import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { flatten, headings } from "../manuscript";
import { Project } from "../project";
import { listTrash } from "../trash";

function sample() {
  return new MemoryFs({
    "dante.yaml": "title: Test\nlanguage: en\n",
    "Codex/Marta.md": "Seen in [[010 Arrival]] and [[010 Return/020 House|the house]].",
    "Manuscript/000 Prologue/000 Prologue.md": "---\nkind: prologue\n---\n",
    "Manuscript/000 Prologue/010 The call.md": "Ring.",
    "Manuscript/010 Return/010 Return.md": "---\nsubtitle: March\n---\n",
    "Manuscript/010 Return/010 Arrival.md": "---\npov: \"[[Marta]]\"\n---\nThe train.",
    "Manuscript/010 Return/020 House.md": "The house.",
    "Manuscript/020 Letter/010 Envelope.md": "The envelope.",
    "Manuscript/notes.txt": "ignored",
  });
}

const paths = (p: Project) => flatten(p.manuscript).map((n) => `${n.kind}:${n.path}`);

describe("project", () => {
  it("loads the manuscript tree with kinds, order and folder notes", async () => {
    const p = await Project.open(sample());
    expect(paths(p)).toEqual([
      "manuscript:Manuscript",
      "prologue:Manuscript/000 Prologue",
      "scene:Manuscript/000 Prologue/010 The call.md",
      "chapter:Manuscript/010 Return",
      "scene:Manuscript/010 Return/010 Arrival.md",
      "scene:Manuscript/010 Return/020 House.md",
      "chapter:Manuscript/020 Letter",
      "scene:Manuscript/020 Letter/010 Envelope.md",
    ]);
    expect(p.node("Manuscript/010 Return").notePath).toBe("Manuscript/010 Return/010 Return.md");
  });

  it("numbers chapters but not the prologue", async () => {
    const p = await Project.open(sample());
    const h = headings(p.manuscript, p.settings);
    expect(h.get("Manuscript/000 Prologue")).toBe("Prologue");
    expect(h.get("Manuscript/010 Return")).toBe("Chapter 1: Return");
    expect(h.get("Manuscript/020 Letter")).toBe("Chapter 2: Letter");
  });

  it("reorders scenes renaming only the moved one", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const moved = await p.move("Manuscript/010 Return/020 House.md", "Manuscript/010 Return", 0);
    expect(moved).toBe("Manuscript/010 Return/005 House.md");
    expect(fs.files.has("Manuscript/010 Return/010 Arrival.md")).toBe(true);
    // The link written with a path is updated; the bare one still works.
    expect(fs.files.get("Codex/Marta.md")).toBe("Seen in [[010 Arrival]] and [[005 House|the house]].");
  });

  it("moves a chapter and renames its folder note with it", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const moved = await p.move("Manuscript/010 Return", "Manuscript", 3);
    expect(moved).toBe("Manuscript/030 Return");
    expect(fs.files.get("Manuscript/030 Return/030 Return.md")).toContain("subtitle: March");
    expect(fs.files.has("Manuscript/030 Return/010 Return.md")).toBe(false);
    expect(p.node("Manuscript/030 Return").notePath).toBe("Manuscript/030 Return/030 Return.md");
  });

  it("moves a scene to another chapter", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const moved = await p.move("Manuscript/010 Return/010 Arrival.md", "Manuscript/020 Letter", 1);
    expect(moved).toBe("Manuscript/020 Letter/020 Arrival.md");
    expect(fs.files.get("Manuscript/020 Letter/020 Arrival.md")).toContain("The train.");
    expect(fs.files.get("Codex/Marta.md")).toContain("[[020 Arrival]]");
  });

  it("renames a scene and fixes links", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const to = await p.rename("Manuscript/010 Return/010 Arrival.md", "Station");
    expect(to).toBe("Manuscript/010 Return/010 Station.md");
    expect(fs.files.get("Codex/Marta.md")).toContain("[[010 Station]]");
  });

  it("writes open editors before files move, and tells where they went", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const order: string[] = [];
    let moved: ((path: string) => string) | null = null;
    p.beforeMove = async () => {
      order.push("before");
    };
    p.onMoved = (m) => {
      order.push("after");
      moved = m;
    };
    await p.rename("Manuscript/010 Return", "Coming back");
    expect(order).toEqual(["before", "after"]);
    expect(moved!("Manuscript/010 Return/010 Arrival.md")).toBe("Manuscript/010 Coming back/010 Arrival.md");
    expect(moved!("Manuscript/010 Return")).toBe("Manuscript/010 Coming back");
    expect(moved!("Codex/Marta.md")).toBe("Codex/Marta.md");
  });

  it("splits a scene at the cursor", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const created = await p.splitScene("Manuscript/010 Return/010 Arrival.md", "The train.\n", "It was late.", "Untitled");
    expect(created).toBe("Manuscript/010 Return/015 Untitled.md");
    expect(fs.files.get("Manuscript/010 Return/010 Arrival.md")).toBe("---\npov: \"[[Marta]]\"\n---\nThe train.\n");
    expect(fs.files.get(created)).toBe("It was late.");
  });

  it("does not log the text a split moves to the new scene as deleted", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const log: [number, number][] = [];
    p.onSceneWritten = (_path, before, after) => log.push([before, after]);
    // "The train." was saved; "It was late." is typed and split off at once.
    await p.splitScene("Manuscript/010 Return/010 Arrival.md", "The train.\n", "It was late.", "Untitled");
    expect(log).toEqual([[2, 5]]);
  });

  it("merges scenes into the first in reading order, sending the others to the trash", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const kept = await p.mergeScenes(["Manuscript/020 Letter/010 Envelope.md", "Manuscript/010 Return/010 Arrival.md", "Manuscript/010 Return/020 House.md"]);
    expect(kept).toBe("Manuscript/010 Return/010 Arrival.md");
    expect(fs.files.get(kept)).toBe("---\npov: \"[[Marta]]\"\n---\nThe train.\n\nThe house.\n\nThe envelope.\n");
    expect(paths(p)).not.toContain("scene:Manuscript/010 Return/020 House.md");
    expect(fs.files.has(".trash/020 House.md")).toBe(true);
    expect(fs.files.get("Codex/Marta.md")).toBe("Seen in [[010 Arrival]] and [[010 Arrival|the house]].");
  });

  it("does not merge a scene that has a conflict copy", async () => {
    const fs = sample();
    fs.files.set("Manuscript/010 Return/020 House (Anna's conflicted copy 2026-10-14).md", "The house!");
    const p = await Project.open(fs);
    await expect(p.mergeScenes(["Manuscript/010 Return/010 Arrival.md", "Manuscript/010 Return/020 House.md"])).rejects.toThrow("conflict");
    expect(fs.files.get("Manuscript/010 Return/020 House.md")).toBe("The house.");
  });

  it("starts a chapter, not a part, after a prologue in a novel with parts", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nlanguage: en\nstructure:\n  parts: true\n",
      "Manuscript/000 Prologue/000 Prologue.md": "---\nkind: prologue\n---\n",
      "Manuscript/000 Prologue/010 The call.md": "Ring.",
      "Manuscript/010 One/010 One.md": "---\nkind: part\n---\n",
    });
    const p = await Project.open(fs);
    await p.splitChapter("Manuscript/000 Prologue/010 The call.md", "Ring.", "Silence.", "Untitled", "Untitled");
    expect(paths(p)).toContain("chapter:Manuscript/005 Untitled");
  });

  it("starts a new chapter at the cursor, taking the following scenes", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const first = await p.splitChapter("Manuscript/010 Return/010 Arrival.md", "The train.", "Later.", "Untitled", "Untitled");
    expect(first).toBe("Manuscript/015 Untitled/010 Untitled 2.md");
    expect(paths(p)).toEqual([
      "manuscript:Manuscript",
      "prologue:Manuscript/000 Prologue",
      "scene:Manuscript/000 Prologue/010 The call.md",
      "chapter:Manuscript/010 Return",
      "scene:Manuscript/010 Return/010 Arrival.md",
      "chapter:Manuscript/015 Untitled",
      "scene:Manuscript/015 Untitled/010 Untitled 2.md",
      "scene:Manuscript/015 Untitled/020 House.md",
      "chapter:Manuscript/020 Letter",
      "scene:Manuscript/020 Letter/010 Envelope.md",
    ]);
  });

  it("creates unique titles", async () => {
    const p = await Project.open(sample());
    const a = await p.createScene("Manuscript/020 Letter", 1, "Untitled");
    const b = await p.createScene("Manuscript/020 Letter", 2, "Untitled");
    expect(a).toBe("Manuscript/020 Letter/020 Untitled.md");
    expect(b).toBe("Manuscript/020 Letter/030 Untitled 2.md");
  });

  it("writes container properties into the folder note", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    await p.setProperties("Manuscript/020 Letter", { status: "draft" });
    expect(fs.files.get("Manuscript/020 Letter/020 Letter.md")).toBe("---\nstatus: draft\n---\n");
    expect(await p.properties("Manuscript/020 Letter")).toEqual({ status: "draft" });
  });

  it("swaps two scenes even with the same title", async () => {
    const fs = new MemoryFs({ "Manuscript/010 A/010 Same.md": "one", "Manuscript/010 A/020 Same.md": "two" });
    const p = await Project.open(fs);
    await p.move("Manuscript/010 A/020 Same.md", "Manuscript/010 A", 0);
    expect(fs.files.get("Manuscript/010 A/005 Same.md")).toBe("two");
    expect(fs.files.get("Manuscript/010 A/010 Same.md")).toBe("one");
  });
});

