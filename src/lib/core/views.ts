import { parse, stringify } from "yaml";
import { conflictOf } from "./conflicts";
import type { Properties } from "./frontmatter";
import { flatten, folderNotePath, headings, type ManuscriptNode } from "./manuscript";
import { noteTitle, noteType, type NoteIndex } from "./notes";
import { basename, dirname, isMarkdown, isWithin, join } from "./path";
import type { NovelSettings } from "./settings";
import { textStats } from "./stats";

/**
 * A view is a YAML file in the Views folder that lists notes as a table, a list, cards,
 * a kanban board or a timeline:
 *
 *   type: kanban
 *   source: Manuscript
 *   items: scene
 *   group_by: status
 *   groups: [idea, draft, revised, done]
 *   fields: [pov, words]
 */
export type ViewKind = "table" | "list" | "cards" | "kanban" | "timeline";
export const VIEW_KINDS: ViewKind[] = ["table", "list", "cards", "kanban", "timeline"];

export interface ViewSpec {
  type: ViewKind;
  /** Folders the notes come from; none means the whole project. */
  source: string[];
  /** "scene", "chapter", "note" (any note), or the id of a note type such as "character". */
  items: string;
  /** Property → accepted values; a note passes when every property has one of them. */
  filter: Record<string, string[]>;
  /** Property to sort by, "-" in front for the reverse order; empty keeps the natural order. */
  sort: string;
  /** Property whose values make the kanban's columns, or the list's and table's groups. */
  group_by: string;
  /** Columns shown in this order, with the empty ones too; others follow as they come. */
  groups: string[];
  /** Properties shown on each item, besides its name. */
  fields: string[];
  /** Property holding each item's date on the timeline, and its end. */
  date: string;
  end: string;
  /** Shows each item's synopsis under its name; on unless the file says `synopsis: false`. */
  synopsis: boolean;
}

/** Fields every item has, besides its properties. */
export const BUILT_IN = ["name", "folder", "type", "words", "chapter"] as const;
export const VIEW_EXT = ".yaml";

export function defaultView(type: ViewKind = "table"): ViewSpec {
  return { type, source: [], items: "note", filter: {}, sort: "", group_by: "", groups: [], fields: [], date: "", end: "", synopsis: true };
}

const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter(Boolean) : text(v) ? [text(v)] : []);

/** Reads a view file; anything missing or wrong takes its default. */
export function parseView(yaml: string): ViewSpec {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = parse(yaml);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) raw = parsed;
  } catch {
    // A file being written by hand: shown with the defaults until it reads again.
  }
  const view = defaultView();
  const type = text(raw.type).toLowerCase();
  // "card" and "board" are what people tend to write.
  const aliases: Record<string, ViewKind> = { card: "cards", board: "kanban" };
  if ((VIEW_KINDS as string[]).includes(type)) view.type = type as ViewKind;
  else if (aliases[type]) view.type = aliases[type];
  view.source = list(raw.source).map((s) => s.replace(/^\/+|\/+$/g, ""));
  view.items = text(raw.items) || "note";
  if (raw.filter && typeof raw.filter === "object" && !Array.isArray(raw.filter)) {
    for (const [key, value] of Object.entries(raw.filter)) view.filter[key] = list(value);
  }
  view.sort = text(raw.sort);
  view.group_by = text(raw.group_by);
  view.groups = list(raw.groups);
  const card = raw.card && typeof raw.card === "object" ? (raw.card as Record<string, unknown>) : {};
  view.fields = list(raw.fields ?? card.fields);
  view.date = text(raw.date);
  view.end = text(raw.end);
  view.synopsis = raw.synopsis !== false;
  return view;
}

/** Writes a view file, leaving out what has its default value. */
export function serializeView(view: ViewSpec): string {
  const out: Record<string, unknown> = { type: view.type };
  if (view.source.length) out.source = view.source.length === 1 ? view.source[0] : view.source;
  if (view.items !== "note") out.items = view.items;
  if (Object.keys(view.filter).length) out.filter = Object.fromEntries(Object.entries(view.filter).map(([k, v]) => [k, v.length === 1 ? v[0] : v]));
  if (view.sort) out.sort = view.sort;
  if (view.group_by) out.group_by = view.group_by;
  if (view.groups.length) out.groups = view.groups;
  if (view.fields.length) out.fields = view.fields;
  if (view.date) out.date = view.date;
  if (view.end) out.end = view.end;
  if (!view.synopsis) out.synopsis = false;
  return stringify(out, { lineWidth: 0 });
}

export interface ViewRow {
  /** The note; for a chapter, its folder. */
  path: string;
  /** The file holding the properties: the note itself, or a chapter's folder note. */
  file: string | null;
  name: string;
  properties: Properties;
  type: string | null;
  folder: string;
  words: number;
  /** Heading of the chapter the scene is in. */
  chapter: string;
  /** The first words of the text, for cards. */
  excerpt: string;
  /** Position in the manuscript or by name, the natural order. */
  order: number;
}

