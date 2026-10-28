import { completionStatus } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { insertNewline } from "@codemirror/commands";
import { EditorSelection, Prec, RangeSetBuilder, StateField, type EditorState, type Extension, type RangeSet, type Transaction, type TransactionSpec } from "@codemirror/state";
import { Decoration, EditorView, keymap, type DecorationSet } from "@codemirror/view";
import { BLANK_LINE, isBlankLine } from "$lib/core/blankLines";

// Paragraphs as in a word processor. In Markdown a paragraph ends with an empty line, but the
// writer need not see it: Enter starts a new paragraph and writes the empty line, and the
// empty lines between two paragraphs are not shown, only the space between them. The cursor
// steps over them, and Backspace at the start of a paragraph joins it to the one before.
// Enter on a paragraph still empty writes a blank line that shows in the book (&nbsp;), as an
// empty paragraph does in a word processor. Shift+Enter goes to a new line in the same
// paragraph. In lists, quotes, code and tables Enter keeps its Markdown meaning.

interface Gaps {
  decorations: DecorationSet;
  /** From the end of the paragraph before to the start of the one after: one step of the cursor. */
  atomic: RangeSet<Decoration>;
  /** The starts of the empty lines not shown. */
  hidden: Set<number>;
}

const join = Decoration.replace({});
const after = Decoration.line({ class: "md-after-gap" });
const step = Decoration.mark({});

/** Where the properties at the top of the text end, or 0. */
function propertiesEnd(state: EditorState): number {
  const doc = state.doc;
  if (doc.lines < 2 || doc.line(1).text.trimEnd() !== "---") return 0;
  for (let n = 2; n <= doc.lines; n++) if (/^(---|\.\.\.)\s*$/.test(doc.line(n).text)) return doc.line(n).to;
  return 0;
}

const KEEPS_LINES = /^(FencedCode|CodeBlock|HTMLBlock|CommentBlock)$/;
const STRUCTURE = /^(ListItem|BulletList|OrderedList|Blockquote|FencedCode|CodeBlock|HTMLBlock|Table)$/;

function inside(state: EditorState, pos: number, names: RegExp): boolean {
  for (let node: { name: string; parent: unknown } | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent as typeof node) {
    if (names.test(node.name)) return true;
  }
  return false;
}

function gaps(state: EditorState): Gaps {
  const doc = state.doc;
  const { main } = state.selection;
  // The empty line the cursor is on is a paragraph being started: the gaps around it are gaps.
  const cursor = main.empty ? doc.lineAt(main.head).number : -1;
  const isText = (n: number) => n === cursor || doc.line(n).text.trim() !== "";
  const top = propertiesEnd(state);
  const decorations = new RangeSetBuilder<Decoration>();
  const atomic = new RangeSetBuilder<Decoration>();
  const hidden = new Set<number>();
  let before = 0;
  for (let n = 1; n <= doc.lines; n++) {
    if (!isText(n)) continue;
    if (before && n - before > 1) {
      const previous = doc.line(before);
      const last = doc.line(n - 1);
      const next = doc.line(n);
      if (previous.from >= top && !inside(state, last.from, KEEPS_LINES)) {
        // The empty lines join the paragraph before; the last one's line break starts the next.
        decorations.add(previous.to, last.from, join);
        decorations.add(next.from, next.from, after);
        atomic.add(previous.to, next.from, step);
        for (let m = before + 1; m < n; m++) hidden.add(doc.line(m).from);
      }
    }
    before = n;
  }
  return { decorations: decorations.finish(), atomic: atomic.finish(), hidden };
}

/** Whether a transaction may change what is hidden: the text, or the empty line the cursor is on. */
function moved(tr: Transaction): boolean {
  if (tr.docChanged) return true;
  if (!tr.selection) return false;
  const line = (state: EditorState) => {
    const { main } = state.selection;
    return main.empty ? state.doc.lineAt(main.head) : null;
  };
  const was = line(tr.startState);
  const now = line(tr.state);
  if (was?.number === now?.number) return false;
  return (!!was && !was.text.trim()) || (!!now && !now.text.trim());
}

const field = StateField.define<Gaps>({
  create: gaps,
  update: (value, tr) => (moved(tr) || syntaxTree(tr.startState) !== syntaxTree(tr.state) ? gaps(tr.state) : value),
  provide: (f) => [EditorView.decorations.from(f, (g) => g.decorations), EditorView.atomicRanges.of((view) => view.state.field(f).atomic)],
});