describe("new project", () => {
  it("creates settings, section folders and a first scene in the novel's language", async () => {
    const fs = new MemoryFs({});
    const { project, scene } = await Project.create(fs, { title: "Il faro", authors: ["Luca"], language: "it" }, { chapter: "Senza titolo", scene: "Senza titolo" });
    expect(project.settings.title).toBe("Il faro");
    expect(project.settings.structure.chapter.label).toBe("Capitolo");
    expect(scene).toBe("Manoscritto/010 Senza titolo/010 Senza titolo 2.md");
    // The scene is not taken for the chapter's folder note.
    expect(project.manuscript.children[0].children.map((c) => c.path)).toEqual([scene]);
    expect(await fs.exists("Ricerca")).toBe(true);
    expect(await fs.readText("dante.yaml")).toContain("title: Il faro");
  });
});

describe("trash", () => {
  it("moves scenes and chapters to .trash without overwriting", async () => {
    const fs = new MemoryFs({
      "Manuscript/010 A/010 One.md": "one",
      "Manuscript/010 A/020 Two.md": "two",
      "Manuscript/020 B/010 One.md": "other",
    });
    const p = await Project.open(fs);
    expect(await p.trash("Manuscript/010 A/010 One.md")).toBe(".trash/010 One.md");
    expect(await p.trash("Manuscript/020 B/010 One.md")).toBe(".trash/010 One 2.md");
    expect(await p.trash("Manuscript/010 A")).toBe(".trash/010 A");
    expect(fs.files.get(".trash/010 A/020 Two.md")).toBe("two");
    expect(p.manuscript.children.map((c) => c.path)).toEqual(["Manuscript/020 B"]);
  });

  it("lists what it holds and puts it back where it was", async () => {
    const fs = new MemoryFs({
      "Manuscript/010 A/010 One.md": "one",
      "Manuscript/010 A/020 Two.md": "two",
      ".trash/Old note.md": "deleted in Obsidian",
    });
    const p = await Project.open(fs);
    await p.trash("Manuscript/010 A/010 One.md");
    await p.trash("Manuscript/010 A");
    const items = await listTrash(fs);
    expect(items.map((i) => [i.name, i.from])).toEqual([
      ["010 A", "Manuscript/010 A"],
      ["010 One.md", "Manuscript/010 A/010 One.md"],
      ["Old note.md", null],
    ]);
    // The chapter first, then its scene back inside it; the note of unknown origin to the Laboratory.
    expect(await p.restore(items[0])).toBe("Manuscript/010 A");
    expect(await p.restore(items[1])).toBe("Manuscript/010 A/010 One.md");
    expect(await p.restore(items[2])).toBe("Laboratory/Old note.md");
    expect(p.manuscript.children[0].children.map((c) => c.path)).toEqual(["Manuscript/010 A/010 One.md", "Manuscript/010 A/020 Two.md"]);
    expect(await listTrash(fs)).toEqual([]);
  });

  it("restores under another name when the place is taken, and deletes for good", async () => {
    const fs = new MemoryFs({ "Manuscript/010 A/010 One.md": "one", "Manuscript/010 A/020 Two.md": "two" });
    const p = await Project.open(fs);
    await p.trash("Manuscript/010 A/010 One.md");
    fs.files.set("Manuscript/010 A/010 One.md", "new one");
    const [item] = await listTrash(fs);
    expect(await p.restore(item)).toBe("Manuscript/010 A/010 One 2.md");
    await p.trash("Manuscript/010 A/020 Two.md");
    await p.deleteForever(await listTrash(fs));
    expect(await listTrash(fs)).toEqual([]);
    expect([...fs.files.keys()].some((f) => f.includes("Two"))).toBe(false);
  });

  it("notes where merged scenes went", async () => {
    const fs = new MemoryFs({ "Manuscript/010 A/010 One.md": "one", "Manuscript/010 A/020 Two.md": "two" });
    const p = await Project.open(fs);
    await p.mergeScenes(["Manuscript/010 A/010 One.md", "Manuscript/010 A/020 Two.md"]);
    expect((await listTrash(fs)).map((i) => i.from)).toEqual(["Manuscript/010 A/020 Two.md"]);
  });
});

