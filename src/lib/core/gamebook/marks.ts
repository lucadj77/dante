// What the tree and the panels show of each paragraph of a gamebook.

import type { NoteIndex } from "../notes";
import { isWithin } from "../path";
import type { NovelSettings } from "../settings";
import { GamebookIndex, lengthBand, pagesOf, warnings, type NumberType, type Paragraph, type Warning } from "./paragraphs";

/** The paragraphs of the manuscript folder, or null when the module is off. */
export function gamebookOf(notes: NoteIndex, settings: NovelSettings): GamebookIndex | null {
  if (!settings.gamebook.enabled) return null;
  const files = [...notes.notes.values()].filter((n) => isWithin(n.path, settings.folders.manuscript)).map((n) => ({ path: n.path, text: n.text }));
  return new GamebookIndex(files, { boxTypes: settings.gamebook.boxes, unit: settings.pages.unit, language: settings.language });
}

export interface ParagraphMark {
  number: number;
  numberType: NumberType;
  ending: boolean;
  empty: boolean;
  length: number;
  band: "short" | "normal" | "long";
  warnings: Warning[];
  /** Numbers of the paragraphs that lead here. */
  incoming: { number: number; path: string; hidden: boolean }[];
  /** Where the paragraph leads; `path` is "" for a link to nothing. */
  outgoing: { number: number | null; label: string; path: string; hidden: boolean; empty: boolean; raw: string }[];
  /** For a relative paragraph: the title of the one it follows, and by how much. */
  anchor: string | null;
  offset: number | null;
}

export interface GamebookSummary {
  paragraphs: number;
  empty: number;
  orphans: number;
  deadEnds: number;
  length: number;
  pages: number;
}

export function paragraphMark(index: GamebookIndex, p: Paragraph, found: Warning[], settings: NovelSettings): ParagraphMark {
  return {
    number: p.number,
    numberType: p.numberType,
    ending: p.ending,
    empty: p.empty,
    length: p.length,
    band: lengthBand(p.length, settings.gamebook.short, settings.pages.size),
    warnings: found,
    incoming: index.incoming(p.path).map(({ from, reference }) => ({ number: from.number, path: from.path, hidden: reference.hidden })),
    outgoing: index.outgoing(p).map(({ reference, to }) => ({
      number: to?.number ?? null,
      label: to ? String(to.number) : reference.target,
      path: to?.path ?? "",
      hidden: reference.hidden,
      empty: to?.empty ?? false,
      raw: reference.raw,
    })),
    anchor: p.anchor,
    offset: p.offset,
  };
}

/** Marks of every paragraph, by path, and the totals for the status bar. */
export function gamebookMarks(index: GamebookIndex, settings: NovelSettings): { marks: Map<string, ParagraphMark>; summary: GamebookSummary } {
  const found = warnings(index, settings.gamebook.start);
  const marks = new Map<string, ParagraphMark>();
  const all = index.all();
  for (const p of all) marks.set(p.path, paragraphMark(index, p, found.get(p.path) ?? [], settings));
  const summary: GamebookSummary = {
    paragraphs: all.length,
    empty: all.filter((p) => p.empty).length,
    orphans: [...marks.values()].filter((m) => m.warnings.includes("orphan")).length,
    deadEnds: [...marks.values()].filter((m) => m.warnings.includes("deadEnd")).length,
    length: all.reduce((n, p) => n + p.length, 0),
    pages: pagesOf(all.map((p) => p.length), settings.pages.size, settings.gamebook.onePerPage),
  };
  return { marks, summary };
}