/** Whether the empty line starting at `from` is hidden as the space between two paragraphs. */
export function hiddenGap(state: EditorState, from: number): boolean {
  return state.field(field, false)?.hidden.has(from) ?? false;
}

/** What Enter writes: a new paragraph, or a blank line that shows when the paragraph is still empty; null to leave Enter to Markdown. */
export function paragraphEnter(state: EditorState): TransactionSpec | null {
  // Enter chooses among the suggestions while they show.
  if (state.readOnly || state.selection.ranges.length > 1 || completionStatus(state) === "active") return null;
  const range = state.selection.main;
  if (inside(state, range.from, STRUCTURE) || range.from < propertiesEnd(state)) return null;
  const line = state.doc.lineAt(range.from);
  if (range.empty && !line.text.trim() && line.number > 1 && state.doc.line(line.number - 1).text.trim()) {
    // An empty line right under the text, as at the end of a file, is not a paragraph yet.
    return { changes: { from: line.from, insert: "\n" }, selection: { anchor: line.from + 1 }, scrollIntoView: true, userEvent: "input" };
  }
  if (range.empty && !line.text.trim()) {
    // Nothing to leave empty before the first paragraph.
    let n = line.number - 1;
    while (n >= 1 && !state.doc.line(n).text.trim()) n--;
    if (n < 1 || state.doc.line(n).to <= propertiesEnd(state)) return null;
    const insert = `${BLANK_LINE}\n\n`;
    return { changes: { from: line.from, to: line.to, insert }, selection: { anchor: line.from + insert.length }, scrollIntoView: true, userEvent: "input" };
  }
  // At the start of a paragraph Enter leaves an empty paragraph above it: a blank line that shows.
  if (range.empty && range.from === line.from && line.number > 1 && !state.doc.line(line.number - 1).text.trim() && !isBlankLine(line.text)) {
    const insert = `${BLANK_LINE}\n\n`;
    return { changes: { from: line.from, insert }, selection: { anchor: line.from + insert.length }, scrollIntoView: true, userEvent: "input" };
  }
  // Spaces at the end of the paragraph would be a hard line break in Markdown, and those at the
  // start of the next one are not wanted either.
  const before = state.doc.sliceString(line.from, range.from);
  const after = state.doc.sliceString(range.to, state.doc.lineAt(range.to).to);
  const blank = isBlankLine(line.text);
  const from = blank ? range.from : range.from - (before.length - before.replace(/[ \t]+$/, "").length);
  const to = blank ? range.to : range.to + (after.length - after.replace(/^[ \t]+/, "").length);
  return { changes: { from, to, insert: "\n\n" }, selection: { anchor: from + 2 }, scrollIntoView: true, userEvent: "input" };
}

function newParagraph(view: EditorView): boolean {
  const spec = paragraphEnter(view.state);
  if (spec) view.dispatch(spec);
  return !!spec;
}

/** End stops at the end of the paragraph: the line on screen goes on through the empty lines not shown. */
function lineEnd(extend: boolean) {
  return (view: EditorView): boolean => {
    const { atomic } = view.state.field(field);
    const selection = EditorSelection.create(
      view.state.selection.ranges.map((range) => {
        let head = view.moveToLineBoundary(range, true).head;
        atomic.between(head, head, (from, to) => {
          if (head > from && head < to) head = from;
        });
        return extend ? EditorSelection.range(range.anchor, head) : EditorSelection.cursor(head);
      }),
      view.state.selection.mainIndex,
    );
    view.dispatch({ selection, scrollIntoView: true, userEvent: "select" });
    return true;
  };
}

/** A click after the end of a paragraph falls in the empty lines not shown, and the cursor would jump to the next one. */
const clickAtEnd = EditorView.domEventHandlers({
  mouseup(event, view) {
    const { main } = view.state.selection;
    if (!main.empty) return false;
    let start = -1;
    view.state.field(field).atomic.between(main.head, main.head, (from, to) => {
      if (to === main.head) start = from;
    });
    const top = start < 0 ? null : view.coordsAtPos(main.head)?.top;
    if (top != null && event.clientY < top) view.dispatch({ selection: { anchor: start }, userEvent: "select.pointer" });
    return false;
  },
});

/** Paragraphs as in a word processor: see the comment at the top. */
export const paragraphs: Extension = [
  field,
  clickAtEnd,
  Prec.highest(
    keymap.of([
      { key: "Enter", run: newParagraph },
      { key: "Shift-Enter", run: insertNewline },
      { key: "End", run: lineEnd(false), shift: lineEnd(true) },
      { mac: "Cmd-ArrowRight", run: lineEnd(false), shift: lineEnd(true) },
    ]),
  ),
];
