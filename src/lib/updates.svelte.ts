import type { Update } from "@tauri-apps/plugin-updater";
import { inTauri } from "./tauriFs";

/**
 * Updates come from the "preview" release on GitHub, whose latest.json names the newest
 * version for each system. Checking and installing go through Tauri's updater plugin,
 * which verifies the download against the public key in tauri.conf.json.
 */
export const updates = $state<{
  /** The installed version, once known. */
  version: string;
  /** False in development and in the portable copy, which update by hand. */
  supported: boolean;
  /** A newer version announced by the release, not yet installed. */
  available: Update | null;
  /** The banner was closed with "Later": it comes back at the next start. */
  dismissed: boolean;
  state: "idle" | "checking" | "current" | "downloading" | "error";
  /** Share of the download received, from 0 to 1, when the size is known. */
  progress: number | null;
  error: string;
}>({ version: "", supported: false, available: null, dismissed: false, state: "idle", progress: null, error: "" });

let ready: Promise<void> | null = null;

/** Learns the installed version and whether this copy can update itself. */
export function loadUpdateInfo(): Promise<void> {
  ready ??= (async () => {
    if (!inTauri()) return;
    const [{ getVersion }, { invoke }] = await Promise.all([import("@tauri-apps/api/app"), import("@tauri-apps/api/core")]);
    updates.version = await getVersion();
    updates.supported = await invoke<boolean>("updates_supported");
  })();
  return ready;
}

/** Asks the release for a newer version; `quiet` keeps network errors to itself (the check at start). */
export async function checkForUpdates(quiet = false): Promise<void> {
  await loadUpdateInfo();
  if (!updates.supported || updates.state === "checking" || updates.state === "downloading") return;
  updates.state = "checking";
  updates.error = "";
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const found = await check();
    updates.available = found;
    updates.dismissed = false;
    updates.state = found ? "idle" : "current";
  } catch (e) {
    updates.state = quiet ? "idle" : "error";
    updates.error = String(e);
  }
}

/** Saves what `beforeInstall` saves, downloads and installs the update, then restarts Dante. */
export async function installUpdate(beforeInstall: () => Promise<void>): Promise<void> {
  const update = updates.available;
  if (!update) return;
  updates.state = "downloading";
  updates.progress = null;
  updates.error = "";
  try {
    await beforeInstall();
    let total = 0;
    let received = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      else if (event.event === "Progress") {
        received += event.data.chunkLength;
        updates.progress = total ? Math.min(1, received / total) : null;
      }
    });
    // On Windows the installer has already closed Dante by now; elsewhere it restarts here.
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    updates.state = "error";
    updates.error = String(e);
  }
}

export interface VersionNews {
  version: string;
  notes: string[];
}

const versionKey = (v: string) => v.split(".").map((n) => Number(n) || 0);

/** True when version `a` comes after `b`. */
export function newerVersion(a: string, b: string): boolean {
  const [x, y] = [versionKey(a), versionKey(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/**
 * What changes from the installed version to the available one, newest first, from the
 * "news" the release's latest.json carries (docs/novita.md and docs/whats-new.md). English
 * for every language but Italian.
 */
export function newsSince(raw: unknown, installed: string, language: string): VersionNews[] {
  const news = (raw as { news?: Record<string, VersionNews[]> } | null)?.news;
  const list = news?.[language === "it" ? "it" : "en"] ?? news?.en ?? [];
  if (!Array.isArray(list)) return [];
  return list.filter((v) => typeof v?.version === "string" && Array.isArray(v.notes) && (!installed || newerVersion(v.version, installed)));
}