/** A property value as it reads: a wikilink becomes its alias or its note's name. */
export function plain(value: unknown): string {
  return text(value).replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => alias ?? basename(target.trim()));
}

/** Every value of a field for a row, as text: one for most, several for a list. */
export function values(row: ViewRow, field: string): string[] {
  switch (field) {
    case "name":
      return [row.name];
    case "folder":
      return [row.folder];
    case "type":
      return row.type ? [row.type] : [];
    case "words":
      return [String(row.words)];
    case "chapter":
      return row.chapter ? [row.chapter] : [];
  }
  const value = row.properties[field];
  if (Array.isArray(value)) return value.map(plain).filter(Boolean);
  const one = plain(value);
  return one ? [one] : [];
}

export function display(row: ViewRow, field: string): string {
  return values(row, field).join(", ");
}

/** The start of a text as it reads: no markup, comments or deleted words. */
export function excerpt(body: string, length = 220): string {
  const clean = body
    .replace(/\{>>[\s\S]*?<<\}|\{--[\s\S]*?--\}|%%[\s\S]*?%%/g, "")
    .replace(/\{~~[\s\S]*?~>([\s\S]*?)~~\}/g, "$1")
    .replace(/\{(\+\+|==)([\s\S]*?)(\+\+|==)\}/g, "$2")
    .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => alias ?? basename(target))
    .replace(/^#{1,6}\s+|^>\s?|^\s*[-*+]\s+/gm, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > length ? clean.slice(0, length).replace(/\s+\S*$/, "") + "…" : clean;
}

/** The notes a view lists, before filtering and sorting. */
export function collect(view: ViewSpec, index: NoteIndex, manuscript: ManuscriptNode, settings: NovelSettings): ViewRow[] {
  const titles = headings(manuscript, settings);
  const nodes = flatten(manuscript);
  const position = new Map(nodes.map((n, i) => [n.path, i]));
  const chapterOf = new Map<string, string>();
  for (const node of nodes) {
    if (node.kind === "chapter" || node.kind === "prologue" || node.kind === "epilogue") {
      for (const inner of flatten(node)) chapterOf.set(inner.path, (titles.get(node.path) ?? node.title).replace(/\n/g, " · "));
    }
  }
  const inSource = (path: string) => !view.source.length || view.source.some((s) => isWithin(path, s));
  const hidden = (path: string) => isWithin(path, settings.folders.templates) || isWithin(path, settings.folders.views);
  const rows: ViewRow[] = [];

  const row = (path: string, file: string | null, name: string): ViewRow => {
    const note = file ? index.notes.get(file) : undefined;
    const properties = note?.properties ?? {};
    return {
      path,
      file,
      name,
      properties,
      type: file ? noteType(file, properties, settings) : null,
      folder: dirname(path),
      words: note ? textStats(note.body).words : 0,
      chapter: chapterOf.get(path) ?? "",
      excerpt: note ? excerpt(note.body) : "",
      order: position.get(path) ?? Number.MAX_SAFE_INTEGER,
    };
  };

  if (view.items === "scene") {
    for (const node of nodes) if (node.kind === "scene" && inSource(node.path)) rows.push(row(node.path, node.path, node.title));
  } else if (view.items === "chapter") {
    for (const node of nodes) {
      if (node.kind === "manuscript" || node.kind === "scene" || !inSource(node.path)) continue;
      const r = row(node.path, node.notePath, (titles.get(node.path) ?? node.title).replace(/\n/g, " · "));
      // A chapter counts the words of its scenes.
      r.words = flatten(node).reduce((n, c) => n + (c.kind === "scene" ? textStats(index.notes.get(c.path)?.body ?? "").words : 0), 0);
      r.type = node.kind;
      rows.push(r);
    }
  } else {
    const folderNotes = new Set(nodes.filter((n) => n.notePath).map((n) => n.notePath!));
    for (const path of index.notes.keys()) {
      if (!isMarkdown(path) || !inSource(path) || hidden(path) || folderNotes.has(path)) continue;
      // Copies made by a sync service are settled apart, not listed.
      if (conflictOf(path, (other) => index.notes.has(other))) continue;
      const r = row(path, path, noteTitle(path, settings.folders.manuscript));
      if (view.items !== "note" && r.type !== view.items) continue;
      rows.push(r);
    }
  }
  return rows;
}

/** Natural order for the manuscript, then by name. */
function natural(a: ViewRow, b: ViewRow): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

