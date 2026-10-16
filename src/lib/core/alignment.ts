// Paragraph alignment. Markdown has none, so an aligned paragraph is wrapped in an HTML
// span that a browser (and Obsidian's reading view) shows as a block of its own:
//
//   <span style="display:block;text-align:center">Fine</span>
//
// The span is inline HTML, so Markdown inside it (*italic*, **bold**, links) is still read
// as Markdown, by Dante and by other apps. Paragraphs without it follow the default: left
// while writing, justified or left in the export, as its settings say. Paragraphs wrapped in
// <p align="right">, <div style="text-align: right"> and the like, written elsewhere, are
// read too.

export type Align = "left" | "center" | "right" | "justify";

const VALUE = "(left|center|right|justify)";
const OPEN = new RegExp(
  `^<(span|p|div)\\s[^>]*?(?:text-align\\s*:\\s*${VALUE}|\\balign\\s*=\\s*["']?${VALUE}\\b["']?)[^>]*>`,
  "i",
);

/** The opening tag Dante writes for an alignment. */
export function alignOpen(align: Align): string {
  return `<span style="display:block;text-align:${align}">`;
}
export const ALIGN_CLOSE = "</span>";

export interface AlignedText {
  align: Align;
  /** Length of the opening tag, at the start of the text. */
  open: number;
  /** Length of the closing tag, at the end of the text (after trailing spaces are left out). */
  close: number;
}

/** The alignment of a paragraph's text, when it is wrapped in an aligning tag. */
export function readAlignment(text: string): AlignedText | null {
  const open = OPEN.exec(text);
  if (!open) return null;
  const end = text.trimEnd();
  const close = `</${open[1].toLowerCase()}>`;
  if (end.length < open[0].length + close.length || end.slice(-close.length).toLowerCase() !== close) return null;
  // A tag opened again inside would close earlier than the end of the paragraph.
  const inner = end.slice(open[0].length, end.length - close.length);
  if (new RegExp(`</${open[1]}>`, "i").test(inner)) return null;
  return { align: (open[2] ?? open[3]).toLowerCase() as Align, open: open[0].length, close: close.length + (text.length - end.length) };
}

/** A paragraph's text with the given alignment, or none (the default) with null. */
export function setAlignment(text: string, align: Align | null): string {
  const current = readAlignment(text);
  const inner = current ? text.slice(current.open, text.length - current.close) : text;
  return align ? alignOpen(align) + inner + ALIGN_CLOSE : inner;
}

// Paragraphs are separated by blank lines, as the export's typography also reads them.
const PARAGRAPH_GAP = /(\n[ \t]*\n)/;

/**
 * Takes the aligning tags out of a scene's Markdown. `aligns` maps the number of each
 * aligned paragraph (counting the chunks between blank lines from 0) to its alignment;
 * the text keeps its paragraphs, so the numbers still hold after typography is applied.
 */
export function extractAlignments(markdown: string): { text: string; aligns: Map<number, Align> } {
  const aligns = new Map<number, Align>();
  const chunks = markdown.split(PARAGRAPH_GAP);
  for (let i = 0; i < chunks.length; i += 2) {
    const chunk = chunks[i];
    const lead = chunk.length - chunk.trimStart().length;
    const found = readAlignment(chunk.slice(lead));
    if (!found) continue;
    aligns.set(i / 2, found.align);
    chunks[i] = chunk.slice(0, lead) + chunk.slice(lead + found.open, chunk.length - found.close);
  }
  return { text: chunks.join(""), aligns };
}

/** Which paragraph (as extractAlignments counts them) each position falls in. */
export function paragraphIndexer(markdown: string): (pos: number) => number {
  const gaps: number[] = [];
  const re = new RegExp(PARAGRAPH_GAP.source, "g");
  for (let m = re.exec(markdown); m; m = re.exec(markdown)) gaps.push(m.index + m[0].length);
  return (pos) => {
    let n = 0;
    while (n < gaps.length && gaps[n] <= pos) n++;
    return n;
  };
}
