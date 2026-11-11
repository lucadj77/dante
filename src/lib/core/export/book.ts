import { parser as baseParser } from "@lezer/markdown";
import { GFM } from "@lezer/markdown";
import type { SyntaxNode } from "@lezer/common";
import { readProperties, splitNote } from "../frontmatter";
import { headingInfo, scenesOf, type ContainerKind, type ManuscriptNode } from "../manuscript";
import { levelHeading } from "../numbering";
import type { Project } from "../project";
import { byline, type ParatextSettings } from "../settings";
import { applyTypography } from "../typography";
import { extractAlignments, paragraphIndexer, type Align } from "../alignment";
import { findImages, imageMime, imageSize, resolveImagePath } from "../images";
import { expandEmbeds } from "../embeds";
import { captionStart, splitRow, parseTable, type CellAlign } from "../tables";
import { resolveLink } from "../wikilinks";
import { isBlankLine, normalizeBlankLines } from "../blankLines";
import { findBoxes, type BoxType } from "../gamebook/boxes";
import { CALLOUT_OPEN, calloutColor, calloutTitle } from "../callouts";
import type { GamebookExportSettings } from "../settings";
import { closingBracket } from "../footnotes";

// A gamebook's references, through typography and the parser: LINK_OPEN, the number of the
// paragraph, LINK_MID, the text shown, LINK_CLOSE.
const LINK_OPEN = "\u{F0003}";
const LINK_MID = "\u{F0004}";
const LINK_CLOSE = "\u{F0005}";

/** The references to paragraphs written with the markers, showing the paragraph's number. */
export function markLinks(text: string, numbers: Map<string, number>): string {
  return text.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (all, target: string) => {
    const n = numbers.get(target.trim());
    return n === undefined ? all : `${LINK_OPEN}${n}${LINK_MID}${n}${LINK_CLOSE}`;
  });
}

const LINK_PIECE = /\u{F0003}(\d+)\u{F0004}|\u{F0005}/gu;

/** Takes the markers out of the runs, giving the runs between them their link. */
function linkRuns(items: Run[], bold: boolean, clickable: boolean): Run[] {
  const out: Run[] = [];
  let link: string | undefined;
  for (const r of items) {
    if (r.image || r.lineBreak || r.footnote || !r.text.includes(LINK_OPEN) && !r.text.includes(LINK_CLOSE) && !link) {
      out.push(r);
      continue;
    }
    let last = 0;
    const piece = (text: string) => {
      if (!text) return;
      out.push(link ? { ...r, text, ...(clickable ? { link } : {}), ...(bold ? {} : { bold: false }) } : { ...r, text });
    };
    for (const m of r.text.matchAll(LINK_PIECE)) {
      piece(r.text.slice(last, m.index));
      link = m[1] ? `p${m[1]}` : undefined;
      last = m.index! + m[0].length;
    }
    piece(r.text.slice(last));
  }
  return out;
}

/** A block with its text at `size` points. */
function sizeRuns(b: Block, size: number): Block {
  const fix = (items: Run[]) => items.map((r) => ({ ...r, size }));
  if (b.type === "table") return { ...b, header: b.header.map(fix), rows: b.rows.map((row) => row.map(fix)) };
  if ("runs" in b) return { ...b, runs: fix(b.runs) };
  return b;
}

/** The blocks with their references' markers turned into links. */
export function applyLinks(blocks: Block[], bold: boolean, clickable: boolean): Block[] {
  const fix = (items: Run[]) => linkRuns(items, bold, clickable);
  return blocks.map((b) => {
    if (b.type === "table") return { ...b, header: b.header.map(fix), rows: b.rows.map((row) => row.map(fix)), caption: b.caption && fix(b.caption) };
    if (b.type === "image") return b.caption ? { ...b, caption: fix(b.caption) } : b;
    if ("runs" in b) return { ...b, runs: fix(b.runs) };
    return b;
  });
}

// A gamebook's boxes, through the parser: each becomes a paragraph of its own that opens it,
// its content, and one that closes it. The markers are private characters outside the range
// that marks images.
const BOX_OPEN = "\u{F0001}";
const BOX_CLOSE = "\u{F0002}";

