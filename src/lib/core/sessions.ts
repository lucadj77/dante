import type { ProjectFs } from "./fs";
import { join } from "./path";
import { slug } from "./presence";

/**
 * How much each person writes each day: `.dante/sessions/<user>.json` holds, per day, the
 * words added and removed in the manuscript and the minutes spent writing. Each person
 * writes only their own file, so the shared folder never has two writers for one file.
 */
export const SESSIONS_DIR = ".dante/sessions";
/** A pause longer than this ends a writing session: the time after it is not counted. */
export const SESSION_GAP = 5 * 60 * 1000;

export interface DayLog {
  added: number;
  removed: number;
  minutes: number;
}

export interface WritingLog {
  user: string;
  /** By day, YYYY-MM-DD in local time. */
  days: Record<string, DayLog>;
}

export function sessionFile(user: string): string {
  return join(SESSIONS_DIR, `${slug(user)}.json`);
}

/** A local date as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function valid(value: unknown): value is WritingLog {
  const v = value as WritingLog;
  return !!v && typeof v.user === "string" && !!v.days && typeof v.days === "object";
}

/** Everyone's logs; unreadable files are skipped. */
export async function readLogs(fs: ProjectFs): Promise<WritingLog[]> {
  if (!(await fs.exists(SESSIONS_DIR))) return [];
  const logs: WritingLog[] = [];
  for (const entry of await fs.list(SESSIONS_DIR)) {
    if (entry.isDir || !entry.name.endsWith(".json")) continue;
    try {
      const value = JSON.parse(await fs.readText(entry.path));
      if (valid(value)) logs.push(value);
    } catch {
      // Being written by a sync service, or broken: left out until it reads again.
    }
  }
  return logs;
}

/** Net words written each day, by everyone or by the logs given. */
export function wordsByDay(logs: WritingLog[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const log of logs) {
    for (const [day, d] of Object.entries(log.days)) out.set(day, (out.get(day) ?? 0) + (d.added || 0) - (d.removed || 0));
  }
  return out;
}

/** Days in a row, up to today (or yesterday, while today is still open), with at least `goal` words. */
export function streak(byDay: Map<string, number>, goal: number, today = new Date()): number {
  const day = new Date(today);
  const reached = (d: Date) => (byDay.get(dayKey(d)) ?? 0) >= Math.max(1, goal);
  if (!reached(day)) day.setDate(day.getDate() - 1);
  let n = 0;
  while (reached(day)) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

/**
 * Keeps one person's log: each change to a scene adds its words to today, and the time
 * between changes counts as writing unless there was a long pause. Writes are batched.
 */
export class SessionRecorder {
  private log: WritingLog | null = null;
  private last = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private loading: Promise<WritingLog> | null = null;

  constructor(
    private fs: ProjectFs,
    public user: string,
    private delay = 10_000,
  ) {}

  private load(): Promise<WritingLog> {
    this.loading ??= (async () => {
      const file = sessionFile(this.user);
      try {
        if (await this.fs.exists(file)) {
          const value = JSON.parse(await this.fs.readText(file));
          if (valid(value)) return value;
        }
      } catch {
        // A broken file starts again; the days already counted are lost.
      }
      return { user: this.user, days: {} };
    })();
    return this.loading;
  }

  /** Counts the change from `before` to `after` words of a scene. */
  async record(before: number, after: number, now = new Date()): Promise<void> {
    if (before === after) return;
    this.log = await this.load();
    const key = dayKey(now);
    const day = (this.log.days[key] ??= { added: 0, removed: 0, minutes: 0 });
    if (after > before) day.added += after - before;
    else day.removed += before - after;
    const elapsed = now.getTime() - this.last;
    if (this.last && elapsed > 0 && elapsed < SESSION_GAP) day.minutes = Math.round((day.minutes + elapsed / 60000) * 10) / 10;
    this.last = now.getTime();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.log) return;
    await this.fs.mkdir(SESSIONS_DIR);
    await this.fs.writeText(sessionFile(this.user), JSON.stringify(this.log, null, 2) + "\n");
  }

  /** Today's log so far, for the progress shown while writing. */
  async today(now = new Date()): Promise<DayLog> {
    const log = this.log ?? (await this.load());
    return log.days[dayKey(now)] ?? { added: 0, removed: 0, minutes: 0 };
  }
}
