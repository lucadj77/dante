import { EditorSelection, Prec, StateField, type EditorState, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, keymap, showTooltip, type Tooltip } from "@codemirror/view";
import type { IconName } from "$lib/ui/Icon.svelte";
import { criticHandler } from "./critic";
import { toggleAlign } from "./alignment";

export type Format = "bold" | "italic" | "strike" | "highlight";
export type LineFormat = "quote" | "bullet" | "ordered" | "task";
export type AlignAction = "alignCenter" | "alignRight";
export type Action = Format | LineFormat | AlignAction | "heading" | "code" | "link" | "wikilink" | "separator" | "comment";

const MARKERS: Record<Format, string> = { bold: "**", italic: "*", strike: "~~", highlight: "==" };

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
export function toggleWrap(state: EditorState, marker: string): TransactionSpec {
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

export function toggleFormat(state: EditorState, format: Format): TransactionSpec {
  return toggleWrap(state, MARKERS[format]);
}

// What may open a line: a heading, a quote, or a list item with its checkbox.
const HEADING = /^#{1,6} /;
const QUOTE = /^> ?/;
const TASK = /^[-*+] \[[ xX]\] /;
const BULLET = /^[-*+] (?!\[[ xX]\] )/;
const ORDERED = /^\d+[.)] /;
const LINE_PATTERNS: Record<LineFormat, RegExp> = { quote: QUOTE, bullet: BULLET, ordered: ORDERED, task: TASK };
const ANY_PREFIX = /^(?:#{1,6} |> ?|[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/;

/** Line numbers covered by the selection, each once. */
function selectedLines(state: EditorState): number[] {
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) lines.add(n);
  }
  return [...lines].sort((a, b) => a - b);
}

/** Replaces the opening of each selected line, keeping the selection on the same text. */
function setPrefixes(state: EditorState, prefix: (line: number, index: number, current: string) => string): TransactionSpec {
  const changes = selectedLines(state).map((n, i) => {
    const line = state.doc.line(n);
    const current = ANY_PREFIX.exec(line.text)?.[0] ?? "";
    return { from: line.from, to: line.from + current.length, insert: prefix(n, i, current) };
  });
  const set = state.changes(changes);
  return { changes: set, selection: state.selection.map(set, 1) };
}

/** Makes the selected lines a quote or a list, or plain lines again if they already are. */
export function toggleLines(state: EditorState, format: LineFormat): TransactionSpec {
  const pattern = LINE_PATTERNS[format];
  const all = selectedLines(state).every((n) => pattern.test(state.doc.line(n).text));
  const prefixes: Record<LineFormat, (i: number) => string> = {
    quote: () => "> ",
    bullet: () => "- ",
    ordered: (i) => `${i + 1}. `,
    task: () => "- [ ] ",
  };
  return setPrefixes(state, (_, i) => (all ? "" : prefixes[format](i)));
}

/** Plain line, then heading 1, 2 and 3, then plain again. */
export function cycleHeading(state: EditorState): TransactionSpec {
  const first = state.doc.lineAt(state.selection.main.from).text;
  const level = (HEADING.exec(first)?.[0].length ?? 1) - 1;
  const next = level >= 3 ? 0 : level + 1;
  return setPrefixes(state, () => (next ? "#".repeat(next) + " " : ""));
}

/** Inline code within a line; a fenced block around several lines. */
export function toggleCode(state: EditorState): TransactionSpec {
  const { from, to } = state.selection.main;
  const a = state.doc.lineAt(from);
  const b = state.doc.lineAt(to);
  if (a.number === b.number && !(from === a.from && to === a.to && from !== to)) return toggleWrap(state, "`");
  const before = a.number > 1 ? state.doc.line(a.number - 1) : null;
  const after = b.number < state.doc.lines ? state.doc.line(b.number + 1) : null;
  if (before?.text.startsWith("```") && after?.text.startsWith("```")) {
    const changes = state.changes([
      { from: before.from, to: a.from },
      { from: b.to, to: after.to },
    ]);
    return { changes, selection: state.selection.map(changes, 1) };
  }
  const changes = state.changes([
    { from: a.from, insert: "```\n" },
    { from: b.to, insert: "\n```" },
  ]);
  // The selection stays on the code, inside the fences.
  return { changes, selection: EditorSelection.range(from + 4, to + 4) };
}

/** [text](address), with the cursor where the address goes. */
export function insertLink(state: EditorState): TransactionSpec {
  return state.changeByRange(({ from, to }) => ({
    changes: [
      { from, insert: "[" },
      { from: to, insert: "]()" },
    ],
    range: EditorSelection.cursor(to + 3),
  }));
}

/** [[selection]], or [[ ]] with the cursor inside. */
export function insertWikilink(state: EditorState): TransactionSpec {
  return state.changeByRange(({ from, to }) => ({
    changes: [
      { from, insert: "[[" },
      { from: to, insert: "]]" },
    ],
    range: from === to ? EditorSelection.cursor(from + 2) : EditorSelection.range(from + 2, to + 2),
  }));
}

/** A scene separator on its own paragraph after the current line. */
export function insertSeparator(state: EditorState): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.to);
  const insert = (line.text.trim() ? "\n\n" : "") + "* * *\n\n";
  return {
    changes: { from: line.to, insert },
    selection: EditorSelection.cursor(line.to + insert.length),
  };
}

