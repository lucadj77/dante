import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import { hiddenGap } from "./paragraphs";

// Marks the lines the page layout of the settings acts on: the empty lines between
// paragraphs (their height is the space between paragraphs) and the first line of each
// paragraph of text (its indent). Headings, lists, quotes and tables are left as they are.

const gap = Decoration.line({ class: "md-gap" });
const paragraph = Decoration.line({ class: "md-para" });

function decorations(view: EditorView): DecorationSet {
  const { state } = view;
  const builder = new RangeSetBuilder<Decoration>();
  const starts = new Set<number>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "Paragraph" && node.node.parent?.name === "Document") starts.add(state.doc.lineAt(node.from).from);
        // Only the top level holds paragraphs of text.
        return node.name === "Document";
      },
    });
  }
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos);
      // An empty line not shown leaves its height to the space above the next paragraph.
      if (line.length === 0 && !hiddenGap(state, line.from)) builder.add(line.from, line.from, gap);
      else if (starts.has(line.from)) builder.add(line.from, line.from, paragraph);
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export const textLayout = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = decorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet || syntaxTree(update.startState) !== syntaxTree(update.state)) this.decorations = decorations(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);
