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
import { NoteIndex } from "./notes";
import { basename, dirname, extname, isMarkdown, isWithin, join, rebase, stripExt } from "./path";
import {
  defaultFolders,
  defaultSettings,
  knownFolders,
  parseSettings,
  serializeSettings,
  SETTINGS_FILE,
  type NoteType,
  type NovelSettings,
} from "./settings";
import { snapshotDir, takeSnapshot } from "./snapshots";
import { rewriteLinks } from "./wikilinks";

/** Folders never scanned: app data, other tools' data, version control. */
const SKIPPED = new Set([".dante", ".obsidian", ".git", ".trash", "node_modules"]);
const TRASH = ".trash";

interface Move {
  from: string;
  to: string;
}

export class Project {
  settings: NovelSettings = defaultSettings();
  manuscript!: ManuscriptNode;
  /** Every file in the project, for link resolution. */
  files: string[] = [];
  /** Folders in the project, for the file trees of the sections. */
  folders: string[] = [];
  /** Scenes already copied to a snapshot in this session. */
  private snapshotted = new Set<string>();
  private indexing: Promise<NoteIndex> | null = null;

  /**
   * @param language Language of a project that has no settings file yet, usually the
   * interface language: it names the folders and the chapter labels.
   */
  constructor(
    public fs: ProjectFs,
    public language = "en",
  ) {}

  /**
   * Sets up a new project in an empty folder: settings, the section folders, and a
   * first chapter with a first scene.
   */
  static async create(
    fs: ProjectFs,
    details: { title: string; author: string; language: string },
    names: { chapter: string; scene: string },
    /** Headings and export choices to start from, such as those used last on this computer. */
    preferences?: Pick<NovelSettings, "structure"> & Pick<NovelSettings["export"], "docx" | "typography" | "revisions">,
  ): Promise<{ project: Project; scene: string }> {
    await fs.mkdir("");
    const settings = { ...defaultSettings(details.language), title: details.title, author: details.author };
    if (preferences) {
      // Through the parser, so stored choices from an older version are completed and checked.
      const merged = parseSettings(
        serializeSettings({ ...settings, structure: preferences.structure, export: { ...settings.export, docx: preferences.docx, typography: preferences.typography, revisions: preferences.revisions } }),
      );
      // Labels follow the new novel's language, and parts are a choice for each novel.
      const { structure, export: exp } = settings;
      settings.structure = {
        ...merged.structure,
        parts: structure.parts,
        part: { ...merged.structure.part, label: structure.part.label },
        chapter: { ...merged.structure.chapter, label: structure.chapter.label },
      };
      settings.export = {
        ...exp,
        docx: { ...merged.export.docx, scene: { ...merged.export.docx.scene, label: exp.docx.scene.label } },
        typography: merged.export.typography,
        revisions: merged.export.revisions,
      };
    }
    await fs.writeText(SETTINGS_FILE, serializeSettings(settings));
    for (const folder of Object.values(settings.folders)) await fs.mkdir(folder);
    const project = await Project.open(fs, details.language);
    const chapter = await project.createContainer(project.manuscript.path, 0, names.chapter);
    const scene = await project.createScene(chapter, 0, names.scene);
    return { project, scene };
  }

  static async open(fs: ProjectFs, language = "en"): Promise<Project> {
    const project = new Project(fs, language);
    await project.reload();
    return project;
  }

  async reload(): Promise<void> {
    this.settings = (await this.fs.exists(SETTINGS_FILE))
      ? parseSettings(await this.fs.readText(SETTINGS_FILE))
      : defaultSettings(this.language);
    // A project that already has the English folders, or older names, keeps them.
    const localized = defaultFolders(this.settings.language);
    for (const key of Object.keys(localized) as (keyof NovelSettings["folders"])[]) {
      const name = this.settings.folders[key];
      if (name !== localized[key] || (await this.fs.exists(name))) continue;
      for (const other of knownFolders(key)) {
        if (other !== name && (await this.fs.exists(other))) {
          this.settings.folders[key] = other;
          break;
        }
      }
    }
    this.manuscript = await loadManuscript(this.fs, this.settings);
    const folders: string[] = [];
    this.files = await this.scan("", folders);
    this.folders = folders;
    this.indexing = null;
  }