/** The text with each box between its markers, and the colours of the boxes in order. */
export function markBoxes(text: string, types: BoxType[]): { text: string; colors: string[] } {
  const colors: string[] = [];
  let out = "";
  let last = 0;
  for (const box of findBoxes(text, types)) {
    const before = text.slice(last, box.from);
    const color = types.find((t) => t.id === box.type)?.color ?? "#868e96";
    const gap = before === "" || /\n\n$/.test(before) ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    out += `${before}${gap}${BOX_OPEN}${colors.length}\n\n${box.content}\n\n${BOX_CLOSE}`;
    colors.push(color);
    last = box.to;
  }
  return { text: out + text.slice(last), colors };
}

/** Takes the box markers out of the blocks and marks the blocks between them. */
export function applyBoxes(blocks: Block[], colors: string[]): Block[] {
  const out: Block[] = [];
  let box: BoxMark | undefined;
  const textOf = (b: Block) => ("runs" in b ? b.runs.map((r) => r.text).join("").trim() : "");
  for (const b of blocks) {
    const text = textOf(b);
    if (text.startsWith(BOX_OPEN)) {
      const id = Number(text.slice(BOX_OPEN.length));
      box = { id, color: colors[id] ?? "#868e96" };
      continue;
    }
    if (text === BOX_CLOSE) {
      box = undefined;
      continue;
    }
    out.push(box ? { ...b, box } : b);
  }
  return out;
}

/** Callouts number their frames from here, apart from a gamebook's boxes. */
const CALLOUT_BASE = 1_000_000;
/** Callouts seen so far, so that each frame has an id of its own, also between scenes. */
let calloutCount = 0;

// The manuscript as a format-neutral document, built once and rendered by each
// exporter (DOCX now; EPUB and PDF later).

export interface Run {
  text: string;
  italic?: boolean;
  bold?: boolean;
  strike?: boolean;
  code?: boolean;
  /** A hard line break inside a paragraph. */
  lineBreak?: boolean;
  /** An image inside the text, on the line with it; the run has no text. */
  image?: BookImage;
  /** In a gamebook, the anchor of the paragraph a reference leads to, as "p12". */
  link?: string;
  /** Size in points, where it differs from the text's, as in a gamebook's boxes. */
  size?: number;
  /** A footnote called at this point: the run has no text, the note's is here. */
  footnote?: Run[];
}

/** An image of the text, with the size it shows at, in pixels (96 to the inch). */
export interface BookImage {
  /** The file in the project. */
  path: string;
  data: Uint8Array;
  mime: string;
  width: number;
  height: number;
  alt: string;
}

/** A gamebook's box a block stands in: blocks with the same id go in one frame. */
export interface BoxMark {
  id: number;
  /** The box type's colour, as "#3b82c4". */
  color: string;
  /** Set when the frame is a callout (`> [!tip] Title`): its first block is the title line. */
  callout?: { type: string; title: string; written: string };
}

export type Block = (
  | { type: "paragraph"; runs: Run[]; align?: Align }
  | { type: "heading"; level: number; runs: Run[] }
  | { type: "quote"; runs: Run[] }
  /**
   * A paragraph of a list item: `marker` is its bullet ("•"), number ("1.") or box ("☐",
   * "☑"), empty for the item's later paragraphs; `level` is 0 outside any other list.
   */
  | { type: "item"; runs: Run[]; marker: string; level: number }
  | { type: "table"; align: CellAlign[]; header: Run[][]; rows: Run[][][]; caption?: Run[] }
  | { type: "image"; image: BookImage; align?: Align; caption?: Run[] }
  | { type: "break" }
  /** An empty line between paragraphs, written as a paragraph of its own: no new scene. */
  | { type: "blank" }
) & { box?: BoxMark };

// Where an image stood, inside the text that goes through typography and the parser: one
// private-use character per image, its number counted from IMAGE_BASE. Footnotes have the
// rest of the private-use characters, counted from NOTE_BASE.
const IMAGE_BASE = 0xe000;
const IMAGE_MARK = /[\ue000-\uefff]/g;
const IMAGE_MAX = 0x1000;
const NOTE_BASE = 0xf000;
const NOTE_MARK = /[\uf000-\uf8ff]/g;
const NOTE_MAX = 0x900;

