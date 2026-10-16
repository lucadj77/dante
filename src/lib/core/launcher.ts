// The launcher file: "Title.dante" in the project folder, which opens the project in Dante
// with a double-click. Its content does not matter; the folder it sits in is the project.

import { sanitizeTitle } from "./naming";
import type { ProjectFs } from "./fs";

export const LAUNCHER_EXTENSION = ".dante";

/** Whether `name` is the name of a launcher file. */
export function isLauncher(name: string): boolean {
  return name.toLowerCase().endsWith(LAUNCHER_EXTENSION) && name.length > LAUNCHER_EXTENSION.length;
}

/**
 * Writes a launcher named after the title, unless the folder already has one (under any
 * name: the writer may have renamed it). Returns its name, or "" when there was one.
 */
export async function ensureLauncher(fs: ProjectFs, title: string, content: string): Promise<string> {
  const entries = await fs.list("");
  if (entries.some((e) => !e.isDir && isLauncher(e.name))) return "";
  const name = (sanitizeTitle(title) || "Dante") + LAUNCHER_EXTENSION;
  await fs.writeText(name, content);
  return name;
}

/**
 * The project folder of something the system asked to open: the folder holding a launcher
 * file or a dante.yaml, or the folder itself.
 */
export function projectFolder(path: string): string {
  const parts = path.split(/[\\/]/);
  const name = parts[parts.length - 1] ?? "";
  if (!isLauncher(name) && name.toLowerCase() !== "dante.yaml") return path.replace(/[\\/]+$/, "") || path;
  const parent = path.slice(0, path.length - name.length).replace(/[\\/]+$/, "");
  return parent || "/";
}
