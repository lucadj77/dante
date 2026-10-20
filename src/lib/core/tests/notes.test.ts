import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { noteTitle, noteType } from "../notes";
import { Project } from "../project";
import { parseSettings, serializeSettings } from "../settings";

function sample() {
  return new MemoryFs({
    "dante.yaml": "title: Test\nlanguage: en\n",
    "Codex/Characters/Marta Rinaldi.md": "---\naliases: [Marta]\nrole: protagonist\n---\nMarta returns home.\n",
    "Codex/Places/Rinaldi House.md": "---\ntype: place\n---\nA stone house. Marta's mother lived here.\n",
    "Codex/Elsewhere.md": "---\ntype: Character\n---\nA minor one.\n",
    "Research/Harbours.md": "Fishing harbours of Liguria, near [[Rinaldi House]].\n",
    "Research/map.pdf": "%PDF",
    "Laboratory/Outline.md": "1. [[Marta Rinaldi|Marta]] arrives\n2. She opens [[Missing note]]\n",
    "Manuscript/010 Return/010 Arrival.md": "---\npov: \"[[Marta Rinaldi|Marta]]\"\n---\nThe train. Città di mare.",
  });
}

describe("note types", () => {
  it("renames an old Codex folder to the language's name, links and settings too", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nlanguage: it\nfolders:\n  codex: Codex\n",
      "Codex/Personaggi/Marta.md": "",
      "Ricerca/Note.md": "See [[Codex/Personaggi/Marta]] and [[Marta]].",
    });
    const p = await Project.open(fs);
    expect(await p.renameSectionFolder("codex", "Bibbia")).toBe("Bibbia");
    expect(p.settings.folders.codex).toBe("Bibbia");
    expect(fs.files.get("Ricerca/Note.md")).toBe("See [[Marta]] and [[Marta]].");
    expect(fs.files.get("dante.yaml")).toContain("codex: Bibbia");
  });

  it("an Italian project keeps its Codex folder, though new ones get a Bibbia", async () => {
    const p = await Project.open(new MemoryFs({ "dante.yaml": "title: Test\nlanguage: it\n", "Codex/Marta.md": "" }));
    expect(p.settings.folders.codex).toBe("Codex");
    const fresh = await Project.open(new MemoryFs({ "dante.yaml": "title: Test\nlanguage: it\n" }));
    expect(fresh.settings.folders.codex).toBe("Bibbia");
  });

  it("comes from the type property or from the Codex folder", async () => {
    const p = await Project.open(sample());
    const index = await p.index();
    const of = (path: string) => noteType(path, index.notes.get(path)!.properties, p.settings);
    expect(of("Codex/Characters/Marta Rinaldi.md")).toBe("character");
    expect(of("Codex/Places/Rinaldi House.md")).toBe("place");
    // By name, in any case, outside the type's folder.
    expect(of("Codex/Elsewhere.md")).toBe("character");
    expect(of("Research/Harbours.md")).toBeNull();
  });

  it("keeps an unknown type as written", () => {
    const settings = parseSettings("language: en\n");
    expect(noteType("Research/x.md", { type: "Spaceship" }, settings)).toBe("Spaceship");
  });

  it("are read from dante.yaml, replacing the defaults, and written back whole", () => {
    const settings = parseSettings("language: it\ntypes:\n  character:\n    name: Personaggio\n    folder: Personaggi\n    properties: [ruolo]\n  ship:\n    name: Nave\n");
    expect(Object.keys(settings.types)).toEqual(["character", "ship"]);
    expect(settings.types.ship).toEqual({ name: "Nave", folder: "Nave", icon: "", properties: [] });
    delete settings.types.ship;
    const again = parseSettings(serializeSettings(settings, "language: it\ntypes:\n  ship:\n    name: Nave\n"));
    expect(Object.keys(again.types)).toEqual(["character"]);
  });

  it("default to the novel's language", () => {
    const settings = parseSettings("language: it\n");
    expect(settings.types.character.folder).toBe("Personaggi");
    expect(settings.types.place.properties).toContain("regione");
  });
});