/** A footnote's definition: `[^1]: text`, with the indented lines that continue it. */
const NOTE_DEFINITION = /^\[\^([^\]\s]+)\]:[ \t]*(.*(?:\n(?: {2,}|\t).*)*)\n?/gm;

/**
 * Takes the footnotes out of a text: `^[written here]` and `[^1]` with its `[^1]: text`
 * elsewhere in the same text. Each call becomes one private-use character; the texts of
 * the notes come back in the order of their calls. A call without a definition stays as
 * it is written.
 */
export function takeFootnotes(text: string): { body: string; notes: string[] } {
  const defined = new Map<string, string>();
  let body = text.replace(NOTE_DEFINITION, (_, id: string, note: string) => {
    defined.set(id, note.replace(/\n[ \t]+/g, " ").trim());
    return "";
  });
  const notes: string[] = [];
  const mark = (note: string) => {
    if (notes.length >= NOTE_MAX) return "";
    notes.push(note);
    return String.fromCharCode(NOTE_BASE + notes.length - 1);
  };
  let out = "";
  let last = 0;
  const call = /\^\[|\[\^([^\]\s]+)\]/g;
  for (let m = call.exec(body); m; m = call.exec(body)) {
    if (m.index > 0 && body[m.index - 1] === "\\") continue;
    let end: number;
    let note: string | undefined;
    if (m[1] !== undefined) {
      note = defined.get(m[1]);
      end = m.index + m[0].length;
    } else {
      const close = closingBracket(body, m.index + 1);
      if (close < 0) continue;
      note = body.slice(m.index + 2, close).replace(/\s*\n\s*/g, " ").trim();
      end = close + 1;
    }
    if (note === undefined) continue;
    // The call stands against the word before it, as in print.
    out += body.slice(last, m.index).replace(/[ \t]+$/, "") + mark(note);
    last = end;
    call.lastIndex = end;
  }
  body = out + body.slice(last);
  return { body, notes };
}

/** The runs with each footnote's character turned into a run that holds the note. */
function noteRuns(items: Run[], notes: Run[][]): Run[] {
  const out: Run[] = [];
  for (const r of items) {
    if (r.image || r.lineBreak || r.text.search(NOTE_MARK) < 0) {
      out.push(r);
      continue;
    }
    let last = 0;
    for (const m of r.text.matchAll(NOTE_MARK)) {
      if (m.index! > last) out.push({ ...r, text: r.text.slice(last, m.index) });
      last = m.index! + 1;
      const footnote = notes[m[0].charCodeAt(0) - NOTE_BASE];
      if (footnote?.length) out.push({ text: "", footnote });
    }
    if (last < r.text.length) out.push({ ...r, text: r.text.slice(last) });
  }
  return out;
}

/** The blocks with their footnotes in place; `notes` are the texts takeFootnotes gave. */
export function applyFootnotes(blocks: Block[], notes: string[]): Block[] {
  if (!notes.length) return blocks;
  const parsed = notes.map((note) => cellRuns(note.replace(NOTE_MARK, "")));
  const fix = (items: Run[]) => noteRuns(items, parsed);
  return blocks.map((b) => {
    if (b.type === "table") return { ...b, header: b.header.map(fix), rows: b.rows.map((row) => row.map(fix)), caption: b.caption && fix(b.caption) };
    if (b.type === "image") return b.caption ? { ...b, caption: fix(b.caption) } : b;
    if ("runs" in b) return { ...b, runs: fix(b.runs) };
    return b;
  });
}

export interface BookScene {
  /** Heading above the scene, possibly on two lines; empty when scenes have none. */
  heading: string;
  blocks: Block[];
  /** In a gamebook, the anchor references lead to, as "p12". */
  anchor?: string;
}

export interface BookEntry {
  kind: ContainerKind | "loose";
  /** The whole heading; a line break separates number and title when chosen. */
  heading: string;
  scenes: BookScene[];
}

export interface Book {
  title: string;
  subtitle: string;
  /** The authors joined in one line, as "Ada Rossi e Bruno Neri". */
  author: string;
  authors: string[];
  language: string;
  paratext: ParatextSettings;
  entries: BookEntry[];
  words: number;
  /** Characters including spaces, for counts in standard pages. */
  characters: number;
  /** For a gamebook, how its paragraphs are laid out. */
  gamebook?: GamebookExportSettings;
}

