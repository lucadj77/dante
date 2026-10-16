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
}

export type Block =
  | { type: "paragraph"; runs: Run[]; align?: Align }
  | { type: "heading"; level: number; runs: Run[] }
  | { type: "quote"; runs: Run[] }
  | { type: "break" };

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

function merge(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    const same = last && !last.lineBreak && !run.lineBreak &&
      !!last.italic === !!run.italic && !!last.bold === !!run.bold && !!last.strike === !!run.strike && !!last.code === !!run.code;
    if (same) last.text += run.text;
    else out.push({ ...run });
  }
  if (out.length) {
    out[0].text = out[0].text.trimStart();
    out[out.length - 1].text = out[out.length - 1].text.trimEnd();
  }
  return out.filter((r) => r.text !== "" || r.lineBreak);
}

/**
 * The blocks of a scene's Markdown. `aligns` gives the alignment of paragraphs, by their
 * number, as extractAlignments took it out of the text.
 */
export function markdownToBlocks(markdown: string, aligns?: Map<number, Align>): Block[] {
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
        if (!runs.length) {
          // Nothing to show.
        } else if (inQuote) {
          blocks.push({ type: "quote", runs });
        } else {
          const align = name === "Paragraph" && paragraphAt ? aligns!.get(paragraphAt(child.from)) : undefined;
          blocks.push(align ? { type: "paragraph", runs, align } : { type: "paragraph", runs });
        }
      } else if (/^(ATX|Setext)Heading(\d)$/.test(name)) {
        const level = Number(name.slice(-1));
        blocks.push({ type: "heading", level, runs: inlineRuns(source, child, child.from, child.to) });
      } else if (name === "Blockquote") {
        visit(child, true);
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

function countWords(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type === "break") continue;
    for (const r of b.runs) n += (r.text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
  }
  return n;
}

function countCharacters(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type !== "break") for (const r of b.runs) n += [...r.text].length;
  }
  return n;
}

export async function buildBook(
  project: Project,
  options: { revisions?: "accept" | "reject"; root?: ManuscriptNode } = {},
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
    const body = splitNote(await project.fs.readText(node.path)).body;
    // Alignment tags come out before typography, which would change the quotes in them.
    const { text, aligns } = extractAlignments(cleanSource(body, options.revisions));
    const blocks = markdownToBlocks(typeset(text), aligns);
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
