import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
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
