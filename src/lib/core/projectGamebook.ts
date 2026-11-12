// What a gamebook asks of the project: the fields of a paragraph, the numbers, the graph and the operations on the whole book.

import { fixArticles } from "./gamebook/articles";
import { addToList, newParagraphText, relabel, removeFromList, setParagraphFields, type ParagraphChanges } from "./gamebook/edit";
import { graphNote, graphNotePath, mermaidGraph } from "./gamebook/graph";
import { gamebookOf } from "./gamebook/marks";
import type { GamebookIndex } from "./gamebook/paragraphs";
import { sanitizeTitle } from "./naming";
import { join } from "./path";
import type { Project } from "./project";
import { restoreSnapshot, takeSnapshot } from "./snapshots";

/** Where the operations on a whole gamebook are recorded, to undo them. */
const OPERATIONS = ".dante/gamebook/operations.json";

export interface GamebookOperation {
  id: string;
  /** The name of the snapshots it took, such as "Prima del rimescolamento". */
  name: string;
  date: string;
  /** Each file it changed, with the snapshot of it taken before. */
  files: { path: string; snapshot: string }[];
  /** The paragraphs' numbers before it, by path. */
  numbers: Record<string, number>;
}
/**
 * In a gamebook: changes a paragraph's own properties as the plugin writes them. A new
 * number (given, or worked out from an anchor) also goes into its aliases, into the label
 * of every reference to it and into the articles before them, so the book reads the same.
 * Refuses a number another paragraph of the same folder already has.
 */
export async function setParagraph(project: Project, path: string, changes: ParagraphChanges): Promise<void> {
  await project.beforeMove?.();
  const index = gamebookOf(await project.index(), project.settings);
  const paragraph = index?.get(path);
  changes = { ...changes };
  if (changes.numberType === "relative" && index && changes.anchor !== undefined) {
    const r = index.resolve(changes.anchor);
    if (r.kind !== "paragraph") throw new Error(`gamebook.noAnchor:${changes.anchor}`);
    if (anchoredOn(project, index, r.to.path, path)) throw new Error(`gamebook.anchorCycle:${changes.anchor}`);
    changes.number = r.to.number + (changes.offset ?? 0);
  }
  if (changes.number !== undefined && (!Number.isInteger(changes.number) || changes.number < 1)) throw new Error(`gamebook.badNumber:${changes.number}`);
  if (changes.number !== undefined && index && paragraph && changes.number !== paragraph.number) {
    // The paragraphs relative to this one move with it, keeping their distance.
    const moved = new Map<string, number>([[path, changes.number]]);
    const queue = [paragraph];
    while (queue.length) {
      const anchor = queue.shift()!;
      for (const other of index.inScope(paragraph.scope)) {
        if (moved.has(other.path) || other.numberType !== "relative" || !other.anchor) continue;
        const r = index.resolve(other.anchor);
        if (r.kind !== "paragraph" || r.to.path !== anchor.path) continue;
        moved.set(other.path, moved.get(anchor.path)! + (other.offset ?? other.number - anchor.number));
        queue.push(other);
      }
    }
    for (const n of moved.values()) {
      const taken = index.byNumber(paragraph.scope, n);
      if (taken && !moved.has(taken.path)) throw new Error(`gamebook.numberTaken:${n}:${taken.title}`);
      if (n < 1) throw new Error(`gamebook.badNumber:${n}`);
    }
    await writeNumbers(project, index, moved, path, changes);
    await project.reload();
    return;
  }
  const text = await project.fs.readText(path);
  const next = setParagraphFields(text, changes);
  if (next !== text) await project.fs.writeText(path, next);
  await project.reload();
}

/** The files that a change of the numbers in `moved` rewrites: the paragraphs and those that refer to them. */
export function touchedBy(project: Project, index: GamebookIndex, moved: Map<string, number>): string[] {
  const files = new Set<string>();
  for (const [p, n] of moved) {
    if (index.get(p)?.number === n) continue;
    files.add(p);
    for (const { from } of index.incoming(p)) files.add(from.path);
  }
  return [...files];
}

/**
 * Gives the paragraphs in `moved` their new numbers and relabels every reference to
 * them, correcting the articles; `own` changes one paragraph's other fields as well.
 */
