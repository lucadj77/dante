import { open } from "@tauri-apps/plugin-dialog";
import type { DocxContent } from "$lib/core/import/docx";
import { readScrivener, readScrivenerZip, ScrivenerError } from "$lib/core/import/scrivener";
import { unzip } from "$lib/core/import/unzip";
import type { ProjectFs } from "$lib/core/fs";
import { inTauri, TauriFs } from "$lib/tauriFs";

export interface PickedProject {
  content: DocxContent;
  name: string;
}

const split = (path: string) => {
  const name = path.split(/[\\/]/).pop() ?? path;
  return { dir: path.slice(0, path.length - name.length).replace(/[\\/]+$/, "") || "/", name };
};

/**
 * Asks for a Scrivener project and reads it. In the app that is the .scriv project itself
 * (on a Mac where Scrivener is installed), the .scrivx file inside it, or a zip of it; in
 * the browser, a zip of it. Null when the writer picks nothing.
 */
export async function pickScrivener(untitled: string): Promise<PickedProject | null> {
  if (!inTauri()) {
    const file = await pickZipInBrowser();
    return file ? { content: await readScrivenerZip(await unzip(file.bytes), untitled), name: file.name } : null;
  }
  const picked = await open({ multiple: false, filters: [{ name: "Scrivener", extensions: ["scriv", "scrivx", "zip"] }] });
  if (typeof picked !== "string") return null;
  return readPicked((root) => new TauriFs(root), picked, untitled);
}

/**
 * Reads the Scrivener project at `picked`, a path from the dialog: the .scriv folder (a
 * package on a Mac), the .scrivx file inside it, or a zip of the project. A .scriv that is
 * a single file, as when a sync service or a download has packed the project, is read as a
 * zip when it is one; an empty one, as a cloud copy that was never downloaded, is refused. `at` makes a filesystem rooted at a folder of the computer.
 */
export async function readPicked(at: (root: string) => ProjectFs, picked: string, untitled: string): Promise<PickedProject> {
  const path = picked.replace(/(.)[\\/]+$/, "$1");
  const { dir, name } = split(path);
  if (/\.scrivx$/i.test(name)) return { content: await readFolder(at(dir), name, untitled), name: split(dir).name };
  if (!/\.zip$/i.test(name)) {
    // The .scrivx file is inside the project's folder, next to the documents.
    const folder = at(path);
    const entries = await folder.list("").catch(() => null);
    const scrivx = entries?.find((e) => !e.isDir && /\.scrivx$/i.test(e.name) && !e.name.startsWith("._"))?.name;
    if (scrivx) return { content: await readFolder(folder, scrivx, untitled), name };
    if (entries) throw new ScrivenerError("notProject");
  }
  const bytes = await at(dir).readBytes(name);
  if (!bytes.length) throw new ScrivenerError("empty");
  if (!isZip(bytes)) throw new ScrivenerError("notProject");
  return { content: await readScrivenerZip(await unzip(bytes), untitled), name };
}

/** Reads the project in `folder`, whose binder is the file `scrivx` in it. */
async function readFolder(folder: ProjectFs, scrivx: string, untitled: string): Promise<DocxContent> {
  const files = async (file: string) => ((await folder.exists(file)) ? folder.readBytes(file) : null);
  return readScrivener(await folder.readText(scrivx), files, scrivx.replace(/\.scrivx$/i, ""), untitled);
}

/** Whether `bytes` start as a zip file does. */
function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
}

function pickZipInBrowser(): Promise<{ bytes: Uint8Array; name: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name } : null);
    };
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
