import { parser as baseParser } from "@lezer/markdown";
import { GFM } from "@lezer/markdown";
import type { SyntaxNode } from "@lezer/common";
import { readProperties, splitNote } from "../frontmatter";
import { headingInfo, type ContainerKind, type ManuscriptNode } from "../manuscript";
import { levelHeading } from "../numbering";
import type { Project } from "../project";
import { byline, type ParatextSettings } from "../settings";
import { applyTypography } from "../typography";
import { extractAlignments, paragraphIndexer, type Align } from "../alignment";
import { findImages, imageMime, imageSize, resolveImagePath } from "../images";
import { expandEmbeds } from "../embeds";
import { splitRow, parseTable, type CellAlign } from "../tables";
import { resolveLink } from "../wikilinks";

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

export type Block =
  | { type: "paragraph"; runs: Run[]; align?: Align }
  | { type: "heading"; level: number; runs: Run[] }
  | { type: "quote"; runs: Run[] }
  | { type: "table"; align: CellAlign[]; header: Run[][]; rows: Run[][][] }
  | { type: "image"; image: BookImage; align?: Align }
  | { type: "break" };

// Where an image stood, inside the text that goes through typography and the parser: one
// private-use character per image, its number counted from IMAGE_BASE.
const IMAGE_BASE = 0xe000;
const IMAGE_MARK = /[\ue000-\uf8ff]/g;

export interface BookScene {
  /** Heading above the scene, possibly on two lines; empty when scenes have none. */
  heading: string;
  blocks: Block[];
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
    .replace(/\[\[([^\]#|]+)(#[^\]]*)?\]\]/g, (_, target: string) => target.split("/").pop()!);
}

const STYLE: Record<string, keyof Run> = {
  Emphasis: "italic",
  StrongEmphasis: "bold",
  Strikethrough: "strike",
  InlineCode: "code",
};
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
    } else if (child.name === "HardBreak") {
      runs.push({ ...style, text: "", lineBreak: true });
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
  const visit = (node: SyntaxNode, inQuote: boolean, marker = "") => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      const name = child.name;
      if (name === "Paragraph" || name === "Task") {
        const runs = inlineRuns(source, child, child.from, child.to);
        // A list item keeps its bullet or number, a task its box.
        let lead = marker;
        if (name === "Task") lead = /x/i.test(source.slice(child.from, child.from + 3)) ? "☑ " : "☐ ";
        if (lead && runs.length) runs.unshift({ text: lead });
        marker = "";
        const align = name === "Paragraph" && paragraphAt ? aligns!.get(paragraphAt(child.from)) : undefined;
        for (const piece of splitAtImages(runs, images)) {
          if (!Array.isArray(piece)) blocks.push(align ? { type: "image", image: piece, align } : { type: "image", image: piece });
          else if (!piece.length) continue;
          else if (inQuote) blocks.push({ type: "quote", runs: piece });
          else blocks.push(align ? { type: "paragraph", runs: piece, align } : { type: "paragraph", runs: piece });
        }
      } else if (/^(ATX|Setext)Heading(\d)$/.test(name)) {
        const level = Number(name.slice(-1));
        blocks.push({ type: "heading", level, runs: inlineRuns(source, child, child.from, child.to) });
      } else if (name === "Blockquote") {
        visit(child, true);
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
        visit(child, inQuote);
      } else if (name === "ListItem") {
        const mark = child.firstChild?.name === "ListMark" ? source.slice(child.firstChild.from, child.firstChild.to) : "";
        visit(child, inQuote, /\d/.test(mark) ? `${mark} ` : "• ");
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
    else if (b.type !== "break" && b.type !== "image") out.push(...b.runs);
  }
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
    if (path && images.length < 0x1900) {
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
  options: { revisions?: "accept" | "reject"; root?: ManuscriptNode; convert?: ImageConverter } = {},
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
  let words = 0;
  let characters = 0;
  let sceneCount = 0;

  const readScene = async (node: ManuscriptNode): Promise<BookScene> => {
    const written = splitNote(await project.fs.readText(node.path)).body;
    // Embedded notes bring their text in, then their images are read with the scene's.
    const source = await expandEmbeds(written, node.path, project.files, (path) => project.fs.readText(path));
    const { body, images } = await takeImages(project, node.path, source, options.convert);
    // Alignment tags come out before typography, which would change the quotes in them.
    const { text, aligns } = extractAlignments(cleanSource(body, options.revisions));
    const blocks = markdownToBlocks(typeset(text), aligns, images);
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

  if (root.kind === "scene") {
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
  };
}
