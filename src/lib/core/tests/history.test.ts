import { describe, expect, it } from "vitest";
import { parseCritic } from "../critic";
import { MemoryFs } from "../fs";
import { filterHistory, historyEntry, historyFile, historyPeople, readHistory, recordHistory } from "../history";
import { Project } from "../project";

const text = "La porta era {~~chiusa~>socchiusa~~}{>>@anna 2026-10-14<<}{>>@luca 2026-10-15: meglio?<<}. {==Il vento==}{>>@luca 2026-10-13: troppo presto?<<}";

describe("history of comments and revisions", () => {
  it("records what a settled item said before and after, with its discussion", () => {
    const [change, comment] = parseCritic(text);
    const now = new Date("2026-10-28T10:00:00Z");
    expect(historyEntry(text, change, "accept", "Luca", "M/a.md", now)).toEqual({
      when: "2026-10-28T10:00:00.000Z",
      by: "Luca",
      action: "accept",
      kind: "substitution",
      path: "M/a.md",
      author: "anna",
      date: "2026-10-14",
      before: "chiusa",
      after: "socchiusa",
      discussion: [{ author: "luca", date: "2026-10-15", text: "meglio?" }],
    });
    expect(historyEntry(text, change, "reject", "Luca", "M/a.md", now)).toMatchObject({ before: "chiusa", after: "chiusa" });
    expect(historyEntry(text, comment, "resolve", "Luca", "M/a.md", now)).toMatchObject({ kind: "highlight", before: "Il vento", author: "luca" });
  });

  it("keeps a file for each person, and reads them all, the latest first", async () => {
    const fs = new MemoryFs();
    const [change, comment] = parseCritic(text);
    await recordHistory(fs, [historyEntry(text, change, "accept", "Luca", "M/a.md", new Date("2026-10-20T10:00:00Z"))]);
    await recordHistory(fs, [historyEntry(text, comment, "resolve", "Anna", "M/b.md", new Date("2026-10-27T10:00:00Z"))]);
    await recordHistory(fs, [historyEntry(text, comment, "resolve", "Luca", "M/b.md", new Date("2026-10-28T10:00:00Z"))]);
    expect(historyFile("Luca")).toBe(".dante/history/Luca.jsonl");
    expect((await fs.readText(".dante/history/Luca.jsonl")).trim().split("\n")).toHaveLength(2);
    const all = await readHistory(fs);
    expect(all.map((e) => [e.by, e.path])).toEqual([["Luca", "M/b.md"], ["Anna", "M/b.md"], ["Luca", "M/a.md"]]);
    expect(filterHistory(all, { path: "M/a.md" })).toHaveLength(1);
    expect(filterHistory(all, { person: "anna" })).toHaveLength(2); // settled by Anna, or proposed by anna
    expect(filterHistory(all, { from: "2026-10-21", to: "2026-10-27" }).map((e) => e.by)).toEqual(["Anna"]);
    expect(historyPeople(all)).toEqual(["Anna", "Luca"]);
  });

  it("follows a scene that moves", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: T\nlanguage: it\n", "Manoscritto/010 Uno/010 A.md": "A.", "Manoscritto/010 Uno/020 B.md": "B." });
    const project = await Project.open(fs, "it");
    const [change] = parseCritic(text);
    await recordHistory(fs, [historyEntry(text, change, "accept", "Luca", "Manoscritto/010 Uno/010 A.md")]);
    const moved = await project.rename("Manoscritto/010 Uno/010 A.md", "Arrivo");
    expect(moved).not.toBe("Manoscritto/010 Uno/010 A.md");
    expect((await readHistory(fs))[0].path).toBe(moved);
  });
});
