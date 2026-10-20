import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeSet, Text } from "@codemirror/state";
import { DocumentStore, RETRY_DELAY, SAVE_DELAY, type DocumentFiles, type Peer } from "../../editor/documents";

/** An editor reduced to its text. */
class FakeEditor implements Peer {
  doc: Text;
  constructor(text: string) {
    this.doc = Text.of(text.split("\n"));
  }
  get text() {
    return this.doc.toString();
  }
  receive(changes: ChangeSet) {
    this.doc = changes.apply(this.doc);
  }
  reset(text: string) {
    this.doc = Text.of(text.split("\n"));
  }
  /** Types `insert` at `at` and returns the change, as an editor would report it. */
  type(at: number, insert: string): ChangeSet {
    const changes = ChangeSet.of({ from: at, insert }, this.doc.length);
    this.doc = changes.apply(this.doc);
    return changes;
  }
}

function files(initial: Record<string, string>) {
  const disk = new Map(Object.entries(initial));
  const writes: string[] = [];
  const snapshots: string[] = [];
  const io: DocumentFiles = {
    read: async (path) => {
      const text = disk.get(path);
      if (text === undefined) throw new Error("missing");
      return text;
    },
    write: async (path, _raw, text) => {
      writes.push(text);
      disk.set(path, text);
    },
    exists: async (path) => disk.has(path),
    snapshot: async (path) => {
      snapshots.push(path);
    },
  };
  return { disk, writes, snapshots, io };
}

describe("files open in several editors", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the text when a write fails, says so and writes it again", async () => {
    const f = files({ "a.md": "One" });
    const doc = new DocumentStore(f.io).get("a.md");
    const one = new FakeEditor(await doc.text());
    doc.join(one);
    const write = f.io.write;
    f.io.write = async () => {
      throw new Error("EACCES");
    };
    doc.edited(one, one.type(3, "!"), one.text);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);
    expect(doc.failed).toBe(true);
    expect(f.disk.get("a.md")).toBe("One");
    f.io.write = write;
    await vi.advanceTimersByTimeAsync(RETRY_DELAY);
    expect(doc.failed).toBe(false);
    expect(f.disk.get("a.md")).toBe("One!");
  });

  it("reads the file again for an editor that comes after one closed before joining", async () => {
    const f = files({ "a.md": "v1" });
    const store = new DocumentStore(f.io);
    await store.get("a.md").text();
    f.disk.set("a.md", "v2");
    await store.refreshAll();
    expect(await store.get("a.md").text()).toBe("v2");
  });

  it("shares what is typed and writes it once", async () => {
    const f = files({ "a.md": "Hello" });
    const store = new DocumentStore(f.io);
    const doc = store.get("a.md");
    const one = new FakeEditor(await doc.text());
    doc.join(one);
    // The second editor starts from the first one's text, not from the disk.
    one.doc = Text.of(["Hello!"]);
    const two = new FakeEditor(await store.get("a.md").text());
    expect(two.text).toBe("Hello!");
    one.doc = Text.of(["Hello"]);
    two.doc = Text.of(["Hello"]);
    store.get("a.md").join(two);

    doc.edited(one, one.type(5, " world"), one.text);
    expect(two.text).toBe("Hello world");
    doc.edited(two, two.type(0, "Oh. "), two.text);
    expect(one.text).toBe("Oh. Hello world");

    expect(f.writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);
    expect(f.writes).toEqual(["Oh. Hello world"]);
  });

  it("takes a snapshot before the first change of a scene", async () => {
    const f = files({ "s.md": "Text" });
    const doc = new DocumentStore(f.io).get("s.md");
    doc.snapshots = true;
    const one = new FakeEditor(await doc.text());
    doc.join(one);
    doc.edited(one, one.type(4, "!"), one.text);
    doc.edited(one, one.type(5, "!"), one.text);
    await doc.flush();
    expect(f.snapshots).toEqual(["s.md"]);
    expect(f.disk.get("s.md")).toBe("Text!!");
  });

  it("takes changes on disk, or reports a conflict when there are unsaved ones", async () => {
    const f = files({ "a.md": "One" });
    const doc = new DocumentStore(f.io).get("a.md");
    const one = new FakeEditor(await doc.text());
    const two = new FakeEditor(await doc.text());
    doc.join(one);
    doc.join(two);
    f.disk.set("a.md", "Two");
    await doc.refresh();
    expect([one.text, two.text]).toEqual(["Two", "Two"]);

    doc.edited(one, one.type(3, "!"), one.text);
    f.disk.set("a.md", "Three");
    let told = 0;
    doc.watch(() => told++);
    await doc.refresh();
    expect(doc.conflict).toBe(true);
    expect(told).toBe(1);
    expect(one.text).toBe("Two!");
    await doc.refresh(true);
    expect([one.text, two.text, doc.conflict]).toEqual(["Three", "Three", false]);
  });

  it("writes what is left when the last editor closes, unless the file is gone", async () => {
    const f = files({ "a.md": "One", "b.md": "Bee" });
    const store = new DocumentStore(f.io);
    const a = store.get("a.md");
    const one = new FakeEditor(await a.text());
    a.join(one);
    a.edited(one, one.type(3, "!"), one.text);
    a.leave(one);
    // Opened again before the write ends: it starts from the written text.
    expect(await store.get("a.md").text()).toBe("One!");

    const b = store.get("b.md");
    const two = new FakeEditor(await b.text());
    b.join(two);
    b.edited(two, two.type(3, "!"), two.text);
    f.disk.delete("b.md");
    b.leave(two);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY * 2);
    expect(f.disk.has("b.md")).toBe(false);
  });

  it("writes every open file before files move", async () => {
    const f = files({ "a.md": "A", "b.md": "B" });
    const store = new DocumentStore(f.io);
    for (const path of ["a.md", "b.md"]) {
      const doc = store.get(path);
      const editor = new FakeEditor(await doc.text());
      doc.join(editor);
      doc.edited(editor, editor.type(1, "+"), editor.text);
    }
    await store.flushAll();
    expect([f.disk.get("a.md"), f.disk.get("b.md")]).toEqual(["A+", "B+"]);
  });
});
