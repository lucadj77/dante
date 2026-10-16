import { beforeEach, describe, expect, it } from "vitest";

// The tests run outside a browser: a storage in memory stands in for the app's.
const stored = new Map<string, string>();
globalThis.localStorage ??= {
  getItem: (k: string) => stored.get(k) ?? null,
  setItem: (k: string, v: string) => void stored.set(k, v),
  removeItem: (k: string) => void stored.delete(k),
  clear: () => stored.clear(),
  key: (i: number) => [...stored.keys()][i] ?? null,
  get length() {
    return stored.size;
  },
} as Storage;
const { closePane, dropMissing, followMoves, loadPanes, MAX_PANES, openBeside, panes, SCENE_SHEETS, togglePin, toggleSceneSheets } = await import("../../ui/panes.svelte");

describe("panes beside a section", () => {
  beforeEach(() => {
    localStorage.clear();
    loadPanes("test");
  });

  const paths = () => panes.list.map((p) => p.path);

  it("replaces the pane not pinned, and opens another only beside pinned ones", () => {
    openBeside("A.md");
    openBeside("B.md");
    expect(paths()).toEqual(["B.md"]);
    togglePin(panes.list[0].id);
    openBeside("C.md");
    expect(paths()).toEqual(["B.md", "C.md"]);
    // Already shown: it gets the cursor, nothing changes.
    const id = openBeside("B.md");
    expect(panes.focus).toBe(id);
    expect(paths()).toEqual(["B.md", "C.md"]);
    togglePin(panes.list[1].id);
    openBeside("D.md");
    expect(paths()).toHaveLength(MAX_PANES);
    expect(paths()).toEqual(["B.md", "D.md"]);
  });

  it("is remembered for the project, follows renames and closes with deleted items", () => {
    openBeside("Codex/Maria.md");
    toggleSceneSheets();
    expect(paths()).toEqual(["Codex/Maria.md", SCENE_SHEETS]);
    expect(panes.list[1].pinned).toBe(true);
    loadPanes("other");
    expect(paths()).toEqual([]);
    loadPanes("test");
    expect(paths()).toEqual(["Codex/Maria.md", SCENE_SHEETS]);

    followMoves((p) => (p === "Codex/Maria.md" ? "Codex/Maria Rossi.md" : p));
    expect(paths()).toEqual(["Codex/Maria Rossi.md", SCENE_SHEETS]);
    dropMissing(() => false);
    expect(paths()).toEqual([SCENE_SHEETS]);
    toggleSceneSheets();
    expect(paths()).toEqual([]);
    openBeside("x.md");
    closePane(panes.list[0].id);
    expect(paths()).toEqual([]);
  });
});
