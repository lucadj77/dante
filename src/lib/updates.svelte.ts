import type { Update } from "@tauri-apps/plugin-updater";
import { base } from "$app/paths";
import { version as builtVersion } from "$app/environment";
import { WEB_BUILD } from "./build";
import { inTauri } from "./tauriFs";

/** A newer web version, announced by the site's version.json. */
export interface WebUpdate {
  version: string;
  rawJson: Record<string, unknown>;
}

/**
 * Updates of the app come from the "preview" release on GitHub, whose latest.json names
 * the newest version for each system. Checking and installing go through Tauri's updater
 * plugin, which verifies the download against the public key in tauri.conf.json.
 *
 * The web version asks its own site: version.json names the newest version and its news,
 * and the service worker downloads the new files, which take over when Dante restarts.
 */
export const updates = $state<{
  /** The installed version, once known. */
  version: string;
  /** False in development and in the portable copy, which update by hand. */
  supported: boolean;
  /** A newer version announced by the release, not yet installed. */
  available: Update | WebUpdate | null;
  /** The banner was closed with "Later": it comes back at the next start. */
  dismissed: boolean;
  state: "idle" | "checking" | "current" | "downloading" | "error";
  /** Share of the download received, from 0 to 1, when the size is known. */
  progress: number | null;
  error: string;
  /** A short message in the corner after a check that found nothing to install. */
  notice: "" | "current" | "error" | "unsupported";
}>({ version: "", supported: false, available: null, dismissed: false, state: "idle", progress: null, error: "", notice: "" });

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

/** Shows `notice` in the corner for a few seconds; errors stay a little longer. */
function announce(notice: typeof updates.notice) {
  clearTimeout(noticeTimer);
  updates.notice = notice;
  noticeTimer = setTimeout(() => (updates.notice = ""), notice === "current" ? 4000 : 10000);
}

export function closeNotice() {
  clearTimeout(noticeTimer);
  updates.notice = "";
}

let ready: Promise<void> | null = null;

/** Learns the installed version and whether this copy can update itself. */
export function loadUpdateInfo(): Promise<void> {
  ready ??= (async () => {
    if (!inTauri()) {
      updates.version = builtVersion;
      updates.supported = WEB_BUILD && "serviceWorker" in navigator;
      return;
    }
    const [{ getVersion }, { invoke }] = await Promise.all([import("@tauri-apps/api/app"), import("@tauri-apps/api/core")]);
    updates.version = await getVersion();
    updates.supported = await invoke<boolean>("updates_supported");
  })();
  return ready;
}

/**
 * Asks the release for a newer version. `quiet` keeps network errors out of the settings
 * (the checks made by themselves); `announce` says the outcome in the corner even when
 * there is nothing to install (the check at start and the one from the menu).
 */
export async function checkForUpdates(quiet = false, announced = false): Promise<void> {
  await loadUpdateInfo();
  if (!updates.supported) {
    if (announced && !quiet && updates.version) announce("unsupported");
    return;
  }
  if (updates.state === "checking" || updates.state === "downloading") return;
  updates.state = "checking";
  updates.error = "";
  try {
    let found: Update | WebUpdate | null;
    if (inTauri()) {
      const { check } = await import("@tauri-apps/plugin-updater");
      found = await check();
    } else {
      const response = await fetch(`${base}/version.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as Record<string, unknown>;
      const version = typeof json.version === "string" ? json.version : "";
      found = version && newerVersion(version, updates.version) ? { version, rawJson: json } : null;
    }
    // A version already announced and put off stays put off until the next start.
    if (!found || found.version !== updates.available?.version) updates.dismissed = false;
    updates.available = found;
    updates.state = found ? "idle" : "current";
    if (!found && announced) announce("current");
  } catch (e) {
    updates.state = quiet ? "idle" : "error";
    updates.error = String(e);
    if (announced) announce("error");
  }
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

/**
 * The check at start, said in the corner, then one every six hours while Dante stays
 * open. Returns the function that stops the later checks.
 */
export function checkAtStart(): () => void {
  void checkForUpdates(true, true);
  const timer = setInterval(() => void checkForUpdates(true), SIX_HOURS);
  return () => clearInterval(timer);
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
    if (!("downloadAndInstall" in update)) {
      await takeWebUpdate();
      return;
    }
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

/**
 * Has the service worker download the new version and take over, then reloads the page.
 * The browser may have fetched it already; without a service worker a reload is enough.
 */
async function takeWebUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) {
    location.reload();
    return;
  }
  await registration.update();
  const waiting = await new Promise<ServiceWorker | null>((resolve) => {
    if (registration.waiting) return resolve(registration.waiting);
    const installing = registration.installing;
    if (!installing) return resolve(null);
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed") resolve(registration.waiting ?? installing);
      else if (installing.state === "redundant") resolve(null);
    });
  });
  if (!waiting) {
    // Nothing newer to take: the site is not updated yet, or the worker failed.
    throw new Error("the new version could not be downloaded");
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  waiting.postMessage("take-over");
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
