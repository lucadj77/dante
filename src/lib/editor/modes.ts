import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

/** Keeps the line being written at the middle of the screen. */
export const typewriterMode = [
  EditorState.transactionExtender.of((tr) =>
    tr.docChanged || tr.selection
      ? { effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: "center" }) }
      : null,
  ),
];

const dimmed = Decoration.line({ class: "cm-dimmed" });

function paragraphBounds(update: { state: EditorView["state"] }) {
  const { doc } = update.state;
  const line = doc.lineAt(update.state.selection.main.head).number;
  let first = line;
  let last = line;
  while (first > 1 && doc.line(first - 1).text.trim() !== "") first--;
  while (last < doc.lines && doc.line(last + 1).text.trim() !== "") last++;
  return { first, last };
}

function buildDimmed(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { first, last } = view.hasFocus ? paragraphBounds(view) : { first: 0, last: 0 };
  for (let n = 1; n <= view.state.doc.lines; n++) {
    if (n < first || n > last) builder.add(view.state.doc.line(n).from, view.state.doc.line(n).from, dimmed);
  }
  return builder.finish();
}

/** Dims everything but the paragraph being written. */
export const focusMode = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDimmed(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.focusChanged) this.decorations = buildDimmed(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);
