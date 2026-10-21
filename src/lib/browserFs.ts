import { join } from "./core/path";
import type { DirEntry, ProjectFs } from "./core/fs";

/**
 * A folder moved half-way is finished from here when the project opens again: a browser can
 * move files but not folders, so a folder is copied and then the original is removed.
 */
export const MOVE_JOURNAL = ".dante/moving.json";

interface Journal {
  from: string;
  to: string;
  /** "copy" while the copy is made, "remove" once it is complete. */
  phase: "copy" | "remove";
}

/** Folders the watch skips, as the desktop app does: Dante's own data and the exports. */
const UNWATCHED = new Set([".dante", "export", ".trash"]);

const isNotFound = (e: unknown) => e instanceof DOMException && (e.name === "NotFoundError" || e.name === "TypeMismatchError");

/** The parts of a project path; anything that could leave the folder is refused. */
function parts(path: string): string[] {
  const list = path.split("/").filter((p) => p !== "");
  for (const p of list) if (p === "." || p === ".." || p.includes("\\")) throw new Error(`Invalid path: ${path}`);
  return list;
}

/**
 * Project filesystem in a Chromium browser, on a folder the writer chose and allowed
 * Dante to change (File System Access API). Writes are safe as in the desktop app: the
 * browser writes a temporary copy and puts it in place when complete.
 */
export class BrowserFs implements ProjectFs {
  /**
   * What the folder held at the last look, by path: size and modification time. Dante's own
   * changes update it as they happen, so the watch reports only changes made by others.
   */
  private seen = new Map<string, string>();

  constructor(
    public handle: FileSystemDirectoryHandle,
    /** Names the folder among the remembered ones, as "web:…". */
    public key: string,
  ) {}

  private async dir(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    let dir = this.handle;
    for (const name of parts(path)) dir = await dir.getDirectoryHandle(name, { create });
    return dir;
  }

  /** The folder holding `path`, and its name there. */
  private async parent(path: string, create = false): Promise<[FileSystemDirectoryHandle, string]> {
    const list = parts(path);
    const name = list.pop();
    if (!name) throw new Error("The project folder itself cannot be changed this way");
    return [await this.dir(list.join("/"), create), name];
  }

  private async entry(path: string): Promise<FileSystemFileHandle | FileSystemDirectoryHandle> {
    if (parts(path).length === 0) return this.handle;
    const [dir, name] = await this.parent(path);
    try {
      return await dir.getFileHandle(name);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      return await dir.getDirectoryHandle(name);
    }
  }

  private async file(path: string): Promise<File> {
    const [dir, name] = await this.parent(path);
    return (await dir.getFileHandle(name)).getFile();
  }

  async list(path: string): Promise<DirEntry[]> {
    const dir = await this.dir(path);
    const entries: DirEntry[] = [];
    for await (const [name, handle] of dir.entries()) entries.push({ path: join(path, name), name, isDir: handle.kind === "directory" });
    return entries;
  }

  async readText(path: string): Promise<string> {
    return (await this.file(path)).text();
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return new Uint8Array(await (await this.file(path)).arrayBuffer());
  }

  writeText(path: string, content: string): Promise<void> {
    return this.write(path, content);
  }

  writeBytes(path: string, content: Uint8Array): Promise<void> {
    return this.write(path, content);
  }

