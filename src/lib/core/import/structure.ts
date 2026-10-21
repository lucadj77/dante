// Turns a document read from another program into Dante's structure: parts, chapters and
// scenes. Each heading level becomes one of them, as `defaultRoles` guesses or as the
// writer chooses. Inside a chapter, a line of only asterisks, hashes or similar marks
// starts a new scene, and so do empty paragraphs when the writer used them that way. In the
// preview the writer can also say what any single paragraph is, and these choices win.

import { setAlignment } from "../alignment";
import type { DocBlock } from "./docx";
import { BLANK_LINE } from "../blankLines";

export interface ImportedScene {
  title: string;
  text: string;
  /** The block the scene starts at, for the preview. */
  at?: number;
}
export interface ImportedChapter {
  title: string;
  scenes: ImportedScene[];
  /** Holds the text that comes before any heading: it can continue a chapter already written. */
  untitled?: boolean;
  at?: number;
}
export interface ImportedPart {
  title: string;
  chapters: ImportedChapter[];
  at?: number;
}
export interface ImportedBook {
  title: string;
  /** Parts, or a single part with an empty title when the book has none. */
  parts: ImportedPart[];
  hasParts: boolean;
  /** What each block of the document became, in order, for the preview. */
  blocks?: BlockRole[];
}

/**
 * What a block of the document became: the book's title, the title of a part, chapter or
 * scene, a scene break, text, a heading kept in the text, an empty line, or nothing.
 */
export type BlockRole = "title" | "part" | "chapter" | "scene" | "break" | "text" | "heading" | "blank" | "space" | "skip";

