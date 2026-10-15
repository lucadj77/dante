import { diffWords, type DiffPart } from "./diff";
import { commentMark, parseCritic } from "./critic";
import { basename, dirname, extname, join } from "./path";

/** A copy that Dropbox, Google Drive or another sync service made of a file edited twice. */
export interface ConflictCopy {
  /** The copy. */
  path: string;
  /** The file it is a copy of. */
  original: string;
  /** Who made the other change, when the name says so. */
  who: string | null;
}

// Each pattern matches the end of the name without its extension; group 1 is the person.
const PATTERNS: RegExp[] = [
  // Dropbox: "Scene (Anna's conflicted copy 2026-10-14).md", also "(… (1))".
  / \(([^()]+?)['’]s conflicted copy(?: \d{4}-\d{2}-\d{2})?(?: \(\d+\))?\)$/i,
  // Dropbox in Italian: "Scena (copia in conflitto di Anna 2026-10-14).md".
  / \(copia in conflitto di ([^()]+?)(?: \d{4}-\d{2}-\d{2})?(?: \(\d+\))?\)$/i,
  // Other services and languages: a bracket that speaks of a conflict.
  / \((?:[^()]*?\b)?(?:conflict|conflicted|conflitto|conflicto|conflit|konflikt)\b[^()]*\)$/i,
  / ?\[(?:conflict|conflitto)\]$/i,
  // Syncthing: "Scene.sync-conflict-20261014-101010-ABCDEFG.md".
  /\.sync-conflict-\d{8}-\d{6}(?:-[A-Z0-9]+)?$/,
];
// Google Drive and others number a second copy: "Scene (1).md", only next to "Scene.md".
const NUMBERED = / \(\d\)$/;

/** The file a copy stands for, if its name is that of a conflict copy. */
export function conflictOf(path: string, exists: (path: string) => boolean): Omit<ConflictCopy, "path"> | null {
  const ext = extname(path);
  const name = basename(path).slice(0, basename(path).length - ext.length);
  for (const pattern of [...PATTERNS, NUMBERED]) {
    const m = pattern.exec(name);
    if (!m || m.index === 0) continue;
    const original = join(dirname(path), name.slice(0, m.index).trimEnd() + ext);
    if (!exists(original)) continue;
    return { original, who: pattern === NUMBERED ? null : (m[1]?.trim() ?? null) };
  }
  return null;
}

/** The conflict copies among the project's files, Markdown and others. */
export function findConflicts(files: string[]): ConflictCopy[] {
  const all = new Set(files);
  const out: ConflictCopy[] = [];
  for (const path of files) {
    const found = conflictOf(path, (p) => all.has(p));
    if (found) out.push({ path, ...found });
  }
  return out;
}

// Comments and revisions already in the texts are compared whole, as single words.
const OPEN = "\uE000";
const CLOSE = "\uE001";
const TOKENS = /\uE000\d+\uE001|[^\s\uE000]+|\s+/g;

/**
 * The differences between a file and its conflict copy, word by word. Comments and
 * revisions in either text are never split: those only one side has are shown as kept,
 * so merging loses nobody's notes.
 */
export function conflictDiff(original: string, copy: string): DiffPart[] {
  const marks: string[] = [];
  const hide = (text: string) => {
    let out = "";
    let pos = 0;
    for (const item of parseCritic(text)) {
      const mark = text.slice(item.from, item.to);
      let id = marks.indexOf(mark);
      if (id === -1) id = marks.push(mark) - 1;
      out += text.slice(pos, item.from) + OPEN + id + CLOSE;
      pos = item.to;
    }
    return out + text.slice(pos);
  };
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  for (const part of diffWords(hide(original), hide(copy), TOKENS)) {
    for (const piece of part.text.split(/(\uE000\d+\uE001)/)) {
      const mark = /^\uE000(\d+)\uE001$/.exec(piece);
      if (mark) push("same", marks[Number(mark[1])]);
      else push(part.type, piece);
    }
  }
  return parts;
}

/**
 * The copy's differences written into the original as revisions in CriticMarkup, signed
 * by `who`: what the copy adds becomes an addition, what it lacks a deletion, to accept or
 * reject one by one.
 */
export function mergeAsRevisions(original: string, copy: string, who: string, date: string): string {
  const sig = commentMark(who, date);
  let out = "";
  for (const part of conflictDiff(original, copy)) {
    if (part.type === "same") out += part.text;
    else if (part.type === "removed") out += `{--${part.text}--}${sig}`;
    else out += `{++${part.text}++}${sig}`;
  }
  return out;
}
