import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { dayKey, readLogs, SessionRecorder, streak, wordsByDay } from "../sessions";
import { frequentWords, goalProgress, manuscriptStats, mentions } from "../statistics";

function sample() {
  return new MemoryFs({
    "dante.yaml": "title: Test\nlanguage: it\n",
    "Bibbia/Personaggi/Marta Rinaldi.md": "---\naliases: [Marta]\n---\n",
    "Bibbia/Luoghi/Casa.md": "---\ntype: place\n---\n",
    "Modelli/Personaggio.md": "---\ntype: character\n---\n",
    "Manoscritto/010 Ritorno/010 Arrivo.md": "Marta arriva. {--Vecchio--}{++Il treno++} è in ritardo.{>>@anna: Marta?<<}",
    "Manoscritto/010 Ritorno/020 Casa.md": "La casa di Marta Rinaldi. Martina no.",
    "Manoscritto/020 Lettera/010 Busta.md": "Una busta, una busta, una lettera.",
  });
}

describe("statistics", () => {
  it("counts scenes and chapters as read, without comments", async () => {
    const p = await Project.open(sample());
    const stats = manuscriptStats(p.manuscript, await p.index(), p.settings);
    expect(stats.scenes.map((s) => [s.title, s.words])).toEqual([
      ["Arrivo", 7],
      ["Casa", 7],
      ["Busta", 6],
    ]);
    expect(stats.chapters.map((c) => [c.title, c.scenes, c.words])).toEqual([
      ["Capitolo 1: Ritorno", 2, 14],
      ["Capitolo 2: Lettera", 1, 6],
    ]);
    expect(stats.words).toBe(20);
  });

  it("finds the Story Bible notes named in the scenes, by name or alias", async () => {
    const p = await Project.open(sample());
    const index = await p.index();
    const found = mentions(manuscriptStats(p.manuscript, index, p.settings), index, p.settings);
    expect(found.map((m) => [m.title, m.count, m.scenes.length])).toEqual([
      ["Marta Rinaldi", 2, 2],
      ["Casa", 0, 0],
    ]);
  });

  it("lists the most used words, leaving out the common ones", () => {
    expect(frequentWords(["Una busta, una busta, l’amico e la lettera."], "it", 2)).toEqual([
      { word: "busta", count: 2 },
      { word: "amico", count: 1 },
    ]);
  });

  it("tells how much is left before a deadline", () => {
    const today = new Date(2026, 9, 15);
    expect(goalProgress(40000, 80000, "2026-10-24", today)).toEqual({ share: 0.5, remaining: 40000, daysLeft: 10, perDay: 4000 });
    expect(goalProgress(90000, 80000, "", today)).toEqual({ share: 1, remaining: 0, daysLeft: null, perDay: null });
  });
});

describe("writing sessions", () => {
  it("logs the words written today by the person writing", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\n" });
    const p = await Project.open(fs);
    const recorder = new SessionRecorder(fs, "Luca Rossi", 0);
    p.onSceneWritten = (_path, before, after) => void recorder.record(before, after);
    const scene = await p.createScene(p.manuscript.path, 0, "Uno");
    await p.writeBody(scene, "Tre parole qui.");
    await p.writeBody(scene, "Tre parole qui. E altre due.");
    await p.writeBody(scene, "Tre parole.");
    await new Promise((r) => setTimeout(r, 0));
    await recorder.flush();
    const logs = await readLogs(fs);
    expect(logs).toHaveLength(1);
    expect(logs[0].user).toBe("Luca Rossi");
    expect(logs[0].days[dayKey(new Date())]).toMatchObject({ added: 6, removed: 4 });
    expect(fs.files.has(".dante/sessions/luca-rossi.json")).toBe(true);
  });

  it("counts days in a row with the goal reached", () => {
    const byDay = wordsByDay([
      { user: "a", days: { "2026-10-13": { added: 600, removed: 0, minutes: 30 }, "2026-10-14": { added: 300, removed: 0, minutes: 10 } } },
      { user: "b", days: { "2026-10-14": { added: 300, removed: 100, minutes: 10 } } },
    ]);
    expect(byDay.get("2026-10-14")).toBe(500);
    // Today has nothing yet: the streak up to yesterday still counts.
    expect(streak(byDay, 500, new Date(2026, 9, 15))).toBe(2);
    expect(streak(byDay, 600, new Date(2026, 9, 15))).toBe(0);
  });
});
