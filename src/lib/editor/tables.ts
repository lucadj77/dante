import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { linkHandler } from "./links";

type Align = "left" | "center" | "right" | null;

export interface TableCell {
  text: string;
  /** Where the cell's text starts in the document, so a click can put the cursor there. */
  from: number;
}

export interface ParsedTable {
  header: TableCell[];
  align: Align[];
  rows: TableCell[][];
}

/**
 * The cells of a table row. A "|" inside [[…]] or escaped as "\|" stays in its cell, as in
 * Obsidian, where [[note\|alias]] is how an alias is written in a table.
 */
export function splitRow(line: string, offset = 0): TableCell[] {
  const cells: TableCell[] = [];
  let start = 0;
  let depth = 0;
  const push = (end: number) => {
    const raw = line.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    cells.push({ text: raw.trim().replace(/\\\|/g, "|"), from: offset + start + lead });
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\") {
      i++;
    } else if (c === "[" && line[i + 1] === "[") {
      depth++;
      i++;
    } else if (c === "]" && line[i + 1] === "]" && depth > 0) {
      depth--;
      i++;
    } else if (c === "|" && depth === 0) {
      push(i);
      start = i + 1;
    }
  }
  push(line.length);
  // The pipes at the two ends of a row are optional and enclose nothing.
  if (/^\s*\|/.test(line)) cells.shift();
  if (/\|\s*$/.test(line.replace(/\\\|/g, "  ")) && cells.length > 0) cells.pop();
  return cells;
}

/** A Markdown table from its lines, or null if the second line is not a delimiter row. */
export function parseTable(lines: { text: string; from: number }[]): ParsedTable | null {
  if (lines.length < 2) return null;
  const delimiter = splitRow(lines[1].text);
  if (delimiter.length === 0 || !delimiter.every((c) => /^:?-+:?$/.test(c.text))) return null;
  const align = delimiter.map((c): Align => {
    const left = c.text.startsWith(":");
    const right = c.text.endsWith(":");
    return left && right ? "center" : right ? "right" : left ? "left" : null;
  });
  return {
    header: splitRow(lines[0].text, lines[0].from),
    align,
    rows: lines.slice(2).map((l) => splitRow(l.text, l.from)),
  };
}

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

const setFocus = StateEffect.define<boolean>();
const focused = StateField.define<boolean>({
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

/** Markdown tables drawn as tables, away from the cursor, as in Obsidian's live preview. */
export const tablePreview: Extension = [focused, tables];