function compare(a: string, b: string): number {
  const x = Number(a);
  const y = Number(b);
  if (a !== "" && b !== "" && !Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

/** Filters and sorts the rows as the view asks. Empty values sort last. */
export function arrange(view: ViewSpec, rows: ViewRow[], sort = view.sort): ViewRow[] {
  const fold = (s: string) => s.trim().toLowerCase();
  const kept = rows.filter((r) =>
    Object.entries(view.filter).every(([field, accepted]) => {
      if (!accepted.length) return true;
      const have = values(r, field).map(fold);
      return accepted.some((a) => (a === "" ? have.length === 0 : have.includes(fold(a))));
    }),
  );
  const desc = sort.startsWith("-");
  const by = desc ? sort.slice(1) : sort;
  return kept.sort((a, b) => {
    if (!by) return natural(a, b);
    const x = display(a, by);
    const y = display(b, by);
    if (!x !== !y) return x ? -1 : 1;
    return (desc ? -compare(x, y) : compare(x, y)) || natural(a, b);
  });
}

export interface Group {
  /** The value shared by the group, "" for items without one. */
  key: string;
  rows: ViewRow[];
}

/**
 * Rows by the first value of `field`: the view's `groups` first, in their order and even
 * when empty, then other values as they appear, and items without a value last.
 */
export function group(view: ViewSpec, rows: ViewRow[], field = view.group_by): Group[] {
  const groups = new Map<string, ViewRow[]>();
  const find = (value: string) => [...groups.keys()].find((k) => k.toLowerCase() === value.toLowerCase());
  for (const g of view.groups) if (!find(g)) groups.set(g, []);
  const none: ViewRow[] = [];
  for (const r of rows) {
    const value = values(r, field)[0];
    if (!value) {
      none.push(r);
      continue;
    }
    const key = find(value) ?? value;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const out = [...groups].map(([key, rows]) => ({ key, rows }));
  if (none.length || view.type === "kanban") out.push({ key: "", rows: none });
  return out;
}

export interface Moment {
  /** The date as written, for display. */
  label: string;
  /** A sortable key: year, month and day, padded. */
  key: string;
  end: string;
  rows: ViewRow[];
}

/**
 * A sortable key for a date: "1987-03-12", "1987-03", "1987", a negative year, or a
 * number of a day or chapter in the story. Null when the value is not a date.
 */
export function dateKey(value: string): string | null {
  const m = /^(-?\d{1,6})(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?:[T ].*)?$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  // Negative years sort before the others, the oldest first.
  const y = year < 0 ? `0${String(999999 + year).padStart(6, "0")}` : `1${String(year).padStart(6, "0")}`;
  return `${y}-${(m[2] ?? "0").padStart(2, "0")}-${(m[3] ?? "0").padStart(2, "0")}`;
}

/** Rows in the order of their dates, together when they share one; undated ones apart. */
export function timeline(view: ViewSpec, rows: ViewRow[]): { moments: Moment[]; undated: ViewRow[] } {
  const moments = new Map<string, Moment>();
  const undated: ViewRow[] = [];
  for (const r of rows) {
    const label = view.date ? values(r, view.date)[0] ?? "" : "";
    const key = label ? dateKey(label) : null;
    if (!key) {
      undated.push(r);
      continue;
    }
    const end = view.end ? (values(r, view.end)[0] ?? "") : "";
    const id = `${key}|${end}`;
    if (!moments.has(id)) moments.set(id, { label, key, end, rows: [] });
    moments.get(id)!.rows.push(r);
  }
  const sorted = [...moments.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.end.localeCompare(b.end)));
  return { moments: sorted, undated };
}

/** Properties used by the listed notes, for the choices of the view editor. */
export function propertyNames(rows: ViewRow[]): string[] {
  const names = new Set<string>();
  for (const r of rows) for (const key of Object.keys(r.properties)) names.add(key);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** The file of a new view named `name` in the Views folder. */
export function viewPath(settings: NovelSettings, name: string): string {
  return join(settings.folders.views, name + VIEW_EXT);
}

export function isView(path: string, settings: NovelSettings): boolean {
  return isWithin(path, settings.folders.views) && /\.ya?ml$/i.test(path);
}

/**
 * The chapters (and prologue, epilogue) by the heading a view shows for them, in reading
 * order: a board grouped by chapter has them as columns, and moves scenes into them.
 */
export function chapterPaths(manuscript: ManuscriptNode, settings: NovelSettings): Map<string, string> {
  const titles = headings(manuscript, settings);
  const out = new Map<string, string>();
  for (const node of flatten(manuscript)) {
    if (node.kind === "chapter" || node.kind === "prologue" || node.kind === "epilogue") {
      out.set((titles.get(node.path) ?? node.title).replace(/\n/g, " · "), node.path);
    }
  }
  return out;
}

/** Where a row's properties are written: the note, or a chapter's folder note. */
export function propertiesTarget(row: ViewRow): string {
  return row.file ?? folderNotePath(row.path);
}
