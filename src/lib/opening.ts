// Opening a project folder on the desktop, from the start screen or from the system (a
// double-clicked launcher file).

import { ensureLauncher } from "./core/launcher";
import { Project } from "./core/project";
import { SETTINGS_FILE } from "./core/settings";
import { app, rememberProject, t } from "./state.svelte";
import { TauriFs } from "./tauriFs";

function folderOf(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** Adds the launcher file to a project that has none, so it can be opened with a double-click. */
export async function addLauncher(project: Project): Promise<void> {
  try {
    const title = project.settings.title || (project.fs instanceof TauriFs ? folderOf(project.fs.root) : "");
    if (await ensureLauncher(project.fs, title, t("launcher.content"))) await project.reload();
  } catch {
    // A folder that cannot be written still opens; it only goes without the launcher.
  }
}

export async function openProjectAt(path: string): Promise<Project> {
  const project = await Project.open(new TauriFs(path), app.settings.language);
  // A new project records its language and folder names, so they no longer follow the interface.
  if (!(await project.fs.exists(SETTINGS_FILE))) {
    await project.saveSettings({ ...project.settings, title: project.settings.title || folderOf(path) });
  }
  await addLauncher(project);
  rememberProject(path, project.settings.title || folderOf(path));
  return project;
}
