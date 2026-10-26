import { open } from "@tauri-apps/plugin-dialog";
import type { DocxContent } from "$lib/core/import/docx";
import { readScrivener, readScrivenerZip } from "$lib/core/import/scrivener";
import { unzip } from "$lib/core/import/unzip";
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
  const { dir, name } = split(picked);
  if (/\.zip$/i.test(name)) {
    const bytes = await new TauriFs(dir).readBytes(name);
    return { content: await readScrivenerZip(await unzip(bytes), untitled), name };
  }
  // The .scrivx file is inside the project's folder, next to the documents.
  const folder = /\.scrivx$/i.test(name) ? new TauriFs(dir) : new TauriFs(picked);
  const scrivx = /\.scrivx$/i.test(name) ? name : (await folder.list("")).find((e) => !e.isDir && /\.scrivx$/i.test(e.name))?.name;
  if (!scrivx) throw new Error("No .scrivx file in the Scrivener project");
  const files = async (path: string) => ((await folder.exists(path)) ? folder.readBytes(path) : null);
  const project = /\.scrivx$/i.test(name) ? split(dir).name : name;
  const content = await readScrivener(await folder.readText(scrivx), files, scrivx.replace(/\.scrivx$/i, ""), untitled);
  return { content, name: project };
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
