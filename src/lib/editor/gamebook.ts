import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { findBoxes, type BoxType } from "../core/gamebook/boxes";

// In a gamebook: boxes drawn as coloured frames, as readers see them in the printed book, and
// references to other paragraphs ([[Title|25]]) shown as a number in a pill. The lines that
// open and close a box (`::: {custom-style="box"}` and `:::`) fold away unless the cursor is
// on them, so the text stays the file's text and can always be edited.

const REFERENCE = /\[\[([^[\]|\n]+)\|(\d+)\]\]/g;
const hideMarker = Decoration.replace({});

/** The box's colour, faint, for its background, mixed here because macOS 10.15 cannot mix colours in CSS. */
function tint(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "transparent";
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, 0.09)`;
}

function cursorLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    const first = state.doc.lineAt(r.from).number;
    const last = state.doc.lineAt(r.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

function decorate(state: EditorState, types: BoxType[], hide: boolean): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const text = state.doc.toString();
  const near = cursorLines(state);
  const byId = new Map(types.map((t) => [t.id, t]));
  // Line decorations and marks must reach the builder in order of position.
  const pending: { from: number; to: number; deco: Decoration }[] = [];
  for (const box of findBoxes(text, types)) {
    const type = byId.get(box.type);
    const style = `--gb-box: ${type?.color ?? "#888888"}; --gb-box-bg: ${tint(type?.color ?? "#888888")}`;
    const first = state.doc.lineAt(box.from).number;
    const last = state.doc.lineAt(box.to).number;
    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n);
      const role = n === first ? "gb-box-open" : n === last ? "gb-box-close" : "gb-box-body";
      const folded = (n === first || n === last) && hide && !near.has(n) && line.length > 0;
      pending.push({ from: line.from, to: line.from, deco: Decoration.line({ class: `gb-box ${role} gb-box-${box.type || "other"}${folded ? " gb-box-folded" : ""}`, attributes: { style } }) });
      if (folded) pending.push({ from: line.from, to: line.to, deco: hideMarker });
    }
  }
  for (const m of text.matchAll(REFERENCE)) {
    const from = m.index;
    const to = from + m[0].length;
    pending.push({ from, to, deco: Decoration.mark({ class: "gb-ref", attributes: { title: m[1].trim() } }) });
  }
  // Same start: the line's decoration first, then the shorter range.
  const isLine = (p: { from: number; to: number; deco: Decoration }) => (p.deco.spec.class?.startsWith("gb-box") ? 0 : 1);
  pending.sort((a, b) => a.from - b.from || isLine(a) - isLine(b) || a.to - b.to);
  for (const p of pending) builder.add(p.from, p.to, p.deco);
  return builder.finish();
}

export function gamebookPreview(types: BoxType[], preview: boolean): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorate(view.state, types, preview);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet) this.decorations = decorate(u.state, types, preview);
      }
    },
    { decorations: (v) => v.decorations },
  );
  const theme = EditorView.baseTheme({
    ".gb-box": {
      borderLeft: "4px solid var(--gb-box)",
      paddingLeft: "12px !important",
      background: "var(--gb-box-bg)",
    },
    // A folded marker line keeps only a sliver of height, as the frame's top or bottom edge.
    ".gb-box-folded": { fontSize: "4px", lineHeight: "8px" },
    ".gb-box-open": { borderTopLeftRadius: "4px", paddingTop: "4px" },
    ".gb-box-close": { borderBottomLeftRadius: "4px", minHeight: "6px" },
    ".gb-ref": {
      padding: "0 6px",
      borderRadius: "9px",
      border: "1px solid var(--border)",
      fontVariantNumeric: "tabular-nums",
    },
  });
  return [plugin, theme];
}

/**
 * Inserts a box at the cursor, on lines of its own, with the type's emoji and text and, for
 * a type tied to a property, the value in bold. The cursor ends inside the box, after the text.
 */
export function insertBox(view: EditorView, type: BoxType, value: string) {
  const state = view.state;
  const at = state.selection.main;
  const line = state.doc.lineAt(at.from);
  // A box starts on a line of its own, after a blank line.
  const before = at.from === line.from ? (line.number > 1 && state.doc.line(line.number - 1).text.trim() !== "" ? "\n" : "") : "\n\n";
  const after = at.to === state.doc.lineAt(at.to).to && at.to < state.doc.length ? "\n" : "\n\n";
  const first = [type.emoji, type.text].filter(Boolean).join(" ");
  const content = value.trim() ? `${first}\n\n**${value.trim()}**` : first;
  const open = '::: {custom-style="box"}\n';
  const insert = `${before}${open}${content}\n:::${after}`;
  const cursor = at.from + before.length + open.length + content.length;
  view.dispatch({ changes: { from: at.from, to: at.to, insert }, selection: { anchor: cursor }, userEvent: "input", scrollIntoView: true });
  view.focus();
}
