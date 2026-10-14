import type { ProjectFs } from "./fs";
import { readProperties, replaceBody, splitNote, writeProperties, type Properties } from "./frontmatter";
import {
  enclosing,
  findNode,
  folderNotePath,
  loadManuscript,
  parentOf,
  type ContainerKind,
  type ManuscriptNode,
} from "./manuscript";
import { assignOrders, formatName, sanitizeTitle } from "./naming";
import { basename, dirname, isMarkdown, join, rebase } from "./path";
import {
  defaultFolders,
  defaultSettings,
  ENGLISH_FOLDERS,
  parseSettings,
  serializeSettings,
  SETTINGS_FILE,
  type NovelSettings,
} from "./settings";
import { snapshotDir, takeSnapshot } from "./snapshots";
import { rewriteLinks } from "./wikilinks";

/** Folders never scanned: app data, other tools' data, version control. */
const SKIPPED = new Set([".dante", ".obsidian", ".git", ".trash", "node_modules"]);

interface Move {
  from: string;
  to: string;
}

export class Project {
  settings: NovelSettings = defaultSettings();
  manuscript!: ManuscriptNode;
  /** Every file in the project, for link resolution. */
  files: string[] = [];
  /** Scenes already copied to a snapshot in this session. */
  private snapshotted = new Set<string>();

  /**
   * @param language Language of a project that has no settings file yet, usually the
   * interface language: it names the folders and the chapter labels.
   */
  constructor(
    public fs: ProjectFs,
    public language = "en",
  ) {}

  static async open(fs: ProjectFs, language = "en"): Promise<Project> {
    const project = new Project(fs, language);
    await project.reload();
    return project;
  }

  async reload(): Promise<void> {
    this.settings = (await this.fs.exists(SETTINGS_FILE))
      ? parseSettings(await this.fs.readText(SETTINGS_FILE))
      : defaultSettings(this.language);
    // A project that already has the English folders keeps them, whatever its language.
    const localized = defaultFolders(this.settings.language);
    for (const key of Object.keys(localized) as (keyof NovelSettings["folders"])[]) {
      const name = this.settings.folders[key];
      if (name === localized[key] && name !== ENGLISH_FOLDERS[key] && !(await this.fs.exists(name)) && (await this.fs.exists(ENGLISH_FOLDERS[key]))) {
        this.settings.folders[key] = ENGLISH_FOLDERS[key];
      }
    }
    this.manuscript = await loadManuscript(this.fs, this.settings);
    this.files = await this.scan("");
  }

