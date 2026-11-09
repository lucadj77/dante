// The paragraphs of a gamebook and the links between them, read the way the Obsidian plugin
// «Librogame» reads them: a paragraph is a Markdown file in the paragraphs folder with an
// integer `numero` property; its title is the file name, which never carries the number.

import type { PageUnit } from "../settings";
import { sceneSize } from "../statistics";
import { findBoxes, withoutBoxes, type Box, type BoxType } from "./boxes";
import { readDocument, readList, readScalar, unquote } from "./frontmatter";
import { findWikiLinks, linkForm, type WikiLink } from "./links";
import { stateInText, type SaidState } from "./check";

/** Frontmatter keys, as the plugin and Missione Cavaliere write them. */
export const KEYS = {
  number: "numero",
  aliases: "aliases",
  numberType: "numero_tipo",
  anchor: "ancora",
  offset: "scarto",
  ending: "finale",
  hidden: "rimandi nascosti",
  note: "note",
} as const;

/** free: a shuffle may change it; fixed: never changes; relative: anchor's number plus an offset. */
export type NumberType = "free" | "fixed" | "relative";
const NUMBER_TYPES: Record<string, NumberType> = { libero: "free", fisso: "fixed", relativo: "relative" };

export interface Reference {
  target: string;
  /** Written in the `rimandi nascosti` property instead of the text. */
  hidden: boolean;
  label: string | null;
  raw: string;
  /** Position in the body; -1 for hidden references. */
  from: number;
  to: number;
}

export interface Paragraph {
  path: string;
  title: string;
  /** The folder holding the file: numbers are counted within it. */
  scope: string;
  number: number;
  numberType: NumberType;
  anchor: string | null;
  offset: number | null;
  ending: boolean;
  hasEndingBox: boolean;
  /** No prose once frontmatter and boxes are left out. */
  empty: boolean;
  /** Length of the visible text, in the project's unit. */
  length: number;
  references: Reference[];
  boxes: Box[];
  /** Links written as [[25]], which point to whatever has that number. */
  bareLinks: WikiLink[];
  /** Values of the frontmatter lists, by key, for the boxes' properties and the register. */
  lists: Record<string, string[]>;
  note: string;
  /** What the prose gives the reader and asks of them, as in "Segna la parola chiave **x**". */
  said: SaidState;
}

export function titleOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

export function scopeOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** The target of a frontmatter value such as `"[[Title|32]]"` or `Title`. */
function targetOf(value: string): string | null {
  const link = findWikiLinks(value)[0];
  if (link) return link.target;
  const plain = unquote(value).trim();
  return plain || null;
}

export interface ReadOptions {
  boxTypes: BoxType[];
  unit: PageUnit;
  /** The book's language, for the phrases that give and ask in the text. Italian when missing. */
  language?: string;
}

export function readParagraph(path: string, text: string, options: ReadOptions): Paragraph | null {
  const { frontmatter, body } = readDocument(text);
  const rawNumber = readScalar(frontmatter, KEYS.number);
  if (rawNumber === null || !/^-?\d+$/.test(rawNumber.trim())) return null;
  const boxes = findBoxes(body, options.boxTypes);
  const references: Reference[] = [];
  const bareLinks: WikiLink[] = [];
  for (const link of findWikiLinks(body)) {
    const form = linkForm(link);
    if (form === "other") continue;
    if (form === "bare") {
      bareLinks.push(link);
      continue;
    }
    references.push({ target: link.target, hidden: false, label: link.label, raw: link.raw, from: link.from, to: link.to });
  }
  for (const value of readList(frontmatter, KEYS.hidden)) {
    const target = targetOf(value);
    if (target) references.push({ target, hidden: true, label: findWikiLinks(value)[0]?.label ?? null, raw: value, from: -1, to: -1 });
  }
  const rawOffset = readScalar(frontmatter, KEYS.offset);
  const offset = rawOffset === null ? NaN : Number.parseInt(rawOffset, 10);
  const rawAnchor = readScalar(frontmatter, KEYS.anchor);
  const endingTypes = new Set(options.boxTypes.filter((t) => t.ending).map((t) => t.id));
  const lists: Record<string, string[]> = {};
  for (const type of options.boxTypes) if (type.property) lists[type.property] = readList(frontmatter, type.property).map(unquote);
  return {
    path,
    title: titleOf(path),
    scope: scopeOf(path),
    number: Number.parseInt(rawNumber, 10),
    numberType: NUMBER_TYPES[readScalar(frontmatter, KEYS.numberType) ?? ""] ?? "free",
    anchor: rawAnchor === null ? null : targetOf(rawAnchor),
    offset: Number.isNaN(offset) ? null : offset,
    ending: readScalar(frontmatter, KEYS.ending) === "true",
    hasEndingBox: boxes.some((b) => endingTypes.has(b.type)),
    empty: withoutBoxes(body, options.boxTypes).trim() === "",
    length: sceneSize(body.replace(/^:::[^\n]*$/gm, ""), options.unit),
    references,
    boxes,
    bareLinks,
    lists,
    note: unquote(readScalar(frontmatter, KEYS.note) ?? ""),
    said: stateInText(body, options.language),
  };
}

export type Resolution = { kind: "paragraph"; to: Paragraph } | { kind: "note" } | { kind: "broken" };

/** Every paragraph of a gamebook, with the links between them. */
export class GamebookIndex {
  private byPath = new Map<string, Paragraph>();
  private byTitle = new Map<string, Paragraph>();
  /** Titles of every file in the paragraphs folder, paragraphs or not. */
  private known = new Set<string>();
  private incomingMemo: Map<string, { from: Paragraph; reference: Reference }[]> | null = null;

