import { describe, expect, it } from "vitest";
import { BrowserFs, MOVE_JOURNAL } from "../../browserFs";

// A folder in memory shaped like the browser's handles, enough for BrowserFs.

let clock = 1000;

class FakeFile {
  kind = "file" as const;
  data: Uint8Array = new Uint8Array();
  modified = clock++;
  constructor(public name: string) {}
  async getFile() {
    return new File([this.data as BlobPart], this.name, { lastModified: this.modified });
  }
  async createWritable() {
    let pending: Uint8Array = new Uint8Array();
    return {
      write: async (chunk: string | Uint8Array) => {
        pending = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
      },
      close: async () => {
        this.data = pending;
        this.modified = clock++;
      },
      abort: async () => {},
    };
  }
}

class FakeDir {
  kind = "directory" as const;
  children = new Map<string, FakeFile | FakeDir>();
  constructor(public name: string) {}
  private get(name: string, kind: "file" | "directory", create?: boolean) {
    let child = this.children.get(name);
    if (!child) {
      if (!create) throw new DOMException("missing", "NotFoundError");
      child = kind === "file" ? new FakeFile(name) : new FakeDir(name);
      this.children.set(name, child);
    }
    if (child.kind !== kind) throw new DOMException("wrong kind", "TypeMismatchError");
    return child;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    return this.get(name, "file", options?.create);
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    return this.get(name, "directory", options?.create);
  }
  async removeEntry(name: string) {
    if (!this.children.delete(name)) throw new DOMException("missing", "NotFoundError");
  }
  async *entries() {
    yield* [...this.children.entries()];
  }
}

function make() {
  const root = new FakeDir("Romanzo");
  return { root, fs: new BrowserFs(root as unknown as FileSystemDirectoryHandle, "web:test") };
}

describe("BrowserFs", () => {
  it("writes, reads and lists files, creating folders", async () => {
    const { fs } = make();
    await fs.writeText("Manoscritto/010 Capitolo/010 Scena.md", "testo");
    expect(await fs.readText("Manoscritto/010 Capitolo/010 Scena.md")).toBe("testo");
    expect(await fs.list("Manoscritto")).toEqual([{ path: "Manoscritto/010 Capitolo", name: "010 Capitolo", isDir: true }]);
    await fs.writeBytes("Allegati/a.bin", new Uint8Array([1, 2, 3]));
    expect([...(await fs.readBytes("Allegati/a.bin"))]).toEqual([1, 2, 3]);
    expect(await fs.exists("Manoscritto/010 Capitolo")).toBe(true);
    expect(await fs.exists("Manoscritto/nulla.md")).toBe(false);
    expect(await fs.exists("")).toBe(true);
  });

  it("refuses paths that leave the folder", async () => {
    const { fs } = make();
    await expect(fs.readText("../segreto.md")).rejects.toThrow("Invalid path");
    await expect(fs.remove("")).rejects.toThrow();
  });

  it("renames files and folders, keeping what is inside", async () => {
    const { fs } = make();
    await fs.writeText("M/010 Uno/010 A.md", "a");
    await fs.writeText("M/010 Uno/020 B.md", "b");
    await fs.rename("M/010 Uno/020 B.md", "M/010 Uno/015 B.md");
    expect(await fs.readText("M/010 Uno/015 B.md")).toBe("b");
    await fs.rename("M/010 Uno", "M/020 Uno");
    expect(await fs.exists("M/010 Uno")).toBe(false);
    expect((await fs.list("M/020 Uno")).map((e) => e.name).sort()).toEqual(["010 A.md", "015 B.md"]);
    expect(await fs.exists(MOVE_JOURNAL)).toBe(false);
    await expect(fs.rename("M/020 Uno/010 A.md", "M/020 Uno/015 B.md")).rejects.toThrow("Already exists");
  });

  it("finishes a folder move interrupted while copying", async () => {
    const { fs } = make();
    await fs.writeText("M/010 Uno/010 A.md", "a");
    await fs.writeText("M/010 Uno/020 B.md", "b");
    // The copy stopped after the first file.
    await fs.writeText("M/020 Uno/010 A.md", "a");
    await fs.writeText(MOVE_JOURNAL, JSON.stringify({ from: "M/010 Uno", to: "M/020 Uno", phase: "copy" }));
    expect(await fs.recover()).toBe(true);
    expect(await fs.exists("M/010 Uno")).toBe(false);
    expect(await fs.readText("M/020 Uno/020 B.md")).toBe("b");
    expect(await fs.exists(MOVE_JOURNAL)).toBe(false);
    expect(await fs.recover()).toBe(false);
  });

  it("finishes a folder move interrupted while removing the original", async () => {
    const { fs } = make();
    await fs.writeText("M/010 Uno/020 B.md", "b");
    await fs.writeText("M/020 Uno/010 A.md", "a");
    await fs.writeText("M/020 Uno/020 B.md", "b");
    await fs.writeText(MOVE_JOURNAL, JSON.stringify({ from: "M/010 Uno", to: "M/020 Uno", phase: "remove" }));
    expect(await fs.recover()).toBe(true);
    expect(await fs.exists("M/010 Uno")).toBe(false);
    expect((await fs.list("M/020 Uno")).length).toBe(2);
  });

  it("reports only the changes made by others", async () => {
    const { fs, root } = make();
    await fs.writeText("M/010 A.md", "a");
    expect(await fs.changes()).toEqual([]);
    await fs.writeText("M/010 A.md", "a2");
    await fs.writeText(".dante/presence/luca.json", "{}");
    expect(await fs.changes()).toEqual([]);
    // Another program writes a scene, adds one and removes nothing.
    const m = (await root.getDirectoryHandle("M")) as FakeDir;
    const a = (await m.getFileHandle("010 A.md")) as FakeFile;
    a.data = new TextEncoder().encode("da Drive");
    a.modified = clock++;
    const b = (await m.getFileHandle("020 B.md", { create: true })) as FakeFile;
    b.data = new TextEncoder().encode("b");
    expect((await fs.changes()).sort()).toEqual(["M/010 A.md", "M/020 B.md"]);
    await m.removeEntry("020 B.md");
    expect(await fs.changes()).toEqual(["M/020 B.md"]);
    await fs.rename("M/010 A.md", "M/030 A.md");
    expect(await fs.changes()).toEqual([]);
  });

  it("names where a file is by the folder's name", () => {
    const { fs } = make();
    expect(fs.where("export/Rossi_Romanzo.docx")).toBe("Romanzo › export › Rossi_Romanzo.docx");
  });
});
