// The project folders a browser was allowed to use, remembered between visits. The browser
// keeps the folder itself (a "handle") in IndexedDB; recent projects name it as "web:<id>".

import { BrowserFs } from "./browserFs";
import { inTauri } from "./tauriFs";

const DB = "dante";
const STORE = "folders";
export const WEB_PREFIX = "web:";

/** True in a Chromium browser, where Dante can work on a folder of the computer. */
export function webFolders(): boolean {
  return !inTauri() && typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export const isWebPath = (path: string) => path.startsWith(WEB_PREFIX);

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Every remembered folder, by its "web:" path. */
async function all(): Promise<Map<string, FileSystemDirectoryHandle>> {
  const [keys, values] = await Promise.all([
    run("readonly", (s) => s.getAllKeys()),
    run<FileSystemDirectoryHandle[]>("readonly", (s) => s.getAll()),
  ]);
  return new Map(keys.map((k, i) => [String(k), values[i]]));
}

/** Remembers a folder and returns its path; a folder already known keeps its path. */
export async function rememberFolder(handle: FileSystemDirectoryHandle): Promise<string> {
  for (const [path, known] of await all()) if (await known.isSameEntry(handle)) return path;
  const path = WEB_PREFIX + crypto.randomUUID();
  await run("readwrite", (s) => s.put(handle, path));
  return path;
}

export async function forgetFolder(path: string): Promise<void> {
  await run("readwrite", (s) => s.delete(path));
}

export async function folderAt(path: string): Promise<FileSystemDirectoryHandle | null> {
  return (await run<FileSystemDirectoryHandle | undefined>("readonly", (s) => s.get(path))) ?? null;
}

/**
 * Makes sure Dante may change the folder, asking the writer when the browser wants it
 * (it must follow a click). False when refused.
 */
export async function allow(handle: FileSystemDirectoryHandle, ask = true): Promise<boolean> {
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return ask && (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

/** Asks the writer to choose a folder; null if they cancelled. */
export async function chooseFolder(startIn?: FileSystemHandle): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker({ id: "dante-project", mode: "readwrite", startIn });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/** The project folder at a remembered path, if it is still there and allowed. */
export async function webFs(path: string, ask = true): Promise<BrowserFs | null> {
  const handle = await folderAt(path);
  if (!handle || !(await allow(handle, ask))) return null;
  return new BrowserFs(handle, path);
}

/**
 * The path of the remembered project folder that holds `file` (a launcher opened with a
 * double-click) directly. Null when none does.
 */
export async function folderHolding(file: FileSystemHandle): Promise<string | null> {
  for (const [path, handle] of await all()) {
    try {
      if ((await handle.resolve(file))?.length === 1) return path;
    } catch {
      // A folder no longer there.
    }
  }
  return null;
}

/** Asks the browser to keep Dante's data even when the disk fills up. */
export function keepData(): void {
  void navigator.storage?.persist?.().catch(() => {});
}
