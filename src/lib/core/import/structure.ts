// Turns a document read from another program into Dante's structure: parts, chapters and
// scenes. The heading levels used decide what each is: with three levels, parts, chapters
// and titled scenes; with two, parts and chapters when the first level reads like parts
// ("Part One", "Libro primo"), otherwise chapters and titled scenes; with one, chapters.
// Inside a chapter, a line of only asterisks, hashes or similar marks starts a new scene.

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

export function structure(blocks: DocBlock[], names: ImportNames, title = ""): ImportedBook {
  // The title style names the book; it is not part of the text.
  const titled = blocks.find((b) => b.kind === "heading" && b.level === 0);
  const body = blocks.filter((b) => !(b.kind === "heading" && b.level === 0));
  const levels = [...new Set(body.filter((b) => b.kind === "heading").map((b) => (b as { level: number }).level))].sort((a, b) => a - b);
  const top = levels.filter((l) => l <= (levels[0] ?? 1) + 2);
  const firstLevelTexts = body.filter((b) => b.kind === "heading" && b.level === top[0]).map((b) => b.text);
  const named = firstLevelTexts.filter((t) => !FRAME.test(t));
  const partsFirst = top.length >= 3 || (top.length === 2 && named.length > 0 && named.every((t) => PART_WORDS.test(t)));
  const role = (level: number): "part" | "chapter" | "scene" | null => {
    const i = top.indexOf(level);
    if (i < 0) return null;
    if (partsFirst) return (["part", "chapter", "scene"] as const)[i];
    return (["chapter", "scene"] as const)[i] ?? null;
  };

  const parts: ImportedPart[] = [{ title: "", chapters: [] }];
  let chapter: ImportedChapter | null = null;
  let scene: ImportedScene | null = null;
  let lines: string[] = [];

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
        continue;
      }
      if (b.text) lines.push(b.text);
      continue;
    }
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
        words += s.text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
      }
    }
  return { parts: book.hasParts ? book.parts.filter((p) => p.title).length : 0, chapters, scenes, words };
}