  private async scan(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await this.fs.list(dir)) {
      if (entry.isDir) {
        if (!SKIPPED.has(entry.name)) out.push(...(await this.scan(entry.path)));
      } else {
        out.push(entry.path);
      }
    }
    return out;
  }

  async saveSettings(settings: NovelSettings): Promise<void> {
    const previous = (await this.fs.exists(SETTINGS_FILE)) ? await this.fs.readText(SETTINGS_FILE) : "";
    await this.fs.writeText(SETTINGS_FILE, serializeSettings(settings, previous));
    await this.reload();
  }

  node(path: string): ManuscriptNode {
    const node = findNode(this.manuscript, path);
    if (!node) throw new Error(`Not in the manuscript: ${path}`);
    return node;
  }

  /** Snapshot taken before the first change to a scene in each session. */
  async autoSnapshot(path: string): Promise<void> {
    if (this.snapshotted.has(path)) return;
    this.snapshotted.add(path);
    await takeSnapshot(this.fs, path);
  }

  // Reading and writing notes

  async readBody(path: string): Promise<string> {
    return splitNote(await this.fs.readText(path)).body;
  }

  async writeBody(path: string, body: string): Promise<void> {
    const text = (await this.fs.exists(path)) ? await this.fs.readText(path) : "";
    await this.fs.writeText(path, replaceBody(text, body));
  }

  /** Properties of a scene, or of a container through its folder note. */
  async properties(path: string): Promise<Properties> {
    const file = this.propertiesFile(path);
    return (await this.fs.exists(file)) ? readProperties(await this.fs.readText(file)) : {};
  }

  async setProperties(path: string, changes: Properties): Promise<void> {
    const file = this.propertiesFile(path);
    const text = (await this.fs.exists(file)) ? await this.fs.readText(file) : "";
    await this.fs.writeText(file, writeProperties(text, changes));
    await this.reload();
  }

  private propertiesFile(path: string): string {
    const node = findNode(this.manuscript, path);
    return node && node.kind !== "scene" ? folderNotePath(path) : path;
  }

  // Structure changes. Each one renames as few files as possible and fixes the
  // wikilinks that pointed to anything it moved.

  /** Puts `path` at `index` among the children of `parentPath`. */
  async move(path: string, parentPath: string, index: number): Promise<string> {
    const node = this.node(path);
    const parent = this.node(parentPath);
    if (parentPath === path || parentPath.startsWith(path + "/")) throw new Error("Cannot move an item into itself");
    const siblings = parent.children.filter((c) => c.path !== path);
    const clamped = Math.max(0, Math.min(index, siblings.length));
    const sequence = [...siblings.slice(0, clamped), node, ...siblings.slice(clamped)];
    // The moved item gets a new number; its siblings keep theirs where they can.
    const orders = assignOrders(sequence.map((n) => (n === node ? null : n.order)));
    const moves = this.orderMovesFrom(parentPath, sequence, orders);
    await this.apply(moves);
    return this.movedPath(moves, path);
  }

  async rename(path: string, title: string): Promise<string> {
    const node = this.node(path);
    const clean = sanitizeTitle(title);
    if (clean === "" || clean === node.title) return path;
    const parent = parentOf(this.manuscript, path)!;
    const unique = this.uniqueTitle(parent, clean, path);
    const name = node.order === null ? unique : formatName(node.order, unique);
    const to = join(parent.path, node.kind === "scene" ? name + ".md" : name);
    await this.apply([{ from: path, to }]);
    return to;
  }

  async createScene(parentPath: string, index: number, title: string, body = ""): Promise<string> {
    const parent = this.node(parentPath);
    const clean = this.uniqueTitle(parent, sanitizeTitle(title) || "Untitled");
    return this.insertNew(parent, index, clean, async (path) => this.fs.writeText(path + ".md", body), ".md");
  }

  async createContainer(parentPath: string, index: number, title: string, kind?: ContainerKind): Promise<string> {
    const parent = this.node(parentPath);
    const clean = this.uniqueTitle(parent, sanitizeTitle(title) || "Untitled");
    return this.insertNew(parent, index, clean, async (path) => {
      await this.fs.mkdir(path);
      if (kind) await this.fs.writeText(folderNotePath(path), writeProperties("", { kind }));
    }, "");
  }

  /**
   * Splits a scene at the cursor: the scene keeps `before`, a new scene right after it
   * gets `after`. Returns the new scene's path.
   */
  async splitScene(path: string, before: string, after: string, title: string): Promise<string> {
    const parent = parentOf(this.manuscript, path)!;
    const index = parent.children.findIndex((c) => c.path === path);
    await this.writeBody(path, before);
    return this.createScene(parent.path, index + 1, title, after);
  }

  /**
   * Starts a new chapter at the cursor: the text after the cursor becomes the first
   * scene of a new chapter, followed by the scenes that came after this one.
   */
  async splitChapter(path: string, before: string, after: string, chapterTitle: string, sceneTitle: string): Promise<string> {
    const chapter = enclosing(this.manuscript, path, ["chapter", "prologue", "epilogue"]);
    // Without an enclosing chapter, the new chapter goes right after the scene itself.
    const holder = parentOf(this.manuscript, chapter ? chapter.path : path)!;
    const origin = chapter ?? holder;
    const sceneIndex = origin.children.findIndex((c) => c.path === path);
    let count = 0;
    while (origin.children[sceneIndex + 1 + count]?.kind === "scene") count++;
    const chapterIndex = holder.children.findIndex((c) => c.path === (chapter ?? this.node(path)).path);

    await this.writeBody(path, before);
    const newChapter = await this.createContainer(holder.path, chapterIndex + 1, chapterTitle);
    const first = await this.createScene(newChapter, 0, sceneTitle, after);
    // Renumbering can rename folders, so positions are looked up again at each step.
    let target = newChapter;
    for (let k = 0; k < count; k++) {
      const holderNow = this.node(holder.path);
      const originNow = chapter ? holderNow.children[chapterIndex] : holderNow;
      const nextIndex = chapter ? sceneIndex + 1 : sceneIndex + 2;
      const scene = originNow.children[nextIndex];
      target = holderNow.children[chapterIndex + 1].path;
      await this.move(scene.path, target, k + 1);
    }
    return count === 0 ? first : this.node(target).children[0].path;
  }

  private async insertNew(
    parent: ManuscriptNode,
    index: number,
    title: string,
    create: (pathWithoutExt: string) => Promise<void>,
    ext: string,
  ): Promise<string> {
    const placeholder = "\u0000new";
    const sequence = [...parent.children];
    const clamped = Math.max(0, Math.min(index, sequence.length));
    const fake: ManuscriptNode = {
      kind: ext ? "scene" : "chapter", path: placeholder, name: "", order: null, title, notePath: null, children: [],
    };
    sequence.splice(clamped, 0, fake);
    const orders = assignOrders(sequence.map((n) => n.order));
    const moves = this.orderMovesFrom(parent.path, sequence, orders).filter((m) => m.from !== placeholder);
    await this.apply(moves);
    const path = join(parent.path, formatName(orders[clamped], title));
    await create(path);
    await this.reload();
    return path + ext;
  }

  private uniqueTitle(parent: ManuscriptNode, title: string, except?: string): string {
    const taken = new Set(parent.children.filter((c) => c.path !== except).map((c) => c.title.toLowerCase()));
    if (!taken.has(title.toLowerCase())) return title;
    let n = 2;
    while (taken.has(`${title} ${n}`.toLowerCase())) n++;
    return `${title} ${n}`;
  }

  private orderMovesFrom(parentPath: string, sequence: ManuscriptNode[], orders: number[]): Move[] {
    const moves: Move[] = [];
    sequence.forEach((node, i) => {
      const name = formatName(orders[i], node.title) + (node.kind === "scene" ? ".md" : "");
      const to = join(parentPath, name);
      if (to !== node.path) moves.push({ from: node.path, to });
    });
    return moves;
  }

  private movedPath(moves: Move[], path: string): string {
    return moves.find((m) => m.from === path)?.to ?? path;
  }

  /** Performs renames, renames folder notes with their folders, then fixes wikilinks. */
  private async apply(moves: Move[]): Promise<void> {
    if (moves.length === 0) return;
    const before = [...this.files];

    // Two passes through temporary names, so that swapping two names never collides.
    const temps = moves.map((m, i) => join(dirname(m.from), `.dante-move-${i}-${basename(m.from)}`));
    for (let i = 0; i < moves.length; i++) await this.fs.rename(moves[i].from, temps[i]);
    for (let i = 0; i < moves.length; i++) await this.fs.rename(temps[i], moves[i].to);

    const renames = new Map<string, string>();
    for (const file of before) {
      let to = file;
      for (const m of moves) to = rebase(to, m.from, m.to);
      if (to !== file) renames.set(file, to);
    }
    for (const m of moves) {
      if (isMarkdown(m.from)) continue;
      const oldNote = join(m.to, basename(m.from) + ".md");
      const newNote = folderNotePath(m.to);
      if (oldNote !== newNote && (await this.fs.exists(oldNote))) {
        await this.fs.rename(oldNote, newNote);
        renames.set(folderNotePath(m.from), newNote);
      }
    }

    // Snapshots follow their scene, again through temporary names.
    const snapshotMoves: Move[] = [];
    for (const [from, to] of renames) {
      if (isMarkdown(from) && (await this.fs.exists(snapshotDir(from)))) {
        snapshotMoves.push({ from: snapshotDir(from), to: snapshotDir(to) });
      }
    }
    const snapshotTemps = snapshotMoves.map((m, i) => join(dirname(m.from), `.dante-move-${i}-${basename(m.from)}`));
    for (let i = 0; i < snapshotMoves.length; i++) await this.fs.rename(snapshotMoves[i].from, snapshotTemps[i]);
    for (let i = 0; i < snapshotMoves.length; i++) await this.fs.rename(snapshotTemps[i], snapshotMoves[i].to);

    const after = before.map((f) => renames.get(f) ?? f);
    for (const file of before) {
      if (!isMarkdown(file)) continue;
      const newPath = renames.get(file) ?? file;
      const text = await this.fs.readText(newPath);
      const updated = rewriteLinks(text, file, renames, before, after, newPath);
      if (updated !== null) await this.fs.writeText(newPath, updated);
    }
    await this.reload();
  }
}

