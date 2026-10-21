import { open } from "@tauri-apps/plugin-dialog";
import { inTauri, TauriFs } from "$lib/tauriFs";

export interface PickedFile {
  bytes: Uint8Array;
  name: string;
}

/**
 * Asks for a Word file: with the system's dialog in the app, with the browser's file
 * picker elsewhere. Null when the writer picks nothing.
 */
export async function pickWordFile(): Promise<PickedFile | null> {
  if (!inTauri()) return pickInBrowser();
  const file = await open({ multiple: false, filters: [{ name: "Word", extensions: ["docx"] }] });
  if (typeof file !== "string") return null;
  const name = file.split(/[\\/]/).pop() ?? file;
  const dir = file.slice(0, file.length - name.length).replace(/[\\/]+$/, "") || "/";
  return { bytes: await new TauriFs(dir).readBytes(name), name };
}

function pickInBrowser(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".docx";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name } : null);
    };
    // Closing the picker without a file sends no change.
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
