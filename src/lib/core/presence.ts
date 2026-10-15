import type { ProjectFs } from "./fs";
import { join } from "./path";

/**
 * Who has which file open, so two people on a shared folder do not edit the same scene at
 * once. Each user writes `.dante/presence/<user>.json` and refreshes it every minute.
 */
export const PRESENCE_DIR = ".dante/presence";
/** A presence not refreshed for this long belongs to an app that was closed or lost. */
export const PRESENCE_TTL = 3 * 60 * 1000;

export interface Presence {
  user: string;
  /** The file being edited, relative to the project. */
  path: string | null;
  /** When that file was opened, ISO. Whoever opened it first keeps editing. */
  since: string | null;
  /** Last refresh, ISO. */
  updated: string;
}

/** A file name for the user: letters and digits, the rest becomes "-". */
export function slug(user: string): string {
  return user.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";
}

export function presenceFile(user: string): string {
  return join(PRESENCE_DIR, `${slug(user)}.json`);
}

export async function writePresence(fs: ProjectFs, presence: Presence): Promise<void> {
  await fs.writeText(presenceFile(presence.user), JSON.stringify(presence, null, 2) + "\n");
}

export async function clearPresence(fs: ProjectFs, user: string): Promise<void> {
  const file = presenceFile(user);
  if (await fs.exists(file)) await fs.remove(file);
}

function valid(value: unknown): value is Presence {
  const p = value as Presence;
  return !!p && typeof p.user === "string" && typeof p.updated === "string" && (p.path === null || typeof p.path === "string");
}

/** Other people with a file open now; stale and unreadable files are skipped. */
export async function readPresence(fs: ProjectFs, me: string, now = new Date()): Promise<Presence[]> {
  if (!(await fs.exists(PRESENCE_DIR))) return [];
  const mine = presenceFile(me);
  const out: Presence[] = [];
  for (const entry of await fs.list(PRESENCE_DIR)) {
    if (entry.isDir || !entry.name.endsWith(".json") || entry.path === mine) continue;
    try {
      const p = JSON.parse(await fs.readText(entry.path));
      if (!valid(p) || !p.path) continue;
      const age = now.getTime() - new Date(p.updated).getTime();
      if (!(age < PRESENCE_TTL)) continue;
      out.push({ user: p.user, path: p.path, since: typeof p.since === "string" ? p.since : null, updated: p.updated });
    } catch {
      // Half-synced or edited by hand: ignored until it reads again.
    }
  }
  return out;
}

/**
 * The person who keeps `path` when several have it open: the first to open it. Returns
 * null when `path` is free for `me`, who opened it at `mySince` (null if not yet).
 */
export function holder(others: Presence[], path: string, mySince: string | null): Presence | null {
  const there = others.filter((o) => o.path === path).sort((a, b) => (a.since ?? a.updated).localeCompare(b.since ?? b.updated));
  const first = there[0];
  if (!first) return null;
  if (mySince && mySince <= (first.since ?? first.updated)) return null;
  return first;
}
