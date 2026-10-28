// Names of the Story Bible found in the text without a link: "Lucia" in a scene is the
// character Lucia, as the mentions in the statistics count her. The editor underlines them,
// and the Links panel lists them, so a link is one click away and never required.

import { noteTitle, noteType, type NoteIndex } from "./notes";
import { isWithin } from "./path";
import type { NovelSettings } from "./settings";

/** A name (or alias) of a note of the Story Bible. */
export interface BibleName {
  name: string;
  path: string;
  /** The note's type id, such as "character". */
  type: string;
}

/** A name found in a text: where it is and the note it names. */
export interface NameFound {
  from: number;
  to: number;
  name: string;
  path: string;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every name and alias of the typed notes outside the manuscript and the templates. */
export function bibleNames(index: NoteIndex, settings: NovelSettings): BibleName[] {
  const out: BibleName[] = [];
  for (const note of index.notes.values()) {
    if (isWithin(note.path, settings.folders.manuscript) || isWithin(note.path, settings.folders.templates)) continue;
    const type = noteType(note.path, note.properties, settings);
    if (!type) continue;
    for (const name of new Set([noteTitle(note.path), ...note.aliases])) if (name.trim()) out.push({ name: name.trim(), path: note.path, type });
  }
  return out;
}

// Links, embeds, comments and code are not the text's own words: a name there is not looked for.
const SKIPPED = /!?\[\[[^\]\n]*\]\]|\[[^\]\n]*\]\([^)\n]*\)|\{>>[\s\S]*?<<\}|`[^`\n]*`|%%[\s\S]*?%%/g;

/** Finds the names of the Story Bible in a text: whole words, written as the note writes them. */
export class NameMatcher {
  readonly names: BibleName[];
  private pattern: RegExp | null;
  private owners = new Map<string, string>();

  constructor(names: BibleName[]) {
    this.names = names;
    // A name two notes share names neither.
    const count = new Map<string, number>();
    for (const n of names) count.set(n.name, (count.get(n.name) ?? 0) + 1);
    const unique = names.filter((n) => count.get(n.name) === 1);
    for (const n of unique) this.owners.set(n.name, n.path);
    const words = [...this.owners.keys()].sort((a, b) => b.length - a.length);
    // "Marta" is not found in "Martina", nor a place called "Casa" in every "casa". The
    // character before is matched rather than looked behind, which macOS 10.15 does not know.
    this.pattern = words.length ? new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  }

  get empty(): boolean {
    return this.pattern === null;
  }

  /** The names in `text`, in order, leaving out those inside links, comments and code. */
  find(text: string): NameFound[] {
    if (!this.pattern) return [];
    const blank = text.replace(SKIPPED, (m) => " ".repeat(m.length));
    const out: NameFound[] = [];
    this.pattern.lastIndex = 0;
    for (const m of blank.matchAll(this.pattern)) {
      const from = m.index! + m[1].length;
      out.push({ from, to: from + m[2].length, name: m[2], path: this.owners.get(m[2])! });
    }
    return out;
  }
}

/** The notes a text names without linking to them, each with how often, most named first. */
export function namedNotes(text: string, matcher: NameMatcher, linked: string[] = [], own = ""): { path: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const found of matcher.find(text)) {
    if (found.path === own || linked.includes(found.path)) continue;
    counts.set(found.path, (counts.get(found.path) ?? 0) + 1);
  }
  return [...counts].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count);
}

/** The scenes that name a note of the Story Bible without linking to it, in the manuscript's order of files. */
export function scenesNaming(path: string, index: NoteIndex, settings: NovelSettings, names: BibleName[]): { path: string; count: number }[] {
  const shared = new Set(names.filter((n, i) => names.findIndex((o) => o.name === n.name) !== i).map((n) => n.name));
  const matcher = new NameMatcher(names.filter((n) => n.path === path && !shared.has(n.name)));
  if (matcher.empty) return [];
  const out: { path: string; count: number }[] = [];
  for (const note of index.notes.values()) {
    if (!isWithin(note.path, settings.folders.manuscript) || note.links.includes(path)) continue;
    const count = matcher.find(note.body).length;
    if (count) out.push({ path: note.path, count });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}
