import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { dayKey, isWritingDay, readLogs, SessionRecorder, streak, wordsByDay } from "../sessions";
import { frequentWords, goalProgress, lengthAnalysis, manuscriptStats, mentions, pageCount, sceneSheets } from "../statistics";
import { parseSettings } from "../settings";

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

  it("measures scenes, chapters and parts in words or characters", async () => {
    const p = await Project.open(
      new MemoryFs({
        "dante.yaml": "title: Test\nlanguage: it\nstructure:\n  parts: true\n",
        "Manoscritto/000 Prologo/000 Prologo.md": "---\nkind: prologue\n---\n",
        "Manoscritto/000 Prologo/010 Inizio.md": "Una parola.",
        "Manoscritto/010 Prima/010 Ritorno/010 Arrivo.md": "Tre parole qui.",
        "Manoscritto/010 Prima/010 Ritorno/020 Casa.md": "Cinque parole sono qui adesso.",
        "Manoscritto/010 Prima/020 Lettera/010 Busta.md": "Due parole.",
        "Manoscritto/020 Seconda/010 Fine/010 Ultima.md": "Quattro parole qui dentro.",
      }),
    );
    const stats = manuscriptStats(p.manuscript, await p.index(), p.settings);
    expect(stats.parts.map((x) => [x.path, x.chapters, x.scenes, x.words])).toEqual([
      ["Manoscritto/010 Prima", 2, 3, 10],
      ["Manoscritto/020 Seconda", 1, 1, 4],
      ["", 1, 1, 2],
    ]);
    const parts = lengthAnalysis(stats, "part", "words");
    expect(parts.rows.map((r) => r.length)).toEqual([10, 4, 2]);
    // The row outside the parts is not a part.
    expect([parts.average, parts.median, parts.shortest?.length, parts.longest?.length]).toEqual([7, 7, 4, 10]);
    const chapters = lengthAnalysis(stats, "chapter", "characters");
    expect(chapters.rows.map((r) => r.length)).toEqual([11, 45, 11, 26]);
    expect(chapters.rows[1].within).toBe(stats.parts[0].title);
    expect(chapters.median).toBe(18.5);
    const scenes = lengthAnalysis(stats, "scene", "words");
    expect(scenes.rows.map((r) => [r.length, r.within])).toEqual([
      [2, chapters.rows[0].title],
      [3, chapters.rows[1].title],
      [5, chapters.rows[1].title],
      [2, chapters.rows[2].title],
      [4, chapters.rows[3].title],
    ]);
    expect(scenes.rows.reduce((n, r) => n + r.share, 0)).toBeCloseTo(1);
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

  it("lists the sheets a scene names or links to, in the order the text names them", async () => {
    const p = await Project.open(sample());
    const index = await p.index();
    const sheets = (text: string, linked: string[] = []) => sceneSheets(text, linked, index, p.settings).map((s) => s.title);
    expect(sheets("Dalla Casa uscì Marta.")).toEqual(["Casa", "Marta Rinaldi"]);
    expect(sheets("Martina e la casa.")).toEqual([]);
    // Linked only, as from a property: after the names.
    expect(sheets("Marta tace.", ["Bibbia/Luoghi/Casa.md"])).toEqual(["Marta Rinaldi", "Casa"]);
  });

  it("lists the most used words, leaving out the common ones", () => {
    expect(frequentWords(["Una busta, una busta, l’amico e la lettera."], "it", 2)).toEqual([
      { word: "busta", count: 2 },
      { word: "amico", count: 1 },
    ]);
  });

  it("tells how much is left before a deadline", () => {
    const today = new Date(2026, 9, 15);
    expect(goalProgress(40000, 80000, "2026-10-24", today)).toEqual({ share: 0.5, remaining: 40000, daysLeft: 10, writingDaysLeft: 10, perDay: 4000 });
    expect(goalProgress(90000, 80000, "", today)).toEqual({ share: 1, remaining: 0, daysLeft: null, writingDaysLeft: null, perDay: null });
    // Monday to Friday: from Thursday 15 to Saturday 24 there are seven writing days.
    expect(goalProgress(40000, 80000, "2026-10-24", today, [1, 2, 3, 4, 5])).toMatchObject({ daysLeft: 10, writingDaysLeft: 7, perDay: 5715 });
  });

  it("counts pages by characters or words", () => {
    const text = { words: 1000, characters: 5400 };
    expect(pageCount(text, { unit: "characters", size: 1800 })).toBe(3);
    expect(pageCount(text, { unit: "words", size: 250 })).toBe(4);
  });

  it("reads page size and writing days from the settings", () => {
    const s = parseSettings("goals:\n  days: [5, 1, 9, 1]\npages:\n  unit: words\n  size: 0\n");
    expect(s.goals.days).toEqual([1, 5]);
    expect(s.pages).toEqual({ unit: "words", size: 250 });
    expect(parseSettings("title: x\n").goals.days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(parseSettings("title: x\n").pages).toEqual({ unit: "characters", size: 1800 });
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

  it("skips rest days in a streak", () => {
    const day = { added: 600, removed: 0, minutes: 30 };
    const byDay = wordsByDay([{ user: "a", days: { "2026-10-09": day, "2026-10-12": day, "2026-10-13": day, "2026-10-14": day } }]);
    // Saturday 10 and Sunday 11 are rest days from Monday to Friday; Thursday 8 ends the run.
    expect(streak(byDay, 500, new Date(2026, 9, 15), [1, 2, 3, 4, 5])).toBe(4);
    expect(streak(byDay, 500, new Date(2026, 9, 15))).toBe(3);
    expect(isWritingDay(new Date(2026, 9, 18), [1, 2, 3, 4, 5])).toBe(false);
    expect(isWritingDay(new Date(2026, 9, 18), [])).toBe(true);
  });
});
