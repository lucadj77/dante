import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { flatten } from "../manuscript";
import { Project } from "../project";

function sample() {
  return new MemoryFs({
    "dante.yaml": "title: Test\nlanguage: en\n",
    "Story Bible/Characters/Marta.md": "Seen in [[010 Arrival]] and [[010 Return/020 House|the house]].",
    "Manuscript/010 Return/010 Return.md": "---\nsubtitle: March\n---\n",
    "Manuscript/010 Return/010 Arrival.md": "---\npov: \"[[Marta]]\"\n---\nThe train.",
    "Manuscript/010 Return/020 House.md": "The house.",
    "Manuscript/010 Return/030 Garden.md": "The garden.",
    "Manuscript/020 Letter/010 Envelope.md": "The envelope.",
    "Laboratory/Idea.md": "An idea, about [[Marta]].",
    "Laboratory/Old chapter/Old chapter.md": "---\nkind: chapter\n---\n",
    "Laboratory/Old chapter/010 First.md": "First.",
    "Research/map.png": "PNG",
  });
}

const scenes = (p: Project) => flatten(p.manuscript).map((n) => n.path);

describe("moving and copying to another place", () => {
  it("takes a scene out of the manuscript without its number, fixing links", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const [to] = await p.transfer(["Manuscript/010 Return/020 House.md"], { dir: "Laboratory" }, false);
    expect(to).toBe("Laboratory/House.md");
    expect(fs.files.get("Laboratory/House.md")).toBe("The house.");
    expect(fs.files.get("Story Bible/Characters/Marta.md")).toBe("Seen in [[010 Arrival]] and [[House|the house]].");
  });

  it("brings a note into the manuscript at a chosen place, with a number", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const [to] = await p.transfer(["Laboratory/Idea.md"], { dir: "Manuscript/010 Return", index: 1 }, false);
    expect(to).toBe("Manuscript/010 Return/015 Idea.md");
    expect(fs.files.has("Laboratory/Idea.md")).toBe(false);
    expect(scenes(p).filter((s) => s.startsWith("Manuscript/010 Return/"))).toEqual([
      "Manuscript/010 Return/010 Arrival.md",
      "Manuscript/010 Return/015 Idea.md",
      "Manuscript/010 Return/020 House.md",
      "Manuscript/010 Return/030 Garden.md",
    ]);
  });

  it("moves scenes within the manuscript to a place in another chapter, in order", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const moved = await p.transfer(["Manuscript/010 Return/010 Arrival.md", "Manuscript/010 Return/030 Garden.md"], { dir: "Manuscript/020 Letter", index: 0 }, false);
    expect(p.node("Manuscript/020 Letter").children.map((c) => c.title)).toEqual(["Arrival", "Garden", "Envelope"]);
    expect(moved.map((m) => p.node(m).title)).toEqual(["Arrival", "Garden"]);
    expect(fs.files.get("Story Bible/Characters/Marta.md")).toContain("[[010 Return/020 House|the house]]");
  });

  it("counts the place as it was when moving down in the same chapter", async () => {
    const p = await Project.open(sample());
    // Before Garden, as the list showed: index 2.
    await p.transfer(["Manuscript/010 Return/010 Arrival.md"], { dir: "Manuscript/010 Return", index: 2 }, false);
    expect(p.node("Manuscript/010 Return").children.map((c) => c.title)).toEqual(["House", "Arrival", "Garden"]);
  });

  it("copies a scene beside itself with another title, leaving links to the original", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const [copy] = await p.transfer(["Manuscript/010 Return/020 House.md"], { dir: "Manuscript/010 Return", index: 2 }, true);
    expect(p.node(copy).title).toBe("House 2");
    expect(fs.files.get(copy)).toBe("The house.");
    expect(fs.files.has("Manuscript/010 Return/020 House.md")).toBe(true);
    expect(p.node("Manuscript/010 Return").children.map((c) => c.title)).toEqual(["Arrival", "House", "House 2", "Garden"]);
    expect(fs.files.get("Story Bible/Characters/Marta.md")).toContain("[[010 Return/020 House|the house]]");
  });

  it("copies a scene to a folder, keeping the name free", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    await fs.writeText("Research/House.md", "Notes.");
    const [copy] = await p.transfer(["Manuscript/010 Return/020 House.md"], { dir: "Research" }, true);
    expect(copy).toBe("Research/House 2.md");
    expect(fs.files.get("Research/House.md")).toBe("Notes.");
  });

  it("moves a chapter out and back, with its folder note", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const [out] = await p.transfer(["Manuscript/010 Return"], { dir: "Laboratory" }, false);
    expect(out).toBe("Laboratory/Return");
    expect(fs.files.get("Laboratory/Return/Return.md")).toContain("subtitle: March");
    expect(fs.files.has("Laboratory/Return/010 Arrival.md")).toBe(true);
    const [back] = await p.transfer(["Laboratory/Old chapter"], { dir: "Manuscript", index: 0 }, false);
    expect(back).toBe("Manuscript/010 Old chapter");
    expect(p.node(back).kind).toBe("chapter");
    expect(fs.files.has("Manuscript/010 Old chapter/010 Old chapter.md")).toBe(true);
  });

  it("copies a chapter with all it holds", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    const [copy] = await p.transfer(["Manuscript/010 Return"], { dir: "Manuscript" }, true);
    expect(copy).toBe("Manuscript/030 Return 2");
    expect(fs.files.get("Manuscript/030 Return 2/030 Return 2.md")).toContain("subtitle: March");
    expect(p.node(copy).children.map((c) => c.title)).toEqual(["Arrival", "House", "Garden"]);
    expect(fs.files.has("Manuscript/010 Return/010 Arrival.md")).toBe(true);
  });

  it("copies files of any kind, but only notes and folders go in the manuscript", async () => {
    const fs = sample();
    const p = await Project.open(fs);
    expect(await p.transfer(["Research/map.png"], { dir: "Laboratory" }, true)).toEqual(["Laboratory/map.png"]);
    await expect(p.transfer(["Research/map.png"], { dir: "Manuscript/010 Return" }, false)).rejects.toThrow();
    await expect(p.transfer(["Manuscript/010 Return"], { dir: "Manuscript/010 Return" }, true)).rejects.toThrow();
  });
});