describe("new project with earlier choices", () => {
  it("starts from them, keeping its own language's labels", async () => {
    const earlier = await Project.create(new MemoryFs({}), { title: "A", authors: ["L"], language: "en" }, { chapter: "C", scene: "S" });
    const prefs = {
      structure: { ...earlier.project.settings.structure, chapter: { ...earlier.project.settings.structure.chapter, numbering: "ordinal" as const } },
      docx: { ...earlier.project.settings.export.docx, pageSize: "15x21" as const, font: "Garamond" },
      typography: { ...earlier.project.settings.export.typography, quotes: "dash" as const },
      revisions: "reject" as const,
    };
    const { project } = await Project.create(new MemoryFs({}), { title: "B", authors: ["L"], language: "it" }, { chapter: "C", scene: "S" }, prefs);
    expect(project.settings.export.docx.pageSize).toBe("15x21");
    expect(project.settings.export.docx.font).toBe("Garamond");
    expect(project.settings.export.typography.quotes).toBe("dash");
    expect(project.settings.export.revisions).toBe("reject");
    expect(project.settings.structure.chapter.numbering).toBe("ordinal");
    expect(project.settings.structure.chapter.label).toBe("Capitolo");
  });
});

describe("unnumbered chapters", () => {
  it("shows only the title and does not count them", async () => {
    const fs = new MemoryFs({
      "Manuscript/000 Prologo/000 Prologo.md": "---\nkind: prologue\n---\n",
      "Manuscript/000 Prologo/010 A.md": "",
      "Manuscript/010 Uno/010 B.md": "",
      "Manuscript/020 Interludio/020 Interludio.md": "---\nnumbered: false\n---\n",
      "Manuscript/020 Interludio/010 C.md": "",
      "Manuscript/030 Due/010 D.md": "",
    });
    const project = await Project.open(fs);
    expect([...headings(project.manuscript, project.settings).values()]).toEqual(["Prologo", "Chapter 1: Uno", "Interludio", "Chapter 2: Due"]);
  });
});

