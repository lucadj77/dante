// Opening a project folder, from the start screen or from the system (a double-clicked
// launcher file): a path in the desktop app, a remembered folder ("web:…") in a browser.

import type { ProjectFs } from "./core/fs";
import { ensureLauncher } from "./core/launcher";
import { Project } from "./core/project";
import { SETTINGS_FILE } from "./core/settings";
import { BrowserFs } from "./browserFs";
import { folderName } from "./platform";
import { app, rememberProject, t } from "./state.svelte";
import { TauriFs } from "./tauriFs";
import { isWebPath, webFs } from "./webFolders";

/** Adds the launcher file to a project that has none, so it can be opened with a double-click. */
export async function addLauncher(project: Project): Promise<void> {
  try {
    const title = project.settings.title || folderName(project.fs);
    if (await ensureLauncher(project.fs, title, t("launcher.content"))) await project.reload();
  } catch {
    // A folder that cannot be written still opens; it only goes without the launcher.
  }
}

/** The project's folder at `path`; null when a browser was not allowed to use it. */
export async function folderFs(path: string): Promise<ProjectFs | null> {
  return isWebPath(path) ? webFs(path) : new TauriFs(path);
}

export async function openProjectAt(path: string): Promise<Project> {
  const fs = await folderFs(path);
  if (!fs) throw new Error(t("welcome.denied"));
  return openProjectIn(fs, path);
}

/** A project already open in another tab: its message is for the writer as it is. */
export class OpenElsewhere extends Error {}

/** The browser folder open in this tab, held so that no other tab opens it too. */
let held: { key: string; release: () => void } | null = null;

/** Holds the folder `key` for this tab, letting go of the one held before; false if another tab has it. */
function hold(key: string): Promise<boolean> {
  if (held?.key === key || !navigator.locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    void navigator.locks.request(`dante:${key}`, { ifAvailable: true }, (lock) => {
      if (!lock) return resolve(false);
      return new Promise<void>((release) => {
        held?.release();
        held = { key, release };
        resolve(true);
      });
    });
  });
}

/** The tab closed its project: another tab may open the folder. */
export function letGo(): void {
  held?.release();
  held = null;
}

/** Opens the project in `fs`, remembered among the recent ones as `path`. */
export async function openProjectIn(fs: ProjectFs, path: string): Promise<Project> {
  if (fs instanceof BrowserFs) {
    // Two tabs on one folder would write over each other's text.
    if (!(await hold(fs.key))) throw new OpenElsewhere(t("welcome.openElsewhere"));
    // A folder move a closed browser left half-way is finished first.
    await fs.recover();
  }
  const project = await Project.open(fs, app.settings.language);
  // A new project records its language and folder names, so they no longer follow the interface.
  if (!(await project.fs.exists(SETTINGS_FILE))) {
    await project.saveSettings({ ...project.settings, title: project.settings.title || folderName(fs) });
  }
  await addLauncher(project);
  rememberProject(path, project.settings.title || folderName(fs), fs instanceof BrowserFs ? fs.name : undefined);
  return project;
}
