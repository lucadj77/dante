import { parser as baseParser } from "@lezer/markdown";
import { GFM } from "@lezer/markdown";
import type { SyntaxNode } from "@lezer/common";
import { splitNote } from "../frontmatter";
import { headings, type ContainerKind, type ManuscriptNode } from "../manuscript";
import type { Project } from "../project";

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
  | { type: "paragraph"; runs: Run[] }
  | { type: "heading"; level: number; runs: Run[] }
  | { type: "quote"; runs: Run[] }
  | { type: "break" };

export interface BookEntry {
  kind: ContainerKind | "loose";
  heading: string;
  /** Each scene is a list of blocks; scenes are separated when rendered. */
  scenes: Block[][];
}

export interface Book {
  title: string;
  author: string;
  language: string;
  entries: BookEntry[];
  words: number;
}

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
const MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark", "URL", "LinkTitle", "LinkLabel", "QuoteMark", "HeaderMark"]);

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

export function markdownToBlocks(markdown: string): Block[] {
  const source = markdown;
  const tree = parser.parse(source);
  const blocks: Block[] = [];
  const visit = (node: SyntaxNode, inQuote: boolean) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      const name = child.name;
      if (name === "Paragraph") {
        const runs = inlineRuns(source, child, child.from, child.to);
        if (runs.length) blocks.push(inQuote ? { type: "quote", runs } : { type: "paragraph", runs });
      } else if (/^(ATX|Setext)Heading(\d)$/.test(name)) {
        const level = Number(name.slice(-1));
        blocks.push({ type: "heading", level, runs: inlineRuns(source, child, child.from, child.to) });
      } else if (name === "Blockquote") {
        visit(child, true);
      } else if (name === "HorizontalRule") {
        blocks.push({ type: "break" });
      } else if (name === "BulletList" || name === "OrderedList" || name === "ListItem") {
        visit(child, inQuote);
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

export async function buildBook(
  project: Project,
  options: { revisions?: "accept" | "reject"; root?: ManuscriptNode } = {},
): Promise<Book> {
  const { settings } = project;
  const root = options.root ?? project.manuscript;
  const heads = headings(project.manuscript, settings);
  const entries: BookEntry[] = [];
  let words = 0;

  const readScene = async (node: ManuscriptNode) => {
    const body = splitNote(await project.fs.readText(node.path)).body;
    const blocks = markdownToBlocks(cleanSource(body, options.revisions));
    words += countWords(blocks);
    return blocks;
  };

  const visit = async (node: ManuscriptNode) => {
    let current: BookEntry | null = null;
    for (const child of node.children) {
      if (child.kind === "scene") {
        if (!current) {
          // Scenes outside any chapter still need a place in the book.
          current = node.kind === "manuscript" || node.kind === "scene"
            ? { kind: "loose", heading: "", scenes: [] }
            : { kind: node.kind as ContainerKind, heading: heads.get(node.path) ?? node.title, scenes: [] };
          entries.push(current);
        }
        current.scenes.push(await readScene(child));
      } else {
        current = null;
        if (child.kind === "part") entries.push({ kind: "part", heading: heads.get(child.path) ?? child.title, scenes: [] });
        if (child.kind === "part") {
          await visit(child);
        } else {
          const entry: BookEntry = { kind: child.kind as ContainerKind, heading: heads.get(child.path) ?? child.title, scenes: [] };
          entries.push(entry);
          for (const scene of child.children.filter((c) => c.kind === "scene")) entry.scenes.push(await readScene(scene));
          // Folders nested deeper than a chapter are read in order too.
          for (const sub of child.children.filter((c) => c.kind !== "scene")) await visit({ ...child, children: [sub] });
        }
      }
    }
  };

  if (root.kind === "scene") {
    entries.push({ kind: "loose", heading: "", scenes: [await readScene(root)] });
  } else {
    await visit(root);
  }
  return { title: settings.title, author: settings.author, language: settings.language, entries, words };
}
