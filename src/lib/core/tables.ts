// Markdown tables, as GitHub and Obsidian write them: a header row, a delimiter row
// (|---|:---:|) and the rows of the body.

export type CellAlign = "left" | "center" | "right" | null;

export interface TableCell {
  text: string;
  /** Where the cell's text starts in the document, so a click can put the cursor there. */
  from: number;
}

export interface ParsedTable {
  header: TableCell[];
  align: CellAlign[];
  rows: TableCell[][];
}

/**
 * The cells of a table row. A "|" inside [[…]] or escaped as "\|" stays in its cell, as in
 * Obsidian, where [[note\|alias]] is how an alias is written in a table.
 */
export function splitRow(line: string, offset = 0, keepEscapes = false): TableCell[] {
  const cells: TableCell[] = [];
  let start = 0;
  let depth = 0;
  const push = (end: number) => {
    const raw = line.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    cells.push({ text: keepEscapes ? text : text.replace(/\\\|/g, "|"), from: offset + start + lead });
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
  const align = delimiter.map((c): CellAlign => {
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

/** A table as its cells' Markdown, to change and write back. */
export interface TableModel {
  align: CellAlign[];
  /** The header first, then the rows of the body; every row has a cell per column. */
  rows: string[][];
}

/** The model of a table's lines, or null when they are not a table. */
export function tableModel(lines: string[]): TableModel | null {
  const parsed = parseTable(lines.map((text) => ({ text, from: 0 })));
  if (!parsed) return null;
  const rows = [lines[0], ...lines.slice(2)].map((l) => splitRow(l, 0, true).map((c) => c.text));
  const columns = Math.max(parsed.align.length, ...rows.map((r) => r.length));
  return {
    align: Array.from({ length: columns }, (_, i) => parsed.align[i] ?? null),
    rows: rows.map((r) => Array.from({ length: columns }, (_, i) => r[i] ?? "")),
  };
}

const width = (text: string) => [...text].length;

/**
 * The table written with its columns lined up, so that it reads as a table in the text
 * too, as Obsidian's Advanced Tables does. Each cell is padded to its column's width.
 */
export function formatTable(model: TableModel): string[] {
  const widths = model.align.map((a, i) => Math.max(a === "center" ? 5 : 3, ...model.rows.map((r) => width(r[i] ?? ""))));
  const row = (cells: string[]) => `| ${cells.map((c, i) => c + " ".repeat(widths[i] - width(c))).join(" | ")} |`;
  const rule = (a: CellAlign, w: number) =>
    a === "center" ? `:${"-".repeat(w - 2)}:` : a === "right" ? `${"-".repeat(w - 1)}:` : a === "left" ? `:${"-".repeat(w - 1)}` : "-".repeat(w);
  const [header, ...body] = model.rows;
  return [row(header), `| ${model.align.map((a, i) => rule(a, widths[i])).join(" | ")} |`, ...body.map(row)];
}

// A table's caption, in the paragraph after it, as Pandoc writes it: "Table: …" or ": …";
// "Tabella:" and the like in the languages Dante knows. Typography may have put a space
// before the colon.
const CAPTION = /^(?:(?:table|tabella|tabla|tableau)[ \t  ]*)?:[ \t]+(?=\S)/i;

/** Where the caption's text starts in a paragraph that is a table caption; 0 when it is not one. */
export function captionStart(paragraph: string): number {
  return CAPTION.exec(paragraph)?.[0].length ?? 0;
}
