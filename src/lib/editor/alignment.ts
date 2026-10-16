import { EditorSelection, EditorState, Prec, type Text, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { ALIGN_CLOSE, alignOpen, readAlignment, type Align } from "$lib/core/alignment";

// Aligned paragraphs in the editor: the command that sets them, and the keys that keep
// their tags whole while the tags are hidden (see livePreview).

export interface Paragraph {
  from: number;
  to: number;
}

export interface AlignedParagraph extends Paragraph {
  align: Align;
  /** Where the text starts and ends, inside the tags. */
  contentFrom: number;
  contentTo: number;
}

/** The lines around `pos` up to the blank lines; null on a blank line. */
export function paragraphAround(doc: Text, pos: number): Paragraph | null {
  let first = doc.lineAt(pos);
  if (!first.text.trim()) return null;
  let last = first;
  while (first.number > 1 && doc.line(first.number - 1).text.trim()) first = doc.line(first.number - 1);
  while (last.number < doc.lines && doc.line(last.number + 1).text.trim()) last = doc.line(last.number + 1);
  return { from: first.from, to: last.to };
}

export function aligned(doc: Text, paragraph: Paragraph | null): AlignedParagraph | null {
  if (!paragraph) return null;
  const found = readAlignment(doc.sliceString(paragraph.from, paragraph.to));
  if (!found) return null;
  return { ...paragraph, align: found.align, contentFrom: paragraph.from + found.open, contentTo: paragraph.to - found.close };
}

export const alignedAt = (doc: Text, pos: number) => aligned(doc, paragraphAround(doc, pos));

// Lines that are not plain paragraphs: headings, quotes, lists, rules, code fences, tables.
const NOT_PROSE = /^\s*(?:#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```|~~~|\|)|^\s*(?:\*\s*){3,}$|^\s*(?:-\s*){3,}$|^\s*(?:_\s*){3,}$/;

/**
 * Aligns the paragraphs touched by the selection, or gives them back the default
 * alignment when they all have `align` already. Headings, lists and quotes are left as
 * they are. On an empty line it starts an aligned paragraph, with the cursor inside.
 */
export function toggleAlign(state: EditorState, align: Align): TransactionSpec {
  const { doc } = state;
  const paragraphs: Paragraph[] = [];
  for (const range of state.selection.ranges) {
    for (let n = doc.lineAt(range.from).number; n <= doc.lineAt(range.to).number; n++) {
      const p = paragraphAround(doc, doc.line(n).from);
      if (!p) continue;
      if (!paragraphs.some((q) => q.from === p.from)) paragraphs.push(p);
      n = doc.lineAt(p.to).number;
    }
  }
  const prose = paragraphs.filter((p) => aligned(doc, p) || !NOT_PROSE.test(doc.lineAt(p.from).text));

  if (!prose.length) {
    // An empty line becomes an empty aligned paragraph, kept apart from its neighbours.
    const { main } = state.selection;
    const line = doc.lineAt(main.head);
    if (paragraphs.length || !main.empty || line.text.trim()) return {};
    const before = line.number > 1 && doc.line(line.number - 1).text.trim() ? "\n" : "";
    const after = line.number < doc.lines && doc.line(line.number + 1).text.trim() ? "\n" : "";
    const opening = before + alignOpen(align);
    return {
      changes: { from: line.from, to: line.to, insert: opening + ALIGN_CLOSE + after },
      selection: EditorSelection.cursor(line.from + opening.length),
    };
  }

  const all = prose.every((p) => aligned(doc, p)?.align === align);
  const changes: { from: number; to: number; insert: string }[] = [];
  // Where the text of each paragraph ends: a cursor there stays before the closing tag.
  const ends = new Set<number>();
  for (const p of prose) {
    const current = aligned(doc, p);
    const contentFrom = current?.contentFrom ?? p.from;
    const contentTo = current?.contentTo ?? p.to;
    changes.push({ from: p.from, to: contentFrom, insert: all ? "" : alignOpen(align) });
    changes.push({ from: contentTo, to: p.to, insert: all ? "" : ALIGN_CLOSE });
    ends.add(contentTo);
  }
  const set = state.changes(changes);
  const map = (pos: number) => set.mapPos(pos, ends.has(pos) ? -1 : 1);
  const selection = EditorSelection.create(
    state.selection.ranges.map((r) => EditorSelection.range(map(r.anchor), map(r.head))),
    state.selection.mainIndex,
  );
  return { changes: set, selection };
}

/** The keys that would otherwise break the hidden tags of an aligned paragraph. */
function keys() {
  const at = (view: EditorView) => {
    const { main } = view.state.selection;
    if (!main.empty || view.state.selection.ranges.length > 1) return null;
    const p = alignedAt(view.state.doc, main.head);
    return p ? { p, head: main.head } : null;
  };
  return Prec.high(
    keymap.of([
      {
        // At the start of the text, Backspace takes the alignment away, as it does a list's marker.
        key: "Backspace",
        run: (view) => {
          const found = at(view);
          if (!found || found.head > found.p.contentFrom) return false;
          const { p } = found;
          view.dispatch({
            changes: [
              { from: p.from, to: p.contentFrom },
              { from: p.contentTo, to: p.to },
            ],
            selection: EditorSelection.cursor(p.from),
            userEvent: "delete.alignment",
          });
          return true;
        },
      },
      {
        // At the end of the text, Enter starts a new paragraph after the tags, with the default alignment.
        key: "Enter",
        run: (view) => {
          const found = at(view);
          if (!found || found.head < found.p.contentTo) return false;
          const end = found.p.to;
          view.dispatch({
            changes: { from: end, insert: "\n\n" },
            selection: EditorSelection.cursor(end + 2),
            scrollIntoView: true,
            userEvent: "input",
          });
          return true;
        },
      },
      {
        // At the end of the text, Delete brings the next paragraph inside the tags.
        key: "Delete",
        run: (view) => {
          const found = at(view);
          if (!found || found.head < found.p.contentTo) return false;
          const { doc } = view.state;
          const { p } = found;
          let n = doc.lineAt(p.to).number + 1;
          while (n <= doc.lines && !doc.line(n).text.trim()) n++;
          if (n > doc.lines) return true;
          const next = paragraphAround(doc, doc.line(n).from)!;
          const inner = aligned(doc, next);
          const closing = doc.sliceString(p.contentTo, p.to).trimEnd();
          view.dispatch({
            changes: [
              { from: p.contentTo, to: inner?.contentFrom ?? next.from, insert: "" },
              { from: inner?.contentTo ?? next.to, to: next.to, insert: closing },
            ],
            selection: EditorSelection.cursor(p.contentTo),
            userEvent: "delete.forward",
          });
          return true;
        },
      },
    ]),
  );
}

/** Typing just outside the hidden tags goes inside them, where the text is. */
const typingInside = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !(tr.isUserEvent("input.type") || tr.isUserEvent("input.paste"))) return tr;
  let only: { from: number; to: number; text: string } | null = null;
  let count = 0;
  tr.changes.iterChanges((from, to, _a, _b, inserted) => {
    count++;
    only = { from, to, text: inserted.toString() };
  });
  const change = only as { from: number; to: number; text: string } | null;
  if (count !== 1 || !change || change.from !== change.to) return tr;
  const p = alignedAt(tr.startState.doc, change.from);
  if (!p) return tr;
  const pos = change.from === p.from ? p.contentFrom : change.from === p.to ? p.contentTo : null;
  if (pos === null || pos === change.from) return tr;
  return {
    changes: { from: pos, insert: change.text },
    selection: EditorSelection.cursor(pos + change.text.length),
    userEvent: tr.isUserEvent("input.paste") ? "input.paste" : "input.type",
    scrollIntoView: true,
  };
});

/** Behaviour that goes with hiding the tags; the raw Markdown view does without it. */
export const alignedEditing = [keys(), typingInside];

/** Line decorations are drawn by livePreview; this centres or right-aligns their lines. */
export const alignmentTheme = EditorView.baseTheme({
  ".cm-line.md-align-center": { textAlign: "center" },
  ".cm-line.md-align-right": { textAlign: "right" },
  ".cm-line.md-align-left": { textAlign: "left" },
  ".cm-line.md-align-justify": { textAlign: "justify" },
});
