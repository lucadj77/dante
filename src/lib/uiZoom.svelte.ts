// The size of the whole interface (menus, panels, buttons and their text), apart from the
// size of the text in the editor. The desktop app zooms its window as a browser zooms a page;
// in a browser it is the browser's own zoom that does it.

import { invoke } from "@tauri-apps/api/core";
import { inTauri } from "./tauriFs";

/** The sizes offered, as a share of the usual one. */
export const UI_ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

/** "app" where Dante zooms its window, "browser" where the browser does, "old-mac" where nothing can. */
export const uiZoom = $state<{ where: "app" | "browser" | "old-mac" }>({ where: inTauri() ? "app" : "browser" });

let applied: number | null = null;

/** Zooms the app's window to `factor`; asked once at start too, which tells whether the system can. */
export async function applyUiZoom(factor: number) {
  if (uiZoom.where !== "app" || factor === applied) return;
  applied = factor;
  try {
    // False on macOS 10.15 and older, whose web view has no page zoom.
    if ((await invoke<boolean>("set_ui_zoom", { factor })) === false) uiZoom.where = "old-mac";
  } catch {
    applied = null;
  }
}

/**
 * The Mac menu bar in the language of the interface: its words are written by the app's shell,
 * which takes them from here at start and whenever the language changes. Nothing to do elsewhere.
 */
export async function applyMenuLabels(labels: Record<string, string>) {
  if (!inTauri()) return;
  try {
    await invoke<boolean>("set_menu_labels", { labels });
  } catch {
    // An older shell without the command keeps its English menu.
  }
}
