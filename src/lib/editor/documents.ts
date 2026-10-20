import type { ChangeSet } from "@codemirror/state";

/**
 * One editor showing an open file. Several editors can show the same file, as when a scene
 * is open in the manuscript and in a pane beside it: what is typed in one reaches the others.
 */
export interface Peer {
  /** The editor's text now. */
  readonly text: string;
  /** Applies what was typed in another editor of the same file. */
  receive(changes: ChangeSet): void;
  /** Takes the file's text, as after a change on disk. */
  reset(text: string): void;
}

/** How the documents read and write their files. */
export interface DocumentFiles {
  /** The text an editor shows: the note's body, or the whole file in the raw view. */
  read(path: string, raw: boolean): Promise<string>;
  write(path: string, raw: boolean, text: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Called once before the first change to a scene is written. */
  snapshot(path: string): Promise<void>;
}

/** How long typing has to stop before the text is written. */
export const SAVE_DELAY = 600;
/** How long to wait before writing again after a write failed. */
export const RETRY_DELAY = 5000;

/**
 * A file open in one or more editors. It keeps the text that is not written yet, writes it
 * a moment after typing stops, and takes changes made on disk by others, so that every
 * editor of the file saves through the same place and none overwrites another's text.
 */
export class OpenDocument {
  private peers = new Set<Peer>();
  private lastSaved = "";
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private snapshotting: Promise<void> | null = null;
  private loading: Promise<string> | null = null;
  private refreshing: Promise<void> | null = null;
  /** The last editor closed and the text left is being written. */
  private closing: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private savedListeners = new Set<(text: string) => void>();
  /** Takes an automatic snapshot before the first change, as scenes do. */
  snapshots = false;
  /** The text on disk changed while this one had unsaved changes. */
  conflict = false;
  /** The last write failed, as when the folder is gone or read-only: the text is kept and written again. */
  failed = false;

  constructor(
    private store: DocumentStore,
    readonly path: string,
    readonly raw: boolean,
  ) {}

  /** The text a new editor starts with: the one already open, or the file's. */
  text(): Promise<string> {
    const open = this.peers.values().next().value;
    if (open) return Promise.resolve(open.text);
    this.loading ??= (this.closing ?? Promise.resolve()).then(() => this.store.files.read(this.path, this.raw)).then(
      (text) => {
        this.lastSaved = text;
        // An editor closed before joining must not leave this text for the next one.
        queueMicrotask(() => (this.loading = null));
        return text;
      },
      (e) => {
        this.loading = null;
        throw e;
      },
    );
    return this.loading;
  }

  join(peer: Peer) {
    this.peers.add(peer);
  }

  /** An editor closed; the last one to close writes what is left and forgets the file. */
  leave(peer: Peer) {
    this.peers.delete(peer);
    if (this.peers.size) return;
    this.loading = null;
    if (this.pending === null) {
      this.store.forget(this);
      return;
    }
    // Saving after the file was moved away would recreate it under its old name.
    this.closing = this.store.files
      .exists(this.path)
      .then((exists) => (exists ? this.save() : this.cancel()))
      .catch(() => {})
      .finally(() => {
        this.closing = null;
        if (!this.peers.size) this.store.forget(this);
      });
  }

  /** Something was typed in `from`: the other editors take it, and the text is saved soon. */
  edited(from: Peer, changes: ChangeSet, text: string) {
    for (const peer of this.peers) if (peer !== from) peer.receive(changes);
    if (this.snapshots) this.snapshotting ??= this.store.files.snapshot(this.path).catch(() => {});
    this.pending = text;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save().catch(() => {}), SAVE_DELAY);
  }

  /** Writes the text not saved yet, now. */
  flush(): Promise<void> {
    return this.save();
  }

  /** Drops the text not saved yet, for operations that rewrite the file themselves. */
  cancel() {
    clearTimeout(this.timer);
    this.pending = null;
  }

  private async save() {
    clearTimeout(this.timer);
    if (this.pending === null) return;
    // The session's first snapshot must hold the text from before this change.
    await this.snapshotting;
    const text = this.pending;
    if (text === null) return;
    this.pending = null;
    try {
      await this.store.files.write(this.path, this.raw, text);
    } catch (e) {
      // Kept, unless newer text came meanwhile, and tried again in a while.
      this.pending ??= text;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.save().catch(() => {}), RETRY_DELAY);
      this.setFailed(true);
      throw e;
    }
    this.setFailed(false);
    this.lastSaved = text;
    for (const listener of this.savedListeners) listener(text);
  }

  /** Reads the file again after a change on disk; `force` drops unsaved changes. */
  refresh(force = false): Promise<void> {
    if (force) return this.load(true);
    this.refreshing ??= this.load(false).finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async load(force: boolean) {
    if (!this.peers.size) return;
    let disk: string;
    try {
      disk = await this.store.files.read(this.path, this.raw);
    } catch {
      return; // Renamed or deleted: the editors close with the reload.
    }
    if (disk === this.lastSaved && !force) return;
    if (this.pending !== null && !force) {
      this.setConflict(true);
      return;
    }
    this.cancel();
    for (const peer of this.peers) peer.reset(disk);
    this.lastSaved = disk;
    this.setConflict(false);
  }

  private setFailed(value: boolean) {
    if (this.failed === value) return;
    this.failed = value;
    for (const listener of this.listeners) listener();
  }

  private setConflict(value: boolean) {
    if (this.conflict === value) return;
    this.conflict = value;
    for (const listener of this.listeners) listener();
  }

  /** Called when `conflict` or `failed` changes; returns the function that stops it. */
  watch(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called after each save with the saved text; returns the function that stops it. */
  onSaved(listener: (text: string) => void): () => void {
    this.savedListeners.add(listener);
    return () => this.savedListeners.delete(listener);
  }

  get editors(): number {
    return this.peers.size;
  }
}

/** The files open in editors, one document per file and view (body or raw). */
export class DocumentStore {
  private open = new Map<string, OpenDocument>();

  constructor(readonly files: DocumentFiles) {}

  get(path: string, raw = false): OpenDocument {
    const key = `${raw ? "raw" : "body"}|${path}`;
    let doc = this.open.get(key);
    if (!doc) {
      doc = new OpenDocument(this, path, raw);
      this.open.set(key, doc);
    }
    return doc;
  }

  forget(doc: OpenDocument) {
    const key = `${doc.raw ? "raw" : "body"}|${doc.path}`;
    if (this.open.get(key) === doc) this.open.delete(key);
  }

  /** Writes every unsaved change, before files are moved or renamed. */
  async flushAll(): Promise<void> {
    await Promise.all([...this.open.values()].map((d) => d.flush()));
  }

  /** Every open document reads its file again. */
  async refreshAll(): Promise<void> {
    await Promise.all([...this.open.values()].map((d) => d.refresh()));
  }
}
