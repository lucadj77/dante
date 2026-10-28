import { acceptCompletion, autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { ChangeSet, EditorSelection, EditorState, Facet, Prec, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { ImageHandler } from "./images";
import type { NameFound, NameMatcher } from "$lib/core/mentions";
import { namedNotes } from "./mentions";

export interface LinkSuggestion {
  /** What goes between [[ and ]]: the shortest name that reaches the note. */
  target: string;
  /** Shown instead of the target, and written as [[target|alias]]. */
  alias?: string;
  /** Where the note is, or its type. */
  detail?: string;
  /** The note's type id, if it has one. */
  type?: string;
}

/** What the editor needs from the project to follow and suggest wikilinks. */
export interface LinkHandler {
  /** Follows the link; `beside` opens it in a pane, as Alt (Option) with the click asks. */
  open(target: string, beside?: boolean): void;
  resolves(target: string): boolean;
  suggestions(): LinkSuggestion[];
  /**
   * The target to write for `name` when no note is called that but exactly one note has
   * it among its aliases; null otherwise.
   */
  aliasOf?(name: string): string | null;
  /**
   * Asks what to do with the link clicked at `at` (open it, preview it, create its note);
   * `edit` puts the cursor inside the link instead.
   */
  choose?(target: string, at: { x: number; y: number }, edit: () => void): void;
  /** The body of an embedded note, for ![[Nota]]; null when there is no such note. */
  note?(target: string): Promise<string | null>;
  /** Showing and adding images, where the project allows it. */
  images?: ImageHandler;
  /**
   * The names of the Story Bible to underline, while the writer wants them, and the note
   * shown (whose own name is not underlined); null when they are turned off.
   */
  names?(): { matcher: NameMatcher; own: string } | null;
  /** A right click on a name found: the menu of its note; `link` writes the name as a link to `target`. */
  named?(found: NameFound, at: { x: number; y: number }, link: (target: string) => void): void;
}

export const linkHandler = Facet.define<LinkHandler, LinkHandler | null>({
  combine: (values) => values[0] ?? null,
});

// The same links the live preview draws: [[target]] or [[target|alias]], with an optional
// #heading after the target.
const LINK = /!?\[\[([^\[\]|\n]+)(\|[^\[\]\n]*)?\]\]/g;

/** The target of the wikilink at `pos`, without its #heading, if there is one. */
export function linkAt(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  for (const m of line.text.matchAll(LINK)) {
    const start = line.from + m.index!;
    if (pos >= start && pos <= start + m[0].length) return m[1].split("#")[0].trim();
  }
  return null;
}

/** The wikilink around `pos`: where it starts and ends, and where its text is. */
function linkRangeAt(state: EditorState, pos: number): { from: number; to: number } | null {
  const line = state.doc.lineAt(pos);
  for (const m of line.text.matchAll(LINK)) {
    const start = line.from + m.index!;
    if (pos >= start && pos <= start + m[0].length) return { from: start, to: start + m[0].length };
  }
  return null;
}

/**
 * A click on a link asks what to do with it. Cmd or Ctrl opens it at once, Alt (Option)
 * opens it in a pane. A click on a link the cursor is already in only moves the cursor, to edit it.
 */
const clicks = EditorView.domEventHandlers({
  mousedown(event, view) {
    const handler = view.state.facet(linkHandler);
    if (!handler || event.button !== 0 || event.shiftKey) return false;
    const modified = event.metaKey || event.ctrlKey;
    const onLink = (event.target as HTMLElement).closest?.(".md-wikilink");
    if (!modified && !onLink) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    const target = linkAt(view, pos);
    const range = linkRangeAt(view.state, pos);
    if (!target || !range) return false;
    if (modified || event.altKey || !handler.choose) {
      event.preventDefault();
      handler.open(target, event.altKey);
      return true;
    }
    const inside = view.hasFocus && view.state.selection.ranges.some((r) => r.from > range.from && r.to < range.to);
    if (inside) return false;
    event.preventDefault();
    handler.choose(target, { x: event.clientX, y: event.clientY }, () => {
      view.focus();
      view.dispatch({ selection: { anchor: range.to - 2 }, scrollIntoView: true });
    });
    return true;
  },
});

/**
 * A link closed by typing "]]" or by wrapping a selection in brackets, whose name is an
 * alias of a note, is written as [[note|alias]]: it reaches the note, here and in Obsidian,
 * and still reads as typed.
 */
const aliasLinks = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !(tr.isUserEvent("input.type") || tr.isUserEvent("input.format"))) return tr;
  const handler = tr.startState.facet(linkHandler);
  if (!handler?.aliasOf) return tr;
  const doc = tr.newDoc;
  const edits: { from: number; to: number; insert: string; linkFrom: number; linkTo: number }[] = [];
  const seen = new Set<number>();
  tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    for (let n = doc.lineAt(fromB).number; n <= doc.lineAt(toB).number; n++) {
      const line = doc.line(n);
      for (const m of line.text.matchAll(LINK)) {
        const start = line.from + m.index!;
        const end = start + m[0].length;
        // Only the change that closes the link counts: typing inside its name does not.
        if (seen.has(start) || !(fromB < end && toB > end - 2) || m[2] !== undefined) continue;
        seen.add(start);
        const inner = m[1];
        const hash = inner.indexOf("#");
        const name = (hash < 0 ? inner : inner.slice(0, hash)).trim();
        const subpath = hash < 0 ? "" : inner.slice(hash);
        const target = name ? handler.aliasOf!(name) : null;
        if (!target) continue;
        const innerFrom = start + m[0].indexOf("[[") + 2;
        edits.push({ from: innerFrom, to: innerFrom + inner.length, insert: `${target}${subpath}|${name}`, linkFrom: start, linkTo: end });
      }
    }
  });
  if (edits.length === 0) return tr;
  const changes = ChangeSet.of(edits.map(({ from, to, insert }) => ({ from, to, insert })), doc.length);
  // A cursor in or at the end of a rewritten link goes after it; the others follow the text.
  const ranges = tr.newSelection.ranges.map((r) => {
    const edit = edits.find((e) => r.from >= e.linkFrom && r.to <= e.linkTo);
    if (!edit) return r.map(changes);
    return EditorSelection.cursor(changes.mapPos(edit.linkTo, 1));
  });
  const spec: TransactionSpec = { changes, selection: EditorSelection.create(ranges, tr.newSelection.mainIndex), sequential: true };
  return [tr, spec];
});

