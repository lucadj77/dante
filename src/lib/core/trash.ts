// The project's trash: what is deleted goes to .trash, where Obsidian keeps deleted notes
// too, and Dante notes where each item came from, so it can be put back in its place.
//
//   .dante/trash.json   { "010 Arrival.md": { "from": "Manuscript/010 Return/010 Arrival.md", "date": "2026-10-26T10:12:00.000Z" } }
//
// Items deleted by Obsidian, or before Dante kept this list, have no origin: they are put
// back in the Laboratory, where the writer can move them.

import type { ProjectFs } from "./fs";
import { basename, dirname, join } from "./path";

export const TRASH = ".trash";
export const TRASH_LOG = ".dante/trash.json";

interface Origin {
  from: string;
  date: string;
}

export interface TrashItem {
  /** Path in the project, under .trash. */
  path: string;
  name: string;
  isDir: boolean;
  /** Where it was before; null when nobody noted it. */
  from: string | null;
  /** When it went to the trash, as an ISO date; null when unknown. */
  date: string | null;
}

async function readLog(fs: ProjectFs): Promise<Record<string, Origin>> {
  try {
    const parsed = JSON.parse(await fs.readText(TRASH_LOG));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLog(fs: ProjectFs, log: Record<string, Origin>): Promise<void> {
  await fs.writeText(TRASH_LOG, JSON.stringify(log, null, 2) + "\n");
}

/** Notes that `trashed` (a path under .trash) came from `from`. */
export async function noteTrashed(fs: ProjectFs, trashed: string, from: string, now = new Date()): Promise<void> {
  const log = await readLog(fs);
  log[basename(trashed)] = { from, date: now.toISOString() };
  await writeLog(fs, log);
}

/** What the trash holds, most recently deleted first; items of unknown date last, by name. */
export async function listTrash(fs: ProjectFs): Promise<TrashItem[]> {
  if (!(await fs.exists(TRASH))) return [];
  const log = await readLog(fs);
  const items: TrashItem[] = [];
  for (const entry of await fs.list(TRASH)) {
    if (entry.name === ".DS_Store" || entry.name.includes(".dante-tmp")) continue;
    const origin = log[entry.name];
    items.push({ path: entry.path, name: entry.name, isDir: entry.isDir, from: origin?.from ?? null, date: origin?.date ?? null });
  }
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.name.localeCompare(b.name));
}

/** A free path for `name` in `dir`: "Name.md", then "Name 2.md" and so on. */
async function free(fs: ProjectFs, dir: string, name: string): Promise<string> {
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  let candidate = join(dir, name);
  for (let n = 2; await fs.exists(candidate); n++) candidate = join(dir, `${stem} ${n}${ext}`);
  return candidate;
}

/**
 * Puts an item back where it was, under its old name when that is free; an item of
 * unknown origin goes to `fallback`. Returns its new path.
 */
export async function restoreFromTrash(fs: ProjectFs, item: TrashItem, fallback: string): Promise<string> {
  const target = item.from ?? join(fallback, item.name);
  const dir = dirname(target);
  if (dir) await fs.mkdir(dir);
  const path = (await fs.exists(target)) ? await free(fs, dir, basename(target)) : target;
  await fs.rename(item.path, path);
  const log = await readLog(fs);
  if (log[item.name]) {
    delete log[item.name];
    await writeLog(fs, log);
  }
  return path;
}

/** Deletes items of the trash for good. */
export async function deleteFromTrash(fs: ProjectFs, items: TrashItem[]): Promise<void> {
  const log = await readLog(fs);
  for (const item of items) {
    await fs.remove(item.path);
    delete log[item.name];
  }
  await writeLog(fs, log);
}
