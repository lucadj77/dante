// Wikilinks between gamebook paragraphs. The canonical form is [[Title|25]]: the link
// points at the title, which never changes, and the label is the paragraph's number.

export interface WikiLink {
  raw: string;
  from: number;
  to: number;
  embed: boolean;
  target: string;
  heading: string | null;
  label: string | null;
}

/** canonical [[Title|25]], unlabelled [[Title]], bare [[25]] (breaks at the first shuffle), or not a paragraph link. */
export type LinkForm = "canonical" | "unlabelled" | "bare" | "other";

// "[^[\]]" keeps a match from running across two links side by side.
const LINK = /(!?)\[\[([^[\]]+)\]\]/g;

export function findWikiLinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  for (const m of text.matchAll(LINK)) {
    const inner = m[2];
    const pipe = inner.indexOf("|");
    const before = pipe === -1 ? inner : inner.slice(0, pipe);
    const label = pipe === -1 ? null : inner.slice(pipe + 1).trim();
    const hash = before.indexOf("#");
    out.push({
      raw: m[0],
      from: m.index,
      to: m.index + m[0].length,
      embed: m[1] === "!",
      target: (hash === -1 ? before : before.slice(0, hash)).trim(),
      heading: hash === -1 ? null : before.slice(hash + 1).trim(),
      label,
    });
  }
  return out;
}

export function linkForm(link: WikiLink): LinkForm {
  if (link.embed || link.heading !== null) return "other";
  if (/^\d+$/.test(link.target)) return "bare";
  return link.label === null ? "unlabelled" : "canonical";
}

export function composeLink(target: string, label: string | null): string {
  return label === null ? `[[${target}]]` : `[[${target}|${label}]]`;
}

/** Applies replacements given by position, from the last to the first so positions stay valid. */
export function replaceRanges(text: string, changes: { from: number; to: number; insert: string }[]): string {
  let out = text;
  for (const c of [...changes].sort((a, b) => b.from - a.from)) out = out.slice(0, c.from) + c.insert + out.slice(c.to);
  return out;
}
