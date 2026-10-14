import type { ProjectFs } from "./fs";
import { readProperties, splitNote, type Properties } from "./frontmatter";
import { parseName } from "./naming";
import { basename, isMarkdown, isWithin, stripExt } from "./path";
import type { NovelSettings } from "./settings";
import { findLinks, resolveLink } from "./wikilinks";

export interface NoteInfo {
  path: string;
  properties: Properties;
  /** The text after the frontmatter. */
  body: string;
  /** Whole text, frontmatter included, where links in properties count too. */
  text: string;
  /** Other names of the note, from Obsidian's `aliases` property. */
  aliases: string[];
  /** Paths the note links to, each once. */
  links: string[];
}

/**
 * The name shown for a file: a note's name without ".md", other files with their
 * extension. In the manuscript, the order prefix is left out too.
 */
export function noteTitle(path: string, manuscript?: string): string {
  if (!isMarkdown(path)) return basename(path);
  const name = stripExt(basename(path));
  return manuscript !== undefined && isWithin(path, manuscript) ? parseName(name).title : name;
}

function aliasesOf(properties: Properties): string[] {
  const value = properties.aliases ?? properties.alias;
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.filter((a): a is string => typeof a === "string" && a.trim() !== "").map((a) => a.trim());
  return [];
}

/**
 * The type of a note: its `type` property when it names a type (by id, name or folder),
 * otherwise the type whose Codex folder it is in. An unknown `type` is kept as written.
 */
export function noteType(path: string, properties: Properties, settings: NovelSettings): string | null {
  let declared = properties.type;
  if (Array.isArray(declared)) declared = declared.find((v) => typeof v === "string");
  if (typeof declared === "string" && declared.trim()) {
    const wanted = declared.trim().toLowerCase();
    for (const [id, type] of Object.entries(settings.types)) {
      if (id.toLowerCase() === wanted || type.name.toLowerCase() === wanted || type.folder.toLowerCase() === wanted) return id;
    }
    return declared.trim();
  }
  const codex = settings.folders.codex;
  if (!isWithin(path, codex) || path === codex) return null;
  const folder = path.slice(codex.length + 1).split("/")[0].toLowerCase();
  for (const [id, type] of Object.entries(settings.types)) {
    if (type.folder.toLowerCase() === folder) return id;
  }
  return null;
}

/** Lowercase without accents, so that "citta" finds "città". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export interface Backlink {
  from: string;
  /** The lines that hold a link, trimmed. */
  lines: string[];
}

export interface SearchResult {
  path: string;
  title: string;
  /** Text around the first match in the note, or "" when only the name matched. */
  snippet: string;
}

/**
 * What the project's notes say and link to, read once and kept up to date as notes are
 * saved. It can always be thrown away and read again.
 */
export class NoteIndex {
  notes = new Map<string, NoteInfo>();

  constructor(
    private files: string[],
    /** The manuscript folder, whose names carry an order prefix. */
    private manuscript = "",
  ) {}

  static async build(fs: ProjectFs, files: string[], manuscript = ""): Promise<NoteIndex> {
    const index = new NoteIndex(files, manuscript);
    for (const path of files) {
      if (!isMarkdown(path)) continue;
      try {
        index.set(path, await fs.readText(path));
      } catch {
        // Gone since the scan: the next reload drops it.
      }
    }
    return index;
  }

  /** Records the new text of a note. */
  set(path: string, text: string) {
    const properties = readProperties(text);
    const links = new Set<string>();
    for (const link of findLinks(text)) {
      const target = resolveLink(link.target, path, this.files);
      if (target && target !== path) links.add(target);
    }
    this.notes.set(path, { path, properties, body: splitNote(text).body, text, aliases: aliasesOf(properties), links: [...links] });
  }

  /** Notes that link to `path`, with the lines where they do. */
  backlinks(path: string): Backlink[] {
    const out: Backlink[] = [];
    for (const note of this.notes.values()) {
      if (!note.links.includes(path)) continue;
      const lines = note.text
        .split("\n")
        .filter((line) => findLinks(line).some((l) => resolveLink(l.target, note.path, this.files) === path))
        .map((line) => line.trim());
      out.push({ from: note.path, lines });
    }
    return out.sort((a, b) => a.from.localeCompare(b.from));
  }

  /** Links in `path` whose target does not exist, as written. */
  unresolved(path: string): string[] {
    const note = this.notes.get(path);
    if (!note) return [];
    const out = new Set<string>();
    for (const link of findLinks(note.text)) {
      if (!resolveLink(link.target, path, this.files)) out.add(link.target);
    }
    return [...out];
  }

  /**
   * Notes and files whose name, aliases or text contain every word of the query, in any
   * case and with or without accents. Name matches come first.
   */
  search(query: string, limit = 50, within?: (path: string) => boolean): SearchResult[] {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const scored: { result: SearchResult; score: number }[] = [];
    for (const path of this.files) {
      if (within && !within(path)) continue;
      const title = noteTitle(path, this.manuscript || undefined);
      const note = this.notes.get(path);
      const name = fold([title, ...(note?.aliases ?? [])].join(" "));
      const body = note ? fold(note.body) : "";
      if (!words.every((w) => name.includes(w) || body.includes(w))) continue;
      const inName = words.filter((w) => name.includes(w)).length;
      const score = inName * 10 + (fold(title).startsWith(words[0]) ? 5 : 0);
      const snippet = note ? excerpt(note.body, words.find((w) => body.includes(w))) : "";
      scored.push({ result: { path, title, snippet }, score });
    }
    scored.sort((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title));
    return scored.slice(0, limit).map((s) => s.result);
  }
}

/** About a line of text around the first place `word` appears. */
function excerpt(body: string, word: string | undefined, width = 90): string {
  if (!word) return "";
  const folded = fold(body);
  // Folding can shorten the text (a letter and its accent become one); positions are
  // close enough for an excerpt, and the text itself is never changed.
  const at = folded.indexOf(word);
  if (at < 0) return "";
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(body.length, start + width);
  const text = body.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + text + (end < body.length ? "…" : "");
}
