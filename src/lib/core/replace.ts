// Finding and replacing words across the project's notes: a character renamed in every
// scene, a place spelled differently. Only the text of a note is searched, never its
// properties, and the parts of the text that Dante or Obsidian read as markup are left
// alone, so a replacement cannot break a link, an image, a comment's signature or an
// alignment tag.

import { splitNote } from "./frontmatter";

export interface FindOptions {
  /** "Renzo" does not match "renzo". */
  caseSensitive: boolean;
  /** "Renzo" does not match "Renzone". */
  wholeWord: boolean;
}

/** A match in a note's text, by character offsets in the text without properties. */
export interface Range {
  from: number;
  to: number;
}

/** A match with the words around it, to show in a list. */
export interface Occurrence extends Range {
  before: string;
  match: string;
  after: string;
}

/**
 * Stretches of text that a replacement must not touch: the target of a wikilink (the
 * alias after | is prose and stays searchable), embeds, the address of a Markdown link or
 * image, HTML tags and entities, and CriticMarkup comments, which hold signatures.
 */
const PROTECTED = [
  /!\[\[[^\]\n]*\]\]/g,
  /\[\[[^\]|\n]*(?=[\]|])/g,
  /\]\([^)\n]*\)/g,
  /<[^>\n]+>/g,
  /&[a-zA-Z]+;|&#\d+;/g,
  /\{>>[\s\S]*?<<\}/g,
  /^```[\s\S]*?^```/gm,
];

function protectedRanges(text: string): Range[] {
  const out: Range[] = [];
  for (const pattern of PROTECTED) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) out.push({ from: m.index, to: m.index + m[0].length });
  }
  return out.sort((a, b) => a.from - b.from);
}

const WORD = /[\p{L}\p{N}_]/u;

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Where `query` appears in `text`, leaving out protected stretches. */
export function findIn(text: string, query: string, options: FindOptions): Range[] {
  if (!query) return [];
  const pattern = new RegExp(escape(query), options.caseSensitive ? "gu" : "giu");
  const shielded = protectedRanges(text);
  const out: Range[] = [];
  for (const m of text.matchAll(pattern)) {
    const from = m.index;
    const to = from + m[0].length;
    if (options.wholeWord && (WORD.test(text.charAt(from - 1)) || WORD.test(text.charAt(to)))) continue;
    if (shielded.some((s) => from < s.to && to > s.from)) continue;
    out.push({ from, to });
  }
  return out;
}

/** The matches with some words of context, cut at line ends. */
export function occurrences(text: string, ranges: Range[], width = 40): Occurrence[] {
  return ranges.map(({ from, to }) => {
    let start = Math.max(0, from - width);
    const lineStart = text.lastIndexOf("\n", from - 1) + 1;
    if (lineStart > start) start = lineStart;
    let end = Math.min(text.length, to + width);
    const lineEnd = text.indexOf("\n", to);
    if (lineEnd !== -1 && lineEnd < end) end = lineEnd;
    // Cut between words, not inside one.
    if (start > lineStart) {
      const space = text.indexOf(" ", start);
      if (space !== -1 && space < from) start = space + 1;
    }
    if (end < (lineEnd === -1 ? text.length : lineEnd)) {
      const space = text.lastIndexOf(" ", end);
      if (space > to) end = space;
    }
    return {
      from,
      to,
      before: (start > lineStart ? "…" : "") + text.slice(start, from),
      match: text.slice(from, to),
      after: text.slice(to, end) + (end < (lineEnd === -1 ? text.length : lineEnd) ? "…" : ""),
    };
  });
}

/**
 * The replacement for one match. When case does not count, a match written with a capital
 * (at the start of a sentence) or all in capitals keeps that look: "renzo" → "carlo" turns
 * "Renzo" into "Carlo" and "RENZO" into "CARLO".
 */
export function adapt(match: string, replacement: string, options: FindOptions): string {
  if (options.caseSensitive || !replacement) return replacement;
  const letters = match.replace(/[^\p{L}]/gu, "");
  if (letters.length > 1 && letters === letters.toLocaleUpperCase() && letters !== letters.toLocaleLowerCase()) return replacement.toLocaleUpperCase();
  const first = match.charAt(0);
  if (first !== first.toLocaleLowerCase() && first === first.toLocaleUpperCase()) return replacement.charAt(0).toLocaleUpperCase() + replacement.slice(1);
  return replacement;
}

/** `text` with the given matches replaced. */
export function replaceIn(text: string, ranges: Range[], replacement: string, options: FindOptions): string {
  let out = text;
  for (const { from, to } of [...ranges].sort((a, b) => b.from - a.from)) {
    out = out.slice(0, from) + adapt(text.slice(from, to), replacement, options) + out.slice(to);
  }
  return out;
}

/** The text of a note without its properties, as the editor shows it. */
export function bodyOf(note: string): string {
  return splitNote(note).body;
}