export async function writeNumbers(project: Project, index: GamebookIndex, moved: Map<string, number>, own?: string, changes?: ParagraphChanges): Promise<number> {
  // Each file to rewrite, with the references in it to relabel.
  const edits = new Map<string, { name: string; from: number; to: number }[]>();
  const add = (file: string, name: string, from: number, to: number) => edits.set(file, [...(edits.get(file) ?? []), { name, from, to }]);
  for (const [p, n] of moved) {
    const old = index.get(p);
    if (!old || (old.number === n && p !== own)) continue;
    add(p, old.title, old.number, n);
    for (const { from, reference } of index.incoming(p)) add(from.path, reference.target, old.number, n);
  }
  const numberOf = (target: string) => {
    const r = index.resolve(target);
    return r.kind !== "paragraph" ? null : (moved.get(r.to.path) ?? r.to.number);
  };
  let written = 0;
  for (const [file, list] of edits) {
    const text = await project.fs.readText(file);
    let next = text;
    if (file === own && changes) next = setParagraphFields(next, changes);
    else if (moved.has(file)) next = setParagraphFields(next, { number: moved.get(file)! });
    // Through a placeholder, so that two paragraphs that swap numbers do not catch each other's references.
    for (const e of list) next = relabel(next, e.name, e.from, -1 - e.to);
    for (const e of list) next = relabel(next, e.name, -1 - e.to, e.to);
    if (project.settings.language.toLowerCase().startsWith("it")) next = fixArticles(next, numberOf).text;
    if (next !== text) {
      await project.fs.writeText(file, next);
      written++;
    }
  }
  return written;
}

/**
 * In a gamebook: writes the graph of the paragraphs of `scope` as a Mermaid diagram in a
 * note at the top of the project, keeping what the writer added around it; returns its path.
 */
export async function writeGamebookGraph(project: Project, scope: string, intro: string): Promise<string> {
  const index = gamebookOf(await project.index(), project.settings);
  if (!index) throw new Error("gamebook.off");
  const path = graphNotePath(project.settings.language);
  const existing = (await project.fs.exists(path)) ? await project.fs.readText(path) : null;
  const next = graphNote(existing, mermaidGraph(index, scope, project.settings.gamebook.start), intro);
  if (next !== existing) await project.fs.writeText(path, next);
  await project.reload();
  return path;
}