/** Suggests notes after "[[", by name and by alias. */
function complete(context: CompletionContext): CompletionResult | null {
  const handler = context.state.facet(linkHandler);
  if (!handler) return null;
  const before = context.matchBefore(/\[\[[^\[\]|\n]*$/);
  if (!before) return null;
  const from = before.from + 2;
  const closed = context.state.doc.sliceString(context.pos, context.pos + 2) === "]]";
  const options: Completion[] = handler.suggestions().map((s) => {
    const insert = s.alias ? `${s.target}|${s.alias}` : s.target;
    return {
      label: s.alias ?? s.target,
      detail: s.alias ? `→ ${s.target}` : s.detail,
      type: s.alias ? "alias" : "note",
      apply: (view, _completion, start, end) => {
        // Brackets already closed after the cursor are written over, not doubled.
        const to = closed ? end + 2 : end;
        view.dispatch({
          changes: { from: start, to, insert: insert + "]]" },
          selection: { anchor: start + insert.length + 2 },
          userEvent: "input.complete",
        });
      },
    };
  });
  return { from, options, validFor: /^[^\[\]|\n]*$/ };
}

/** Following and suggesting wikilinks, for notes and scenes alike. */
export function wikilinks(handler: LinkHandler | undefined): Extension {
  if (!handler) return [];
  return [
    linkHandler.of(handler),
    Prec.high(clicks),
    aliasLinks,
    namedNotes,
    autocompletion({ override: [complete], icons: false, activateOnTyping: true }),
    // Tab takes the highlighted suggestion too, as Enter does.
    Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
  ];
}
