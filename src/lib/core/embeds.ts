import { splitNote } from "./frontmatter";
import { isImagePath } from "./images";
import { isMarkdown } from "./path";
import { resolveLink } from "./wikilinks";

// Notes embedded in others, as Obsidian does with ![[Nota]]: the whole note, one section
// with ![[Nota#Titolo]], or one paragraph marked with ^id with ![[Nota#^id]].

export interface NoteEmbed {
  from: number;
  to: number;
  /** The note, without the section. */
  target: string;
  /** A heading, or "^id" for a paragraph; "" for the whole note. */
  section: string;
}

const EMBED = /!\[\[([^\[\]|\n]+)(?:\|[^\[\]\n]*)?\]\]/g;

/** The notes the text embeds, leaving images out. */
export function findNoteEmbeds(text: string): NoteEmbed[] {
  const out: NoteEmbed[] = [];
  for (const m of text.matchAll(EMBED)) {
    const [target, ...rest] = m[1].split("#");
    if (isImagePath(target.trim())) continue;
    out.push({ from: m.index!, to: m.index! + m[0].length, target: target.trim(), section: rest.join("#").trim() });
  }
  return out;
}

const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/;

/**
 * The part of a note's body an embed shows: the section under a heading (heading
 * included) up to the next heading of the same level or higher, or the paragraph that
 * ends with ^id (without the id). Null when the note has no such part.
 */
export function embeddedPart(body: string, section: string): string | null {
  if (!section) return body.trim();
  if (section.startsWith("^")) {
    const id = section.slice(1);
    for (const paragraph of body.split(/\n[ \t]*\n/)) {
      const marked = new RegExp(`[ \\t]\\^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*$`);
      if (marked.test(paragraph)) return paragraph.replace(marked, "").trim();
    }
    return null;
  }
  const wanted = section.toLowerCase();
  const lines = body.split("\n");
  let start = -1;
  let level = 0;
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) fence = !fence;
    const h = fence ? null : HEADING.exec(lines[i]);
    if (!h) continue;
    if (start >= 0 && h[1].length <= level) return lines.slice(start, i).join("\n").trim();
    if (start < 0 && h[2].trim().toLowerCase() === wanted) {
      start = i;
      level = h[1].length;
    }
  }
  return start >= 0 ? lines.slice(start).join("\n").trim() : null;
}

/**
 * The text with each embedded note replaced by its text, as a paragraph of its own, and
 * the notes those embed in turn. A note that embeds itself, directly or not, or goes
 * deeper than `depth`, is left out there. An embed that finds nothing is left as it is,
 * for the export to drop.
 */
export async function expandEmbeds(
  text: string,
  fromPath: string,
  files: string[],
  read: (path: string) => Promise<string>,
  depth = 5,
  seen: Set<string> = new Set([fromPath]),
): Promise<string> {
  const embeds = findNoteEmbeds(text);
  if (!embeds.length) return text;
  let out = "";
  let last = 0;
  for (const embed of embeds) {
    out += text.slice(last, embed.from);
    last = embed.to;
    const path = resolveLink(embed.target, fromPath, files.filter(isMarkdown));
    if (!path || seen.has(path) || depth <= 0) {
      out += path ? "" : text.slice(embed.from, embed.to);
      continue;
    }
    let part: string | null = null;
    try {
      part = embeddedPart(splitNote(await read(path)).body, embed.section);
    } catch {
      part = null;
    }
    if (part === null) {
      out += text.slice(embed.from, embed.to);
      continue;
    }
    const inner = await expandEmbeds(part, path, files, read, depth - 1, new Set([...seen, path]));
    out += `\n\n${inner}\n\n`;
  }
  return out + text.slice(last);
}
