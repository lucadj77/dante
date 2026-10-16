import { basename, dirname, join } from "./path";

export interface DirEntry {
  /** Path relative to the project root. */
  path: string;
  name: string;
  isDir: boolean;
}

/**
 * Filesystem access scoped to one project folder. Every path is relative to the
 * project root and uses "/" as separator.
 */
export interface ProjectFs {
  list(dir: string): Promise<DirEntry[]>;
  readText(path: string): Promise<string>;
  /** Writes the file, creating missing parent folders. */
  writeText(path: string, content: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
  /** Reads a file of any kind, such as an image or a PDF. */
  readBytes(path: string): Promise<Uint8Array>;
  /** Writes a file of any kind, creating missing parent folders. */
  writeBytes(path: string, content: Uint8Array): Promise<void>;
}

/** In-memory filesystem used by tests and by the demo project. */
export class MemoryFs implements ProjectFs {
  files = new Map<string, string>();
  /** Files written as bytes; their text in `files` is a placeholder. */
  bytes = new Map<string, Uint8Array>();
  dirs = new Set<string>([""]);

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.addFile(path, content);
    }
  }

  private addFile(path: string, content: string) {
    this.files.set(path, content);
    let dir = dirname(path);
    while (dir !== "" && !this.dirs.has(dir)) {
      this.dirs.add(dir);
      dir = dirname(dir);
    }
  }

  async list(dir: string): Promise<DirEntry[]> {
    if (!this.dirs.has(dir)) throw new Error(`Not a folder: ${dir}`);
    const entries: DirEntry[] = [];
    for (const d of this.dirs) {
      if (d !== "" && dirname(d) === dir) entries.push({ path: d, name: basename(d), isDir: true });
    }
    for (const f of this.files.keys()) {
      if (dirname(f) === dir) entries.push({ path: f, name: basename(f), isDir: false });
    }
    return entries;
  }

  async readText(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }

  async writeText(path: string, content: string): Promise<void> {
    this.bytes.delete(path);
    this.addFile(path, content);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return this.bytes.get(path) ?? new TextEncoder().encode(await this.readText(path));
  }

  async writeBytes(path: string, content: Uint8Array): Promise<void> {
    this.addFile(path, "");
    this.bytes.set(path, content);
  }

  async rename(from: string, to: string): Promise<void> {
    if (await this.exists(to)) throw new Error(`Already exists: ${to}`);
    if (this.files.has(from)) {
      const content = this.files.get(from)!;
      this.files.delete(from);
      this.addFile(to, content);
      const bytes = this.bytes.get(from);
      this.bytes.delete(from);
      if (bytes) this.bytes.set(to, bytes);
      return;
    }
    if (!this.dirs.has(from)) throw new Error(`Not found: ${from}`);
    const move = (p: string) => join(to, p.slice(from.length + 1));
    for (const d of [...this.dirs]) {
      if (d === from || d.startsWith(from + "/")) {
        this.dirs.delete(d);
        this.dirs.add(d === from ? to : move(d));
      }
    }
    for (const [f, content] of [...this.files]) {
      if (f.startsWith(from + "/")) {
        this.files.delete(f);
        this.files.set(move(f), content);
      }
    }
    let dir = dirname(to);
    while (dir !== "" && !this.dirs.has(dir)) {
      this.dirs.add(dir);
      dir = dirname(dir);
    }
  }

  async mkdir(path: string): Promise<void> {
    let dir = path;
    while (dir !== "" && !this.dirs.has(dir)) {
      this.dirs.add(dir);
      dir = dirname(dir);
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.dirs.has(path);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
    this.bytes.delete(path);
    for (const d of [...this.dirs]) if (d === path || d.startsWith(path + "/")) this.dirs.delete(d);
    for (const f of [...this.files.keys()]) if (f.startsWith(path + "/")) this.files.delete(f);
  }
}
