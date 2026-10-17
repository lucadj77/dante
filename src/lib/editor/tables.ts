import { syntaxTree } from "@codemirror/language";
import { EditorSelection, Prec, RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension, type TransactionSpec } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from "@codemirror/view";
import { linkHandler } from "./links";
import { parseTable, type ParsedTable, type TableCell } from "../core/tables";

// The inline Markdown a cell can hold: wikilinks, bold, italics, highlight, strikethrough, code.
const INLINE = /\[\[([^\[\]|\n]+)(?:\|([^\[\]\n]+))?\]\]|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|==(.+?)==|~~(.+?)~~|`([^`]+)`/g;

function renderInline(text: string, parent: HTMLElement, resolves: ((t: string) => boolean) | null) {
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) parent.append(text.slice(last, m.index));
    last = m.index! + m[0].length;
    let el: HTMLElement;
    if (m[1] !== undefined) {
      el = document.createElement("span");
      const target = m[1].split("#")[0].trim();
      el.className = resolves && !resolves(target) ? "md-wikilink md-unresolved" : "md-wikilink";
      el.dataset.target = target;
      el.textContent = m[2] ?? m[1];
      parent.append(el);
      continue;
    }
    const [tag, cls, inner] =
      m[3] !== undefined || m[4] !== undefined
        ? ["strong", "md-strong", m[3] ?? m[4]]
        : m[5] !== undefined || m[6] !== undefined
          ? ["em", "md-em", m[5] ?? m[6]]
          : m[7] !== undefined
            ? ["mark", "md-highlight", m[7]]
            : m[8] !== undefined
              ? ["s", "md-strike", m[8]]
              : ["code", "md-code", m[9]];
    el = document.createElement(tag);
    el.className = cls;
    if (tag === "code") el.textContent = inner;
    else renderInline(inner, el, resolves);
    parent.append(el);
  }
  if (last < text.length) parent.append(text.slice(last));
}

class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly table: ParsedTable,
  ) {
    super();
  }
  eq(other: TableWidget) {
    return other.source === this.source && other.table.header[0]?.from === this.table.header[0]?.from;
  }
  toDOM(view: EditorView) {
    const links = view.state.facet(linkHandler);
    const resolves = links ? (t: string) => links.resolves(t) : null;
    const wrap = document.createElement("div");
    wrap.className = "md-table-wrap";
    const table = document.createElement("table");
    table.className = "md-table";
    const columns = this.table.header.length;
    const row = (cells: TableCell[], tag: "th" | "td") => {
      const tr = document.createElement("tr");
      for (let i = 0; i < columns; i++) {
        const cell = document.createElement(tag);
        const align = this.table.align[i];
        if (align) cell.style.textAlign = align;
        const c = cells[i];
        if (c) {
          cell.dataset.pos = String(c.from);
          renderInline(c.text, cell, resolves);
        }
        tr.append(cell);
      }
      return tr;
    };
    const head = document.createElement("thead");
    head.append(row(this.table.header, "th"));
    const body = document.createElement("tbody");
    for (const r of this.table.rows) body.append(row(r, "td"));
    table.append(head, body);
    wrap.append(table);

    // A click on a link follows it; anywhere else it puts the cursor in that cell, which
    // shows the table as typed.
    wrap.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      event.preventDefault();
      const link = target.closest<HTMLElement>(".md-wikilink");
      if (link?.dataset.target && links) {
        links.open(link.dataset.target, event.altKey);
        return;
      }
      const cell = target.closest<HTMLElement>("[data-pos]");
      const pos = cell ? Number(cell.dataset.pos) : this.table.header[0]?.from ?? 0;
      view.focus();
      view.dispatch({ selection: { anchor: Math.min(pos, view.state.doc.length) }, scrollIntoView: true });
    });
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

/** Whether the editor has the focus, kept in the state for decorations built there. */
export const setFocus = StateEffect.define<boolean>();
export const focused = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setFocus)) value = e.value;
    return value;
  },
  provide: () => EditorView.focusChangeEffect.of((_state, focusing) => setFocus.of(focusing)),
});

function build(state: EditorState): DecorationSet {
  const hasFocus = state.field(focused);
  const builder = new RangeSetBuilder<Decoration>();
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "Table") return;
      const first = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(node.to);
      // While the cursor is in the table, it shows as typed.
      if (hasFocus && state.selection.ranges.some((r) => r.to >= first.from && r.from <= last.to)) return false;
      const lines = [];
      for (let n = first.number; n <= last.number; n++) {
        const l = state.doc.line(n);
        lines.push({ text: l.text, from: l.from });
      }
      const table = parseTable(lines);
      if (table) {
        const source = state.doc.sliceString(first.from, last.to);
        builder.add(first.from, last.to, Decoration.replace({ widget: new TableWidget(source, table), block: true }));
      }
      return false;
    },
  });
  return builder.finish();
}

// Block widgets cannot come from a view plugin, so the tables live in a state field.
const tables = StateField.define<DecorationSet>({
  create: build,
  update(value, tr) {
    const focusChanged = tr.effects.some((e) => e.is(setFocus));
    if (tr.docChanged || tr.selection || focusChanged || syntaxTree(tr.state) !== syntaxTree(tr.startState)) return build(tr.state);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** A new table of three columns and two rows after the current line, the cursor in its first cell. */
export function insertTable(state: EditorState): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.to);
  const before = line.text.trim() ? "\n\n" : "";
  const row = "|     |     |     |";
  const insert = `${before}${row}\n| --- | --- | --- |\n${row}\n${row}\n`;
  const at = line.text.trim() ? line.to : line.from;
  return {
    changes: { from: at, to: line.text.trim() ? at : line.to, insert },
    selection: EditorSelection.cursor(at + before.length + 2),
  };
}

/** Where the cursor goes in each cell of a row: after the bar and one space. */
function cellStops(text: string): number[] {
  const bars: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === "[" && text[i + 1] === "[") (depth++, i++);
    else if (c === "]" && text[i + 1] === "]" && depth > 0) (depth--, i++);
    else if (c === "|" && depth === 0) bars.push(i);
  }
  const stops: number[] = [];
  const closed = /\|\s*$/.test(text);
  for (let k = 0; k < bars.length - (closed ? 1 : 0); k++) {
    const pos = bars[k] + 1;
    stops.push(text[pos] === " " ? pos + 1 : pos);
  }
  return stops;
}

/** The table around the cursor's line, as lines of the document; null outside a table. */
function tableAround(state: EditorState): { first: number; last: number } | null {
  const pos = state.selection.main.head;
  for (let node: ReturnType<typeof syntaxTree>["topNode"] | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
    if (node.name === "Table") return { first: state.doc.lineAt(node.from).number, last: state.doc.lineAt(node.to).number };
  }
  return null;
}

const isDelimiter = (text: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(text);

/** Tab and Shift+Tab go from cell to cell; Tab after the last cell and Enter add a row. */
function moveCell(forward: boolean) {
  return (view: EditorView): boolean => {
    const { state } = view;
    const table = tableAround(state);
    if (!table || !state.selection.main.empty) return false;
    const head = state.selection.main.head;
    const stops: number[] = [];
    for (let n = table.first; n <= table.last; n++) {
      const line = state.doc.line(n);
      if (n === table.first + 1 && isDelimiter(line.text)) continue;
      for (const s of cellStops(line.text)) stops.push(line.from + s);
    }
    if (forward) {
      const next = stops.find((s) => s > head);
      if (next !== undefined) view.dispatch({ selection: { anchor: next }, scrollIntoView: true });
      else addRow(view, table.last);
    } else {
      const previous = [...stops].reverse().find((s) => s < head);
      if (previous !== undefined) view.dispatch({ selection: { anchor: previous }, scrollIntoView: true });
    }
    return true;
  };
}

function addRow(view: EditorView, after: number) {
  const line = view.state.doc.line(after);
  const columns = Math.max(1, cellStops(line.text).length);
  const row = "\n|" + "     |".repeat(columns);
  view.dispatch({ changes: { from: line.to, insert: row }, selection: { anchor: line.to + 3 }, scrollIntoView: true, userEvent: "input" });
}

function newRow(view: EditorView): boolean {
  const table = tableAround(view.state);
  if (!table || !view.state.selection.main.empty) return false;
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const n = line.number;
  // Enter on an empty last row leaves the table, as in Obsidian: the row goes.
  if (n === table.last && n > table.first + 1 && /^[\s|]*$/.test(line.text)) {
    const from = view.state.doc.line(n - 1).to;
    view.dispatch({ changes: { from, to: line.to, insert: "\n\n" }, selection: { anchor: from + 2 }, scrollIntoView: true, userEvent: "input" });
    return true;
  }
  // In the header, the new row goes below the delimiter.
  addRow(view, n === table.first ? Math.min(table.first + 1, table.last) : n);
  return true;
}

const tableKeys = Prec.high(
  keymap.of([
    { key: "Tab", run: moveCell(true) },
    { key: "Shift-Tab", run: moveCell(false) },
    { key: "Enter", run: newRow },
  ]),
);

/** Markdown tables drawn as tables, away from the cursor, as in Obsidian's live preview. */
export const tablePreview: Extension = [focused, tables, tableKeys];