/** Property holding the title to print when it differs from the working title. */
export const PUBLISHED_TITLE = "published_title";

const parser = baseParser.configure(GFM);

/**
 * Removes what belongs to the writing process, not to the text: comments, and
 * revisions (accepted by default). Wikilinks become their alias or their target.
 */
export function cleanSource(markdown: string, revisions: "accept" | "reject" = "accept"): string {
  const accept = revisions === "accept";
  return markdown
    .replace(/\{>>[\s\S]*?<<\}/g, "")
    .replace(/\{\+\+([\s\S]*?)\+\+\}/g, accept ? "$1" : "")
    .replace(/\{--([\s\S]*?)--\}/g, accept ? "" : "$1")
    .replace(/\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g, accept ? "$2" : "$1")
    .replace(/\{==([\s\S]*?)==\}/g, "$1")
    // Highlighting is a note to self: the text stays, the marks go.
    .replace(/==(?=\S)([^=\n]+?)==/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]#|]+)(#[^\]]*)?\]\]/g, (_, target: string) => target.split("/").pop()!)
    // Blank lines as the export reads them, whatever the app that wrote them.
    .replace(/^.*$/gm, normalizeBlankLines);
}

const STYLE: Record<string, keyof Run> = {
  Emphasis: "italic",
  StrongEmphasis: "bold",
  Strikethrough: "strike",
  InlineCode: "code",
};
// The entities a writer may type; others stay as they are.
const ENTITIES: Record<string, string> = { nbsp: "\u00a0", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", thinsp: "\u2009", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»" };

function entity(text: string): string {
  const name = text.slice(1, -1);
  if (name[0] === "#") {
    const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : text;
  }
  return ENTITIES[name] ?? text;
}

const MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark", "URL", "LinkTitle", "LinkLabel", "QuoteMark", "HeaderMark", "TaskMarker"]);

function inlineRuns(source: string, node: SyntaxNode, from: number, to: number, style: Partial<Run> = {}): Run[] {
  const runs: Run[] = [];
  const text = (a: number, b: number) => {
    if (b <= a) return;
    // Soft line breaks inside a paragraph are spaces.
    const t = source.slice(a, b).replace(/\s*\n\s*/g, " ");
    if (t) runs.push({ ...style, text: t });
  };
  let pos = from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from < from || child.to > to) continue;
    text(pos, child.from);
    if (MARKS.has(child.name)) {
      // Markup characters are not text.
    } else if (child.name === "Autolink") {
      // <https://…> is written as the address alone.
      text(child.from + 1, child.to - 1);
    } else if (child.name === "HardBreak") {
      runs.push({ ...style, text: "", lineBreak: true });
    } else if (child.name === "Entity") {
      runs.push({ ...style, text: entity(source.slice(child.from, child.to)) });
    } else if (child.name === "Escape") {
      runs.push({ ...style, text: source.slice(child.from + 1, child.to) });
    } else if (STYLE[child.name]) {
      runs.push(...inlineRuns(source, child, child.from, child.to, { ...style, [STYLE[child.name]]: true }));
    } else {
      runs.push(...inlineRuns(source, child, child.from, child.to, style));
    }
    pos = child.to;
  }
  text(pos, to);
  return merge(runs);
}

/** The runs of a table cell's text. */
function cellRuns(text: string): Run[] {
  const clean = text.replace(IMAGE_MARK, "");
  const tree = parser.parse(clean);
  const paragraph = tree.topNode.firstChild;
  if (!paragraph || paragraph.name !== "Paragraph") return clean.trim() ? [{ text: clean.trim() }] : [];
  return inlineRuns(clean, paragraph as unknown as SyntaxNode, paragraph.from, paragraph.to);
}

/**
 * A paragraph's runs with its images. A paragraph of images alone gives each image as a
 * piece of its own, shown as a figure; a paragraph with text keeps them inside the text,
 * on the line, as the editor shows them.
 */
