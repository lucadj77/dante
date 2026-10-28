// The record of what happened to comments and revisions: who accepted or rejected a change,
// who closed a discussion, when, and what the text said before and after. Once settled, the
// marks leave the scene, so this record is the only trace of them.
//
// Each person writes a file of their own, `.dante/history/<name>.jsonl`, one entry per line:
// two authors sharing the folder (on Drive or Dropbox) never write the same file.

import { discussion, type CriticItem, type ItemKind } from "./critic";
import type { ProjectFs } from "./fs";
import { join } from "./path";

export const HISTORY_DIR = ".dante/history";

export type HistoryAction = "accept" | "reject" | "resolve";

export interface HistoryEntry {
  /** When, as an ISO date and time. */
  when: string;
  /** Who accepted, rejected or closed it. */
  by: string;
  action: HistoryAction;
  kind: ItemKind;
  /** The scene or note, by its path at the time (kept current when scenes move). */
  path: string;
  /** Who proposed the change or opened the discussion, and when, as signed. */
  author: string | null;
  date: string | null;
  /** The text before and after: for a comment, the passage it was on, the same in both. */
  before: string;
  after: string;
  discussion: { author: string | null; date: string | null; text: string }[];
}

/** What a settled item leaves in the record. */
export function historyEntry(text: string, item: CriticItem, action: HistoryAction, by: string, path: string, now = new Date()): HistoryEntry {
  const slice = (from: number, to: number) => text.slice(from, to);
  const content = slice(item.contentFrom, item.contentTo);
  let before = content;
  let after = content;
  if (item.kind === "addition") before = "";
  if (item.kind === "deletion") after = "";
  if (item.kind === "substitution") after = slice(item.newFrom!, item.newTo!);
  // A comment alone is on no passage: what it says is in the discussion.
  if (item.kind === "comment") before = after = "";
  if (action === "reject") after = before;
  return {
    when: now.toISOString(),
    by,
    action,
    kind: item.kind,
    path,
    author: item.author,
    date: item.date,
    before,
    after,
    discussion: discussion(item).map((c) => ({ author: c.author, date: c.date, text: c.text })),
  };
}

/** The file where `by` writes: their name, made safe for a file name. */
export function historyFile(by: string): string {
  const name = by.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/^\.+/, "") || "anonymous";
  return join(HISTORY_DIR, `${name}.jsonl`);
}

/** Adds entries to the file of whoever settled them. */
export async function recordHistory(fs: ProjectFs, entries: HistoryEntry[]): Promise<void> {
  const byFile = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const file = historyFile(entry.by);
    byFile.set(file, [...(byFile.get(file) ?? []), entry]);
  }
  for (const [file, list] of byFile) {
    const previous = (await fs.exists(file)) ? await fs.readText(file) : "";
    const lines = list.map((e) => JSON.stringify(e)).join("\n");
    await fs.writeText(file, previous && !previous.endsWith("\n") ? `${previous}\n${lines}\n` : `${previous}${lines}\n`);
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  const e = value as HistoryEntry;
  return !!e && typeof e === "object" && typeof e.when === "string" && typeof e.path === "string" && typeof e.by === "string";
}

/** Every entry of every person, the most recent first. A line that does not read is skipped. */
export async function readHistory(fs: ProjectFs): Promise<HistoryEntry[]> {
  if (!(await fs.exists(HISTORY_DIR))) return [];
  const out: HistoryEntry[] = [];
  for (const file of await fs.list(HISTORY_DIR)) {
    if (file.isDir || !file.name.endsWith(".jsonl")) continue;
    for (const line of (await fs.readText(file.path)).split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (isEntry(entry)) out.push({ ...entry, discussion: Array.isArray(entry.discussion) ? entry.discussion : [] });
      } catch {
        // A line cut short by a sync in progress.
      }
    }
  }
  return out.sort((a, b) => b.when.localeCompare(a.when));
}

export interface HistoryFilter {
  /** Who settled the item or proposed it; "" for anyone. */
  person?: string;
  /** Days as YYYY-MM-DD, both included; "" for no limit. */
  from?: string;
  to?: string;
  path?: string;
}

/** The entries that pass the filter. Days are read in local time. */
export function filterHistory(entries: HistoryEntry[], filter: HistoryFilter): HistoryEntry[] {
  const day = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const person = filter.person?.trim().toLowerCase() ?? "";
  return entries.filter(
    (e) =>
      (!filter.path || e.path === filter.path) &&
      (!person || e.by.toLowerCase() === person || (e.author ?? "").toLowerCase() === person) &&
      (!filter.from || day(e.when) >= filter.from) &&
      (!filter.to || day(e.when) <= filter.to),
  );
}

/** Everyone named in the record, as they sign. */
export function historyPeople(entries: HistoryEntry[]): string[] {
  const names = new Map<string, string>();
  for (const e of entries) for (const n of [e.by, e.author]) if (n && !names.has(n.toLowerCase())) names.set(n.toLowerCase(), n);
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

/** Keeps the record's paths current after scenes moved or were renamed. */
export async function moveHistory(fs: ProjectFs, renames: Map<string, string>): Promise<void> {
  if (!renames.size || !(await fs.exists(HISTORY_DIR))) return;
  for (const file of await fs.list(HISTORY_DIR)) {
    if (file.isDir || !file.name.endsWith(".jsonl")) continue;
    const text = await fs.readText(file.path);
    let changed = false;
    const lines = text.split("\n").map((line) => {
      if (!line.trim()) return line;
      try {
        const entry = JSON.parse(line);
        const to = isEntry(entry) ? renames.get(entry.path) : undefined;
        if (!to) return line;
        changed = true;
        return JSON.stringify({ ...entry, path: to });
      } catch {
        return line;
      }
    });
    if (changed) await fs.writeText(file.path, lines.join("\n"));
  }
}
