import { describe, expect, it } from "vitest";
import { today } from "../critic";
import { conflictOf, findConflicts, mergeAsRevisions } from "../conflicts";
import { MemoryFs } from "../fs";
import { holder, presenceFile, readPresence, writePresence, clearPresence } from "../presence";
import { Project } from "../project";

const scene = "Manuscript/010 Return/010 Arrival.md";

describe("conflict copies", () => {
  const has = (...paths: string[]) => (p: string) => paths.includes(p);

  it("recognises the copies of Dropbox, Drive and Syncthing", () => {
    const original = "Manuscript/010 Arrival.md";
    const exists = has(original);
    expect(conflictOf("Manuscript/010 Arrival (Anna's conflicted copy 2026-10-14).md", exists)).toEqual({ original, who: "Anna" });
    expect(conflictOf("Manuscript/010 Arrival (Anna’s conflicted copy).md", exists)?.who).toBe("Anna");
    expect(conflictOf("Manuscript/010 Arrival (copia in conflitto di Anna Neri 2026-10-14).md", exists)).toEqual({ original, who: "Anna Neri" });
    expect(conflictOf("Manuscript/010 Arrival (Conflict 2026-10-14).md", exists)?.original).toBe(original);
    expect(conflictOf("Manuscript/010 Arrival.sync-conflict-20261014-101010-ABCDEFG.md", exists)?.original).toBe(original);
    expect(conflictOf("Manuscript/010 Arrival (1).md", exists)).toEqual({ original, who: null });
  });

  it("needs the original next to the copy", () => {
    expect(conflictOf("Manuscript/010 Arrival (1).md", has())).toBeNull();
    expect(conflictOf("Manuscript/010 The conflict (draft).md", has("Manuscript/010 The.md"))).toBeNull();
    expect(findConflicts(["a.md", "a (Anna's conflicted copy).md", "b.md"]).map((c) => c.path)).toEqual(["a (Anna's conflicted copy).md"]);
  });

  it("writes the differences as revisions", () => {
    expect(mergeAsRevisions("The door was closed.", "The door was open.", "anna", "2026-10-14")).toBe(
      "The door was {--closed.--}{>>@anna 2026-10-14<<}{++open.++}{>>@anna 2026-10-14<<}",
    );
  });

  it("keeps comments and revisions whole when merging", () => {
    const original = "The key still turned{>>@luca 2026-10-14: which lock?<<} in the lock.";
    const copy = "The key still turned in the old lock.";
    expect(mergeAsRevisions(original, copy, "anna", "2026-10-14")).toBe(
      "The key still turned{>>@luca 2026-10-14: which lock?<<} in the{++ old++}{>>@anna 2026-10-14<<} lock.",
    );
  });

  it("keeps copies out of the manuscript and settles them", async () => {
    const copy = "Manuscript/010 Return/010 Arrival (Anna's conflicted copy).md";
    const fs = new MemoryFs({
      [scene]: "---\nstatus: draft\n---\nThe door was closed.",
      [copy]: "---\nstatus: done\n---\nThe door was open.",
    });
    const project = await Project.open(fs);
    expect(project.manuscript.children[0].children.map((c) => c.path)).toEqual([scene]);
    expect(project.conflicts).toEqual([{ path: copy, original: scene, who: "Anna" }]);

    await project.resolveConflict(project.conflicts[0], "merge", "Before merging", "someone");
    expect(fs.files.get(scene)).toBe("---\nstatus: draft\n---\nThe door was {--closed.--}{>>@Anna " + today() + "<<}{++open.++}{>>@Anna " + today() + "<<}");
    expect(fs.files.has(copy)).toBe(false);
    expect([...fs.files.keys()].some((p) => p.startsWith(".trash/"))).toBe(true);
    expect([...fs.files.keys()].some((p) => p.startsWith(".dante/snapshots/") && p.endsWith("Before merging.md"))).toBe(true);
    expect(project.conflicts).toEqual([]);
  });

  it("takes the copy in place of the original", async () => {
    const copy = "Manuscript/010 Return/010 Arrival (1).md";
    const fs = new MemoryFs({ [scene]: "old", [copy]: "new" });
    const project = await Project.open(fs);
    await project.resolveConflict(project.conflicts[0], "copy", "x", "someone");
    expect(fs.files.get(scene)).toBe("new");
    expect(fs.files.has(copy)).toBe(false);
    expect(fs.files.get(".trash/010 Arrival.md")).toBe("old");
  });
});

describe("presence", () => {
  const now = new Date("2026-10-14T10:00:00Z");

  it("names the file after the user", () => {
    expect(presenceFile("Luca Di Gialleonardo")).toBe(".dante/presence/luca-di-gialleonardo.json");
    expect(presenceFile("Niccolò")).toBe(".dante/presence/niccolo.json");
  });

  it("reads other people's fresh presence only", async () => {
    const fs = new MemoryFs();
    await writePresence(fs, { user: "Anna", path: scene, since: "2026-10-14T09:58:00Z", updated: "2026-10-14T09:59:30Z" });
    await writePresence(fs, { user: "Luca", path: scene, since: "2026-10-14T09:59:00Z", updated: "2026-10-14T09:59:30Z" });
    await writePresence(fs, { user: "Old", path: scene, since: null, updated: "2026-10-14T09:00:00Z" });
    await fs.writeText(".dante/presence/broken.json", "{");
    const others = await readPresence(fs, "Luca", now);
    expect(others.map((o) => o.user)).toEqual(["Anna"]);
    await clearPresence(fs, "Anna");
    expect(await readPresence(fs, "Luca", now)).toEqual([]);
  });

  it("lets whoever opened the file first keep it", () => {
    const anna = { user: "Anna", path: scene, since: "2026-10-14T09:58:00Z", updated: "2026-10-14T09:59:30Z" };
    expect(holder([anna], scene, null)?.user).toBe("Anna");
    expect(holder([anna], scene, "2026-10-14T09:59:00Z")?.user).toBe("Anna");
    expect(holder([anna], scene, "2026-10-14T09:57:00Z")).toBeNull();
    expect(holder([anna], "other.md", null)).toBeNull();
  });
});
