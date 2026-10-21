// What differs between the desktop app, a project folder opened in a browser and the sample
// project, for the parts of the interface that care.

import type { ProjectFs } from "./core/fs";
import { BrowserFs } from "./browserFs";
import { TauriFs } from "./tauriFs";

/** Names the project among others, for what is remembered per project (panes, folds). */
export function projectKey(fs: ProjectFs): string {
  if (fs instanceof TauriFs) return fs.root;
  if (fs instanceof BrowserFs) return fs.key;
  return "sample";
}

/** True when the project is a folder of the computer, not the sample kept in memory. */
export function onDisk(fs: ProjectFs): boolean {
  return fs instanceof TauriFs || fs instanceof BrowserFs;
}

/** The name of the project's folder; "" for the sample. */
export function folderName(fs: ProjectFs): string {
  if (fs instanceof TauriFs) return fs.root.split(/[\\/]/).filter(Boolean).pop() ?? fs.root;
  if (fs instanceof BrowserFs) return fs.name;
  return "";
}

/**
 * Where a project file is, for the writer to find it: the full path in the desktop app;
 * in a browser, which knows only the folder's name, that name and the path inside it.
 */
export function whereIs(fs: ProjectFs, path: string): string {
  if (fs instanceof TauriFs) return `${fs.root.replace(/[\\/]+$/, "")}/${path}`;
  if (fs instanceof BrowserFs) return fs.where(path);
  return path;
}