  private async scan(dir: string, folders: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await this.fs.list(dir)) {
      if (entry.isDir) {
        if (SKIPPED.has(entry.name)) continue;
        folders.push(entry.path);
        out.push(...(await this.scan(entry.path, folders)));
      } else if (!entry.name.includes(".dante-tmp") && !entry.name.startsWith(".dante-move-") && entry.name !== ".DS_Store") {
        out.push(entry.path);
      }
    }
    return out;
  }

  /** What every note says and links to; read on first use after each reload. */
  index(): Promise<NoteIndex> {
    this.indexing ??= NoteIndex.build(this.fs, this.files, this.settings.folders.manuscript);
    return this.indexing;
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
    await this.writeNote(path, replaceBody(text, body));
  }

  /** Writes a whole note, keeping the link index current. */
  async writeNote(path: string, text: string): Promise<void> {
    await this.fs.writeText(path, text);
    if (this.indexing) (await this.indexing).set(path, text);
  }

  // Notes and files outside the manuscript: Codex, Research, Laboratory and the rest.

  /** A file name in `dir` not taken yet: "Name.md", then "Name 2.md" and so on. */
  private async freeName(dir: string, name: string): Promise<string> {
    const ext = extname(name);
    const stem = ext ? name.slice(0, -ext.length) : name;
    let candidate = join(dir, name);
    for (let n = 2; await this.fs.exists(candidate); n++) candidate = join(dir, `${stem} ${n}${ext}`);
    return candidate;
  }

  /** Creates a note in `dir` and returns its path. */
  async createNote(dir: string, title: string, text = ""): Promise<string> {
    const name = (sanitizeTitle(title) || "Untitled") + ".md";
    const path = await this.freeName(dir, name);
    await this.fs.writeText(path, text);
    await this.reload();
    return path;
  }

  async createFolder(dir: string, name: string): Promise<string> {
    const path = await this.freeName(dir, sanitizeTitle(name) || "Untitled");
    await this.fs.mkdir(path);
    await this.reload();
    return path;
  }

  /**
   * A new note of a type, in the type's Codex folder, from the type's template when
   * there is one: `<Templates>/<type name>.md`, where {{title}} and {{date}} are filled in.
   */
  async createTyped(typeId: string, title: string): Promise<string> {
    const type = this.settings.types[typeId];
    if (!type) throw new Error(`Unknown type: ${typeId}`);
    const dir = join(this.settings.folders.codex, type.folder);
    const template = this.templatePath(typeId);
    let text: string;
    if (await this.fs.exists(template)) {
      const clean = sanitizeTitle(title) || "Untitled";
      const date = new Date().toISOString().slice(0, 10);
      text = (await this.fs.readText(template)).replace(/\{\{\s*title\s*\}\}/g, clean).replace(/\{\{\s*date\s*\}\}/g, date);
    } else {
      text = this.typeSkeleton(typeId);
    }
    // The type is written down, so the note keeps it wherever it is moved.
    if (readProperties(text).type === undefined) text = writeProperties(text, { type: typeId });
    return this.createNote(dir, title, text);
  }

  /** Adds, changes or (with null) removes a note type. Notes keep what they say. */
  async setType(id: string, type: NoteType | null): Promise<void> {
    const settings = structuredClone(this.settings);
    if (type) settings.types[id] = type;
    else delete settings.types[id];
    await this.saveSettings(settings);
  }

  /** An id for a new type, from its name: "Ship" becomes "ship", "Navi spaziali" "navi-spaziali". */
  typeId(name: string): string {
    const base = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "type";
    let id = base;
    for (let n = 2; id in this.settings.types; n++) id = `${base}-${n}`;
    return id;
  }

  templatePath(typeId: string): string {
    return join(this.settings.folders.templates, `${this.settings.types[typeId]?.name ?? typeId}.md`);
  }

  /** The starting text of a type without a template: its type and suggested properties. */
  private typeSkeleton(typeId: string): string {
    const properties: Properties = { type: typeId };
    for (const key of this.settings.types[typeId]?.properties ?? []) properties[key] = key === "aliases" ? [] : "";
    return writeProperties("", properties) + "\n";
  }

  /** Opens the type's template, creating it from the suggested properties if needed. */
  async ensureTemplate(typeId: string): Promise<string> {
    const path = this.templatePath(typeId);
    if (!(await this.fs.exists(path))) {
      await this.fs.writeText(path, this.typeSkeleton(typeId));
      await this.reload();
    }
    return path;
  }

  /** Renames a note, file or folder in place, keeping its extension, and fixes links. */
  async renamePath(path: string, name: string): Promise<string> {
    const ext = this.files.includes(path) ? extname(path) : "";
    const clean = sanitizeTitle(ext && name.toLowerCase().endsWith(ext.toLowerCase()) ? stripExt(name) : name);
    if (clean === "") return path;
    const to = join(dirname(path), clean + ext);
    if (to === path) return path;
    if (to.toLowerCase() !== path.toLowerCase() && (await this.fs.exists(to))) throw new Error(`Already exists: ${clean + ext}`);
    await this.apply([{ from: path, to }]);
    return to;
  }

  /**
   * Renames one of the project's own folders, such as an old Codex folder to the name the
   * project's language gives it, fixing links and recording the new name in the settings.
   */
  async renameSectionFolder(key: keyof NovelSettings["folders"], name: string): Promise<string> {
    const from = this.settings.folders[key];
    if (!(await this.fs.exists(from))) throw new Error(`Missing folder: ${from}`);
    const to = await this.renamePath(from, name);
    await this.saveSettings({ ...this.settings, folders: { ...this.settings.folders, [key]: to } });
    return to;
  }

  /** Moves a note, file or folder into `dir`, and fixes links. */
  async movePath(path: string, dir: string): Promise<string> {
    if (isWithin(dir, path)) throw new Error("Cannot move an item into itself");
    if (dirname(path) === dir) return path;
    const to = await this.freeName(dir, basename(path));
    await this.apply([{ from: path, to }]);
    return to;
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
    // In its new place the item may need another title, so it is not taken for a folder note.
    const clash = parent.kind !== "manuscript" && parent.title.toLowerCase() === node.title.toLowerCase();
    const moved = clash ? { ...node, title: this.uniqueTitle(parent, node.title, path) } : node;
    const sequence = [...siblings.slice(0, clamped), moved, ...siblings.slice(clamped)];
    // The moved item gets a new number; its siblings keep theirs where they can.
    const orders = assignOrders(sequence.map((n) => (n === moved ? null : n.order)));
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

  /**
   * Moves a scene, chapter, part, note, file or folder to the project's .trash folder,
   * where Obsidian keeps deleted notes too, so it can be recovered. Returns where it went.
   */
  async trash(path: string): Promise<string> {
    const target = await this.freeName(TRASH, basename(path));
    await this.fs.mkdir(TRASH);
    await this.fs.rename(path, target);
    await this.reload();
    return target;
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

  /**
   * A title not used by the item's siblings nor by its container: a child named like its
   * folder would be read as the folder note. A renamed container also avoids its
   * children's titles.
   */
  private uniqueTitle(parent: ManuscriptNode, title: string, except?: string): string {
    const taken = new Set(parent.children.filter((c) => c.path !== except).map((c) => c.title.toLowerCase()));
    if (parent.kind !== "manuscript") taken.add(parent.title.toLowerCase());
    const self = except ? findNode(this.manuscript, except) : null;
    for (const child of self?.children ?? []) taken.add(child.title.toLowerCase());
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

