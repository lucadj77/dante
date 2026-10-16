// Reads a Word document (.docx) as a list of headings and paragraphs in Markdown. Bold,
// italic, strikethrough and highlighting are kept, from the text or from its styles;
// comments and tracked changes become signed CriticMarkup, as Dante writes them, and
// footnotes become comments. Headings are paragraphs whose style is one of Word's headings
// ("heading 1"… whatever the language of Word, since files keep the English names) or has
// an outline level; the "Title" style gives the book's title. Of the layout only centred and
// right-aligned paragraphs are kept, as Dante aligns them.

import { setAlignment, type Align } from "../alignment";
import { SCENE_BREAK } from "./structure";
import { unzip } from "./unzip";
import { child, descendants, isElement, parseXml, textOf, type XmlElement } from "./xml";

export type DocBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string };

export interface DocxContent {
  title: string;
  author: string;
  blocks: DocBlock[];
}

interface Format {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  highlight?: boolean;
}

interface Style {
  name: string;
  basedOn: string | null;
  outline: number | null;
  format: Format;
  /** Alignment set by the style (w:jc), when it sets one. */
  align?: string;
}

interface Change {
  type: "ins" | "del";
  author: string;
  date: string;
}

type Token =
  | { kind: "text"; text: string; format: Format; change: Change | null }
  | { kind: "break" }
  | { kind: "commentStart"; id: string }
  | { kind: "commentEnd"; id: string }
  | { kind: "note"; text: string };

const W_VAL = "w:val";

function on(element: XmlElement | undefined): boolean | undefined {
  if (!element) return undefined;
  const value = element.attrs[W_VAL];
  return value === undefined || !["0", "false", "off", "none"].includes(value);
}

function formatOf(rPr: XmlElement | undefined): Format {
  if (!rPr) return {};
  const format: Format = {};
  const bold = on(child(rPr, "w:b"));
  const italic = on(child(rPr, "w:i"));
  const strike = on(child(rPr, "w:strike")) ?? on(child(rPr, "w:dstrike"));
  const highlight = on(child(rPr, "w:highlight"));
  if (bold !== undefined) format.bold = bold;
  if (italic !== undefined) format.italic = italic;
  if (strike !== undefined) format.strike = strike;
  if (highlight !== undefined) format.highlight = highlight;
  return format;
}

// Key under which the default paragraph style's id is kept, in `name`.
const DEFAULT_STYLE = "\u0000default";

function readStyles(xml: string): Map<string, Style> {
  const styles = new Map<string, Style>();
  if (!xml) return styles;
  for (const s of descendants(parseXml(xml), "w:style")) {
    const id = s.attrs["w:styleId"];
    if (!id) continue;
    if (s.attrs["w:type"] === "paragraph" && s.attrs["w:default"] === "1") {
      styles.set(DEFAULT_STYLE, { name: id, basedOn: null, outline: null, format: {} });
    }
    const outline = child(child(s, "w:pPr"), "w:outlineLvl")?.attrs[W_VAL];
    styles.set(id, {
      name: child(s, "w:name")?.attrs[W_VAL] ?? id,
      basedOn: child(s, "w:basedOn")?.attrs[W_VAL] ?? null,
      outline: outline === undefined ? null : Number(outline),
      format: formatOf(child(s, "w:rPr")),
      align: child(child(s, "w:pPr"), "w:jc")?.attrs[W_VAL],
    });
  }
  return styles;
}

/** The paragraph's style, or the document's default one. */
function paragraphStyle(styles: Map<string, Style>, pPr: XmlElement | undefined): string | undefined {
  return child(pPr, "w:pStyle")?.attrs[W_VAL] ?? styles.get(DEFAULT_STYLE)?.name;
}

/** A style's formatting with what it inherits. */
function styleFormat(styles: Map<string, Style>, id: string | undefined, depth = 0): Format {
  const style = id ? styles.get(id) : undefined;
  if (!style || depth > 20) return {};
  return { ...styleFormat(styles, style.basedOn ?? undefined, depth + 1), ...style.format };
}

function styleOutline(styles: Map<string, Style>, id: string | undefined, depth = 0): number | null {
  const style = id ? styles.get(id) : undefined;
  if (!style || depth > 20) return null;
  return style.outline ?? styleOutline(styles, style.basedOn ?? undefined, depth + 1);
}

function styleAlign(styles: Map<string, Style>, id: string | undefined, depth = 0): string | undefined {
  const style = id ? styles.get(id) : undefined;
  if (!style || depth > 20) return undefined;
  return style.align ?? styleAlign(styles, style.basedOn ?? undefined, depth + 1);
}