/** A scene break as writers type it: "***", "* * *", "#", "§", "~"… alone on a line. */
export const SCENE_BREAK = /^\s*(?:[*#~§•·⁂✻❦]\s*){1,5}$|^\s*[-–—]{3,}\s*$/;
/** A prologue or epilogue, which stands outside the parts. */
const FRAME = /^(prolog(?:ue|o)?|prólogo|epilog(?:ue|o)?|epílogo)\b/i;
const PART_WORDS = /^(part|parte|partie|teil|libro|book|livre|buch|volume|tomo)\b/i;

const LABEL = "(?:part|parte|partie|teil|libro|book|livre|buch|chapter|capitolo|cap\\.|chapitre|cap[ií]tulo|kapitel|prologue|prologo|prólogo|prolog|epilogue|epilogo|epílogo|epilog)";
const NUMBERED = new RegExp(`^${LABEL}\\s+(?:\\d+|[ivxlcdm]+)\\b\\s*[:.\\-–—]?\\s*(.*)$`, "i");
const SPELLED = new RegExp(`^${LABEL}\\s+\\S+\\s*[:.\\-–—]\\s*(.+)$`, "i");

/**
 * A part's or chapter's own title, without the "Chapter 3:" Dante adds by itself when it
 * numbers them; a heading that is only a label and a number stays as it is.
 */
export function ownTitle(heading: string): string {
  const rest = (NUMBERED.exec(heading)?.[1] ?? SPELLED.exec(heading)?.[1] ?? "").trim();
  return rest || heading;
}

export interface ImportNames {
  /** Title of a chapter holding text that comes before any heading. */
  start: string;
  /** Title of the n-th scene of a chapter, for scenes without a heading. */
  scene: (n: number) => string;
}

/** What the headings of one level become; "text" keeps them in the text, as headings. */
export type HeadingRole = "part" | "chapter" | "scene" | "text";

export interface LevelSummary {
  level: number;
  count: number;
  /** The first headings of the level, to recognize it. */
  examples: string[];
}

/** The heading levels the book uses, from the highest; the title style is left out. */
export function headingLevels(blocks: DocBlock[]): LevelSummary[] {
  const levels = new Map<number, LevelSummary>();
  for (const b of blocks) {
    if (b.kind !== "heading" || b.level === 0) continue;
    const summary = levels.get(b.level) ?? { level: b.level, count: 0, examples: [] };
    summary.count++;
    if (summary.examples.length < 3) summary.examples.push(b.text);
    levels.set(b.level, summary);
  }
  return [...levels.values()].sort((a, b) => a.level - b.level);
}

/**
 * What each heading level becomes unless the writer chooses otherwise: with three levels,
 * parts, chapters and titled scenes; with two, parts and chapters when the first level
 * reads like parts, otherwise chapters and titled scenes; with one, chapters.
 */
export function defaultRoles(blocks: DocBlock[]): Record<number, HeadingRole> {
  const levels = headingLevels(blocks).map((l) => l.level);
  const top = levels.filter((l) => l <= (levels[0] ?? 1) + 2);
  const firstLevelTexts = blocks.filter((b) => b.kind === "heading" && b.level === top[0]).map((b) => b.text);
  const named = firstLevelTexts.filter((t) => !FRAME.test(t));
  const partsFirst = top.length >= 3 || (top.length === 2 && named.length > 0 && named.every((t) => PART_WORDS.test(t)));
  const order: HeadingRole[] = partsFirst ? ["part", "chapter", "scene"] : ["chapter", "scene"];
  const roles: Record<number, HeadingRole> = {};
  levels.forEach((level) => {
    const i = top.indexOf(level);
    roles[level] = i >= 0 ? (order[i] ?? "text") : "text";
  });
  return roles;
}

/**
 * How many empty paragraphs in a row separate scenes: 0 when they never do, 1 or 2.
 * "keep" starts no scene either, and keeps each empty paragraph between two paragraphs as a
 * blank line of the text.
 */
export type BlankLines = 0 | 1 | 2 | "keep";

/**
 * Empty paragraphs separate scenes unless the writer uses them for spacing or marks scenes
 * with a line such as "***": when more than
 * a third of the gaps between paragraphs hold one, only two in a row count, and not even
 * those when they are as common.
 */
export function defaultBlankLines(blocks: DocBlock[]): BlankLines {
  // Scenes marked with "***" and the like leave the empty paragraphs to spacing.
  if (blocks.some((b) => b.kind === "paragraph" && SCENE_BREAK.test(b.text))) return 0;
  const gaps: number[] = [];
  let run = -1;
  for (const b of blocks) {
    if (b.kind === "heading") run = -1;
    else if (b.text === "") {
      if (run >= 0) run++;
    } else {
      if (run >= 0) gaps.push(run);
      run = 0;
    }
  }
  if (gaps.length === 0) return 0;
  const share = (min: number) => gaps.filter((g) => g >= min).length / gaps.length;
  if (share(1) === 0) return 0;
  if (share(1) <= 1 / 3) return 1;
  return share(2) > 0 && share(2) <= 1 / 3 ? 2 : 0;
}

/**
 * What the writer said a single paragraph or heading is, in the preview: the title of a
 * part, chapter or scene, a scene break, plain text, or something to leave out.
 */
export type Mark = "part" | "chapter" | "scene" | "break" | "text" | "skip";

/** A paragraph's words without alignment, Markdown marks and escapes, as a title shows them. */
export function plainText(text: string): string {
  return setAlignment(text, null)
    .replace(/\{(?:\+\+|--|==|~~|>>)[\s\S]*?(?:\+\+|--|==|~~|<<)\}/g, (m) => (m.startsWith("{++") || m.startsWith("{==") ? m.slice(3, -3) : ""))
    .replace(/(\*{1,2}|_{1,2}|~~|==)(.+?)\1/g, "$2")
    .replace(/\\(.)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Numbers as chapters and sections are numbered: figures, Roman numerals, words.
const FIGURES = /\d+|\b[IVXLCDM]+\b/g;
const NUMBER_WORDS =
  /\b(?:(?:prim|second|terz|quart|quint|sest|settim|ottav|non|decim)[oa]|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi;

/**
 * A short line's shape, with its numbers and any title after them left out: "Capitolo 3"
 * and "Capitolo IV: La casa" share it.
 */
function shape(block: DocBlock): string | null {
  const text = plainText(block.text);
  if (!text || text.length > 80) return null;
  const numbered = text.replace(FIGURES, "#").replace(NUMBER_WORDS, "#").toLowerCase();
  // A title after the number, as in "Capitolo 3: Il ritorno", differs from line to line.
  return block.kind + ":" + numbered.replace(/^([^#]*#)\s*[:.)\-–—]\s.*$/, "$1").replace(/[.:)]+$/, "");
}

/**
 * The paragraphs and headings like the one at `index`: the same words around a number,
 * such as "Capitolo 3" and "Capitolo 4", or "12" and "13". Long paragraphs have no likes.
 */
export function similar(blocks: DocBlock[], index: number): number[] {
  const wanted = blocks[index] ? shape(blocks[index]) : null;
  if (!wanted) return [];
  const out: number[] = [];
  blocks.forEach((b, i) => {
    if (shape(b) === wanted) out.push(i);
  });
  return out;
}

/** Fewer paragraphs than this between two empty lines make no scene of their own. */
const SHORT_SCENE = 3;

/**
 * Which runs of empty paragraphs open a new scene, by the index of their last empty
 * paragraph; the others in `kept` stay as one blank line. A run that would leave a scene of
 * one or two paragraphs, before or after it, is most likely spacing: it is kept, and the
 * shortest such scenes are joined first.
 */
function blankBreaks(
  blocks: DocBlock[],
  blanks: BlankLines,
  marks: Record<number, Mark>,
  isTitle: (b: DocBlock, i: number) => boolean,
  role: (level: number) => "part" | "chapter" | "scene" | null,
): { breaks: Set<number>; kept: Set<number> } {
  const breaks = new Set<number>();
  const kept = new Set<number>();
  if (typeof blanks !== "number" || blanks === 0) return { breaks, kept };
  // Paragraphs in each stretch of text, and what ends each stretch: an empty-line run that
  // may open a scene (its index), or anything else that always does (null).
  const sizes: number[] = [0];
  const ends: (number | null)[] = [];
  let run = 0;
  let last = -1;
  const hard = () => {
    ends.push(null);
    sizes.push(0);
    run = 0;
  };
  const text = () => {
    if (run >= blanks && sizes[sizes.length - 1] > 0) {
      ends.push(last);
      sizes.push(0);
    }
    run = 0;
    sizes[sizes.length - 1]++;
  };
  blocks.forEach((b, i) => {
    if (isTitle(b, i)) return;
    const mark = marks[i];
    if (mark === "skip") return;
    if (mark === "text") {
      if (b.text) text();
      return;
    }
    if (mark) return hard();
    if (b.kind === "paragraph") {
      if (SCENE_BREAK.test(b.text)) return hard();
      if (!b.text) {
        run++;
        last = i;
        return;
      }
      return text();
    }
    if (role(b.level) === null) {
      // A heading kept in the text belongs to its scene; empty lines before it open none.
      run = 0;
      sizes[sizes.length - 1]++;
      return;
    }
    hard();
  });
  // Joins the shortest scene to its neighbour, one empty-line run at a time.
  for (;;) {
    let best = -1;
    let smallest = SHORT_SCENE;
    ends.forEach((end, k) => {
      if (end === null) return;
      const size = Math.min(sizes[k], sizes[k + 1]);
      if (size < smallest) {
        smallest = size;
        best = k;
      }
    });
    if (best < 0) break;
    kept.add(ends[best]!);
    sizes.splice(best, 2, sizes[best] + sizes[best + 1]);
    ends.splice(best, 1);
  }
  for (const end of ends) if (end !== null) breaks.add(end);
  return { breaks, kept };
}

export function structure(
  blocks: DocBlock[],
  names: ImportNames,
  title = "",
  roles: Record<number, HeadingRole> = defaultRoles(blocks),
  blanks: BlankLines = defaultBlankLines(blocks),
  marks: Record<number, Mark> = {},
): ImportedBook {
  // The title style names the book; it is not part of the text.
  const isTitle = (b: DocBlock, i: number) => b.kind === "heading" && b.level === 0 && !marks[i];
  const titled = blocks.find(isTitle);
  const markedParts = Object.values(marks).includes("part");
  const partsFirst = markedParts || blocks.some((b) => b.kind === "heading" && b.level > 0 && roles[b.level] === "part");
  const role = (level: number): "part" | "chapter" | "scene" | null => {
    const r = roles[level];
    return r && r !== "text" ? r : null;
  };

  const parts: ImportedPart[] = [{ title: "", chapters: [] }];
  let chapter: ImportedChapter | null = null;
  let scene: ImportedScene | null = null;
  let lines: string[] = [];
  let blank = 0;
  /** The first block of the scene being read, when it has no heading. */
  let first: number | undefined;
  const result: BlockRole[] = blocks.map(() => "skip");
  let current = -1;
  let lastBlank = -1;
  /** Empty paragraphs kept as blank lines once text follows them in the same scene. */
  let spaces: number[] = [];
  const auto = blankBreaks(blocks, blanks, marks, isTitle, role);

  const closeScene = () => {
    const text = lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    lines = [];
    const at = first;
    first = undefined;
    if (!scene && !text) return;
    if (!chapter) {
      chapter = { title: names.start, scenes: [], untitled: true, at };
      parts[parts.length - 1].chapters.push(chapter);
    }
    const s: ImportedScene = scene ?? { title: names.scene(chapter.scenes.length + 1), text: "", at };
    s.text = text;
    chapter.scenes.push(s);
    scene = null;
  };

  const open = (r: "part" | "chapter" | "scene", heading: string) => {
    closeScene();
    const at = current;
    result[at] = r;
    if (r === "part" && FRAME.test(heading)) {
      // Outside any part: an untitled part holds it, written at the top of the manuscript.
      chapter = { title: heading, scenes: [], at };
      parts.push({ title: "", chapters: [chapter] });
      result[at] = "chapter";
    } else if (r === "part") {
      parts.push({ title: ownTitle(heading), chapters: [], at });
      chapter = null;
    } else if (r === "chapter") {
      chapter = { title: ownTitle(heading), scenes: [], at };
      parts[parts.length - 1].chapters.push(chapter);
    } else {
      scene = { title: heading, text: "", at };
    }
  };

  const paragraph = (text: string) => {
    if (!text) {
      blank++;
      result[current] = "blank";
      lastBlank = current;
      if (blanks === "keep") spaces.push(current);
      return;
    }
    if (blank > 0 && auto.breaks.has(lastBlank) && lines.length > 0) {
      closeScene();
      result[lastBlank] = "break";
    } else if (blank > 0 && auto.kept.has(lastBlank) && lines.length > 0) {
      // Too short a scene: the empty lines are spacing, kept as one blank line.
      result[lastBlank] = "space";
      lines.push(BLANK_LINE);
    }
    if (lines.length > 0) {
      for (const i of spaces) {
        result[i] = "space";
        lines.push(BLANK_LINE);
      }
    }
    blank = 0;
    spaces = [];
    if (first === undefined && !scene) first = current;
    result[current] = "text";
    lines.push(text);
  };

  blocks.forEach((b, i) => {
    current = i;
    if (isTitle(b, i)) {
      if (b === titled) result[i] = "title";
      return;
    }
    const mark = marks[i];
    if (mark === "skip") return;
    if (mark === "break") {
      closeScene();
      result[i] = "break";
      blank = 0;
      spaces = [];
      return;
    }
    if (mark === "text") {
      // An empty line said to be text stays as a blank line: it starts no scene.
      if (!b.text) {
        result[i] = "space";
        lines.push(BLANK_LINE);
        if (first === undefined && !scene) first = i;
      } else paragraph(b.text);
      return;
    }
    if (mark) {
      blank = 0;
      spaces = [];
      open(mark, b.kind === "heading" ? b.text : plainText(b.text));
      return;
    }
    if (b.kind === "paragraph") {
      if (SCENE_BREAK.test(b.text)) {
        closeScene();
        result[i] = "break";
        blank = 0;
        spaces = [];
        return;
      }
      paragraph(b.text);
      return;
    }
    blank = 0;
    spaces = [];
    const r = role(b.level);
    if (r === null) {
      // A deeper heading than the structure uses stays in the text as a heading.
      if (first === undefined && !scene) first = i;
      result[i] = "heading";
      lines.push(`${"#".repeat(Math.min(6, Math.max(1, b.level)))} ${b.text}`);
      return;
    }
    open(r, b.text);
  });
  closeScene();

  // Text before the first part, or a book without parts, sits in the untitled first part.
  const kept = parts.filter((p, i) => i > 0 || p.chapters.length > 0);
  // Chapters left without scenes get an empty one, so each can be written in.
  for (const p of kept) for (const c of p.chapters) if (!c.scenes.length) c.scenes.push({ title: names.scene(1), text: "" });
  return { title: titled?.text || title, parts: kept, hasParts: partsFirst, blocks: result };
}

/** How much the import holds, for the preview. */
export function counts(book: ImportedBook): { parts: number; chapters: number; scenes: number; words: number } {
  let chapters = 0;
  let scenes = 0;
  let words = 0;
  for (const p of book.parts)
    for (const c of p.chapters) {
      chapters++;
      for (const s of c.scenes) {
        scenes++;
        // Tags, such as the ones aligning a paragraph, are not words.
        words += s.text.replace(/<\/?[a-zA-Z][^<>\n]*>/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
      }
    }
  return { parts: book.hasParts ? book.parts.filter((p) => p.title).length : 0, chapters, scenes, words };
}
