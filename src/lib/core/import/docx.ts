// Reads a Word document (.docx) as a list of headings and paragraphs, with bold, italic and
// struck-through text written as Markdown. Headings are paragraphs whose style is one of
// Word's headings ("heading 1"… whatever the language of Word, since files keep the English
// names) or has an outline level; the "Title" style gives the book's title.

import { unzip } from "./unzip";

export type DocBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string };

export interface DocxContent {
  title: string;
  author: string;
  blocks: DocBlock[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function unescape(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );
}

/** The value of a w:val attribute of the first `tag` in `xml`, or null when absent. */
function val(xml: string, tag: string): string | null {
  const m = new RegExp(`<w:${tag}\\b([^>]*)/?>`).exec(xml);
  if (!m) return null;
  return /w:val="([^"]*)"/.exec(m[1])?.[1] ?? "";
}
/** Whether an on/off property (bold, italic…) is on. */
function on(xml: string, tag: string): boolean {
  const v = val(xml, tag);
  return v !== null && !["0", "false", "off", "none"].includes(v);
}

interface StyleInfo {
  /** 1 for "heading 1", 0 for the title style, null for body text. */
  level: number | null;
  bold: boolean;
  italic: boolean;
}

function readStyles(xml: string): Map<string, StyleInfo> {
  const styles = new Map<string, StyleInfo>();
  for (const m of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const id = /w:styleId="([^"]*)"/.exec(m[1])?.[1];
    if (!id) continue;
    const body = m[2];
    const name = (val(body, "name") ?? "").toLowerCase();
    const heading = /^heading\s*(\d)$/.exec(name);
    const outline = val(body, "outlineLvl");
    const level = name === "title" ? 0 : heading ? Number(heading[1]) : outline !== null && outline !== "" ? Number(outline) + 1 : null;
    const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1] ?? "";
    styles.set(id, { level: level !== null && level <= 9 ? level : null, bold: on(rPr, "b"), italic: on(rPr, "i") });
  }
  return styles;
}

interface Piece {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
}

/** A run's text and formatting. */
function runPiece(run: string, style: StyleInfo | undefined): Piece {
  const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? "";
  let text = "";
  for (const m of run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t\s*\/>|<w:(tab|br|cr|noBreakHyphen)\b[^>]*\/>/g)) {
    if (m[1] !== undefined) text += unescape(m[1]);
    else if (m[2] === "tab") text += " ";
    else if (m[2] === "noBreakHyphen") text += "-";
    else if (m[2]) text += /w:type="page"/.test(m[0]) ? "" : "\n";
  }
  return {
    text: text.replace(/\u00a0/g, " "),
    bold: /<w:b\b/.test(rPr) ? on(rPr, "b") : !!style?.bold,
    italic: /<w:i\b/.test(rPr) ? on(rPr, "i") : !!style?.italic,
    strike: on(rPr, "strike") || on(rPr, "dstrike"),
  };
}

/**
 * The paragraph's text with Markdown marks. Runs with the same formatting are joined first,
 * since Word often splits a word or an italic phrase into several runs; spaces stay outside
 * the marks, as Markdown needs.
 */
function markdown(pieces: Piece[]): string {
  const same = (a: Piece, b: Piece) => a.bold === b.bold && a.italic === b.italic && a.strike === b.strike;
  const joined: Piece[] = [];
  for (const piece of pieces) {
    const last = joined[joined.length - 1];
    if (last && (same(last, piece) || !piece.text.trim())) last.text += piece.text;
    else if (last && !last.text.trim()) joined[joined.length - 1] = { ...piece, text: last.text + piece.text };
    else joined.push({ ...piece });
  }
  return joined
    .map((p) => {
      if (!p.text.trim()) return p.text;
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(p.text)!;
      let marked = core;
      if (p.strike) marked = `~~${marked}~~`;
      if (p.italic) marked = `*${marked}*`;
      if (p.bold) marked = `**${marked}**`;
      return lead + marked + trail;
    })
    .join("");
}

export function readDocument(documentXml: string, stylesXml = ""): DocBlock[] {
  const styles = readStyles(stylesXml);
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(documentXml)?.[1] ?? documentXml;
  const blocks: DocBlock[] = [];
  for (const m of body.matchAll(/<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const p = m[1] ?? "";
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(p)?.[1] ?? "";
    const style = styles.get(val(pPr, "pStyle") ?? "") ?? styles.get("Normal");
    const outline = val(pPr, "outlineLvl");
    const level = outline !== null && outline !== "" && Number(outline) < 9 ? Number(outline) + 1 : (style?.level ?? null);
    // Deleted text of tracked changes is left out; inserted text is kept.
    const content = p.replace(/<w:del\b[\s\S]*?<\/w:del>/g, "").replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, "");
    const pieces = [...content.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)].map((r) => runPiece(r[1], level === null ? style : undefined));
    const text = markdown(pieces).replace(/[ \t]+\n/g, "\n").trim();
    if (level !== null) {
      // Headings keep their words, not their formatting.
      const plain = text.replace(/\*+|~~/g, "").replace(/\s+/g, " ").trim();
      if (plain) blocks.push({ kind: "heading", level, text: plain });
    } else blocks.push({ kind: "paragraph", text });
  }
  return blocks;
}

/** Reads the text, title and author of a .docx file. */
export async function readDocx(bytes: Uint8Array): Promise<DocxContent> {
  const files = await unzip(bytes);
  const read = async (name: string) => {
    const file = files.get(name);
    return file ? new TextDecoder().decode(await file()) : "";
  };
  const document = await read("word/document.xml");
  if (!document) throw new Error("Not a Word document");
  const core = await read("docProps/core.xml");
  const tag = (name: string) => unescape(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(core)?.[1] ?? "").trim();
  return { title: tag("dc:title"), author: tag("dc:creator"), blocks: readDocument(document, await read("word/styles.xml")) };
}