/**
 * Centred or right-aligned, from the paragraph or its style; null otherwise. Left and
 * justified text is the default, so it needs nothing.
 */
function alignment(styles: Map<string, Style>, pPr: XmlElement | undefined): Align | null {
  const value = child(pPr, "w:jc")?.attrs[W_VAL] ?? styleAlign(styles, paragraphStyle(styles, pPr));
  if (value === "center") return "center";
  // "end" is the right side in left-to-right text; "right" is what older files write.
  if (value === "right" || value === "end") return "right";
  return null;
}

/** Heading level from the paragraph's style or outline level. */
function headingLevel(styles: Map<string, Style>, pPr: XmlElement | undefined): number | null | "skip" {
  const id = paragraphStyle(styles, pPr);
  const name = (id ? styles.get(id)?.name ?? id : "").toLowerCase();
  // Tables of contents repeat the headings.
  if (/^toc\b|^toc ?\d|^sommario|^indice/.test(name)) return "skip";
  if (name === "title" || name === "titolo") return 0;
  if (name === "subtitle" || name === "sottotitolo") return null;
  const named = /^(?:heading|titolo|título|titre|überschrift)\s*(\d)$/.exec(name);
  if (named) return Number(named[1]);
  const direct = child(pPr, "w:outlineLvl")?.attrs[W_VAL];
  const outline = direct !== undefined ? Number(direct) : styleOutline(styles, id);
  // Level 9 means body text.
  return outline !== null && outline >= 0 && outline < 9 ? outline + 1 : null;
}