function splitAtImages(runs: Run[], images: (BookImage | null)[]): (Run[] | BookImage)[] {
  const hasText = runs.some((r) => r.text.replace(IMAGE_MARK, "").trim());
  const out: (Run[] | BookImage)[] = [];
  let current: Run[] = [];
  const flush = () => {
    const kept = merge(current);
    if (kept.some((r) => r.text.trim() || r.lineBreak || r.image)) out.push(kept.filter((r, i) => !(r.lineBreak && (i === 0 || i === kept.length - 1))));
    current = [];
  };
  for (const run of runs) {
    let last = 0;
    for (const m of run.text.matchAll(IMAGE_MARK)) {
      if (m.index! > last) current.push({ ...run, text: run.text.slice(last, m.index) });
      last = m.index! + 1;
      const image = images[m[0].charCodeAt(0) - IMAGE_BASE];
      if (!image) continue;
      if (hasText) current.push({ text: "", image });
      else {
        flush();
        out.push(image);
      }
    }
    if (last < run.text.length || run.lineBreak) current.push(last ? { ...run, text: run.text.slice(last) } : run);
  }
  flush();
  return out;
}

function merge(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    const same = last && !last.lineBreak && !run.lineBreak && !last.image && !run.image &&
      !!last.italic === !!run.italic && !!last.bold === !!run.bold && !!last.strike === !!run.strike && !!last.code === !!run.code;
    if (same) last.text += run.text;
    else out.push({ ...run });
  }
  if (out.length) {
    out[0].text = out[0].text.trimStart();
    out[out.length - 1].text = out[out.length - 1].text.trimEnd();
  }
  return out.filter((r) => r.text !== "" || r.lineBreak || r.image);
}

/**
 * The blocks of a scene's Markdown. `aligns` gives the alignment of paragraphs, by their
 * number, as extractAlignments took it out of the text.
 */
export function markdownToBlocks(markdown: string, aligns?: Map<number, Align>, images: (BookImage | null)[] = []): Block[] {
  const source = markdown;
  const tree = parser.parse(source);
  const paragraphAt = aligns?.size ? paragraphIndexer(source) : null;
  const blocks: Block[] = [];
  const visit = (node: SyntaxNode, inQuote: boolean, marker = "", level = -1) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      const name = child.name;
      if (name === "Paragraph" && isBlankLine(source.slice(child.from, child.to))) {
        blocks.push({ type: "blank" });
      } else if (name === "Paragraph" || name === "Task") {
        const runs = inlineRuns(source, child, child.from, child.to);
        // A list item keeps its bullet or number, a task its box.
        let lead = marker;
        if (name === "Task") lead = /x/i.test(source.slice(child.from, child.from + 3)) ? "☑" : "☐";
        // Inside a quote the item is a line of the quote, its marker at the start.
        if (lead && inQuote && runs.length) runs.unshift({ text: `${lead} ` });
        marker = "";
        const align = name === "Paragraph" && paragraphAt ? aligns!.get(paragraphAt(child.from)) : undefined;
        // A caption after a table belongs to it: "Tabella: …" or ": …", as Pandoc writes it.
        const previous = blocks[blocks.length - 1];
        const caption = name === "Paragraph" && child.prevSibling?.name === "Table" && previous?.type === "table" ? captionStart(source.slice(child.from, child.to)) : 0;
        if (caption && previous.type === "table") {
          previous.caption = inlineRuns(source, child, child.from + caption, child.to);
          continue;
        }
        for (const piece of splitAtImages(runs, images)) {
          if (!Array.isArray(piece)) {
            // A figure's description is its caption, as Pandoc reads it.
            const figure: Block = { type: "image", image: piece };
            if (align) figure.align = align;
            if (piece.alt) figure.caption = cellRuns(piece.alt);
            blocks.push(figure);
          }
          else if (!piece.length) continue;
          else if (inQuote) blocks.push({ type: "quote", runs: piece });
          else if (level >= 0) {
            blocks.push({ type: "item", runs: piece, marker: lead, level });
            lead = "";
          }
          else blocks.push(align ? { type: "paragraph", runs: piece, align } : { type: "paragraph", runs: piece });
        }
      } else if (/^(ATX|Setext)Heading(\d)$/.test(name)) {
        const level = Number(name.slice(-1));
        blocks.push({ type: "heading", level, runs: inlineRuns(source, child, child.from, child.to) });
      } else if (name === "Blockquote") {
        const lines = source.slice(child.from, child.to).split("\n");
        const open = CALLOUT_OPEN.exec(lines[0]);
        if (!open) {
          visit(child, true);
          continue;
        }
        // A callout goes into a frame of its colour, its title in bold on the first line.
        const [, type, written] = open;
        const title = calloutTitle(type, written);
        const box: BoxMark = { id: CALLOUT_BASE + calloutCount++, color: calloutColor(type), callout: { type, title, written: written.trim() } };
        const inner = lines.slice(1).map((line) => line.replace(/^>[ \t]?/, "")).join("\n");
        blocks.push({ type: "paragraph", runs: [{ text: title, bold: true }], box });
        for (const block of markdownToBlocks(inner, undefined, images)) blocks.push({ ...block, box });
      } else if (name === "Table") {
        let from = child.from;
        const lines = source.slice(child.from, child.to).split("\n").map((text) => {
          const line = { text, from };
          from += text.length + 1;
          return line;
        });
        const table = parseTable(lines);
        if (table) {
          const columns = table.header.length;
          const row = (cells: { text: string }[]) => Array.from({ length: columns }, (_, i) => cellRuns(cells[i]?.text ?? ""));
          blocks.push({ type: "table", align: table.align.slice(0, columns), header: row(table.header), rows: table.rows.map(row) });
        } else {
          for (const line of lines) blocks.push({ type: "paragraph", runs: cellRuns(splitRow(line.text).map((c) => c.text).join(" ")) });
        }
      } else if (name === "HorizontalRule") {
        blocks.push({ type: "break" });
      } else if (name === "BulletList" || name === "OrderedList") {
        visit(child, inQuote, "", level);
      } else if (name === "ListItem") {
        const mark = child.firstChild?.name === "ListMark" ? source.slice(child.firstChild.from, child.firstChild.to) : "";
        visit(child, inQuote, /\d/.test(mark) ? mark : "•", level + 1);
      } else if (name === "FencedCode" || name === "CodeBlock") {
        const text = source.slice(child.from, child.to).replace(/^```.*\n?|```$/gm, "");
        blocks.push({ type: "paragraph", runs: [{ text, code: true }] });
      }
    }
  };
  visit(tree.topNode as unknown as SyntaxNode, false);
  return blocks;
}

