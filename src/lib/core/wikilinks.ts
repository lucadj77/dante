import { basename, dirname, isMarkdown, isWithin, stripExt } from "./path";

// [[target#heading|alias]], optionally embedded with a leading "!".
const LINK = /(!?)\[\[([^\[\]|#^\n]+)([#^][^\[\]|\n]*)?(\|[^\[\]\n]*)?\]\]/g;

export interface WikiLink {
  target: string;
  /** "#heading" or "^block", including the marker. */
  subpath: string;
  alias: string | null;
  start: number;
  end: number;
}

export function findLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const m of text.matchAll(LINK)) {
    links.push({
      target: m[2].trim(),
      subpath: m[3] ?? "",
      alias: m[4] ? m[4].slice(1) : null,
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }
  return links;
}

/** Text with each link written as a reader sees it: its alias, or the linked note's name. */
export function readableLinks(text: string): string {
  return text.replace(LINK, (_m, _embed, target: string, _sub, alias?: string) => (alias ? alias.slice(1) : basename(stripExt(target.trim()))));
}

function normalize(target: string): string {
  return (isMarkdown(target) ? stripExt(target) : target).replace(/^\/+/, "").toLowerCase();
}

/**
 * Resolves a link target the way Obsidian does: a bare name matches any note with that
 * name, a path matches the end of a note's path. With several matches, the note in the
 * linking note's folder (or closest to it) wins, then the shortest path.
 */
export function resolveLink(target: string, fromPath: string, notes: string[]): string | null {
  const wanted = normalize(target);
  if (wanted === "") return null;
  const matches = notes.filter((p) => {
    const key = linkKey(p).toLowerCase();
    return key === wanted || key.endsWith("/" + wanted);
  });
  if (matches.length <= 1) return matches[0] ?? null;
  const fromDir = dirname(fromPath);
  const closeness = (p: string) => {
    let dir = fromDir;
    let steps = 0;
    while (!isWithin(p, dir)) {
      dir = dirname(dir);
      steps++;
    }
    return steps;
  };
  return [...matches].sort((a, b) => closeness(a) - closeness(b) || a.length - b.length || a.localeCompare(b))[0];
}

/** Notes are linked without their ".md"; other files keep their extension. */
function linkKey(path: string): string {
  return isMarkdown(path) ? stripExt(path) : path;
}

/** The shortest target that still resolves to `path` from `fromPath`. */
export function linkTarget(path: string, fromPath: string, notes: string[]): string {
  const name = linkKey(basename(path));
  if (resolveLink(name, fromPath, notes) === path) return name;
  return linkKey(path);
}

/**
 * Rewrites the links in `text` whose note moved. `renames` maps old note paths to new
 * ones; `before` and `after` are all the project's notes before and after the moves.
 * Returns null when nothing changed.
 */
export function rewriteLinks(
  text: string,
  fromPath: string,
  renames: Map<string, string>,
  before: string[],
  after: string[],
  newFromPath = fromPath,
): string | null {
  let out = "";
  let last = 0;
  let changed = false;
  for (const link of findLinks(text)) {
    const resolved = resolveLink(link.target, fromPath, before);
    if (!resolved) continue;
    const moved = renames.get(resolved) ?? resolved;
    // A link that still reaches its note is left exactly as written.
    if (resolveLink(link.target, newFromPath, after) === moved) continue;
    const finalTarget = linkTarget(moved, newFromPath, after);
    const embed = text[link.start] === "!" ? "!" : "";
    const alias = link.alias !== null ? `|${link.alias}` : "";
    out += text.slice(last, link.start) + `${embed}[[${finalTarget}${link.subpath}${alias}]]`;
    last = link.end;
    changed = true;
  }
  if (!changed) return null;
  return out + text.slice(last);
}

/**
 * The note that has `name` among its aliases (in any case), when no note is called `name`
 * and exactly one note has that alias.
 */
export function resolveAlias(name: string, fromPath: string, notes: string[], aliases: (path: string) => string[]): string | null {
  if (resolveLink(name, fromPath, notes) !== null) return null;
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const matches = notes.filter((p) => aliases(p).some((a) => a.toLowerCase() === wanted));
  return matches.length === 1 ? matches[0] : null;
}
