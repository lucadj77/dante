import { acceptCompletion, autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { ChangeSet, EditorSelection, EditorState, Facet, Prec, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { ImageHandler } from "./images";
import type { NameFound, NameMatcher } from "$lib/core/mentions";
import { namedNotes } from "./mentions";
import { articleFix } from "$lib/core/gamebook/articles";

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
  /** In a gamebook paragraph: references to other paragraphs instead of links to notes. */
  gamebook?: GamebookLinks;
}

/** A paragraph offered after "[[". */
export interface ParagraphChoice {
  title: string;
  number: number;
  empty: boolean;
}

export interface GamebookLinks {
  paragraphs(): ParagraphChoice[];
  firstFree(): number;
  /** Creates a paragraph with the first free number. */
  create(title: string): Promise<ParagraphChoice>;
  /** Adds a reference to the paragraph's hidden references, out of the text. */
  hide(choice: ParagraphChoice): Promise<void>;
  /** Asks for everything (title, fixed or relative number, hidden or not), then calls `insert` for a reference in the text. */
  ask(title: string, hidden: boolean, insert: (choice: ParagraphChoice) => void): void;
  failed(error: unknown): void;
  /** The words of the two ways to create a paragraph, in the writer's language. */
  labels: { create(title: string, number: number): string; createDetail: string; more(title: string): string; moreDetail: string };
}

/**
 * Writes a reference to `choice` over from..to, in bold as the plugin writes it, with the
 * article before it agreeing with the number.
 */
export function insertReference(view: EditorView, from: number, to: number, choice: ParagraphChoice) {
  const state = view.state;
  const boldBefore = state.doc.sliceString(Math.max(0, from - 2), from) === "**";
  const boldAfter = state.doc.sliceString(to, to + 2) === "**";
  const link = `[[${choice.title}|${choice.number}]]`;
  const insert = boldBefore && boldAfter ? link : `**${link}**`;
  const line = state.doc.lineAt(from);
  const before = state.doc.sliceString(line.from, from);
  const fix = articleFix(before, choice.number);
  const changes = fix ? [{ from: line.from + fix.from, to: from, insert: fix.text }, { from, to, insert }] : [{ from, to, insert }];
  const set = ChangeSet.of(changes, state.doc.length);
  view.dispatch({ changes: set, selection: { anchor: set.mapPos(to, 1) + (boldBefore && boldAfter ? 2 : 0) }, userEvent: "input.complete", scrollIntoView: true });
}

/** After "[[" in a gamebook: the paragraphs by number or title, then the new paragraph to create. */
function completeParagraph(context: CompletionContext, gamebook: GamebookLinks): CompletionResult | null {
  const before = context.matchBefore(/\[\[[^\[\]|\n]*$/);
  if (!before) return null;
  const start = before.from;
  const query = before.text.slice(2);
  const closed = context.state.doc.sliceString(context.pos, context.pos + 2) === "]]";
  const end = (pos: number) => (closed ? pos + 2 : pos);
  // The list is filtered and ordered here: paragraphs first, by number when a number is
  // typed, then the paragraphs to create, which the editor's own ranking would put first.
  const wanted = fold(query.trim());
  const found = gamebook
    .paragraphs()
    .filter((p) => !wanted || String(p.number).startsWith(wanted) || fold(p.title).includes(wanted))
    .sort((a, b) => {
      const exact = (p: ParagraphChoice) => (String(p.number) === wanted || fold(p.title) === wanted ? 0 : 1);
      return exact(a) - exact(b) || a.number - b.number;
    });
  const options: Completion[] = found.map((p) => ({
      label: `${p.number} ${p.title}`,
      detail: p.empty ? "○" : undefined,
      type: "paragraph",
      apply: (view: EditorView, _c: Completion, _from: number, to: number) => {
        if (takeHidden()) {
          view.dispatch({ changes: { from: start, to: end(to), insert: "" } });
          void gamebook.hide(p).catch(gamebook.failed);
        } else insertReference(view, start, end(to), p);
      },
    }));
  // The new paragraph comes first, as the writer asked: creating is what "[[" is most often for.
  const title = query.trim();
  const creating: Completion[] = [];
  if (title && !/^\d+$/.test(title) && !found.some((p) => fold(p.title) === wanted)) {
    creating.push({
      label: title,
      displayLabel: gamebook.labels.create(title, gamebook.firstFree()),
      detail: gamebook.labels.createDetail,
      type: "create",
      apply: (view: EditorView, _c: Completion, _from: number, to: number) => {
        const hidden = takeHidden();
        const range = { from: start, to: end(to) };
        void gamebook
          .create(title)
          .then((choice) => {
            if (hidden) {
              view.dispatch({ changes: { ...range, insert: "" } });
              return gamebook.hide(choice);
            }
            insertReference(view, range.from, range.to, choice);
          })
          .catch(gamebook.failed);
      },
    });
  }
  if (!/^\d+$/.test(title)) {
    creating.push({
      label: title + " ",
      displayLabel: gamebook.labels.more(title),
      detail: gamebook.labels.moreDetail,
      type: "create-more",
      apply: (view: EditorView, _c: Completion, _from: number, to: number) => {
        const hidden = takeHidden();
        view.dispatch({ changes: { from: start, to: end(to), insert: "" } });
        gamebook.ask(title, hidden, (choice) => insertReference(view, start, start, choice));
      },
    });
  }
  options.unshift(...creating);
  return { from: start + 2, options, filter: false };
}

/** Lower case and without accents, to find "perche" in "Perché". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Alt+Enter takes a suggestion as a hidden reference: the key sets this, the suggestion reads it. */
let hiddenPending = false;
function takeHidden(): boolean {
  const hidden = hiddenPending;
  hiddenPending = false;
  return hidden;
}
const hiddenKey = keymap.of([
  {
    key: "Alt-Enter",
    run: (view) => {
      hiddenPending = true;
      const done = acceptCompletion(view);
      if (!done) hiddenPending = false;
      return done;
    },
  },
]);

/** In a gamebook: the window for a new paragraph, whose reference goes at the cursor (over the selection, which proposes the title). */
export function askNewParagraph(view: EditorView): boolean {
  const gamebook = view.state.facet(linkHandler)?.gamebook;
  if (!gamebook) return false;
  const at = view.state.selection.main;
  const selected = view.state.sliceDoc(at.from, at.to).trim();
  gamebook.ask(selected, false, (choice) => insertReference(view, at.from, at.to, choice));
  return true;
}

/** In a gamebook, Ctrl+Enter (Cmd+Enter) creates a paragraph and puts the reference to it at the cursor. */
const newParagraphKey = keymap.of([{ key: "Mod-Enter", run: askNewParagraph }]);

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
  if (handler.gamebook) return completeParagraph(context, handler.gamebook);
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
    ...(handler.gamebook ? [Prec.highest(hiddenKey), Prec.highest(newParagraphKey)] : []),
  ];
}
