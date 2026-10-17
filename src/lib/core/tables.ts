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
