// What only the web version does at start: the service worker that keeps it offline, the
// request to keep its data, and the launcher files double-clicked once Dante is installed.

import { base } from "$app/paths";
import { WEB_BUILD } from "./build";
import { inTauri } from "./tauriFs";
import { keepData } from "./webFolders";

/** Calls `onLauncher` with each "Title.dante" file the system asks Dante to open. */
export function startWeb(onLauncher: (file: FileSystemFileHandle) => void): void {
  if (!WEB_BUILD || inTauri()) return;
  keepData();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${base}/service-worker.js`).catch(() => {
      // Without it Dante still works, only not offline.
    });
  }
  window.launchQueue?.setConsumer((params) => {
    const file = params.files.find((f): f is FileSystemFileHandle => f.kind === "file" && f.name.toLowerCase().endsWith(".dante"));
    if (file) onLauncher(file);
  });
}
