import { syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, Facet, Prec, StateEffect, type Range, StateField, type Extension, type TransactionSpec } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from "@codemirror/view";
import { linkHandler } from "./links";
import { captionStart, formatTable, parseTable, splitRow, tableModel, type ParsedTable, type TableCell, type TableModel } from "../core/tables";

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

const rawLine = Decoration.line({ class: "md-table-raw" });
const captionLine = Decoration.line({ class: "md-caption" });

function build(state: EditorState): DecorationSet {
  const hasFocus = state.field(focused);
  const ranges: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "Table") return;
      const first = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(node.to);
      // The caption after the table, "Tabella: …", shows as a caption, its label hidden
      // away from the cursor.
      const next = node.node.nextSibling;
      const start = next?.name === "Paragraph" ? captionStart(state.doc.sliceString(next.from, next.to)) : 0;
      if (next && start) {
        ranges.push(captionLine.range(state.doc.lineAt(next.from).from));
        const editing = hasFocus && state.selection.ranges.some((r) => r.to >= next.from && r.from <= next.to);
        if (!editing) ranges.push(Decoration.replace({}).range(next.from, next.from + start));
      }
      // While the cursor is in the table, it shows as typed, in even letters so that its
      // columns line up, with the bar to change it above.
      if (hasFocus && state.selection.ranges.some((r) => r.to >= first.from && r.from <= last.to)) {
        if (!state.readOnly) ranges.push(Decoration.widget({ widget: new TableBar(), block: true, side: -1 }).range(first.from));
        for (let n = first.number; n <= last.number; n++) ranges.push(rawLine.range(state.doc.line(n).from));
        return false;
      }
      const lines = [];
      for (let n = first.number; n <= last.number; n++) {
        const l = state.doc.line(n);
        lines.push({ text: l.text, from: l.from });
      }
      const table = parseTable(lines);
      if (table) {
        const source = state.doc.sliceString(first.from, last.to);
        ranges.push(Decoration.replace({ widget: new TableWidget(source, table), block: true }).range(first.from, last.to));
      }
      return false;
    },
  });
  return Decoration.set(ranges, true);
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
  const empty = ["", "", ""];
  const insert = `${before}${formatTable({ align: [null, null, null], rows: [empty, empty, empty] }).join("\n")}\n`;
  const at = line.text.trim() ? line.to : line.from;
  return {
    changes: { from: at, to: line.text.trim() ? at : line.to, insert },
    selection: EditorSelection.cursor(at + before.length + 2),
  };
}

/** The positions of the bars that separate a row's cells; a bar in [[…]] or escaped is text. */
function bars(text: string): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === "[" && text[i + 1] === "[") (depth++, i++);
    else if (c === "]" && text[i + 1] === "]" && depth > 0) (depth--, i++);
    else if (c === "|" && depth === 0) out.push(i);
  }
  return out;
}

