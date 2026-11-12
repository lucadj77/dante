// Where an exported file goes: the project's export folder, a place chosen in a dialog, or a download.

import { EXPORT_FOLDER, exportBaseName } from "$lib/core/export/files";
import type { Project } from "$lib/core/project";
import { BrowserFs } from "$lib/browserFs";
import { inTauri, TauriFs } from "$lib/tauriFs";

/** Where a file went: in the project, or anywhere on the computer. */
export interface Saved {
  /** Path in the project, for files in the export folder. */
  relative: string;
  absolute: string;
}

/** The kind of file being exported: its extension, its name in the dialogs, its media type. */
export interface FileKind {
  ext: string;
  name: string;
  mime: string;
}

/** What saves the exports of `project`; `kind` gives the format chosen at the moment of saving. */
export function exportSaver(project: Project, kind: () => FileKind) {
  const desktop = inTauri();
  const web = project.fs instanceof BrowserFs;
  // The folder of the last export, on this computer, for the save dialog.
  const LAST_PATH_KEY = `dante.last-export:${"root" in project.fs ? (project.fs as { root: string }).root : ""}`;

  /** "Author_Title_2026-10-16-11-30.ext": each export gets its own name, so none replaces another. */
  function fileName(ext = kind().ext, date = new Date()) {
    return `${exportBaseName(project.settings, date)}.${ext}`;
  }

  /** A path in the export folder not taken yet, relative to the project. */
  async function exportPath(ext = kind().ext): Promise<string> {
    const name = fileName(ext).replace(/\.[^.]+$/, "");
    let path = `${EXPORT_FOLDER}/${name}.${ext}`;
    for (let n = 2; await project.fs.exists(path); n++) path = `${EXPORT_FOLDER}/${name}-${n}.${ext}`;
    return path;
  }

  /** Asks where to save the file in the desktop app; null if cancelled. */
  async function choosePath(): Promise<string | null> {
    const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_PATH_KEY);
    } catch {
      // No storage: the dialog opens in its default folder.
    }
    const defaultPath = last ? last.replace(/[^/\\]+$/, fileName()) : fileName();
    const { ext, name } = kind();
    const path = await saveDialog({ defaultPath, filters: [{ name, extensions: [ext] }] });
    if (!path) return null;
    try {
      localStorage.setItem(LAST_PATH_KEY, path);
    } catch {
      // Not remembered; nothing else depends on it.
    }
    return path;
  }

  const root = project.fs instanceof TauriFs ? project.fs.root : "";
  const inProject = (relative: string): Saved => ({ relative, absolute: `${root.replace(/[\\/]+$/, "")}/${relative}` });

  /**
   * Where to write: a new file in the export folder, or the place chosen in a dialog.
   * Null if the dialog was cancelled.
   */
  async function destination(elsewhere: boolean): Promise<Saved | null> {
    if (elsewhere) {
      const path = await choosePath();
      return path ? { relative: "", absolute: path } : null;
    }
    return inProject(await exportPath());
  }

  /**
   * In a browser, "elsewhere" asks where with the browser's own dialog, when it has one.
   * Null if cancelled, "" when the browser cannot ask and the file is downloaded instead.
   */
  async function saveInBrowser(bytes: Uint8Array | string, name: string, mime: string): Promise<Saved | "" | null> {
    const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
    if (!picker) return download(bytes, name, mime);
    let handle: FileSystemFileHandle;
    try {
      const { ext, name: label } = kind();
      handle = await picker({ suggestedName: name, id: "dante-export", types: [{ description: label, accept: { [mime]: [`.${name.split(".").pop() || ext}`] } }] });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
    const writable = await handle.createWritable();
    await writable.write(bytes as FileSystemWriteChunkType);
    await writable.close();
    return { relative: "", absolute: handle.name };
  }

  function download(bytes: Uint8Array | string, name: string, mime: string): "" {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "";
  }

  /** Writes the file in the project's export folder or where chosen; the sample project downloads it and gets "". */
  async function save(bytes: Uint8Array | string, elsewhere: boolean, name = fileName(), mime = kind().mime): Promise<Saved | "" | null> {
    if (web) {
      if (elsewhere) return saveInBrowser(bytes, name, mime);
      const where = inProject(await exportPath());
      if (typeof bytes === "string") await project.fs.writeText(where.relative, bytes);
      else await project.fs.writeBytes(where.relative, bytes);
      return where;
    }
    if (desktop) {
      const where = await destination(elsewhere);
      if (!where) return null;
      if (where.relative) {
        if (typeof bytes === "string") await project.fs.writeText(where.relative, bytes);
        else await project.fs.writeBytes(where.relative, bytes);
      } else {
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        await writeFile(where.absolute, typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes);
      }
      return where;
    }
    return download(bytes, name, mime);
  }

  return { fileName, destination, save, root };
}
