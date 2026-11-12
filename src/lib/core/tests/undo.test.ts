import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { Project, StaleUndoError } from "../project";

function sample() {
  return new MemoryFs({
    "dante.yaml": "title: Test\nlanguage: en\n",
    "Story Bible/Characters/Marta.md": "Seen in [[010 Arrival]] and [[010 Return/020 House|the house]].",
    "Manuscript/010 Return/010 Return.md": "---\nsubtitle: March\n---\n",
    "Manuscript/010 Return/010 Arrival.md": "---\npov: \"[[Marta]]\"\n---\nThe train. It was late.",
    "Manuscript/010 Return/020 House.md": "The house.",
    "Manuscript/010 Return/030 Garden.md": "The garden.",
    "Manuscript/020 Letter/010 Envelope.md": "The envelope.",
    "Manuscript/030 End/010 Last.md": "The end.",
    "Laboratory/Idea.md": "An idea, about [[Marta]] in [[020 House]].",
  });
}

/** The writer's files and their text: without the trash and Dante's own records. */
const book = (fs: MemoryFs) => Object.fromEntries([...fs.files].filter(([path]) => !path.startsWith(".")).sort(([a], [b]) => a.localeCompare(b)));

async function undone(change: (p: Project) => Promise<unknown>, kind: string) {
  const fs = sample();
  const p = await Project.open(fs);
  const before = book(fs);
  await change(p);
  expect(book(fs)).not.toEqual(before);
  expect(p.lastChange?.kind).toBe(kind);
  await p.undoLastChange();
  expect(book(fs)).toEqual(before);
  expect(p.lastChange).toBeNull();
}

describe("taking back the last change to the order of the book", () => {
  it("puts a scene back in its chapter, at its place", () => undone((p) => p.move("Manuscript/010 Return/010 Arrival.md", "Manuscript/020 Letter", 1), "move"));

  it("puts a scene back among its siblings", () => undone((p) => p.move("Manuscript/010 Return/030 Garden.md", "Manuscript/010 Return", 0), "move"));

  it("puts a chapter back where it was", () => undone((p) => p.move("Manuscript/010 Return", "Manuscript", 3), "move"));

  it("brings back scenes moved out of the manuscript, with their numbers and links", () =>
    undone((p) => p.transfer(["Manuscript/010 Return/020 House.md", "Manuscript/020 Letter/010 Envelope.md"], { dir: "Laboratory" }, false), "move"));

  it("takes a note back out of the manuscript", () => undone((p) => p.transfer(["Laboratory/Idea.md"], { dir: "Manuscript/010 Return", index: 1 }, false), "move"));

  it("joins a split scene again, with its text as it was", () => undone((p) => p.splitScene("Manuscript/010 Return/010 Arrival.md", "The train. ", "It was late.", "Untitled"), "split"));

  it("undoes a new chapter started in the middle of a scene", () =>
    undone((p) => p.splitChapter("Manuscript/010 Return/010 Arrival.md", "The train. ", "It was late.", "Untitled", "Untitled scene"), "split"));

  it("separates merged scenes again", () => undone((p) => p.mergeScenes(["Manuscript/010 Return/010 Arrival.md", "Manuscript/010 Return/020 House.md"]), "merge"));

  it("keeps what was written in the halves of a split scene", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const created = await p.splitScene("Manuscript/010 Return/010 Arrival.md", "The train. ", "It was late.", "Untitled");
    await p.writeBody(created, "It was very late.");
    await p.undoLastChange();
    expect(fs.files.get("Manuscript/010 Return/010 Arrival.md")).toContain("The train.\n\nIt was very late.");
    expect(fs.files.has(created)).toBe(false);
  });

  it("refuses to separate a merged scene that was written in since", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const kept = await p.mergeScenes(["Manuscript/010 Return/010 Arrival.md", "Manuscript/010 Return/020 House.md"]);
    await p.writeBody(kept, "Something else.");
    await expect(p.undoLastChange()).rejects.toBeInstanceOf(StaleUndoError);
  });

  it("forgets the change once something else moves", async () => {
    const p = await Project.open(sample());
    await p.move("Manuscript/010 Return/010 Arrival.md", "Manuscript/020 Letter", 1);
    await p.createScene("Manuscript/010 Return", 0, "New");
    expect(p.lastChange).toBeNull();
    await p.move("Manuscript/010 Return/030 Garden.md", "Manuscript/010 Return", 0);
    await p.trash("Manuscript/030 End/010 Last.md");
    expect(p.lastChange).toBeNull();
  });

  it("does not offer to take back a copy", async () => {
    const p = await Project.open(sample());
    await p.transfer(["Manuscript/010 Return/020 House.md"], { dir: "Laboratory" }, true);
    expect(p.lastChange).toBeNull();
  });
});
