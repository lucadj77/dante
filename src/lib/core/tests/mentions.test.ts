import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { bibleNames, NameMatcher, namedNotes, scenesNaming } from "../mentions";
import { Project } from "../project";

const files = {
  "dante.yaml": "title: T\nlanguage: it\n",
  "Bibbia/Personaggi/Lucia Mondella.md": "---\ntype: character\naliases: [Lucia]\n---\n",
  "Bibbia/Personaggi/Marta.md": "---\ntype: character\n---\n",
  "Bibbia/Luoghi/Casa.md": "---\ntype: place\n---\n",
  "Manoscritto/010 Uno/010 A.md": "Lucia guarda Martina. Poi [[Marta]] entra in casa con Lucia Mondella.",
  "Manoscritto/010 Uno/020 B.md": "Nessuno qui. `Lucia` {>>@a: Lucia?<<}",
};

describe("names of the Story Bible in the text", () => {
  it("are whole words written as the note writes them, outside links, comments and code", async () => {
    const project = await Project.open(new MemoryFs(files), "it");
    const index = await project.index();
    const names = bibleNames(index, project.settings);
    const matcher = new NameMatcher(names);
    const text = index.notes.get("Manoscritto/010 Uno/010 A.md")!.body;
    expect(matcher.find(text).map((f) => [f.name, f.path, text.slice(f.from, f.to)])).toEqual([
      ["Lucia", "Bibbia/Personaggi/Lucia Mondella.md", "Lucia"],
      ["Lucia Mondella", "Bibbia/Personaggi/Lucia Mondella.md", "Lucia Mondella"],
    ]);
    expect(matcher.find(index.notes.get("Manoscritto/010 Uno/020 B.md")!.body)).toEqual([]);
    expect(namedNotes(text, matcher)).toEqual([{ path: "Bibbia/Personaggi/Lucia Mondella.md", count: 2 }]);
    expect(namedNotes(text, matcher, ["Bibbia/Personaggi/Lucia Mondella.md"])).toEqual([]);
    expect(scenesNaming("Bibbia/Personaggi/Lucia Mondella.md", index, project.settings, names)).toEqual([{ path: "Manoscritto/010 Uno/010 A.md", count: 2 }]);
    expect(scenesNaming("Bibbia/Personaggi/Marta.md", index, project.settings, names)).toEqual([]);
  });

  it("leave out a name two notes share", () => {
    const matcher = new NameMatcher([
      { name: "Anna", path: "a.md", type: "character" },
      { name: "Anna", path: "b.md", type: "character" },
      { name: "Bruno", path: "c.md", type: "character" },
    ]);
    expect(matcher.find("Anna e Bruno").map((f) => f.name)).toEqual(["Bruno"]);
  });
});

describe("the novel's own words", () => {
  it("takes the words of names and aliases, and those the writer added", async () => {
    const { knownWords, findKnownWords } = await import("../mentions");
    const known = knownWords([{ name: "Lucia Mondella", path: "a", type: "character" }, { name: "l'Innominato", path: "b", type: "character" }], ["bravi", "Pescarenico"]);
    expect([...known].sort()).toEqual(["Innominato", "Lucia", "Mondella", "Pescarenico", "bravi"]);
    const text = "Lucia vide i bravi dell'Innominato; lucia no.";
    expect(findKnownWords(text, known).map((r) => text.slice(r.from, r.to))).toEqual(["Lucia", "bravi", "Innominato"]);
  });

  it("is kept in dante.yaml, and leaves it when empty", async () => {
    const { parseSettings, serializeSettings } = await import("../settings");
    const settings = parseSettings("title: T\ndictionary:\n  - bravi\n  - bravi\n  - ' Pescarenico '\n");
    expect(settings.dictionary).toEqual(["bravi", "Pescarenico"]);
    expect(serializeSettings(settings, "title: T\n")).toContain("dictionary:\n  - bravi\n  - Pescarenico");
    expect(serializeSettings({ ...settings, dictionary: [] }, "title: T\ndictionary:\n  - bravi\n")).not.toContain("dictionary");
  });
});