function transaction(state: EditorState, action: Exclude<Action, "comment">): TransactionSpec {
  switch (action) {
    case "bold":
    case "italic":
    case "strike":
    case "highlight":
      return toggleFormat(state, action);
    case "quote":
    case "bullet":
    case "ordered":
    case "task":
      return toggleLines(state, action);
    case "heading":
      return cycleHeading(state);
    case "code":
      return toggleCode(state);
    case "link":
      return insertLink(state);
    case "wikilink":
      return insertWikilink(state);
    case "separator":
      return insertSeparator(state);
    case "alignCenter":
      return toggleAlign(state, "center");
    case "alignRight":
      return toggleAlign(state, "right");
  }
}

/** Applies a formatting action to the editor's selection. */
export function applyFormat(view: EditorView, action: Action): boolean {
  if (action === "comment") {
    const { from, to } = view.state.selection.main;
    view.state.facet(criticHandler)?.newComment(view, from, to);
    return true;
  }
  view.dispatch(view.state.update(transaction(view.state, action), { userEvent: "input.format", scrollIntoView: true }));
  return true;
}

/** Buttons in the order they are shown; null separates groups. */
export const ACTIONS: (Action | null)[] = [
  "bold", "italic", "strike", "highlight", null,
  "heading", "quote", "bullet", "ordered", "task", null,
  "alignCenter", "alignRight", null,
  "code", "link", "wikilink", "separator", null,
  "comment",
];

/** What each button shows, as text, with an inline style where the glyph is the style itself. */
export const ICONS: Record<Action, { text: string; style?: string; icon?: IconName }> = {
  bold: { text: "B", style: "font-weight: 700" },
  italic: { text: "I", style: "font-style: italic; font-family: Georgia, serif" },
  strike: { text: "S", style: "text-decoration: line-through" },
  highlight: { text: "H", style: "background: #f5e27a; color: #222; padding: 0 3px; border-radius: 2px" },
  heading: { text: "T", style: "font-weight: 700; font-family: Georgia, serif" },
  quote: { text: "❝" },
  bullet: { text: "•≡" },
  ordered: { text: "1≡" },
  task: { text: "☑" },
  alignCenter: { text: "≡", icon: "alignCenter" },
  alignRight: { text: "≡", icon: "alignRight" },
  code: { text: "</>", style: "font-family: ui-monospace, monospace; font-size: 12px" },
  link: { text: "🔗︎" },
  wikilink: { text: "[[ ]]", style: "font-size: 12px" },
  separator: { text: "✱✱✱", style: "font-size: 10px; letter-spacing: 1px" },
  comment: { text: "💬︎" },
};

export type FormattingLabels = Record<Action, string>;

/** Inline actions offered in the bar over a selection; the fixed bar has them all. */
const SELECTION_ACTIONS: (Action | null)[] = ["bold", "italic", "strike", "highlight", null, "code", "link", "wikilink", null, "comment"];

/** Fills `dom` with buttons that apply actions to the editor `view()` returns. */
export function fillBar(dom: HTMLElement, actions: (Action | null)[], labels: FormattingLabels, view: () => EditorView | null) {
  for (const action of actions) {
    if (action === null) {
      const gap = document.createElement("span");
      gap.className = "cm-format-gap";
      dom.append(gap);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    const icon = document.createElement("span");
    icon.textContent = ICONS[action].text;
    if (ICONS[action].style) icon.setAttribute("style", ICONS[action].style!);
    button.append(icon);
    button.title = labels[action];
    button.setAttribute("aria-label", labels[action]);
    // Keeps the selection in the editor while clicking.
    button.addEventListener("mousedown", (e) => e.preventDefault());
    button.addEventListener("click", () => {
      const v = view();
      if (v) applyFormat(v, action);
    });
    dom.append(button);
  }
}

/** A small bar above the selection with the inline formatting buttons. */
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
        fillBar(dom, SELECTION_ACTIONS, labels, () => view);
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

const run_ = (action: Action) => (view: EditorView) => applyFormat(view, action);

/** Keyboard shortcuts, the bar over a selection, and its look. */
export function formatting(labels: FormattingLabels): Extension {
  return [
    Prec.high(
      keymap.of([
        { key: "Mod-b", run: run_("bold") },
        { key: "Mod-i", run: run_("italic") },
        { key: "Mod-Shift-x", run: run_("strike") },
        { key: "Mod-Shift-h", run: run_("highlight") },
        { key: "Mod-e", run: run_("code") },
        { key: "Mod-k", run: run_("link") },
        { key: "Mod-Shift-7", run: run_("ordered") },
        { key: "Mod-Shift-8", run: run_("bullet") },
        { key: "Mod-Shift-9", run: run_("task") },
        { key: "Mod-Shift-.", run: run_("quote") },
        { key: "Mod-Shift-e", run: run_("alignCenter") },
        { key: "Mod-Shift-r", run: run_("alignRight") },
      ]),
    ),
    selectionBar(labels),
    EditorView.baseTheme({
      ".cm-format-bar": {
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "3px",
        borderRadius: "6px",
        fontFamily: "var(--ui-font)",
      },
      // Only while writing in this editor.
      "&:not(.cm-focused) .cm-format-bar": { display: "none" },
    }),
  ];
}