describe("note index", () => {
  it("finds backlinks, from properties and text, with their lines", async () => {
    const p = await Project.open(sample());
    const index = await p.index();
    const back = index.backlinks("Codex/Characters/Marta Rinaldi.md");
    expect(back.map((b) => b.from)).toEqual(["Laboratory/Outline.md", "Manuscript/010 Return/010 Arrival.md"]);
    expect(back[0].lines).toEqual(["1. [[Marta Rinaldi|Marta]] arrives"]);
    expect(index.unresolved("Laboratory/Outline.md")).toEqual(["Missing note"]);
  });

  it("follows saved text", async () => {
    const p = await Project.open(sample());
    await p.index();
    await p.writeBody("Research/Harbours.md", "Nothing linked now.\n");
    expect((await p.index()).backlinks("Codex/Places/Rinaldi House.md")).toEqual([]);
  });

  it("searches names, aliases and text, ignoring case and accents", async () => {
    const p = await Project.open(sample());
    const index = await p.index();
    expect(index.search("marta").map((r) => r.path)).toEqual([
      "Codex/Characters/Marta Rinaldi.md",
      "Laboratory/Outline.md",
      "Codex/Places/Rinaldi House.md",
    ]);
    expect(index.search("citta")[0]).toMatchObject({ path: "Manuscript/010 Return/010 Arrival.md", title: "Arrival" });
    expect(index.search("map")[0].path).toBe("Research/map.pdf");
    expect(index.search("stone house")[0].snippet).toContain("A stone house");
  });

  it("titles keep the order prefix outside the manuscript", () => {
    expect(noteTitle("Research/2024 Trip.md", "Manuscript")).toBe("2024 Trip");
    expect(noteTitle("Manuscript/010 Arrival.md", "Manuscript")).toBe("Arrival");
    expect(noteTitle("Research/map.pdf")).toBe("map.pdf");
  });
});

describe("notes outside the manuscript", () => {
  it("creates notes and folders with free names", async () => {
    const p = await Project.open(sample());
    expect(await p.createNote("Research", "Harbours")).toBe("Research/Harbours 2.md");
    expect(await p.createFolder("Research", "Maps")).toBe("Research/Maps");
    expect(p.folders).toContain("Research/Maps");
  });

  it("creates a typed note from its template or from the suggested properties", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const plain = await p.createTyped("object", "The key");
    expect(plain).toBe("Codex/Objects/The key.md");
    expect(await fs.readText(plain)).toBe("---\ntype: object\nowner: \"\"\n---\n\n");
    await fs.writeText("Templates/Character.md", "---\nrole:\n---\n# {{title}}\n");
    const typed = await p.createTyped("character", "Anna");
    expect(await fs.readText(typed)).toBe("---\nrole:\ntype: character\n---\n# Anna\n");
    // A title is written as it is, "$" included.
    expect(await fs.readText(await p.createTyped("character", "Mr $& Big $$"))).toContain("# Mr $& Big $$\n");
  });

  it("scans folders called like the skipped ones inside the project's folders", async () => {
    const fs = sample();
    await fs.writeText("Research/export/notes.md", "hello");
    const p = await Project.open(fs);
    expect(p.files).toContain("Research/export/notes.md");
  });

  it("renames and moves files and folders, fixing links", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    expect(await p.renamePath("Codex/Places/Rinaldi House.md", "Casa Rinaldi")).toBe("Codex/Places/Casa Rinaldi.md");
    expect(await fs.readText("Research/Harbours.md")).toContain("[[Casa Rinaldi]]");
    expect(await p.renamePath("Research/map.pdf", "Liguria")).toBe("Research/Liguria.pdf");
    expect(await p.movePath("Codex/Characters", "Research")).toBe("Research/Characters");
    expect(await fs.exists("Research/Characters/Marta Rinaldi.md")).toBe(true);
    await expect(p.movePath("Research", "Research/Characters")).rejects.toThrow();
  });

  it("moves anything to the trash", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    expect(await p.trash("Research/map.pdf")).toBe(".trash/map.pdf");
    await fs.writeText("Research/map.pdf", "%PDF");
    expect(await p.trash("Research/map.pdf")).toBe(".trash/map 2.pdf");
    expect(await p.trash("Laboratory")).toBe(".trash/Laboratory");
    expect(p.files.some((f) => f.startsWith(".trash"))).toBe(false);
  });
});

describe("type definitions", () => {
  it("are added and removed in dante.yaml", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const id = p.typeId("Navi spaziali");
    expect(id).toBe("navi-spaziali");
    await p.setType(id, { name: "Navi spaziali", folder: "Navi", icon: "🚀", properties: ["equipaggio"] });
    expect((await Project.open(fs)).settings.types[id].icon).toBe("🚀");
    await p.setType("character", null);
    expect("character" in (await Project.open(fs)).settings.types).toBe(false);
    expect(p.typeId("Place")).toBe("place-2");
  });
});
