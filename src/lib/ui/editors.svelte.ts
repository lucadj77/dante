import type { EditorView } from "@codemirror/view";
import type { CriticHandler } from "$lib/editor/critic";
import { layout, toggle } from "./layout.svelte";

/**
 * The editors open in any section, by the path of their file, so the comments panel can
 * read and change the text of the note it is showing.
 */
const views = new Map<string, EditorView>();

export const editors = $state<{
  /** Bumped when an editor opens, closes or its text changes. */
  rev: number;
  /** A comment being written, on `[from, to)` of `path`. */
  draft: { path: string; from: number; to: number } | null;
  /** The thread to show, where the bubble at `from` was clicked. */
  focus: { path: string; from: number } | null;
  /** The panel tab the editors asked for. */
  tab: "comments" | null;
}>({ rev: 0, draft: null, focus: null, tab: null });

export function registerEditor(path: string, view: EditorView | null) {
  if (view) views.set(path, view);
  else if (views.has(path)) views.delete(path);
  editors.rev++;
}

/** Forgets the editor only if it is still the one registered for `path`. */
export function unregisterEditor(path: string, view: EditorView) {
  if (views.get(path) === view) registerEditor(path, null);
}

export function editorFor(path: string | null): EditorView | null {
  return path ? (views.get(path) ?? null) : null;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** The text of an editor changed; the panels catch up a moment after typing stops. */
export function editorChanged() {
  clearTimeout(timer);
  timer = setTimeout(() => editors.rev++, 250);
}

/** What the editor of `path` asks when a comment is started or a bubble clicked. */
export function criticHandlerFor(path: string): CriticHandler {
  return {
    newComment(_view, from, to) {
      editors.draft = { path, from, to };
      editors.focus = null;
      showComments();
    },
    openThread(_view, from) {
      editors.focus = { path, from };
      showComments();
    },
  };
}

function showComments() {
  editors.tab = "comments";
  if (!layout.right) toggle("right");
}