describe("own titles", () => {
  it("uses the title property for headings and keeps file names when moving", async () => {
    const fs = sample();
    fs.files.set("Manuscript/010 Return/010 Return.md", "---\ntitle: The return home\n---\n");
    fs.files.set("Manuscript/010 Return/020 House.md", "---\ntitle: The old house\n---\nThe house.");
    const p = await Project.open(fs);
    expect(headings(p.manuscript, p.settings).get("Manuscript/010 Return")).toBe("Chapter 1: The return home");
    const house = p.node("Manuscript/010 Return/020 House.md");
    expect([house.title, house.fileTitle]).toEqual(["The old house", "House"]);
    const moved = await p.move("Manuscript/010 Return/020 House.md", "Manuscript/010 Return", 0);
    expect(moved).toBe("Manuscript/010 Return/005 House.md");
  });

  it("sets and clears a title without renaming the file", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    await p.retitle("Manuscript/020 Letter", "A letter from Elena");
    expect(p.node("Manuscript/020 Letter").title).toBe("A letter from Elena");
    expect(fs.files.get("Manuscript/020 Letter/020 Letter.md")).toContain("title: A letter from Elena");
    await p.retitle("Manuscript/020 Letter", "Letter");
    expect(p.node("Manuscript/020 Letter").title).toBe("Letter");
    expect(fs.files.get("Manuscript/020 Letter/020 Letter.md")).not.toContain("title:");
  });
});
