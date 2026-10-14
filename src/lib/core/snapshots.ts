import type { ProjectFs } from "./fs";
import { basename, join, stripExt } from "./path";

// A snapshot is a copy of a scene file in .dante/snapshots/<scene path>/.
// Its file name is the time it was taken, plus a name when the writer gave one:
//   .dante/snapshots/Manuscript/010 Return/010 Arrival/2026-10-13T18-40-05 First draft.md

export const SNAPSHOT_ROOT = ".dante/snapshots";

export interface Snapshot {
  /** Path of the snapshot file, relative to the project. */
  path: string;
  date: Date;
  /** Given by the writer; automatic snapshots have none. */
  name: string | null;
}

export function snapshotDir(scenePath: string): string {
  return join(SNAPSHOT_ROOT, stripExt(scenePath));
}

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?: (.+))?$/;

export function parseSnapshotName(file: string): { date: Date; name: string | null } | null {
  const m = STAMP.exec(stripExt(basename(file)));
  if (!m) return null;
  const [, y, mo, d, h, mi, s, name] = m;
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +s), name: name ?? null };
}

export async function listSnapshots(fs: ProjectFs, scenePath: string): Promise<Snapshot[]> {
  const dir = snapshotDir(scenePath);
  if (!(await fs.exists(dir))) return [];
  const out: Snapshot[] = [];
  for (const entry of await fs.list(dir)) {
    const parsed = entry.isDir ? null : parseSnapshotName(entry.name);
    if (parsed) out.push({ path: entry.path, ...parsed });
  }
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Copies the scene as it is on disk. An automatic snapshot is skipped when the
 * latest snapshot already holds the same text. Returns the snapshot, or null.
 */
export async function takeSnapshot(
  fs: ProjectFs,
  scenePath: string,
  name: string | null = null,
  now = new Date(),
): Promise<Snapshot | null> {
  if (!(await fs.exists(scenePath))) return null;
  const text = await fs.readText(scenePath);
  const existing = await listSnapshots(fs, scenePath);
  if (name === null && existing.length > 0 && (await fs.readText(existing[0].path)) === text) return null;
  const clean = name?.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim() || null;
  let file = join(snapshotDir(scenePath), `${stamp(now)}${clean ? " " + clean : ""}.md`);
  // Two snapshots in the same second get a counter.
  for (let n = 2; await fs.exists(file); n++) {
    file = join(snapshotDir(scenePath), `${stamp(now)}${clean ? " " + clean : ""} (${n}).md`);
  }
  await fs.writeText(file, text);
  return { path: file, date: now, name: clean };
}

/** Puts a snapshot's text back into the scene, keeping the current text as a snapshot first. */
export async function restoreSnapshot(fs: ProjectFs, scenePath: string, snapshotPath: string): Promise<void> {
  const text = await fs.readText(snapshotPath);
  await takeSnapshot(fs, scenePath);
  await fs.writeText(scenePath, text);
}

/** Deletes the automatic snapshots taken before `date`, across the project. Named ones stay. */
export async function cleanSnapshots(fs: ProjectFs, before: Date): Promise<number> {
  if (!(await fs.exists(SNAPSHOT_ROOT))) return 0;
  let removed = 0;
  const visit = async (dir: string) => {
    for (const entry of await fs.list(dir)) {
      if (entry.isDir) {
        await visit(entry.path);
        continue;
      }
      const parsed = parseSnapshotName(entry.name);
      if (parsed && parsed.name === null && parsed.date < before) {
        await fs.remove(entry.path);
        removed++;
      }
    }
  };
  await visit(SNAPSHOT_ROOT);
  return removed;
}
