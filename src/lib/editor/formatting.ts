import { EditorSelection, Prec, StateField, type EditorState, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap, showTooltip, type Tooltip } from "@codemirror/view";

export type Format = "bold" | "italic" | "strike";

const MARKERS: Record<Format, string> = { bold: "**", italic: "*", strike: "~~" };

/** Length of the run of `char` ending at `pos` (going left) or starting at it (going right). */
function run(state: EditorState, pos: number, char: string, left: boolean): number {
  let n = 0;
  while (true) {
    const at = left ? pos - n - 1 : pos + n;
    if (at < 0 || at >= state.doc.length || state.doc.sliceString(at, at + 1) !== char) return n;
    n++;
  }
}

/**
 * Whether the text between `from` and `to` is already wrapped in `marker`. Asterisks
 * count as runs, so *italic* inside **bold** is told apart: one or three around the
 * text mean italic, two or three mean bold.
 */
function wrapped(state: EditorState, from: number, to: number, marker: string): boolean {
  if (marker.startsWith("*")) {
    const before = run(state, from, "*", true);
    const after = run(state, to, "*", false);
    const ok = (n: number) => (marker === "*" ? n === 1 || n === 3 : n === 2 || n === 3);
    return ok(before) && ok(after);
  }
  const m = marker.length;
  return state.doc.sliceString(from - m, from) === marker && state.doc.sliceString(to, to + m) === marker;
}

/** Adds the marker around each selection, or removes it when it is already there. */
export function toggleFormat(state: EditorState, format: Format): TransactionSpec {
  const marker = MARKERS[format];
  const m = marker.length;
  return state.changeByRange((range) => {
    const { from, to } = range;
    if (wrapped(state, from, to, marker)) {
      return {
        changes: [
          { from: from - m, to: from },
          { from: to, to: to + m },
        ],
        range: EditorSelection.range(from - m, to - m),
      };
    }
    // A selection that includes its own markers is unwrapped too.
    const text = state.doc.sliceString(from, to);
    if (text.length >= 2 * m && text.startsWith(marker) && text.endsWith(marker) && !range.empty) {
      return {
        changes: { from, to, insert: text.slice(m, text.length - m) },
        range: EditorSelection.range(from, to - 2 * m),
      };
    }
    return {
      changes: [
        { from, insert: marker },
        { from: to, insert: marker },
      ],
      range: EditorSelection.range(from + m, to + m),
    };
  });
}

function command(format: Format) {
  return (view: EditorView) => {
    view.dispatch(view.state.update(toggleFormat(view.state, format), { userEvent: "input.format" }));
    return true;
  };
}

export interface FormattingLabels {
  bold: string;
  italic: string;
  strike: string;
}

const BUTTONS: { format: Format; text: string; style: string }[] = [
  { format: "bold", text: "B", style: "font-weight: 700" },
  { format: "italic", text: "I", style: "font-style: italic" },
  { format: "strike", text: "S", style: "text-decoration: line-through" },
];

/** A small bar above the selection with the formatting buttons. */
function selectionBar(labels: FormattingLabels) {
  const tooltip = (state: EditorState): Tooltip | null => {
    const range = state.selection.main;
    if (range.empty) return null;
    return {
      pos: range.from,
      above: true,
      arrow: false,
      create: (view) => {
        const dom = document.createElement("div");
        dom.className = "cm-format-bar";
        dom.setAttribute("role", "toolbar");
        // Inline, so the app's colours win over the editor's default tooltip theme.
        dom.style.cssText =
          "background: var(--bg-panel); border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(0,0,0,.15); color: var(--text)";
        for (const b of BUTTONS) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = b.text;
          button.setAttribute("style", b.style);
          button.title = labels[b.format];
          button.setAttribute("aria-label", labels[b.format]);
          // Keeps the selection in the editor while clicking.
          button.addEventListener("mousedown", (e) => e.preventDefault());
          button.addEventListener("click", () => command(b.format)(view));
          dom.append(button);
        }
        return { dom };
      },
    };
  };
  return StateField.define<Tooltip | null>({
    create: tooltip,
    update: (value, tr) => (tr.docChanged || tr.selection ? tooltip(tr.state) : value),
    provide: (field) => showTooltip.from(field),
  });
}

/** Cmd/Ctrl+B bold, Cmd/Ctrl+I italic, Cmd/Ctrl+Shift+X strikethrough, and the selection bar. */
export function formatting(labels: FormattingLabels): Extension {
  return [
    Prec.high(keymap.of([
      { key: "Mod-b", run: command("bold") },
      { key: "Mod-i", run: command("italic") },
      { key: "Mod-Shift-x", run: command("strike") },
    ])),
    selectionBar(labels),
    EditorView.baseTheme({
      ".cm-format-bar": {
        display: "flex",
        gap: "2px",
        padding: "3px",
        borderRadius: "6px",
        fontFamily: "var(--ui-font)",
      },
      ".cm-format-bar button": {
        minWidth: "28px",
        height: "26px",
        padding: "0 6px",
        border: "none",
        borderRadius: "4px",
        background: "transparent",
        color: "inherit",
        fontSize: "14px",
        cursor: "pointer",
      },
      ".cm-format-bar button:hover": { background: "var(--bg-hover)" },
      // Only while writing in this editor.
      "&:not(.cm-focused) .cm-format-bar": { display: "none" },
    }),
  ];
}