const ESCAPE = /[\\*_`]|~~|==|\[\[/g;

function escapeText(text: string): string {
  return text.replace(ESCAPE, (m) => m.split("").map((c) => "\\" + c).join(""));
}

const MARKERS: [keyof Format, string][] = [
  ["highlight", "=="],
  ["strike", "~~"],
  ["bold", "**"],
  ["italic", "*"],
];

/**
 * Text pieces with their formatting as Markdown. Markers never sit next to a space on
 * their inner side, where Markdown would not read them.
 */
function renderFormatted(pieces: { text: string; format: Format }[]): string {
  let out = "";
  let open: string[] = [];
  let pending = "";
  for (const piece of pieces) {
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece.text)!;
    const [, lead, core, trail] = match;
    if (core === "") {
      pending += piece.text;
      continue;
    }
    const wanted = MARKERS.filter(([key]) => piece.format[key]).map(([, m]) => m);
    // Keeps the markers both open and wanted, from the outside in, and closes the rest.
    let keep = 0;
    while (keep < open.length && wanted.includes(open[keep])) keep++;
    for (let i = open.length - 1; i >= keep; i--) out += open[i];
    open = open.slice(0, keep);
    out += pending + lead;
    for (const m of wanted) {
      if (!open.includes(m)) {
        out += m;
        open.push(m);
      }
    }
    out += escapeText(core);
    pending = trail;
  }
  for (let i = open.length - 1; i >= 0; i--) out += open[i];
  return out + pending;
}

function signature(author: string, date: string, text = ""): string {
  const day = date.slice(0, 10);
  const words = text.replace(/<<\}/g, "<<").trim();
  if (author && /^\d{4}-\d{2}-\d{2}$/.test(day)) return `{>>@${author} ${day}${words ? ": " + words : ""}<<}`;
  return `{>>${[author, words].filter(Boolean).join(": ")}<<}`;
}

interface Context {
  styles: Map<string, Style>;
  comments: Map<string, { author: string; date: string; text: string }>;
  notes: Map<string, string>;
  noteLabel: string;
}

/** The pieces of a paragraph, in order. */
function tokens(paragraph: XmlElement, ctx: Context, base: Format): Token[] {
  const out: Token[] = [];
  let field = false;
  const visit = (element: XmlElement, change: Change | null) => {
    for (const node of element.children) {
      if (!isElement(node)) continue;
      switch (node.name) {
        case "w:r":
          run(node, change);
          break;
        case "w:ins":
        case "w:del":
          visit(node, { type: node.name === "w:ins" ? "ins" : "del", author: node.attrs["w:author"] ?? "", date: node.attrs["w:date"] ?? "" });
          break;
        case "w:commentRangeStart":
          out.push({ kind: "commentStart", id: node.attrs["w:id"] });
          break;
        case "w:commentRangeEnd":
          out.push({ kind: "commentEnd", id: node.attrs["w:id"] });
          break;
        case "w:hyperlink":
        case "w:smartTag":
        case "w:fldSimple":
        case "w:customXml":
        case "w:dir":
        case "w:bdo":
          visit(node, change);
          break;
        case "w:sdt":
          if (child(node, "w:sdtContent")) visit(child(node, "w:sdtContent")!, change);
          break;
        default:
          break;
      }
    }
  };
  const run = (r: XmlElement, change: Change | null) => {
    const rPr = child(r, "w:rPr");
    const format = { ...base, ...styleFormat(ctx.styles, child(rPr, "w:rStyle")?.attrs[W_VAL]), ...formatOf(rPr) };
    const text = (t: string) => out.push({ kind: "text", text: t, format, change });
    for (const node of r.children) {
      if (!isElement(node)) continue;
      switch (node.name) {
        case "w:fldChar": {
          // Between "begin" and "separate" are field instructions, not text.
          const type = node.attrs["w:fldCharType"];
          if (type === "begin") field = true;
          else if (type === "separate" || type === "end") field = false;
          break;
        }
        case "w:t":
        case "w:delText":
          if (!field) text(textOf(node));
          break;
        case "w:tab":
        case "w:ptab":
          text(" ");
          break;
        case "w:noBreakHyphen":
          text("‑");
          break;
        case "w:br":
          // Page and column breaks are layout; a plain break starts a new line.
          if (!node.attrs["w:type"] || node.attrs["w:type"] === "textWrapping") out.push({ kind: "break" });
          break;
        case "w:cr":
          out.push({ kind: "break" });
          break;
        case "w:footnoteReference":
        case "w:endnoteReference": {
          const note = ctx.notes.get(`${node.name === "w:footnoteReference" ? "f" : "e"}${node.attrs["w:id"]}`);
          if (note) out.push({ kind: "note", text: note });
          break;
        }
        default:
          break;
      }
    }
  };
  visit(paragraph, null);
  return out;
}

function render(list: Token[], ctx: Context): string {
  const closedHere = new Set(list.filter((t) => t.kind === "commentEnd").map((t) => (t as { id: string }).id));
  let out = "";
  let pieces: { text: string; format: Format }[] = [];
  let change: Change | null = null;
  const flush = () => {
    if (pieces.length === 0) return;
    const text = renderFormatted(pieces);
    pieces = [];
    if (change && text.trim()) {
      const mark = change.type === "ins" ? ["{++", "++}"] : ["{--", "--}"];
      // Spaces stay outside the marks, where the editor expects them.
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
      out += `${lead}${mark[0]}${core}${mark[1]}${signature(change.author, change.date)}${trail}`;
    } else if (!change || change.type === "ins") {
      out += text;
    }
  };
  for (const token of list) {
    if (token.kind === "text") {
      if (token.change !== change) flush();
      change = token.change;
      pieces.push(token);
      continue;
    }
    flush();
    change = null;
    if (token.kind === "break") out += "\n";
    else if (token.kind === "note") out += `{>>${ctx.noteLabel}: ${token.text.replace(/<<\}/g, "<<")}<<}`;
    else if (token.kind === "commentStart") {
      if (closedHere.has(token.id)) out += "{==";
    } else {
      const comment = ctx.comments.get(token.id);
      const opened = list.some((t) => t.kind === "commentStart" && t.id === token.id);
      if (opened) out += "==}";
      out += comment ? signature(comment.author, comment.date, comment.text) : "";
    }
  }
  flush();
  return out.replace(/\{====\}/g, "").trim();
}

function plainOf(list: Token[]): string {
  return list
    .map((t) => (t.kind === "text" && t.change?.type !== "del" ? t.text : t.kind === "break" ? " " : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapes what Markdown would read as a heading, quote or list at the start of a paragraph. */
function escapeStart(text: string): string {
  if (/^(#{1,6}(\s|$)|>|[-+*](\s|$))/.test(text)) return "\\" + text;
  return text.replace(/^(\d+)([.)])(\s|$)/, "$1\\$2$3");
}

function notesOf(xml: string, element: string, prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!xml) return out;
  for (const note of descendants(parseXml(xml), element)) {
    const type = note.attrs["w:type"];
    if (type && type !== "normal") continue;
    const text = descendants(note, "w:p")
      .map((p) => descendants(p, "w:t").map(textOf).join(""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) out.set(prefix + note.attrs["w:id"], text);
  }
  return out;
}

/** Paragraphs of the body in reading order, tables and content controls included. */
function bodyParagraphs(body: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  const visit = (element: XmlElement) => {
    for (const node of element.children) {
      if (!isElement(node)) continue;
      if (node.name === "w:p") out.push(node);
      else if (["w:tbl", "w:tr", "w:tc", "w:sdt", "w:sdtContent", "w:customXml", "w:ins"].includes(node.name)) visit(node);
    }
  };
  visit(body);
  return out;
}

/** The other parts of the file that the body refers to. */
export interface DocumentParts {
  styles?: string;
  comments?: string;
  footnotes?: string;
  endnotes?: string;
  /** Word put before a footnote's text, such as "Nota". */
  noteLabel?: string;
}

export function readDocument(documentXml: string, parts: DocumentParts = {}): DocBlock[] {
  const comments = new Map<string, { author: string; date: string; text: string }>();
  if (parts.comments) {
    for (const c of descendants(parseXml(parts.comments), "w:comment")) {
      const text = descendants(c, "w:p")
        .map((p) => descendants(p, "w:t").map(textOf).join(""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      comments.set(c.attrs["w:id"], { author: c.attrs["w:author"] ?? "", date: c.attrs["w:date"] ?? "", text });
    }
  }
  const ctx: Context = {
    styles: readStyles(parts.styles ?? ""),
    comments,
    notes: new Map([...notesOf(parts.footnotes ?? "", "w:footnote", "f"), ...notesOf(parts.endnotes ?? "", "w:endnote", "e")]),
    noteLabel: parts.noteLabel ?? "Note",
  };

  const document = parseXml(documentXml);
  const body = descendants(document, "w:body")[0] ?? document;
  const blocks: DocBlock[] = [];
  for (const p of bodyParagraphs(body)) {
    const pPr = child(p, "w:pPr");
    const level = headingLevel(ctx.styles, pPr);
    if (level === "skip") continue;
    const list = tokens(p, ctx, level === null ? styleFormat(ctx.styles, paragraphStyle(ctx.styles, pPr)) : {});
    const plain = plainOf(list);
    if (level !== null) {
      // Headings keep their words, not their formatting.
      if (plain) blocks.push({ kind: "heading", level, text: plain });
    } else if (SCENE_BREAK.test(plain)) {
      blocks.push({ kind: "paragraph", text: plain });
    } else {
      const text = escapeStart(render(list, ctx).replace(/[ \t]+\n/g, "\n"));
      blocks.push({ kind: "paragraph", text: text ? setAlignment(text, alignment(ctx.styles, pPr)) : text });
    }
  }

  // Without heading styles, lines such as "Capitolo 3" or "Parte seconda" are the headings.
  if (!blocks.some((b) => b.kind === "heading" && b.level > 0)) {
    blocks.forEach((b, i) => {
      if (b.kind !== "paragraph") return;
      // Such lines are often centred.
      const text = setAlignment(b.text, null);
      if (text.length > 80 || text.includes("\n")) return;
      const level = PART_LINE.test(text) ? 1 : CHAPTER_LINE.test(text) ? 2 : null;
      if (level !== null) blocks[i] = { kind: "heading", level, text: text.replace(/\\/g, "") };
    });
  }
  return blocks;
}

/** Reads the text, title and author of a .docx file. */
export async function readDocx(bytes: Uint8Array, labels: { note: string } = { note: "Note" }): Promise<DocxContent> {
  const files = await unzip(bytes);
  const read = async (name: string) => {
    const file = files.get(name);
    return file ? new TextDecoder().decode(await file()) : "";
  };
  const document = await read("word/document.xml");
  if (!document) throw new Error("Not a Word document");
  const blocks = readDocument(document, {
    styles: await read("word/styles.xml"),
    comments: await read("word/comments.xml"),
    footnotes: await read("word/footnotes.xml"),
    endnotes: await read("word/endnotes.xml"),
    noteLabel: labels.note,
  });
  const core = parseXml(await read("docProps/core.xml"));
  const tag = (name: string) => descendants(core, name).map(textOf).join("").trim();
  return { title: tag("dc:title"), author: tag("dc:creator"), blocks };
}

// Lines that read as headings in a document without heading styles.
const PART_WORD = "(?:parte|part|libro|book|teil|partie|livre)";
const CHAPTER_WORD = "(?:capitolo|cap\\.|chapter|ch\\.|capítulo|chapitre|kapitel)";
const FRAME_WORD = "(?:prologo|prologue|prólogo|prolog|epilogo|epilogue|epílogo|epilog)";
const NUMBER_WORD =
  "(?:\\d+|[ivxlcdm]+|(?:prim|second|terz|quart|quint|sest|settim|ottav|non|decim)[oa]|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|one|two|three|four|five|six|seven|eight|nine|ten)";
const PART_LINE = new RegExp(`^${PART_WORD}\\s+${NUMBER_WORD}(?![\\p{L}\\d])`, "iu");
const CHAPTER_LINE = new RegExp(`^(?:${CHAPTER_WORD}\\s+${NUMBER_WORD}(?![\\p{L}\\d])|${FRAME_WORD}$)`, "iu");
