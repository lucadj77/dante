// Turns a document read from another program into Dante's structure: parts, chapters and
// scenes. Each heading level becomes one of them, as `defaultRoles` guesses or as the
// writer chooses. Inside a chapter, a line of only asterisks, hashes or similar marks
// starts a new scene, and so do empty paragraphs when the writer used them that way.

import type { DocBlock } from "./docx";

export interface ImportedScene {
  title: string;
  text: string;
}
export interface ImportedChapter {
  title: string;
  scenes: ImportedScene[];
}
export interface ImportedPart {
  title: string;
  chapters: ImportedChapter[];
}
export interface ImportedBook {
  title: string;
  /** Parts, or a single part with an empty title when the book has none. */
  parts: ImportedPart[];
  hasParts: boolean;
}

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
 */
export type BlankLines = 0 | 1 | 2;

/**
 * Empty paragraphs separate scenes unless the writer uses them for spacing: when more than
 * a third of the gaps between paragraphs hold one, only two in a row count, and not even
 * those when they are as common.
 */
export function defaultBlankLines(blocks: DocBlock[]): BlankLines {
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

export function structure(
  blocks: DocBlock[],
  names: ImportNames,
  title = "",
  roles: Record<number, HeadingRole> = defaultRoles(blocks),
  blanks: BlankLines = defaultBlankLines(blocks),
): ImportedBook {
  // The title style names the book; it is not part of the text.
  const titled = blocks.find((b) => b.kind === "heading" && b.level === 0);
  const body = blocks.filter((b) => !(b.kind === "heading" && b.level === 0));
  const partsFirst = Object.values(roles).includes("part");
  const role = (level: number): "part" | "chapter" | "scene" | null => {
    const r = roles[level];
    return r && r !== "text" ? r : null;
  };

  const parts: ImportedPart[] = [{ title: "", chapters: [] }];
  let chapter: ImportedChapter | null = null;
  let scene: ImportedScene | null = null;
  let lines: string[] = [];
  let blank = 0;

  const closeScene = () => {
    const text = lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    lines = [];
    if (!scene && !text) return;
    if (!chapter) {
      chapter = { title: names.start, scenes: [] };
      parts[parts.length - 1].chapters.push(chapter);
    }
    const s: ImportedScene = scene ?? { title: names.scene(chapter.scenes.length + 1), text: "" };
    s.text = text;
    chapter.scenes.push(s);
    scene = null;
  };

  for (const b of body) {
    if (b.kind === "paragraph") {
      if (SCENE_BREAK.test(b.text)) {
        closeScene();
        blank = 0;
        continue;
      }
      if (!b.text) {
        blank++;
        continue;
      }
      if (blanks > 0 && blank >= blanks && lines.length > 0) closeScene();
      blank = 0;
      lines.push(b.text);
      continue;
    }
    blank = 0;
    const r = role(b.level);
    if (r === null) {
      // A deeper heading than the structure uses stays in the text as a heading.
      lines.push(`${"#".repeat(Math.min(6, b.level))} ${b.text}`);
      continue;
    }
    closeScene();
    if (r === "part" && FRAME.test(b.text)) {
      // Outside any part: an untitled part holds it, written at the top of the manuscript.
      chapter = { title: b.text, scenes: [] };
      parts.push({ title: "", chapters: [chapter] });
    } else if (r === "part") {
      parts.push({ title: ownTitle(b.text), chapters: [] });
      chapter = null;
    } else if (r === "chapter") {
      chapter = { title: ownTitle(b.text), scenes: [] };
      parts[parts.length - 1].chapters.push(chapter);
    } else {
      scene = { title: b.text, text: "" };
    }
  }
  closeScene();

  // Text before the first part, or a book without parts, sits in the untitled first part.
  const kept = parts.filter((p, i) => i > 0 || p.chapters.length > 0);
  // Chapters left without scenes get an empty one, so each can be written in.
  for (const p of kept) for (const c of p.chapters) if (!c.scenes.length) c.scenes.push({ title: names.scene(1), text: "" });
  return { title: titled?.text || title, parts: kept, hasParts: partsFirst };
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