/** Where the cursor goes in each cell of a row: after the bar and one space. */
function cellStops(text: string): number[] {
  const all = bars(text);
  const stops: number[] = [];
  const closed = /\|\s*$/.test(text);
  const open = /^\s*\|/.test(text);
  if (!open) stops.push(text.match(/^\s*/)![0].length);
  for (let k = 0; k < all.length - (closed ? 1 : 0); k++) {
    const pos = all[k] + 1;
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

/** The table at the cursor as a model, with the cell the cursor is in. */
interface TableAt {
  first: number;
  last: number;
  model: TableModel;
  /** 0 for the header (and its delimiter row), then the rows of the body. */
  row: number;
  col: number;
  /** Where the cursor is in the cell's text. */
  offset: number;
}

function tableAt(state: EditorState): TableAt | null {
  // A scene someone else is writing cannot be changed from here.
  if (state.readOnly) return null;
  const around = tableAround(state);
  if (!around) return null;
  const lines: string[] = [];
  for (let n = around.first; n <= around.last; n++) lines.push(state.doc.line(n).text);
  const model = tableModel(lines);
  if (!model) return null;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const index = line.number - around.first;
  const row = index <= 1 ? 0 : index - 1;
  const at = head - line.from;
  const leading = /^\s*\|/.test(line.text) ? 1 : 0;
  const col = Math.min(model.align.length - 1, Math.max(0, bars(line.text).filter((b) => b < at).length - leading));
  const cell = index === 1 ? undefined : splitRow(line.text, 0, true)[col];
  const offset = cell ? Math.min(cell.text.length, Math.max(0, at - cell.from)) : 0;
  return { ...around, model, row, col, offset };
}

/**
 * Writes the table back with its columns lined up and puts the cursor in cell `row`,
 * `col`: at `offset` in its text, or at its end.
 */
function writeTable(view: EditorView, at: TableAt, model: TableModel, row: number, col: number, offset: number | "end" = "end") {
  const lines = formatTable(model);
  const from = view.state.doc.line(at.first).from;
  const to = view.state.doc.line(at.last).to;
  const index = row === 0 ? 0 : row + 1;
  let start = from;
  for (let i = 0; i < index; i++) start += lines[i].length + 1;
  const text = model.rows[row][col];
  const anchor = start + cellStops(lines[index])[col] + (offset === "end" ? text.length : Math.min(offset, text.length));
  view.dispatch({ changes: { from, to, insert: lines.join("\n") }, selection: { anchor }, scrollIntoView: true, userEvent: "input" });
}

const emptyRow = (model: TableModel) => model.align.map(() => "");
const copy = (model: TableModel): TableModel => ({ align: [...model.align], rows: model.rows.map((r) => [...r]) });

/** Tab and Shift+Tab go from cell to cell, lining the columns up; Tab after the last cell adds a row. */
function moveCell(forward: boolean) {
  return (view: EditorView): boolean => {
    const at = tableAt(view.state);
    if (!at || !view.state.selection.main.empty) return false;
    const model = copy(at.model);
    const columns = model.align.length;
    let { row, col } = at;
    if (forward) {
      if (++col >= columns) {
        col = 0;
        if (++row >= model.rows.length) model.rows.push(emptyRow(model));
      }
    } else if (--col < 0) {
      if (row === 0) col = 0;
      else (row--, (col = columns - 1));
    }
    writeTable(view, at, model, row, col);
    return true;
  };
}

/** Enter adds a row under the cursor's; on an empty last row it leaves the table, as in Obsidian. */
function newRow(view: EditorView): boolean {
  const at = tableAt(view.state);
  if (!at || !view.state.selection.main.empty) return false;
  const { model, row } = at;
  if (row === model.rows.length - 1 && row > 0 && model.rows[row].every((c) => !c.trim())) {
    const last = view.state.doc.line(at.last);
    const from = view.state.doc.line(at.last - 1).to;
    view.dispatch({ changes: { from, to: last.to, insert: "\n\n" }, selection: { anchor: from + 2 }, scrollIntoView: true, userEvent: "input" });
    return true;
  }
  const next = copy(model);
  next.rows.splice(row + 1, 0, emptyRow(model));
  writeTable(view, at, next, row + 1, 0);
  return true;
}

export type TableAction = "rowAbove" | "rowBelow" | "deleteRow" | "columnLeft" | "columnRight" | "deleteColumn" | "alignLeft" | "alignCenter" | "alignRight";

/** Changes the table at the cursor; false when the cursor is not in a table or the change cannot be made. */
export function tableCommand(view: EditorView, action: TableAction): boolean {
  const at = tableAt(view.state);
  if (!at) return false;
  const model = copy(at.model);
  let { row, col } = at;
  let offset: number | "end" = at.offset;
  switch (action) {
    case "rowAbove":
      // Above the header, the new row becomes the header and the old one the first row.
      model.rows.splice(row, 0, emptyRow(model));
      offset = 0;
      break;
    case "rowBelow":
      model.rows.splice(++row, 0, emptyRow(model));
      offset = 0;
      break;
    case "deleteRow":
      if (model.rows.length < 2) return false;
      model.rows.splice(row, 1);
      row = Math.min(row, model.rows.length - 1);
      offset = "end";
      break;
    case "columnLeft":
    case "columnRight": {
      const index = action === "columnLeft" ? col : col + 1;
      model.align.splice(index, 0, null);
      for (const r of model.rows) r.splice(index, 0, "");
      col = index;
      offset = 0;
      break;
    }
    case "deleteColumn":
      if (model.align.length < 2) return false;
      model.align.splice(col, 1);
      for (const r of model.rows) r.splice(col, 1);
      col = Math.min(col, model.align.length - 1);
      offset = "end";
      break;
    default: {
      const align = action === "alignLeft" ? "left" : action === "alignCenter" ? "center" : "right";
      // The same alignment again takes it off.
      model.align[col] = model.align[col] === align ? null : align;
    }
  }
  writeTable(view, at, model, row, col, offset);
  return true;
}

/** Names of the table bar's buttons, in the interface language. */
export interface TableLabels {
  row: string;
  column: string;
  above: string;
  below: string;
  left: string;
  right: string;
  delete: string;
  align: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}

const ENGLISH: TableLabels = {
  row: "Row",
  column: "Column",
  above: "Above",
  below: "Below",
  left: "Left",
  right: "Right",
  delete: "Delete",
  align: "Align",
  alignLeft: "Align left",
  alignCenter: "Center",
  alignRight: "Align right",
};

export const tableLabels = Facet.define<TableLabels, TableLabels>({
  combine: (values) => values[0] ?? ENGLISH,
});

/** The bar over a table being edited: rows and columns to add or remove, the column's alignment. */
class TableBar extends WidgetType {
  eq() {
    return true;
  }
  toDOM(view: EditorView) {
    const labels = view.state.facet(tableLabels);
    const bar = document.createElement("div");
    bar.className = "md-table-bar";
    const group = (name: string, buttons: [string, string, TableAction][]) => {
      const g = document.createElement("span");
      g.className = "md-table-group";
      const label = document.createElement("span");
      label.className = "md-table-label";
      label.textContent = name;
      g.append(label);
      for (const [text, title, action] of buttons) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.title = title;
        b.dataset.action = action;
        g.append(b);
      }
      bar.append(g);
    };
    group(labels.row, [
      [`+ ${labels.above}`, `${labels.row}: ${labels.above}`, "rowAbove"],
      [`+ ${labels.below}`, `${labels.row}: ${labels.below}`, "rowBelow"],
      [labels.delete, `${labels.row}: ${labels.delete}`, "deleteRow"],
    ]);
    group(labels.column, [
      [`+ ${labels.left}`, `${labels.column}: ${labels.left}`, "columnLeft"],
      [`+ ${labels.right}`, `${labels.column}: ${labels.right}`, "columnRight"],
      [labels.delete, `${labels.column}: ${labels.delete}`, "deleteColumn"],
    ]);
    group(labels.align, [
      ["⇤", labels.alignLeft, "alignLeft"],
      ["↔", labels.alignCenter, "alignCenter"],
      ["⇥", labels.alignRight, "alignRight"],
    ]);
    // The cursor stays in its cell: the buttons act on it.
    bar.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const action = (event.target as HTMLElement).closest<HTMLElement>("button")?.dataset.action as TableAction | undefined;
      if (action) tableCommand(view, action);
    });
    return bar;
  }
  ignoreEvent() {
    return true;
  }
}

