// Backups of the open project: zip files the desktop app keeps in a folder of the computer
// (src-tauri/src/backup.rs), or that a browser downloads.

import { backupStamp, unzipProject, zipProject } from "./core/backup";
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

/** The backups kept for the project, as file names, the most recent first. */
export async function backupNames(project: Project, settings: AppSettings = app.settings): Promise<string[]> {
  const info = await backupInfo(project, settings);
  if (!info?.dir) return [];
  const entries = await new TauriFs(info.dir).list("");
  return entries.filter((e) => !e.isDir && e.name.endsWith(".zip") && !e.name.startsWith(".")).map((e) => e.name).sort().reverse();
}

/**
 * Takes a backup out of its zip into a new folder beside the project's, named
 * `folder` (with a number after it when the name is taken), and returns that folder's path.
 * The project and the backup stay as they are.
 */
export async function extractBackup(project: Project, name: string, folder: string, settings: AppSettings = app.settings): Promise<string> {
  if (!(project.fs instanceof TauriFs)) throw new Error("Backups are opened by the desktop app");
  const info = await backupInfo(project, settings);
  if (!info?.dir) throw new Error("No backups for this project");
  const { dirname, join } = await import("@tauri-apps/api/path");
  const parent = new TauriFs(await dirname(project.fs.root));
  const clean = folder.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "Dante";
  let target = clean;
  for (let n = 2; await parent.exists(target); n++) target = `${clean} ${n}`;
  const zip = await new TauriFs(info.dir).readBytes(name);
  await parent.mkdir(target);
  const path = await join(parent.root, target);
  await unzipProject(new TauriFs(path), zip);
  return path;
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