/** Every run of text in the blocks, table cells included. */
function allRuns(blocks: Block[]): Run[] {
  const out: Run[] = [];
  for (const b of blocks) {
    if (b.type === "table") for (const row of [b.header, ...b.rows]) for (const cell of row) out.push(...cell);
    if (b.type === "table" || b.type === "image") out.push(...(b.caption ?? []));
    else if (b.type !== "break" && b.type !== "blank") out.push(...b.runs);
  }
  // The notes are text of the book too.
  for (const r of [...out]) if (r.footnote) out.push(...r.footnote);
  return out;
}

function countWords(blocks: Block[]): number {
  let n = 0;
  for (const r of allRuns(blocks)) n += (r.text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
  return n;
}

function countCharacters(blocks: Block[]): number {
  let n = 0;
  for (const r of allRuns(blocks)) n += [...r.text].length;
  return n;
}

/** Turns an image a format cannot hold (WebP, SVG…) into PNG; null when it cannot. */
export type ImageConverter = (data: Uint8Array, mime: string) => Promise<{ data: Uint8Array; width: number; height: number } | null>;

// Formats every exporter can embed as they are.
const PORTABLE = new Set(["image/png", "image/jpeg", "image/gif"]);

/**
 * Replaces the images of a scene with markers and reads their files. An image that cannot
 * be found, read or converted is left out, as embedded notes are.
 */
async function takeImages(project: Project, notePath: string, text: string, convert?: ImageConverter): Promise<{ body: string; images: BookImage[] }> {
  const found = findImages(text);
  const images: BookImage[] = [];
  let body = "";
  let last = 0;
  for (const embed of found) {
    const path = embed.wiki ? resolveLink(embed.target.split("#")[0], notePath, project.files) : resolveImagePath(embed.target, notePath, project.files);
    let image: BookImage | null = null;
    if (path && images.length < IMAGE_MAX) {
      try {
        let data = await project.fs.readBytes(path);
        let mime = imageMime(path);
        let size = imageSize(data, mime);
        if (!PORTABLE.has(mime)) {
          const png = convert ? await convert(data, mime) : null;
          if (png) {
            data = png.data;
            mime = "image/png";
            size ??= { width: png.width, height: png.height };
          } else {
            size = null;
          }
        }
        if (size && size.width > 0 && size.height > 0) {
          const width = embed.width ?? size.width;
          const height = embed.height ?? Math.round((width * size.height) / size.width);
          image = { path, data, mime, width, height, alt: embed.alt };
        }
      } catch {
        image = null;
      }
    }
    const before = text.slice(last, embed.from);
    last = embed.to;
    if (!image) {
      // No double space where the image was.
      body += before;
      if (/[ \t]$/.test(body) && /^[ \t]/.test(text.slice(last))) last++;
      continue;
    }
    body += before + String.fromCharCode(IMAGE_BASE + images.length);
    images.push(image);
  }
  return { body: body + text.slice(last), images };
}

export async function buildBook(
  project: Project,
  options: {
    revisions?: "accept" | "reject";
    root?: ManuscriptNode;
    convert?: ImageConverter;
  } = {},
): Promise<Book> {
  const { settings } = project;
  const docx = settings.export.docx;
  const typography = settings.export.typography;
  const typeset = (text: string) => applyTypography(text, typography);
  const root = options.root ?? project.manuscript;

  // Published titles replace working titles; they live in scene notes and folder notes.
  const published = new Map<string, string>();
  const collect = async (node: ManuscriptNode) => {
    const file = node.kind === "scene" ? node.path : node.notePath;
    if (file) {
      const value = readProperties(await project.fs.readText(file))[PUBLISHED_TITLE];
      if (typeof value === "string" && value.trim()) published.set(node.path, value.trim());
    }
    for (const child of node.children) await collect(child);
  };
  await collect(project.manuscript);
  const titleOf = (node: ManuscriptNode) => typeset(published.get(node.path) ?? node.title);
  const heads = headingInfo(project.manuscript, settings, titleOf);

  const entries: BookEntry[] = [];
  const gamebook = settings.gamebook.enabled;
  const gx = settings.gamebook.export;
  /** In a gamebook, the number of each paragraph by title, for the references. */
  const numbers = new Map<string, number>();
  if (gamebook) for (const node of scenesOf(project.manuscript)) if (node.number !== undefined) numbers.set(node.path.slice(node.path.lastIndexOf("/") + 1).replace(/\.md$/, ""), node.number);
  /** Boxes counted across the book, so that two boxes in a row stay two. */
  let boxBase = 0;
  let words = 0;
  let characters = 0;
  let sceneCount = 0;

  const readScene = async (node: ManuscriptNode): Promise<BookScene> => {
    const written = splitNote(await project.fs.readText(node.path)).body;
    // Embedded notes bring their text in, then their images are read with the scene's.
    const source = await expandEmbeds(written, node.path, project.files, (path) => project.fs.readText(path));
    const { body, images } = await takeImages(project, node.path, source, options.convert);
    for (const image of images) image.alt = typeset(image.alt);
    // Alignment tags come out before typography, which would change the quotes in them.
    const marked = gamebook ? markBoxes(markLinks(body, numbers), settings.gamebook.boxes) : { text: body, colors: [] };
    const noted = takeFootnotes(cleanSource(marked.text, options.revisions));
    const { text, aligns } = extractAlignments(noted.body);
    // A reference inside a note is its paragraph's number, without the link.
    const notes = noted.notes.map((note) => typeset(note.replace(/\u{F0003}\d+\u{F0004}|\u{F0005}/gu, "")));
    const parsed = applyFootnotes(markdownToBlocks(typeset(text), aligns, images), notes);
    const colors = gx.boxes === "gray" ? marked.colors.map(() => "#868e96") : marked.colors;
    const blocks = gamebook
      ? applyLinks(applyBoxes(parsed, colors), gx.bold, gx.links).map((b) => {
          // Callouts keep their frame whatever the settings for boxes say.
          if (b.box?.callout) return b;
          const sized = b.box && gx.boxSize ? sizeRuns(b, gx.boxSize) : b;
          return sized.box && gx.boxes !== "none" ? { ...sized, box: { ...sized.box, id: sized.box.id + boxBase } } : { ...sized, box: undefined };
        })
      : parsed;
    boxBase += marked.colors.length;
    words += countWords(blocks);
    characters += countCharacters(blocks);
    sceneCount++;
    const heading = levelHeading(docx.scene, sceneCount, titleOf(node), settings.language);
    return { heading: heading.text, blocks };
  };

  const entryFor = (node: ManuscriptNode, kind: BookEntry["kind"]): BookEntry => {
    return { kind, heading: heads.get(node.path)?.text ?? titleOf(node), scenes: [] };
  };

  const readScenes = async (entry: BookEntry, scenes: ManuscriptNode[]) => {
    if (docx.sceneNumbersRestart) sceneCount = 0;
    for (const scene of scenes) entry.scenes.push(await readScene(scene));
    if (docx.omitSingleSceneHeading && entry.scenes.length === 1) entry.scenes[0].heading = "";
  };

  const visit = async (node: ManuscriptNode) => {
    // Scenes outside any chapter still need a place in the book.
    let loose: ManuscriptNode[] = [];
    // The chapter just read at this level, if nothing but scenes came after it.
    let previous: BookEntry | null = null;
    const flushLoose = async () => {
      if (!loose.length) return;
      // Scenes left after a chapter, outside it, read as its continuation: no new chapter.
      if (previous) {
        for (const scene of loose) previous.scenes.push(await readScene(scene));
        loose = [];
        return;
      }
      const entry: BookEntry = node.kind === "manuscript" || node.kind === "part"
        ? { kind: "loose", heading: "", scenes: [] }
        : entryFor(node, node.kind as ContainerKind);
      entries.push(entry);
      await readScenes(entry, loose);
      loose = [];
    };
    for (const child of node.children) {
      if (child.kind === "scene") {
        loose.push(child);
        continue;
      }
      await flushLoose();
      previous = null;
      if (child.kind === "part") {
        entries.push(entryFor(child, "part"));
        await visit(child);
      } else {
        const entry = entryFor(child, child.kind as ContainerKind);
        entries.push(entry);
        await readScenes(entry, child.children.filter((c) => c.kind === "scene"));
        // Folders nested deeper than a chapter are read in order too.
        for (const sub of child.children.filter((c) => c.kind !== "scene")) await visit({ ...child, children: [sub] });
        if (node.kind === "manuscript" || node.kind === "part") previous = entry;
      }
    }
    await flushLoose();
  };

  if (gamebook && root.kind !== "scene") {
    // A gamebook: the paragraphs in order of number, each under its number; the pages
    // without a number (rules, an introduction) before or after them, under their title.
    let paragraphs: BookEntry | null = null;
    for (const node of scenesOf(root)) {
      if (node.number !== undefined) {
        if (!paragraphs) entries.push((paragraphs = { kind: "loose", heading: "", scenes: [] }));
        const scene = await readScene(node);
        scene.heading = gx.prefix + (gx.heading === "numberTitle" ? `${node.number} · ${titleOf(node)}` : String(node.number));
        scene.anchor = `p${node.number}`;
        paragraphs.scenes.push(scene);
      } else {
        paragraphs = null;
        const scene = await readScene(node);
        scene.heading = "";
        entries.push({ kind: "chapter", heading: titleOf(node), scenes: [scene] });
      }
    }
  } else if (root.kind === "scene") {
    const entry: BookEntry = { kind: "loose", heading: "", scenes: [] };
    entries.push(entry);
    await readScenes(entry, [root]);
  } else {
    await visit(root);
  }
  const paratext = { ...settings.export.paratext };
  for (const key of Object.keys(paratext) as (keyof ParatextSettings)[]) paratext[key] = typeset(paratext[key]);
  return {
    title: typeset(settings.title),
    subtitle: typeset(settings.subtitle),
    author: byline(settings.authors, settings.language),
    authors: [...settings.authors],
    language: settings.language,
    paratext,
    entries,
    words,
    characters,
    ...(gamebook && root.kind !== "scene" ? { gamebook: gx } : {}),
  };
}