/** In a gamebook: the operations on the whole book, newest first, to undo them. */
export async function gamebookOperations(project: Project): Promise<GamebookOperation[]> {
  if (!(await project.fs.exists(OPERATIONS))) return [];
  try {
    const list = JSON.parse(await project.fs.readText(OPERATIONS));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * In a gamebook: gives the paragraphs new numbers all at once, as a shuffle does. Every
 * file it touches is kept first in a snapshot named `name`, and the operation is recorded
 * so that it can be undone. Returns how many files changed.
 */
export async function renumberParagraphs(project: Project, numbers: Map<string, number>, name: string): Promise<number> {
  await project.beforeMove?.();
  const index = gamebookOf(await project.index(), project.settings);
  if (!index) return 0;
  const now = new Date();
  const files: { path: string; snapshot: string }[] = [];
  for (const path of touchedBy(project, index, numbers)) {
    const snap = await takeSnapshot(project.fs, path, name, now);
    if (snap) files.push({ path, snapshot: snap.path });
  }
  const before: Record<string, number> = {};
  for (const p of numbers.keys()) {
    const old = index.get(p);
    if (old) before[p] = old.number;
  }
  const written = await writeNumbers(project, index, numbers);
  const operations = await gamebookOperations(project);
  operations.unshift({ id: now.toISOString(), name, date: now.toISOString(), files, numbers: before });
  await project.fs.writeText(OPERATIONS, JSON.stringify(operations.slice(0, 30), null, 2));
  await project.reload();
  return written;
}

/**
 * Undoes a recorded operation: every file goes back to its snapshot, or, with `onlyNumbers`,
 * the paragraphs only get their old numbers back, with references and articles, and the text
 * written since stays.
 */
export async function undoGamebookOperation(project: Project, id: string, onlyNumbers: boolean, name: string): Promise<void> {
  const op = (await gamebookOperations(project)).find((o) => o.id === id);
  if (!op) return;
  if (onlyNumbers) {
    const index = gamebookOf(await project.index(), project.settings);
    const numbers = new Map(Object.entries(op.numbers).filter(([p]) => index?.get(p)));
    for (const [p, n] of numbers) {
      const p0 = index!.get(p)!;
      const taken = index!.byNumber(p0.scope, n);
      if (taken && !numbers.has(taken.path)) throw new Error(`gamebook.numberTaken:${n}:${taken.title}`);
    }
    await renumberParagraphs(project, numbers, name);
    return;
  }
  await project.beforeMove?.();
  for (const f of op.files) {
    if (await project.fs.exists(f.snapshot)) await restoreSnapshot(project.fs, f.path, f.snapshot);
  }
  await project.reload();
}

/** Whether `anchor` follows `path`, directly or through other anchors: anchoring on it would go round in a circle. */
export function anchoredOn(project: Project, index: GamebookIndex, anchor: string, path: string): boolean {
  const seen = new Set<string>();
  let current = index.get(anchor);
  while (current && !seen.has(current.path)) {
    if (current.path === path) return true;
    seen.add(current.path);
    if (current.numberType !== "relative" || !current.anchor) return false;
    const r = index.resolve(current.anchor);
    current = r.kind === "paragraph" ? r.to : undefined;
  }
  return false;
}

/**
 * In a gamebook: creates a paragraph in `dir`, with the first free number, a fixed one or
 * one relative to another paragraph, and returns its path and number.
 */
export async function createParagraph(project: Project, dir: string, title: string, spec: { numberType: "free" | "fixed" | "relative"; number?: number; anchor?: string; offset?: number }): Promise<{ path: string; title: string; number: number }> {
  const clean = sanitizeTitle(title);
  if (!clean) throw new Error("gamebook.noTitle");
  const path = join(dir, `${clean}.md`);
  if (await project.fs.exists(path)) throw new Error(`gamebook.exists:${clean}`);
  const index = gamebookOf(await project.index(), project.settings);
  let number: number;
  if (spec.numberType === "relative") {
    const r = spec.anchor && index ? index.resolve(spec.anchor) : null;
    if (!r || r.kind !== "paragraph") throw new Error(`gamebook.noAnchor:${spec.anchor ?? ""}`);
    number = r.to.number + (spec.offset ?? 0);
  } else if (spec.numberType === "fixed") {
    number = spec.number ?? 0;
  } else {
    number = index ? index.firstFreeNumber(dir) : 1;
  }
  if (!Number.isInteger(number) || number < 1) throw new Error(`gamebook.badNumber:${number}`);
  const taken = index?.byNumber(dir, number);
  if (taken) throw new Error(`gamebook.numberTaken:${number}:${taken.title}`);
  await project.fs.writeText(path, newParagraphText({ number, numberType: spec.numberType, anchor: spec.anchor, offset: spec.offset }));
  await project.reload();
  return { path, title: clean, number };
}

/**
 * In a gamebook: a page that is not a paragraph (rules, an introduction), a file without a
 * number in the paragraphs' folder, so that it goes before them; returns its path.
 */
export async function createPage(project: Project, dir: string, title: string): Promise<string> {
  const path = await project.freeName(dir, (sanitizeTitle(title) || "Untitled") + ".md");
  await project.fs.writeText(path, "");
  await project.reload();
  return path;
}

/** In a gamebook: adds a value to a list property of a paragraph (a hidden reference, a keyword), as the plugin writes it. */
export async function addToParagraphList(project: Project, path: string, key: string, value: string): Promise<void> {
  await project.beforeMove?.();
  const text = await project.fs.readText(path);
  const next = addToList(text, key, value);
  if (next !== text) await project.fs.writeText(path, next);
  await project.reload();
}

export async function removeFromParagraphList(project: Project, path: string, key: string, value: string): Promise<void> {
  await project.beforeMove?.();
  const text = await project.fs.readText(path);
  const next = removeFromList(text, key, value);
  if (next !== text) await project.fs.writeText(path, next);
  await project.reload();
}
