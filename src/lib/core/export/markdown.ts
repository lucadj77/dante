import { stringify } from "yaml";
import type { DocxSettings, Separator } from "../settings";
import type { Block, Book, Run } from "./book";
import { PARATEXT_LABELS } from "./docx";

// The book as one Markdown file: title, author and language as properties, then the
// novel with parts, chapters and scenes as headings. Comments and revisions are already
// settled by buildBook, so the file holds only the text a reader would see.

/** Escapes what Markdown would read as markup. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>~=|#])/g, "\\$1");
}

/** Escapes what would start a list at the start of a paragraph. */
function escapeStart(text: string): string {
  return text.replace(/^(\s*)([+-])(?=\s|$)/, "$1\\$2").replace(/^(\s*\d+)([.)])(?=\s|$)/, "$1\\$2");
}

function inline(r: Run): string {
  if (r.lineBreak) return "  \n";
  if (r.code) return `\`${r.text.replace(/`/g, "")}\``;
  const lead = r.text.match(/^\s*/)![0];
  const tail = r.text.slice(lead.length).match(/\s*$/)![0];
  const core = r.text.slice(lead.length, r.text.length - tail.length);
  if (!core) return r.text;
  let out = escapeMarkdown(core);
  if (r.italic) out = `*${out}*`;
  if (r.bold) out = `**${out}**`;
  if (r.strike) out = `~~${out}~~`;
  // Marks go inside the spaces, or Markdown would not read them as marks.
  return lead + out + tail;
}

const runs = (items: Run[]) => escapeStart(items.map(inline).join(""));

/** Plain text written by the author, such as a dedication: one paragraph per blank line. */
function paragraphs(text: string, wrap = (p: string) => p): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => wrap(p.split("\n").map((line) => escapeStart(escapeMarkdown(line))).join("  \n")));
}

/** A heading: Markdown keeps it on one line, so a title on its own line follows a full stop. */
function heading(level: number, text: string): string {
  return `${"#".repeat(Math.min(6, level))} ${escapeMarkdown(text.split("\n").map((l) => l.trim()).filter(Boolean).join(". "))}`;
}

export function bookToMarkdown(book: Book, opts: DocxSettings): string {
  const out: string[] = [];
  const add = (...blocks: string[]) => out.push(...blocks);
  const title = book.title || "Untitled";
  const labels = PARATEXT_LABELS[book.language.slice(0, 2)] ?? PARATEXT_LABELS.en;

  const meta: Record<string, string> = { title };
  if (book.subtitle) meta.subtitle = book.subtitle;
  if (book.author) meta.author = book.author;
  if (book.language) meta.lang = book.language;
  add(`---\n${stringify(meta, { lineWidth: 0 }).trimEnd()}\n---`);

  // With a title page the title is the first heading and the novel's headings go one level down.
  let top = 1;
  if (opts.titlePage) {
    add(heading(1, title));
    if (book.subtitle) add(`*${escapeMarkdown(book.subtitle)}*`);
    if (book.author) add(escapeMarkdown(book.author));
    top = 2;
  }
  const { paratext } = book;
  if (paratext.dedication.trim()) add(...paragraphs(paratext.dedication, (p) => `*${p}*`));
  if (paratext.epigraph.trim()) {
    const source = paratext.epigraphSource.trim() ? [`— ${escapeMarkdown(paratext.epigraphSource.trim())}`] : [];
    add([...paragraphs(paratext.epigraph, (p) => `*${p}*`), ...source].map((p) => p.replace(/^/gm, "> ")).join("\n>\n"));
  }

  const hasParts = book.entries.some((e) => e.kind === "part");
  const chapterLevel = top + (hasParts ? 1 : 0);
  const sceneLevel = chapterLevel + 1;
  const separator = (kind: Separator): string | null => {
    if (kind === "none") return null;
    if (kind === "characters" && opts.sceneSeparator.trim()) return escapeStart(escapeMarkdown(opts.sceneSeparator.trim()));
    // A blank line or a new page has no Markdown of its own: a rule marks the break.
    return "---";
  };
  const blocks = (items: Block[]) => {
    for (const block of items) {
      if (block.type === "heading") add(heading(sceneLevel + block.level, block.runs.map((r) => r.text).join("")));
      else if (block.type === "quote") add(`> ${runs(block.runs)}`.replace(/\n/g, "\n> "));
      else if (block.type === "break") add(separator("characters") ?? "---");
      else if (block.runs.length && block.runs.every((r) => r.code)) add("```\n" + block.runs.map((r) => r.text).join("").replace(/\n$/, "") + "\n```");
      else add(runs(block.runs));
    }
  };

  for (const entry of book.entries) {
    if (entry.kind === "part") {
      add(heading(top, entry.heading));
      continue;
    }
    if (entry.heading) add(heading(chapterLevel, entry.heading));
    entry.scenes.forEach((scene, i) => {
      if (i > 0) {
        const s = separator(opts.sceneBreak);
        if (s) add(s);
      }
      if (scene.heading) add(heading(sceneLevel, scene.heading));
      blocks(scene.blocks);
    });
  }

  const back = (label: string, text: string) => {
    if (text.trim()) add(heading(chapterLevel, label), ...paragraphs(text));
  };
  back(labels.authorNote, paratext.authorNote);
  back(labels.acknowledgements, paratext.acknowledgements);
  if (paratext.colophon.trim()) add("---", ...paragraphs(paratext.colophon));
  return out.join("\n\n") + "\n";
}
