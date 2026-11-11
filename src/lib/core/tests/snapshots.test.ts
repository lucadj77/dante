import { describe, expect, it } from "vitest";
import { diffWords } from "../diff";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { cleanSnapshots, listSnapshots, restoreSnapshot, takeSnapshot } from "../snapshots";

const scene = "Manuscript/010 Return/010 Arrival.md";

describe("snapshots", () => {
  it("takes, lists and skips identical automatic snapshots", async () => {
    const fs = new MemoryFs({ [scene]: "v1" });
    const first = await takeSnapshot(fs, scene, null, new Date(2026, 9, 13, 18, 40, 5));
    expect(first?.path).toBe(".dante/snapshots/Manuscript/010 Return/010 Arrival/2026-10-13T18-40-05.md");
    expect(await takeSnapshot(fs, scene, null, new Date(2026, 9, 13, 19))).toBeNull();
    await fs.writeText(scene, "v2");
    await takeSnapshot(fs, scene, "First draft", new Date(2026, 9, 14, 9));
    const list = await listSnapshots(fs, scene);
    expect(list.map((s) => s.name)).toEqual(["First draft", null]);
  });

  it("restores, keeping the current text as a snapshot", async () => {
    const fs = new MemoryFs({ [scene]: "old" });
    const snap = await takeSnapshot(fs, scene, "keep", new Date(2026, 0, 1));
    await fs.writeText(scene, "new");
    await restoreSnapshot(fs, scene, snap!.path);
    expect(fs.files.get(scene)).toBe("old");
    const texts = await Promise.all((await listSnapshots(fs, scene)).map((s) => fs.readText(s.path)));
    expect(texts).toContain("new");
  });

  it("cleans automatic snapshots before a date and keeps named ones", async () => {
    const fs = new MemoryFs({ [scene]: "a" });
    await takeSnapshot(fs, scene, null, new Date(2026, 0, 1));
    await fs.writeText(scene, "b");
    await takeSnapshot(fs, scene, "Named", new Date(2026, 0, 2));
    await fs.writeText(scene, "c");
    await takeSnapshot(fs, scene, null, new Date(2026, 5, 1));
    expect(await cleanSnapshots(fs, new Date(2026, 2, 1))).toBe(1);
    expect((await listSnapshots(fs, scene)).map((s) => s.name)).toEqual([null, "Named"]);
  });

  it("follows the scene when it is moved", async () => {
    const fs = new MemoryFs({ [scene]: "text", "Manuscript/010 Return/020 House.md": "house" });
    await takeSnapshot(fs, scene, "Draft", new Date(2026, 0, 1));
    const p = await Project.open(fs);
    const moved = await p.move(scene, "Manuscript/010 Return", 2);
    expect(moved).toBe("Manuscript/010 Return/030 Arrival.md");
    expect((await listSnapshots(fs, moved)).map((s) => s.name)).toEqual(["Draft"]);
  });
});

describe("diffWords", () => {
  it("marks added and removed words", () => {
    const parts = diffWords("The door was closed.", "The door was half open.");
    expect(parts).toEqual([
      { type: "same", text: "The door was " },
      { type: "removed", text: "closed." },
      { type: "added", text: "half open." },
    ]);
  });
});

describe("snapshots when everything is renumbered", () => {
  it("keeps each scene's snapshots", async () => {
    const fs = new MemoryFs({ "Manuscript/010 A.md": "a", "Manuscript/011 B.md": "b" });
    await takeSnapshot(fs, "Manuscript/010 A.md", "A", new Date(2026, 0, 1));
    await takeSnapshot(fs, "Manuscript/011 B.md", "B", new Date(2026, 0, 1));
    const p = await Project.open(fs);
    // No room between 10 and 11: all scenes are renumbered.
    const created = await p.createScene("Manuscript", 1, "C");
    expect(created).toBe("Manuscript/020 C.md");
    expect((await listSnapshots(fs, "Manuscript/010 A.md")).map((s) => s.name)).toEqual(["A"]);
    expect((await listSnapshots(fs, "Manuscript/030 B.md")).map((s) => s.name)).toEqual(["B"]);
  });
});

describe("snapshots of the whole manuscript", () => {
  it("takes every scene under one name, and puts back only what changed", async () => {
    const { takeWholeSnapshot, listWholeSnapshots, restoreWholeSnapshot, deleteWholeSnapshot } = await import("../snapshots");
    const a = "Manuscript/010 Uno/010 A.md";
    const b = "Manuscript/010 Uno/020 B.md";
    const fs = new MemoryFs({ [a]: "Prima A.", [b]: "Prima B." });
    const taken = await takeWholeSnapshot(fs, [a, b], "Prima stesura", new Date(2026, 10, 11, 18, 40, 5));
    expect(taken).toMatchObject({ id: "2026-11-11T18-40-05 Prima stesura", name: "Prima stesura", scenes: 2 });
    // Each scene shows it among its own snapshots.
    expect((await listSnapshots(fs, a)).map((s) => s.name)).toEqual(["Prima stesura"]);
    await fs.writeText(a, "Dopo A.");
    await fs.writeText("Manuscript/010 Uno/030 C.md", "Nuova.");
    const scenes = [a, b, "Manuscript/010 Uno/030 C.md"];
    expect(await listWholeSnapshots(fs)).toMatchObject([{ name: "Prima stesura", scenes: 2 }]);
    expect(await restoreWholeSnapshot(fs, scenes, taken.id)).toBe(1);
    expect(await fs.readText(a)).toBe("Prima A.");
    expect(await fs.readText("Manuscript/010 Uno/030 C.md")).toBe("Nuova.");
    // What was there before going back is kept as a snapshot of its own.
    expect(await Promise.all((await listSnapshots(fs, a)).map((s) => fs.readText(s.path)))).toContain("Dopo A.");
    await deleteWholeSnapshot(fs, scenes, taken.id);
    expect(await listWholeSnapshots(fs)).toEqual([]);
    expect((await listSnapshots(fs, b)).length).toBe(0);
  });
});
