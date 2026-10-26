// Backups of the open project: zip files the desktop app keeps in a folder of the computer
// (src-tauri/src/backup.rs), or that a browser downloads.

import { backupStamp, zipProject } from "./core/backup";
import type { Project } from "./core/project";
import { folderName } from "./platform";
import { app, type AppSettings } from "./state.svelte";
import { TauriFs } from "./tauriFs";

/** Documents/Dante backup, in the language of the system's own folder names. */
export async function defaultBackupFolder(): Promise<string> {
  const { documentDir, join } = await import("@tauri-apps/api/path");
  return join(await documentDir(), "Dante backup");
}

export async function backupFolder(settings: AppSettings = app.settings): Promise<string> {
  return settings.backupFolder.trim() || (await defaultBackupFolder());
}

/** The name of the project's backups: its folder's name. */
function backupName(project: Project): string {
  return folderName(project.fs) || project.settings.title || "Dante";
}

/**
 * Makes a backup of a project of the computer; with `onlyIfChanged` nothing is made when no
 * file changed since the last one. Returns the zip's path, or null.
 */
export async function backupNow(project: Project, onlyIfChanged = false, settings: AppSettings = app.settings): Promise<string | null> {
  if (!(project.fs instanceof TauriFs)) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("backup_project", {
    root: project.fs.root,
    dest: await backupFolder(settings),
    name: backupName(project),
    stamp: backupStamp(new Date()),
    keep: Math.max(1, Math.round(settings.backupKeep) || 10),
    onlyIfChanged,
  });
}

/** The automatic backup when a project closes; errors are only logged, closing goes on. */
export async function backupOnClose(project: Project): Promise<void> {
  if (!app.settings.backupOnClose || !(project.fs instanceof TauriFs)) return;
  try {
    await backupNow(project, true);
  } catch (e) {
    console.error("Backup failed", e);
  }
}

export interface BackupInfo {
  dir: string | null;
  latest: string | null;
  count: number;
}

export async function backupInfo(project: Project, settings: AppSettings = app.settings): Promise<BackupInfo | null> {
  if (!(project.fs instanceof TauriFs)) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<BackupInfo>("list_backups", { root: project.fs.root, dest: await backupFolder(settings), name: backupName(project) });
}

/** In a browser: the project as a zip, downloaded. */
export async function downloadBackup(project: Project): Promise<void> {
  const name = backupName(project);
  const bytes = await zipProject(project.fs, name);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name} ${backupStamp(new Date())}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