  private async write(path: string, content: string | Uint8Array): Promise<void> {
    const [dir, name] = await this.parent(path, true);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(content as FileSystemWriteChunkType);
      await writable.close();
    } catch (e) {
      await writable.abort().catch(() => {});
      throw e;
    }
    this.note(path, await handle.getFile());
  }

  async mkdir(path: string): Promise<void> {
    await this.dir(path, true);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.entry(path);
      return true;
    } catch (e) {
      if (isNotFound(e)) return false;
      throw e;
    }
  }

  async remove(path: string): Promise<void> {
    const [dir, name] = await this.parent(path);
    await dir.removeEntry(name, { recursive: true });
    this.forget(path);
  }

  async rename(from: string, to: string): Promise<void> {
    if (await this.exists(to)) throw new Error(`Already exists: ${to}`);
    const source = await this.entry(from);
    if (source === this.handle) throw new Error("The project folder cannot be moved");
    if (source.kind === "file") {
      await this.moveFile(source, from, to);
      return;
    }
    await this.writeJournal({ from, to, phase: "copy" });
    await this.copyDir(source, await this.dir(to, true), to);
    await this.writeJournal({ from, to, phase: "remove" });
    await this.remove(from);
    await this.remove(MOVE_JOURNAL);
  }

  private async moveFile(source: FileSystemFileHandle, from: string, to: string): Promise<void> {
    const [target, name] = await this.parent(to, true);
    if (source.move) {
      try {
        await source.move(target, name);
        this.forget(from);
        this.note(to, await (await target.getFileHandle(name)).getFile());
        return;
      } catch {
        // Not allowed on this folder: copied below instead.
      }
    }
    await this.write(to, new Uint8Array(await (await source.getFile()).arrayBuffer()));
    await this.remove(from);
  }

  private async copyDir(source: FileSystemDirectoryHandle, target: FileSystemDirectoryHandle, path: string): Promise<void> {
    for await (const [name, handle] of source.entries()) {
      if (handle.kind === "directory") {
        await this.copyDir(handle, await target.getDirectoryHandle(name, { create: true }), join(path, name));
      } else {
        await this.write(join(path, name), new Uint8Array(await (await handle.getFile()).arrayBuffer()));
      }
    }
  }

  private writeJournal(journal: Journal): Promise<void> {
    return this.write(MOVE_JOURNAL, JSON.stringify(journal));
  }

  /**
   * Completes a folder move that was interrupted, such as by closing the browser: a copy
   * not finished is made again, a copy finished loses its original. True when there was one.
   */
  async recover(): Promise<boolean> {
    let journal: Journal;
    try {
      journal = JSON.parse(await this.readText(MOVE_JOURNAL)) as Journal;
    } catch {
      return false;
    }
    const { from, to } = journal;
    if (journal.phase === "copy" && (await this.exists(from))) {
      if (await this.exists(to)) await this.remove(to);
      await this.rename(from, to);
      return true;
    }
    if (await this.exists(from)) await this.remove(from);
    await this.remove(MOVE_JOURNAL);
    return true;
  }

  private note(path: string, file: File) {
    this.seen.set(path, `${file.size}:${file.lastModified}`);
  }

  private forget(path: string) {
    for (const key of [...this.seen.keys()]) if (key === path || key.startsWith(`${path}/`)) this.seen.delete(key);
  }

  /** Size and modification time of every file outside Dante's own folders. */
  private async scan(): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    const walk = async (dir: FileSystemDirectoryHandle, path: string) => {
      for await (const [name, handle] of dir.entries()) {
        const child = join(path, name);
        if (handle.kind === "directory") {
          if (path === "" && UNWATCHED.has(name)) continue;
          await walk(handle, child);
        } else if (!name.includes(".crswap") && !name.includes(".dante-tmp")) {
          try {
            const file = await handle.getFile();
            found.set(child, `${file.size}:${file.lastModified}`);
          } catch {
            // Removed while looking: the next look tells.
          }
        }
      }
    };
    await walk(this.handle, "");
    return found;
  }

  /**
   * Looks at the folder again and returns the paths others changed, added or removed since
   * the last look. The first look only learns what is there.
   */
  async changes(): Promise<string[]> {
    const now = await this.scan();
    const changed: string[] = [];
    for (const [path, sig] of now) if (this.seen.get(path) !== sig) changed.push(path);
    for (const path of this.seen.keys()) {
      if (!now.has(path) && !UNWATCHED.has(path.split("/")[0])) changed.push(path);
    }
    // Dante's own files under .dante stay known between looks.
    for (const [path, sig] of this.seen) if (UNWATCHED.has(path.split("/")[0])) now.set(path, sig);
    this.seen = now;
    return changed;
  }

  /**
   * Calls `onChange` with what others changed in the folder, looking every few seconds
   * while the page is visible and at once when it comes back. A browser gets no notice from
   * the system as the desktop app does. Returns the function that stops watching.
   */
  watch(onChange: (paths: string[]) => void, every = 3000): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let looking = false;
    const look = async () => {
      clearTimeout(timer);
      if (stopped) return;
      if (!looking && !document.hidden) {
        looking = true;
        try {
          const paths = await this.changes();
          if (paths.length && !stopped) onChange(paths);
        } catch {
          // The folder is out of reach for a moment, as during a sync: tried again later.
        } finally {
          looking = false;
        }
      }
      if (!stopped) timer = setTimeout(look, every);
    };
    const onVisible = () => {
      if (!document.hidden) void look();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // The first look only learns the folder.
    void this.changes().finally(() => {
      if (!stopped) timer = setTimeout(look, every);
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }

  /** The folder's name; a browser does not tell where the folder is on the computer. */
  get name(): string {
    return this.handle.name;
  }

  /** Where `path` is, for the writer: the project folder's name and the path inside it. */
  where(path: string): string {
    return [this.handle.name, ...parts(path)].join(" › ");
  }
}
