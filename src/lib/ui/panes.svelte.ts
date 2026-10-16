// The panes beside a section: a scene, a chapter, a Codex sheet, a note, a file or a view,
// kept open while the sections change. What they show is remembered on this computer for
// each project, not in the project folder, so a co-author's screen stays as it is.

/** Not a file: the pane listing the Codex sheets of the scene being written. */
export const SCENE_SHEETS = ":scene-sheets";

/** Panes beside the section at most, so the text keeps room to be read. */
export const MAX_PANES = 2;
export const PANE_WIDTH = 440;
export const MIN_PANE = 260;

export interface Pane {
  id: number;
  /** The note, file, view or manuscript folder shown, or SCENE_SHEETS. */
  path: string;
  /** A pinned pane is not replaced by the next item opened beside. */
  pinned: boolean;
  width: number;
  /** In the scene sheets pane, the sheet chosen among the scene's. */
  sheet?: string;
}

interface Panes {
  list: Pane[];
  /** The pane with the cursor, or null for the section. */
  focus: number | null;
  /** The scene being written, followed by the scene sheets and marked in views. */
  writing: string | null;
}

export const panes = $state<Panes>({ list: [], focus: null, writing: null });

let key: string | null = null;
let nextId = 1;

/** Reads the panes of a project, kept under `scope` (its folder). */
export function loadPanes(scope: string) {
  key = `dante.panes|${scope}`;
  let list: Pane[] = [];
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (Array.isArray(stored)) {
      list = stored
        .filter((p) => typeof p?.path === "string" && p.path)
        .slice(0, MAX_PANES)
        .map((p) => ({
          id: nextId++,
          path: p.path,
          pinned: !!p.pinned,
          width: typeof p.width === "number" ? p.width : PANE_WIDTH,
          sheet: typeof p.sheet === "string" ? p.sheet : undefined,
        }));
    }
  } catch {
    // Nothing remembered: no panes.
  }
  panes.list = list;
  panes.focus = null;
  panes.writing = null;
}

function save() {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(panes.list.map(({ path, pinned, width, sheet }) => ({ path, pinned, width, sheet }))));
  } catch {
    // Not remembered after a restart; the panes still work.
  }
}

/**
 * Shows `path` beside the section. A pane already showing it gets the cursor; otherwise the
 * last pane not pinned shows it instead, and only when every pane is pinned does a new one
 * open, up to MAX_PANES (then the last one is replaced).
 */
export function openBeside(path: string): number {
  const shown = panes.list.find((p) => p.path === path);
  if (shown) {
    panes.focus = shown.id;
    return shown.id;
  }
  const loose = panes.list.findLast((p) => !p.pinned);
  let target: Pane;
  if (loose) {
    target = loose;
    target.path = path;
  } else if (panes.list.length < MAX_PANES) {
    target = { id: nextId++, path, pinned: false, width: panes.list.at(-1)?.width ?? PANE_WIDTH };
    panes.list.push(target);
  } else {
    target = panes.list.at(-1)!;
    target.path = path;
    target.pinned = false;
  }
  panes.focus = target.id;
  save();
  return target.id;
}

/**
 * Shows the scene sheets beside the section, or closes them when they are open. They come
 * pinned, so the next item opened beside goes in another pane instead of taking their place.
 */
export function toggleSceneSheets() {
  const open = panes.list.find((p) => p.path === SCENE_SHEETS);
  if (open) return closePane(open.id);
  if (panes.list.length < MAX_PANES) {
    const pane: Pane = { id: nextId++, path: SCENE_SHEETS, pinned: true, width: panes.list.at(-1)?.width ?? PANE_WIDTH };
    panes.list.push(pane);
  } else {
    const target = panes.list.findLast((p) => !p.pinned) ?? panes.list.at(-1)!;
    target.path = SCENE_SHEETS;
    target.pinned = true;
    target.sheet = undefined;
  }
  save();
}

export function closePane(id: number) {
  panes.list = panes.list.filter((p) => p.id !== id);
  if (panes.focus === id) panes.focus = null;
  save();
}

export function setPanePath(id: number, path: string) {
  const pane = panes.list.find((p) => p.id === id);
  if (!pane || pane.path === path) return;
  pane.path = path;
  save();
}

export function setPaneSheet(id: number, sheet: string) {
  const pane = panes.list.find((p) => p.id === id);
  if (!pane || pane.sheet === sheet) return;
  pane.sheet = sheet;
  save();
}

export function togglePin(id: number) {
  const pane = panes.list.find((p) => p.id === id);
  if (!pane) return;
  pane.pinned = !pane.pinned;
  save();
}

export function setPaneWidth(id: number, width: number) {
  const pane = panes.list.find((p) => p.id === id);
  if (!pane) return;
  pane.width = Math.round(Math.max(MIN_PANE, width));
  save();
}

/** Gives every pane the same width as the section's text, `available` being the room for all. */
export function evenWidths(available: number) {
  const each = Math.max(MIN_PANE, Math.floor(available / (panes.list.length + 1)));
  for (const pane of panes.list) pane.width = each;
  save();
}

/** Paths moved or renamed: the panes follow them. */
export function followMoves(moved: (path: string) => string) {
  let changed = false;
  for (const pane of panes.list) {
    if (pane.sheet) pane.sheet = moved(pane.sheet);
    if (pane.path === SCENE_SHEETS) continue;
    const to = moved(pane.path);
    if (to !== pane.path) {
      pane.path = to;
      changed = true;
    }
  }
  if (panes.writing) panes.writing = moved(panes.writing);
  if (changed) save();
}

/** Closes the panes whose item no longer exists, as after it was deleted. */
export function dropMissing(exists: (path: string) => boolean) {
  const kept = panes.list.filter((p) => p.path === SCENE_SHEETS || exists(p.path));
  if (kept.length === panes.list.length) return;
  panes.list = kept;
  if (panes.focus !== null && !kept.some((p) => p.id === panes.focus)) panes.focus = null;
  save();
}

/** The pane with the cursor, if any. */
export function focusedPane(): Pane | null {
  return panes.focus === null ? null : (panes.list.find((p) => p.id === panes.focus) ?? null);
}

/** The item a pane shows: its path, or the sheet shown in the scene sheets pane. */
export function shownIn(pane: Pane): string | null {
  return pane.path === SCENE_SHEETS ? (pane.sheet ?? null) : pane.path;
}
