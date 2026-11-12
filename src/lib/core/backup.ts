// A backup of the whole project as one zip file, made in the browser, where Dante cannot
// write outside the project's folder: the writer downloads it. The desktop app makes the
// same zip in src-tauri/src/backup.rs and keeps it in a folder of the computer.

import { unzipSync, zipSync, type Zippable } from "fflate";
import type { ProjectFs } from "./fs";

/** Left out, as in the app: exports, the trash, other programs' data, version control. */
const SKIPPED_TOP = new Set(["export", ".trash", ".obsidian", ".git", "node_modules"]);
const PRESENCE = ".dante/presence";

/** "2026-10-26 10-15-30", in local time: sorts by date and can be part of a file name. */
export function backupStamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`;
}

/** The files of the project to save, as paths relative to its folder. */
export async function backupFiles(fs: ProjectFs, dir = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.list(dir)) {
    if (dir === "" && SKIPPED_TOP.has(entry.name)) continue;
    if (entry.path === PRESENCE || entry.name === ".DS_Store" || entry.name.includes(".dante-tmp")) continue;
    if (entry.isDir) out.push(...(await backupFiles(fs, entry.path)));
    else out.push(entry.path);
  }
  return out.sort();
}

/** The project as a zip whose files sit in a folder called `name`. */
export async function zipProject(fs: ProjectFs, name: string): Promise<Uint8Array> {
  const files: Zippable = {};
  for (const path of await backupFiles(fs)) {
    try {
      files[`${name}/${path}`] = await fs.readBytes(path);
    } catch {
      // Gone since the listing: left out.
    }
  }
  return zipSync(files, { level: 6 });
}

/**
 * Writes the files of a backup into `fs`, an empty folder: the opposite of zipProject. The
 * folder the zip keeps its files in is left out. Returns how many files were written.
 */
export async function unzipProject(fs: ProjectFs, zip: Uint8Array): Promise<number> {
  const files = Object.entries(unzipSync(zip)).filter(([name]) => !name.endsWith("/"));
  const tops = new Set(files.map(([name]) => name.split("/")[0]));
  // One folder at the top holding everything: the project's own, as the backups are made.
  const strip = tops.size === 1 && files.every(([name]) => name.includes("/")) ? [...tops][0].length + 1 : 0;
  const made = new Set<string>();
  let count = 0;
  for (const [name, bytes] of files) {
    const path = name.slice(strip);
    const parts = path.split("/");
    // Nothing is written outside the folder, whatever the zip says.
    if (!path || parts.some((part) => part === "" || part === "." || part === "..") || path.includes("\\")) continue;
    const dir = parts.slice(0, -1).join("/");
    if (dir && !made.has(dir)) {
      await fs.mkdir(dir);
      made.add(dir);
    }
    await fs.writeBytes(path, bytes);
    count++;
  }
  return count;
}