/** A table left by the cursor gets its columns lined up again, as the typing may have moved them. */
const formatOnLeave = EditorState.transactionFilter.of((tr) => {
  if (tr.docChanged || !tr.selection || !tr.isUserEvent("select") || tr.startState.readOnly) return tr;
  const around = tableAround(tr.startState);
  if (!around) return tr;
  const { doc } = tr.startState;
  const from = doc.line(around.first).from;
  const to = doc.line(around.last).to;
  const head = tr.newSelection.main.head;
  if (head >= from && head <= to) return tr;
  const lines: string[] = [];
  for (let n = around.first; n <= around.last; n++) lines.push(doc.line(n).text);
  const model = tableModel(lines);
  const text = model ? formatTable(model).join("\n") : null;
  if (!text || text === lines.join("\n")) return tr;
  return [tr, { changes: { from, to, insert: text }, sequential: true }];
});

const tableKeys = Prec.high(
  keymap.of([
    { key: "Tab", run: moveCell(true) },
    { key: "Shift-Tab", run: moveCell(false) },
    { key: "Enter", run: newRow },
  ]),
);

/** Markdown tables drawn as tables, away from the cursor, as in Obsidian's live preview. */
export const tablePreview: Extension = [focused, tables, tableKeys, formatOnLeave];
