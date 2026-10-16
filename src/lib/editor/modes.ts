import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, layer, RectangleMarker, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

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

/**
 * Shades the row the cursor is on, as it is drawn on screen: a long paragraph wraps over
 * several rows and only the one being written is marked. Drawn under the text, across the
 * whole column, and only in the editor that has the cursor.
 */
export const cursorLine = layer({
  above: false,
  class: "cm-cursorLineLayer",
  markers(view) {
    if (!view.hasFocus) return [];
    const { head, assoc } = view.state.selection.main;
    const at = view.coordsAtPos(head, assoc || 1);
    if (!at) return [];
    // The layer's origin, as CodeMirror places it inside the scroller.
    const scroller = view.scrollDOM.getBoundingClientRect();
    const baseLeft = scroller.left - view.scrollDOM.scrollLeft * view.scaleX;
    const baseTop = scroller.top - view.scrollDOM.scrollTop * view.scaleY;
    const content = view.contentDOM.getBoundingClientRect();
    // As tall as a row of text, even where the letters are smaller, such as in an empty line.
    const height = Math.max(at.bottom - at.top, view.defaultLineHeight);
    const middle = (at.top + at.bottom) / 2;
    return [new RectangleMarker("cm-cursorLine", content.left - baseLeft, middle - height / 2 - baseTop, content.width, height)];
  },
  update: (update) => update.docChanged || update.selectionSet || update.focusChanged || update.geometryChanged || update.viewportChanged,
});
