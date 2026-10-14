import type { Project } from "$lib/core/project";
import { clearPresence, holder, readPresence, writePresence, type Presence } from "$lib/core/presence";
import { app } from "$lib/state.svelte";

const WRITE_EVERY = 60 * 1000;
const READ_EVERY = 15 * 1000;

/** Who else has a file of the open project open, and which file this app is editing. */
export const presence = $state<{ others: Presence[]; mine: { path: string | null; since: string | null } }>({
  others: [],
  mine: { path: null, since: null },
});

let project: Project | null = null;
/** The name the last presence file was written under, to remove it when the name changes. */
let writtenAs: string | null = null;

async function write() {
  if (!project) return;
  const user = app.settings.userName.trim();
  try {
    if (writtenAs && writtenAs !== user) await clearPresence(project.fs, writtenAs);
    writtenAs = null;
    // Without a name nobody could tell who it is.
    if (!user) return;
    await writePresence(project.fs, { user, path: presence.mine.path, since: presence.mine.since, updated: new Date().toISOString() });
    writtenAs = user;
  } catch {
    // Read-only or unreachable folder: the others just do not see us.
  }
}

async function read() {
  if (!project) return;
  try {
    presence.others = await readPresence(project.fs, app.settings.userName.trim());
  } catch {
    presence.others = [];
  }
}

/** Starts announcing this app in the project; the returned function stops and cleans up. */
export function startPresence(opened: Project): () => void {
  project = opened;
  presence.mine = { path: null, since: null };
  void read();
  const writer = setInterval(write, WRITE_EVERY);
  const reader = setInterval(read, READ_EVERY);
  return () => {
    clearInterval(writer);
    clearInterval(reader);
    const fs = opened.fs;
    const user = writtenAs;
    project = null;
    writtenAs = null;
    presence.others = [];
    if (user) void clearPresence(fs, user).catch(() => {});
  };
}

/** Tells the others which file this app is editing now, or none. */
export function announce(path: string | null) {
  if (presence.mine.path === path) return;
  presence.mine = { path, since: path ? new Date().toISOString() : null };
  void write();
}

/** Stops announcing `path` if it is still the one announced, as when its editor closes. */
export function leave(path: string) {
  if (presence.mine.path === path) announce(null);
}

/** Who keeps `path` when this app opens it too, or null if it is free. */
export function lockedBy(path: string): Presence | null {
  return holder(presence.others, path, presence.mine.path === path ? presence.mine.since : null);
}