  constructor(files: { path: string; text: string }[], options: ReadOptions) {
    for (const f of files) {
      this.known.add(titleOf(f.path));
      const p = readParagraph(f.path, f.text, options);
      if (!p) continue;
      this.byPath.set(p.path, p);
      if (!this.byTitle.has(p.title)) this.byTitle.set(p.title, p);
    }
  }

  all(): Paragraph[] {
    return [...this.byPath.values()].sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
  }

  scopes(): string[] {
    return [...new Set(this.all().map((p) => p.scope))];
  }

  inScope(scope: string): Paragraph[] {
    return this.all().filter((p) => p.scope === scope);
  }

  get(path: string): Paragraph | undefined {
    return this.byPath.get(path);
  }

  byNumber(scope: string, number: number): Paragraph | undefined {
    return this.inScope(scope).find((p) => p.number === number);
  }

  resolve(target: string): Resolution {
    const to = this.byTitle.get(target);
    if (to) return { kind: "paragraph", to };
    return this.known.has(target) ? { kind: "note" } : { kind: "broken" };
  }

  /** Where a paragraph leads: other paragraphs, or `to: null` for a link to nothing. Links to notes are left out. */
  outgoing(p: Paragraph): { reference: Reference; to: Paragraph | null }[] {
    const out: { reference: Reference; to: Paragraph | null }[] = [];
    for (const reference of p.references) {
      const r = this.resolve(reference.target);
      if (r.kind === "note") continue;
      out.push({ reference, to: r.kind === "paragraph" ? r.to : null });
    }
    return out;
  }

  /** Paragraphs that lead here, in order of number. */
  incoming(path: string): { from: Paragraph; reference: Reference }[] {
    if (!this.incomingMemo) {
      const map = new Map<string, { from: Paragraph; reference: Reference }[]>();
      for (const from of this.all()) {
        for (const reference of from.references) {
          const r = this.resolve(reference.target);
          if (r.kind !== "paragraph") continue;
          const list = map.get(r.to.path) ?? [];
          list.push({ from, reference });
          map.set(r.to.path, list);
        }
      }
      this.incomingMemo = map;
    }
    return this.incomingMemo.get(path) ?? [];
  }

  firstFreeNumber(scope: string): number {
    const taken = new Set(this.inScope(scope).map((p) => p.number));
    let n = 1;
    while (taken.has(n)) n++;
    return n;
  }

  duplicates(scope: string): Map<number, Paragraph[]> {
    const by = new Map<number, Paragraph[]>();
    for (const p of this.inScope(scope)) by.set(p.number, [...(by.get(p.number) ?? []), p]);
    return new Map([...by].filter(([, list]) => list.length > 1));
  }

  /** No paragraph leads here, apart from the first one. */
  orphans(scope: string, start: number): Paragraph[] {
    return this.inScope(scope).filter((p) => p.number !== start && this.incoming(p.path).length === 0);
  }

  /** Paths reachable from `from` following the links, `from` included. */
  reachable(from: Paragraph): Set<string> {
    const seen = new Set([from.path]);
    const queue = [from];
    while (queue.length) {
      const p = queue.shift()!;
      for (const { to } of this.outgoing(p)) {
        if (!to || seen.has(to.path)) continue;
        seen.add(to.path);
        queue.push(to);
      }
    }
    return seen;
  }

  unreachable(scope: string, start: number): Paragraph[] {
    const first = this.byNumber(scope, start);
    const seen = first ? this.reachable(first) : new Set<string>();
    return this.inScope(scope).filter((p) => !seen.has(p.path));
  }

  /** Leads nowhere (a broken link still counts as a way out) and is not an ending. */
  deadEnd(p: Paragraph): boolean {
    return this.outgoing(p).length === 0 && !p.ending;
  }
}

export type Warning = "orphan" | "deadEnd" | "unreachable" | "duplicate" | "bareLink" | "broken" | "endingBox" | "staleLabel";

/** What is wrong with each paragraph, by path. */
export function warnings(index: GamebookIndex, start: number): Map<string, Warning[]> {
  const out = new Map<string, Warning[]>();
  const add = (path: string, w: Warning) => out.set(path, [...(out.get(path) ?? []), w]);
  for (const scope of index.scopes()) {
    for (const p of index.orphans(scope, start)) add(p.path, "orphan");
    for (const p of index.unreachable(scope, start)) if (index.incoming(p.path).length > 0) add(p.path, "unreachable");
    for (const list of index.duplicates(scope).values()) for (const p of list) add(p.path, "duplicate");
  }
  for (const p of index.all()) {
    if (index.deadEnd(p)) add(p.path, "deadEnd");
    if (p.bareLinks.length) add(p.path, "bareLink");
    if (index.outgoing(p).some((o) => !o.to)) add(p.path, "broken");
    if (p.hasEndingBox && !p.ending) add(p.path, "endingBox");
    if (index.outgoing(p).some((o) => o.to && !o.reference.hidden && o.reference.label !== String(o.to.number))) add(p.path, "staleLabel");
  }
  return out;
}

/** Short, normal or long, against the short threshold and the size of a page. */
export function lengthBand(length: number, short: number, page: number): "short" | "normal" | "long" {
  if (page > 0 && length > page) return "long";
  if (length < short) return "short";
  return "normal";
}

/** Estimated pages: each paragraph on its own pages, or the text running on. */
export function pagesOf(lengths: number[], page: number, onePerPage: boolean): number {
  if (page <= 0) return 0;
  if (onePerPage) return lengths.reduce((n, l) => n + Math.max(1, Math.ceil(l / page)), 0);
  return Math.max(lengths.length ? 1 : 0, Math.ceil(lengths.reduce((n, l) => n + l, 0) / page));
}
