import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import { calloutColor } from "$lib/core/callouts";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

// Callouts, the quotes that open with `> [!note]` or `> [!warning]`: the marker reads as a
// coloured pill with the callout's name, and the quote gets the same colour. The marker comes
// back as text when the cursor is on its line, so it can be changed.

export { calloutColor };

const OPEN = /^>\s*\[!([\w-]+)\]([+-]?)/;



/** The room `md-after-gap` leaves above a line. */
const GAP = "calc(1em * var(--editor-line-height, 1.7) * var(--editor-gap, 1))";


/** The colour, faint, for the background: macOS 10.15 cannot mix colours in CSS. */
export function faint(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.08)`;
}

/** The callout a quoted line belongs to, looking back to its "> [!type]" line; null outside one. */
export function calloutAround(state: EditorState, lineNumber: number): string | null {
  for (let n = lineNumber; n >= 1; n--) {
    const text = state.doc.line(n).text;
    const open = OPEN.exec(text);
    if (open) return open[1];
    if (!text.startsWith(">")) return null;
  }
  return null;
}

class Pill extends WidgetType {
  constructor(readonly type: string) {
    super();
  }
  eq(other: Pill) {
    return other.type === this.type;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-callout-pill";
    span.textContent = this.type;
    span.style.background = calloutColor(this.type);
    return span;
  }
}

function decorate(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursor = new Set(state.selection.ranges.map((r) => state.doc.lineAt(r.head).number));
  let type: string | null = null;
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    const open = OPEN.exec(line.text);
    if (open) type = open[1];
    else if (!line.text.startsWith(">")) type = null;
    if (!type) continue;
    const color = calloutColor(type);
    builder.add(line.from, line.from, Decoration.line({ class: `cm-callout${open ? " cm-callout-first" : ""}`, attributes: { style: `--callout: ${color}; --callout-bg: ${faint(color)}` } }));
    if (open && !cursor.has(n)) {
      const start = line.from + line.text.indexOf("[");
      builder.add(start, line.from + open[0].length, Decoration.replace({ widget: new Pill(open[1]) }));
    }
  }
  return builder.finish();
}

export function calloutPreview(): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorate(view.state);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet) this.decorations = decorate(u.state);
      }
    },
    { decorations: (v) => v.decorations },
  );
  const theme = EditorView.baseTheme({
    ".cm-line.cm-callout": { background: "var(--callout-bg)", boxShadow: "inset 3px 0 0 var(--callout)" },
    // The room left above a paragraph after a hidden blank line stays outside the callout:
    // its border, band and background start below it.
    ".cm-line.cm-callout.md-after-gap": {
      borderLeftColor: "transparent",
      boxShadow: "none",
      background: `linear-gradient(to right, var(--border) 3px, var(--callout) 3px, var(--callout) 6px, var(--callout-bg) 6px) 0 ${GAP} / 100% 100% no-repeat border-box`,
    },
    ".cm-callout-pill": {
      display: "inline-block",
      padding: "0 8px",
      borderRadius: "9px",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      fontSize: "0.7em",
      fontWeight: "600",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      verticalAlign: "0.15em",
    },
  });
  return [plugin, theme];
}
