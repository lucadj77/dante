import type { ProjectFs } from "./fs";
import { readProperties, renameProperty, replaceBody, splitNote, writeProperties, type Properties } from "./frontmatter";
import {
  enclosing,
  findNode,
  folderNotePath,
  GOAL,
  loadManuscript,
  NUMBERED,
  parentOf,
  scenesOf,
  SYNOPSIS,
  TITLE,
  type ContainerKind,
  type ManuscriptNode,
} from "./manuscript";
import { assignOrders, formatName, parseName, sanitizeTitle } from "./naming";
import { NoteIndex } from "./notes";
import { basename, dirname, extname, isMarkdown, isWithin, join, rebase, stripExt } from "./path";
import {
  defaultFolders,
  defaultSettings,
  defaultTypes,
  knownFolders,
  parseSettings,
  projectStatus,
  sceneTemplateName,
  serializeSettings,
  SETTINGS_FILE,
  statusProperty,
  type NoteType,
  type NovelSettings,
} from "./settings";
import { restoreSnapshot, snapshotDir, takeSnapshot } from "./snapshots";
import { moveHistory } from "./history";
import { textStats } from "./stats";
import { addToList, newParagraphText, relabel, removeFromList, setParagraphFields, type ParagraphChanges } from "./gamebook/edit";
import { fixArticles } from "./gamebook/articles";
import type { GamebookIndex } from "./gamebook/paragraphs";
import { gamebookOf } from "./gamebook/marks";
import { graphNote, graphNotePath, mermaidGraph } from "./gamebook/graph";

/** Where the operations on a whole gamebook are recorded, to undo them. */
const OPERATIONS = ".dante/gamebook/operations.json";

export interface GamebookOperation {
  id: string;
  /** The name of the snapshots it took, such as "Prima del rimescolamento". */
  name: string;
  date: string;
  /** Each file it changed, with the snapshot of it taken before. */
  files: { path: string; snapshot: string }[];
  /** The paragraphs' numbers before it, by path. */
  numbers: Record<string, number>;
}
import type { TextSize } from "./sessions";
import { rewriteLinks } from "./wikilinks";
import { findConflicts, mergeAsRevisions, type ConflictCopy } from "./conflicts";
import { today } from "./critic";
import { isView, parseView, serializeView, starterViews, VIEW_EXT, type ViewSpec } from "./views";
import type { ImportedBook } from "./import/structure";
import type { ImportedNote } from "./import/scrivener";
import { coverFor, type CoverSettings } from "./cover";
import { EXPORT_FOLDER } from "./export/files";
import { attachmentsFolderName, safeFileName } from "./images";
import { deleteFromTrash, noteTrashed, restoreFromTrash, TRASH, type TrashItem } from "./trash";
import { bodyOf, findIn, occurrences, replaceIn, type FindOptions, type Occurrence, type Range } from "./replace";

const NO_TEXT: TextSize = { words: 0, characters: 0 };
const sizeOf = (body: string): TextSize => {
  const stats = textStats(body);
  return { words: stats.words, characters: stats.characters };
};

/** The matches of a search in one note. */
export interface NoteMatches {
  path: string;
  occurrences: Occurrence[];
}

/** What a replacement changed, to put it back: each note's whole text before and after. */
export interface Replaced {
  count: number;
  notes: { path: string; before: string; after: string }[];
}

/** Folders never scanned: app data, other tools' data, version control. */
// Exports are copies of the novel: kept out of links, searches and statistics.
/** Properties Dante reads by their name, which keep it. */
export const RESERVED_PROPERTIES = [TITLE, SYNOPSIS, GOAL, NUMBERED, "kind", "type", "aliases", "published_title"];

/** Whether a property may take another name: not one Dante reads by name, nor the stage of work. */
export function canRenameProperty(settings: NovelSettings, name: string): boolean {
  const lower = name.trim().toLowerCase();
  return !!lower && !RESERVED_PROPERTIES.includes(lower) && lower !== projectStatus(settings).name.toLowerCase();
}

const SKIPPED = new Set([".dante", ".obsidian", ".git", ".trash", "node_modules", EXPORT_FOLDER]);

/** The reordering under way, kept on disk until it is finished. */
const MOVE_JOURNAL = ".dante/moves.json";
/** The project's id, under which this computer keeps what belongs to it, such as its own look. */
const ID_FILE = ".dante/id";
interface MoveJournal {
  /** Every file of the project before the moves, for the links. */
  before: string[];
  moves: Move[];
  /** The snapshots' folders that follow their scenes, once known. */
  snapshots?: Move[];
  /** The steps completed: "files", "snapshots", "history". */
  done: string[];
}
const tempName = (m: Move, i: number) => join(dirname(m.from), `.dante-move-${i}-${basename(m.from)}`);

/** Scenes cannot be merged while one of them has a conflict copy to settle. */
export class MergeConflictError extends Error {
  constructor(public path: string) {
    super(`Settle the conflict copy of ${path} first`);
  }
}

interface Move {
  from: string;
  to: string;
}

/** Where a group of imported notes goes: a type of the Story Bible, Research, the Laboratory, or nowhere. */
export type NoteDestination = `codex:${string}` | "research" | "laboratory" | "skip";

/**
 * The likely place of a group of notes: a folder named as a type of the Story Bible, in
 * any of Dante's languages, by its name or its folder, goes there; the rest into Research.
 */
export function noteDestination(types: Record<string, NoteType>, group: string, research = false): NoteDestination {
  if (research) return "research";
  const wanted = group.trim().toLowerCase();
  for (const [id, type] of Object.entries(types)) {
    const names = [type.name, type.folder, ...["en", "it", "es", "fr"].flatMap((l) => {
      const known = defaultTypes(l)[id];
      return known ? [known.name, known.folder] : [];
    })];
    if (names.some((n) => n.toLowerCase() === wanted)) return `codex:${id}`;
  }
  return "research";
}

export class Project {
  settings: NovelSettings = defaultSettings();
  manuscript!: ManuscriptNode;
  /** Every file in the project, for link resolution. */
  files: string[] = [];
  /** Folders in the project, for the file trees of the sections. */
  folders: string[] = [];
  /** Copies made by a sync service when a file changed in two places. */
  conflicts: ConflictCopy[] = [];
  /** Scenes already copied to a snapshot in this session. */
  private snapshotted = new Set<string>();
  private indexing: Promise<NoteIndex> | null = null;
  /** Set when opening found a reordering cut short: it was undone, or brought to its end. */
  recovered: "undone" | "completed" | null = null;
  /** The id this computer keeps the project's own things under; "" until one is needed. */
  id = "";

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
    details: { title: string; subtitle?: string; authors: string[]; language: string; cover?: CoverSettings; coverImage?: { name: string; data: Uint8Array } },
    /** Names of the first chapter and scene; null starts an empty manuscript, as an import does. */
    names: { chapter: string; scene: string } | null,
    /** Headings and export choices to start from, such as those used last on this computer. */
    preferences?: Pick<NovelSettings, "structure"> & Pick<NovelSettings["export"], "docx" | "typography" | "revisions">,
    /** Names of the starting views, a board and a table of the scenes; none are made without. */
    views?: { board: string; scenes: string },
  ): Promise<{ project: Project; scene: string }> {
    await fs.mkdir("");
    const settings = { ...defaultSettings(details.language), title: details.title, subtitle: details.subtitle?.trim() ?? "", authors: details.authors.map((a) => a.trim()).filter(Boolean), cover: details.cover ?? coverFor(details.title) };
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
        // Dialogue keeps the marks typed in each new novel: a convention chosen for another book does not carry over.
        typography: { ...merged.export.typography, quotes: exp.typography.quotes },
        revisions: merged.export.revisions,
      };
    }
    await fs.writeText(SETTINGS_FILE, serializeSettings(settings));
    for (const folder of Object.values(settings.folders)) await fs.mkdir(folder);
    const project = await Project.open(fs, details.language);
    // The cover's picture goes among the attachments, as one chosen later in the settings does.
    if (details.coverImage) {
      const image = await project.addAttachment(details.coverImage.name, details.coverImage.data);
      await project.saveSettings({ ...project.settings, cover: { ...project.settings.cover, image } });
    }
    if (views) for (const [name, view] of starterViews(statusProperty(settings.language), views, settings.goals.unit)) await project.createView(name, view);
    if (!names) return { project, scene: "" };
    const chapter = await project.createContainer(project.manuscript.path, 0, names.chapter);
    const scene = await project.createScene(chapter, 0, names.scene);
    return { project, scene };
  }

  static async open(fs: ProjectFs, language = "en"): Promise<Project> {
    const project = new Project(fs, language);
    try {
      project.recovered = await project.recoverMoves();
    } catch {
      // A folder that cannot be written now opens all the same: the journal waits for next time.
    }
    await project.reload();
    try {
      if (await fs.exists(ID_FILE)) project.id = (await fs.readText(ID_FILE)).trim();
    } catch {
      // No id: the project follows the look of the computer.
    }
    return project;
  }

  /**
   * A name for this project that stays when its folder is moved or renamed, written in the
   * project the first time something on this computer is kept under it.
   */
  async ensureId(): Promise<string> {
    if (!this.id) {
      const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
      await this.fs.writeText(ID_FILE, id + "\n");
      this.id = id;
    }
    return this.id;
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
    this.conflicts = findConflicts(this.files);
    this.indexing = null;
  }

  private async scan(dir: string, folders: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await this.fs.list(dir)) {
      if (entry.isDir) {
        // Only in the project's own folder: a folder of notes may be called "export" too.
        if (dir === "" && SKIPPED.has(entry.name)) continue;
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

  /** Called before files are moved or renamed, to write what the editors still hold. */
  beforeMove: (() => Promise<void>) | null = null;

  /** Called after files were moved or renamed, with where any old path went. */
  onMoved: ((moved: (path: string) => string) => void) | null = null;

  /** Called after a scene is written, with its words and characters before and after, for the writing log. */
  onSceneWritten: ((path: string, before: TextSize, after: TextSize) => void) | null = null;

  /** Writes a whole note, keeping the link index current. */
  async writeNote(path: string, text: string): Promise<void> {
    const scene = this.onSceneWritten && isMarkdown(path) && isWithin(path, this.settings.folders.manuscript);
    const before = scene && (await this.fs.exists(path)) ? sizeOf(splitNote(await this.fs.readText(path)).body) : NO_TEXT;
    await this.fs.writeText(path, text);
    if (scene) this.onSceneWritten?.(path, before, sizeOf(splitNote(text).body));
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

  /** Copies a file from the computer into `dir`, keeping its name unless taken; returns its path. */
  async importFile(dir: string, name: string, data: Uint8Array): Promise<string> {
    await this.fs.mkdir(dir);
    const path = await this.freeName(dir, safeFileName(name));
    await this.fs.writeBytes(path, data);
    return path;
  }

  /**
   * Saves an image added from the editor and returns its path: in the attachments folder
   * inside Research, where the material gathered for the novel lives.
   */
  async addAttachment(name: string, data: Uint8Array): Promise<string> {
    const dir = join(this.settings.folders.research, attachmentsFolderName(this.settings.language));
    await this.fs.mkdir(dir);
    const path = await this.freeName(dir, safeFileName(name));
    await this.fs.writeBytes(path, data);
    // The new file is known at once, so links to it resolve and the Notes tree shows its folder,
    // without reading the project again.
    this.files.push(path);
    if (!this.folders.includes(dir)) this.folders.push(dir);
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
      text = fillTemplate(await this.fs.readText(template), title);
    } else {
      text = this.typeSkeleton(typeId);
    }
    // The type is written down, so the note keeps it wherever it is moved.
    if (readProperties(text).type === undefined) text = writeProperties(text, { type: typeId });
    return this.createNote(dir, title, text);
  }

  /** Adds, changes or (with null) removes a note type. Notes keep what they say. */
  async setType(id: string, type: NoteType | null): Promise<void> {
    const settings: NovelSettings = JSON.parse(JSON.stringify(this.settings));
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

  /** The template new scenes start from, when it exists: `<Templates>/Scena.md` in an Italian novel. */
  sceneTemplatePath(): string {
    return join(this.settings.folders.templates, `${sceneTemplateName(this.settings.language)}.md`);
  }

  /** Opens the template of new scenes, creating it with the first stage of work if needed. */
  async ensureSceneTemplate(): Promise<string> {
    const path = this.sceneTemplatePath();
    if (!(await this.fs.exists(path))) {
      const status = projectStatus(this.settings);
      await this.fs.writeText(path, writeProperties("", { [status.name]: status.values[0] ?? "", synopsis: "" }) + "\n");
      await this.reload();
    }
    return path;
  }

  /** Properties every scene is offered, from the template of new scenes; none without it. */
  async sceneProperties(): Promise<Properties> {
    const path = this.sceneTemplatePath();
    return (await this.fs.exists(path)) ? readProperties(await this.fs.readText(path)) : {};
  }

  /**
   * Offers a property to every scene of the novel: new scenes start with it, and the others
   * show it empty, without their files being written until it is given a value.
   */
  async addSceneProperty(name: string, value: unknown): Promise<void> {
    const path = await this.ensureSceneTemplate();
    await this.setProperties(path, { [name]: value });
  }

  /** View files in the Views folder, by name. */
  get views(): string[] {
    return this.files.filter((f) => isView(f, this.settings)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /** A new view file in the Views folder; returns its path. */
  async createView(name: string, view: ViewSpec): Promise<string> {
    const dir = this.settings.folders.views;
    await this.fs.mkdir(dir);
    const path = await this.freeName(dir, (sanitizeTitle(name) || "Untitled") + VIEW_EXT);
    await this.fs.writeText(path, serializeView(view));
    await this.reload();
    return path;
  }

  async saveView(path: string, view: ViewSpec): Promise<void> {
    await this.fs.writeText(path, serializeView(view));
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

  /**
   * Moves or copies items, in order, to another place: a folder of any section, or a place
   * in the manuscript. In the manuscript `index` is where among the container's children
   * they go, counted as the children are now; without it they go at the end. An item that
   * leaves the manuscript loses its number; one that enters it gets the number of its
   * place. Moves fix the links; a copy keeps them reaching what the original reached.
   * Returns where each item ended up.
   */
  async transfer(paths: string[], target: { dir: string; index?: number }, copy: boolean): Promise<string[]> {
    const sources = paths.filter((path, i) => paths.indexOf(path) === i && !paths.some((other) => other !== path && isWithin(path, other)));
    for (const path of sources) if (isWithin(target.dir, path)) throw new Error("Cannot move an item into itself");
    await this.beforeMove?.();
    const ordered = !this.settings.gamebook.enabled && isWithin(target.dir, this.settings.folders.manuscript) && !!findNode(this.manuscript, target.dir);
    let dir = target.dir;
    let index = target.index ?? Number.POSITIVE_INFINITY;
    if (ordered && !copy && Number.isFinite(index)) {
      // Items moved from before the place leave a gap, so the place is counted without them.
      const children = this.node(dir).children;
      index -= children.slice(0, index).filter((c) => sources.includes(c.path)).length;
    }
    let pending = [...sources];
    const results: string[] = [];
    while (pending.length) {
      const source = pending.shift()!;
      let moved: (path: string) => string = (path) => path;
      let result: string;
      if (ordered) {
        ({ result, moved } = await this.placeInManuscript(source, dir, index, copy));
        if (Number.isFinite(index)) index++;
      } else {
        ({ result, moved } = await this.placeInFolder(source, dir, copy));
      }
      results.push(result);
      dir = moved(dir);
      pending = pending.map(moved);
      for (let i = 0; i < results.length - 1; i++) results[i] = moved(results[i]);
    }
    return results;
  }

  /** The title an item takes in the manuscript: its file name without number or extension. */
  private titleOf(path: string): string {
    const node = findNode(this.manuscript, path);
    if (node && node.kind !== "manuscript") return node.fileTitle;
    const name = this.files.includes(path) ? stripExt(basename(path)) : basename(path);
    return parseName(name).title;
  }

  private async placeInManuscript(source: string, dir: string, index: number, copy: boolean): Promise<{ result: string; moved: (path: string) => string }> {
    const parent = this.node(dir);
    const file = this.files.includes(source);
    if (file && !isMarkdown(source)) throw new Error(`Only notes and folders go in the manuscript: ${basename(source)}`);
    const ext = file ? ".md" : "";
    const node = findNode(this.manuscript, source);
    if (copy) {
      const title = this.uniqueTitle(parent, sanitizeTitle(this.titleOf(source)) || "Untitled");
      const { path, moved } = await this.insertAt(parent, index, title, (path, moved) => this.copyItem(moved(source), path + ext), ext);
      return { result: path, moved };
    }
    const siblings = parent.children.filter((c) => c.path !== source);
    const clamped = Math.max(0, Math.min(index, siblings.length));
    // Within the manuscript, a move like dragging; from outside, the item comes in as a new one.
    const title = node && dirname(source) === parent.path ? node.fileTitle : this.uniqueTitle(parent, sanitizeTitle(this.titleOf(source)) || "Untitled", node ? source : undefined);
    const item: ManuscriptNode = node
      ? { ...node, fileTitle: title }
      : { kind: file ? "scene" : "chapter", path: source, name: basename(source), order: null, title, fileTitle: title, notePath: null, children: [] };
    const sequence = [...siblings.slice(0, clamped), item, ...siblings.slice(clamped)];
    const orders = assignOrders(sequence.map((n) => (n === item ? null : n.order)));
    const moves = this.orderMovesFrom(parent.path, sequence, orders);
    const moved = await this.apply(moves);
    return { result: moved(source), moved };
  }

  private async placeInFolder(source: string, dir: string, copy: boolean): Promise<{ result: string; moved: (path: string) => string }> {
    const file = this.files.includes(source);
    const inManuscript = isWithin(source, this.settings.folders.manuscript);
    const leaves = inManuscript && !isWithin(dir, this.settings.folders.manuscript);
    // Out of the manuscript the number in front of the name means nothing.
    const name = leaves ? this.titleOf(source) + (file ? extname(source) : "") : basename(source);
    if (!copy && dirname(source) === dir && name === basename(source)) return { result: source, moved: (path) => path };
    const to = await this.freeName(dir, name);
    if (copy) {
      await this.fs.mkdir(dir);
      await this.copyItem(source, to);
      await this.reload();
      return { result: to, moved: (path) => path };
    }
    await this.fs.mkdir(dir);
    const moved = await this.apply([{ from: source, to }]);
    return { result: moved(source), moved };
  }

  /**
   * Copies a file, or a folder with all it holds, to `to`. A folder note takes the copy's
   * folder name, and links in copied notes are fixed so they still reach the same notes.
   */
  private async copyItem(from: string, to: string): Promise<void> {
    const after = [...this.files];
    const plan: { from: string; to: string }[] = [];
    const walk = async (source: string, target: string) => {
      if (!(await this.isFolder(source))) {
        plan.push({ from: source, to: target });
        return;
      }
      await this.fs.mkdir(target);
      const note = folderNotePath(source);
      for (const entry of await this.fs.list(source)) {
        if (entry.name.startsWith(".dante-move-")) continue;
        const name = entry.path === note ? basename(target) + ".md" : entry.name;
        await walk(entry.path, join(target, name));
      }
    };
    await walk(from, to);
    for (const item of plan) after.push(item.to);
    for (const item of plan) {
      if (isMarkdown(item.from)) {
        const text = await this.fs.readText(item.from);
        await this.fs.writeText(item.to, rewriteLinks(text, item.from, new Map(), this.files, after, item.to) ?? text);
      } else {
        await this.fs.writeBytes(item.to, await this.fs.readBytes(item.from));
      }
    }
  }

  private async isFolder(path: string): Promise<boolean> {
    if (this.files.includes(path)) return false;
    try {
      await this.fs.list(path);
      return true;
    } catch {
      return false;
    }
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

  /**
   * In a gamebook: changes a paragraph's own properties as the plugin writes them. A new
   * number (given, or worked out from an anchor) also goes into its aliases, into the label
   * of every reference to it and into the articles before them, so the book reads the same.
   * Refuses a number another paragraph of the same folder already has.
   */
  async setParagraph(path: string, changes: ParagraphChanges): Promise<void> {
    await this.beforeMove?.();
    const index = gamebookOf(await this.index(), this.settings);
    const paragraph = index?.get(path);
    changes = { ...changes };
    if (changes.numberType === "relative" && index && changes.anchor !== undefined) {
      const r = index.resolve(changes.anchor);
      if (r.kind !== "paragraph") throw new Error(`gamebook.noAnchor:${changes.anchor}`);
      if (this.anchoredOn(index, r.to.path, path)) throw new Error(`gamebook.anchorCycle:${changes.anchor}`);
      changes.number = r.to.number + (changes.offset ?? 0);
    }
    if (changes.number !== undefined && (!Number.isInteger(changes.number) || changes.number < 1)) throw new Error(`gamebook.badNumber:${changes.number}`);
    if (changes.number !== undefined && index && paragraph && changes.number !== paragraph.number) {
      // The paragraphs relative to this one move with it, keeping their distance.
      const moved = new Map<string, number>([[path, changes.number]]);
      const queue = [paragraph];
      while (queue.length) {
        const anchor = queue.shift()!;
        for (const other of index.inScope(paragraph.scope)) {
          if (moved.has(other.path) || other.numberType !== "relative" || !other.anchor) continue;
          const r = index.resolve(other.anchor);
          if (r.kind !== "paragraph" || r.to.path !== anchor.path) continue;
          moved.set(other.path, moved.get(anchor.path)! + (other.offset ?? other.number - anchor.number));
          queue.push(other);
        }
      }
      for (const n of moved.values()) {
        const taken = index.byNumber(paragraph.scope, n);
        if (taken && !moved.has(taken.path)) throw new Error(`gamebook.numberTaken:${n}:${taken.title}`);
        if (n < 1) throw new Error(`gamebook.badNumber:${n}`);
      }
      await this.writeNumbers(index, moved, path, changes);
      await this.reload();
      return;
    }
    const text = await this.fs.readText(path);
    const next = setParagraphFields(text, changes);
    if (next !== text) await this.fs.writeText(path, next);
    await this.reload();
  }

  /** The files that a change of the numbers in `moved` rewrites: the paragraphs and those that refer to them. */
  private touchedBy(index: GamebookIndex, moved: Map<string, number>): string[] {
    const files = new Set<string>();
    for (const [p, n] of moved) {
      if (index.get(p)?.number === n) continue;
      files.add(p);
      for (const { from } of index.incoming(p)) files.add(from.path);
    }
    return [...files];
  }

  /**
   * Gives the paragraphs in `moved` their new numbers and relabels every reference to
   * them, correcting the articles; `own` changes one paragraph's other fields as well.
   */
  private async writeNumbers(index: GamebookIndex, moved: Map<string, number>, own?: string, changes?: ParagraphChanges): Promise<number> {
    // Each file to rewrite, with the references in it to relabel.
    const edits = new Map<string, { name: string; from: number; to: number }[]>();
    const add = (file: string, name: string, from: number, to: number) => edits.set(file, [...(edits.get(file) ?? []), { name, from, to }]);
    for (const [p, n] of moved) {
      const old = index.get(p);
      if (!old || (old.number === n && p !== own)) continue;
      add(p, old.title, old.number, n);
      for (const { from, reference } of index.incoming(p)) add(from.path, reference.target, old.number, n);
    }
    const numberOf = (target: string) => {
      const r = index.resolve(target);
      return r.kind !== "paragraph" ? null : (moved.get(r.to.path) ?? r.to.number);
    };
    let written = 0;
    for (const [file, list] of edits) {
      const text = await this.fs.readText(file);
      let next = text;
      if (file === own && changes) next = setParagraphFields(next, changes);
      else if (moved.has(file)) next = setParagraphFields(next, { number: moved.get(file)! });
      // Through a placeholder, so that two paragraphs that swap numbers do not catch each other's references.
      for (const e of list) next = relabel(next, e.name, e.from, -1 - e.to);
      for (const e of list) next = relabel(next, e.name, -1 - e.to, e.to);
      if (this.settings.language.toLowerCase().startsWith("it")) next = fixArticles(next, numberOf).text;
      if (next !== text) {
        await this.fs.writeText(file, next);
        written++;
      }
    }
    return written;
  }

  /**
   * In a gamebook: writes the graph of the paragraphs of `scope` as a Mermaid diagram in a
   * note at the top of the project, keeping what the writer added around it; returns its path.
   */
  async writeGamebookGraph(scope: string, intro: string): Promise<string> {
    const index = gamebookOf(await this.index(), this.settings);
    if (!index) throw new Error("gamebook.off");
    const path = graphNotePath(this.settings.language);
    const existing = (await this.fs.exists(path)) ? await this.fs.readText(path) : null;
    const next = graphNote(existing, mermaidGraph(index, scope, this.settings.gamebook.start), intro);
    if (next !== existing) await this.fs.writeText(path, next);
    await this.reload();
    return path;
  }

  /** In a gamebook: the operations on the whole book, newest first, to undo them. */
  async gamebookOperations(): Promise<GamebookOperation[]> {
    if (!(await this.fs.exists(OPERATIONS))) return [];
    try {
      const list = JSON.parse(await this.fs.readText(OPERATIONS));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  /**
   * In a gamebook: gives the paragraphs new numbers all at once, as a shuffle does. Every
   * file it touches is kept first in a snapshot named `name`, and the operation is recorded
   * so that it can be undone. Returns how many files changed.
   */
  async renumberParagraphs(numbers: Map<string, number>, name: string): Promise<number> {
    await this.beforeMove?.();
    const index = gamebookOf(await this.index(), this.settings);
    if (!index) return 0;
    const now = new Date();
    const files: { path: string; snapshot: string }[] = [];
    for (const path of this.touchedBy(index, numbers)) {
      const snap = await takeSnapshot(this.fs, path, name, now);
      if (snap) files.push({ path, snapshot: snap.path });
    }
    const before: Record<string, number> = {};
    for (const p of numbers.keys()) {
      const old = index.get(p);
      if (old) before[p] = old.number;
    }
    const written = await this.writeNumbers(index, numbers);
    const operations = await this.gamebookOperations();
    operations.unshift({ id: now.toISOString(), name, date: now.toISOString(), files, numbers: before });
    await this.fs.writeText(OPERATIONS, JSON.stringify(operations.slice(0, 30), null, 2));
    await this.reload();
    return written;
  }

  /**
   * Undoes a recorded operation: every file goes back to its snapshot, or, with `onlyNumbers`,
   * the paragraphs only get their old numbers back, with references and articles, and the text
   * written since stays.
   */
  async undoGamebookOperation(id: string, onlyNumbers: boolean, name: string): Promise<void> {
    const op = (await this.gamebookOperations()).find((o) => o.id === id);
    if (!op) return;
    if (onlyNumbers) {
      const index = gamebookOf(await this.index(), this.settings);
      const numbers = new Map(Object.entries(op.numbers).filter(([p]) => index?.get(p)));
      for (const [p, n] of numbers) {
        const p0 = index!.get(p)!;
        const taken = index!.byNumber(p0.scope, n);
        if (taken && !numbers.has(taken.path)) throw new Error(`gamebook.numberTaken:${n}:${taken.title}`);
      }
      await this.renumberParagraphs(numbers, name);
      return;
    }
    await this.beforeMove?.();
    for (const f of op.files) {
      if (await this.fs.exists(f.snapshot)) await restoreSnapshot(this.fs, f.path, f.snapshot);
    }
    await this.reload();
  }

  /** Whether `anchor` follows `path`, directly or through other anchors: anchoring on it would go round in a circle. */
  private anchoredOn(index: GamebookIndex, anchor: string, path: string): boolean {
    const seen = new Set<string>();
    let current = index.get(anchor);
    while (current && !seen.has(current.path)) {
      if (current.path === path) return true;
      seen.add(current.path);
      if (current.numberType !== "relative" || !current.anchor) return false;
      const r = index.resolve(current.anchor);
      current = r.kind === "paragraph" ? r.to : undefined;
    }
    return false;
  }

  /**
   * In a gamebook: creates a paragraph in `dir`, with the first free number, a fixed one or
   * one relative to another paragraph, and returns its path and number.
   */
  async createParagraph(dir: string, title: string, spec: { numberType: "free" | "fixed" | "relative"; number?: number; anchor?: string; offset?: number }): Promise<{ path: string; title: string; number: number }> {
    const clean = sanitizeTitle(title);
    if (!clean) throw new Error("gamebook.noTitle");
    const path = join(dir, `${clean}.md`);
    if (await this.fs.exists(path)) throw new Error(`gamebook.exists:${clean}`);
    const index = gamebookOf(await this.index(), this.settings);
    let number: number;
    if (spec.numberType === "relative") {
      const r = spec.anchor && index ? index.resolve(spec.anchor) : null;
      if (!r || r.kind !== "paragraph") throw new Error(`gamebook.noAnchor:${spec.anchor ?? ""}`);
      number = r.to.number + (spec.offset ?? 0);
    } else if (spec.numberType === "fixed") {
      number = spec.number ?? 0;
    } else {
      number = index ? index.firstFreeNumber(dir) : 1;
    }
    if (!Number.isInteger(number) || number < 1) throw new Error(`gamebook.badNumber:${number}`);
    const taken = index?.byNumber(dir, number);
    if (taken) throw new Error(`gamebook.numberTaken:${number}:${taken.title}`);
    await this.fs.writeText(path, newParagraphText({ number, numberType: spec.numberType, anchor: spec.anchor, offset: spec.offset }));
    await this.reload();
    return { path, title: clean, number };
  }

  /**
   * In a gamebook: a page that is not a paragraph (rules, an introduction), a file without a
   * number in the paragraphs' folder, so that it goes before them; returns its path.
   */
  async createPage(dir: string, title: string): Promise<string> {
    const path = await this.freeName(dir, (sanitizeTitle(title) || "Untitled") + ".md");
    await this.fs.writeText(path, "");
    await this.reload();
    return path;
  }

  /** In a gamebook: adds a value to a list property of a paragraph (a hidden reference, a keyword), as the plugin writes it. */
  async addToParagraphList(path: string, key: string, value: string): Promise<void> {
    await this.beforeMove?.();
    const text = await this.fs.readText(path);
    const next = addToList(text, key, value);
    if (next !== text) await this.fs.writeText(path, next);
    await this.reload();
  }

  async removeFromParagraphList(path: string, key: string, value: string): Promise<void> {
    await this.beforeMove?.();
    const text = await this.fs.readText(path);
    const next = removeFromList(text, key, value);
    if (next !== text) await this.fs.writeText(path, next);
    await this.reload();
  }

  /**
   * Gives a property a new name in every note of the project, in its definition, in the
   * types that suggest it, in the tree's dot and in the views. A note that already has a
   * property with the new name keeps both, and is returned among `skipped`.
   */
  async renameProperty(from: string, to: string): Promise<{ notes: number; skipped: string[] }> {
    from = from.trim();
    to = to.trim();
    if (!from || !to || from === to) return { notes: 0, skipped: [] };
    if (!canRenameProperty(this.settings, from) || RESERVED_PROPERTIES.includes(to.toLowerCase())) throw new Error(`The property "${from}" cannot be renamed to "${to}"`);
    await this.beforeMove?.();
    let notes = 0;
    const skipped: string[] = [];
    for (const path of this.files.filter(isMarkdown)) {
      const text = await this.fs.readText(path);
      if (!(from in readProperties(text))) continue;
      const renamed = renameProperty(text, from, to);
      if (renamed === null) skipped.push(path);
      else {
        await this.fs.writeText(path, renamed);
        notes++;
      }
    }
    const same = (name: string) => name.toLowerCase() === from.toLowerCase();
    const swap = (name: string) => (same(name) ? to : name);
    for (const path of this.views) {
      const view = parseView(await this.fs.readText(path));
      const sort = view.sort.replace(/^-/, "");
      const next: ViewSpec = {
        ...view,
        filter: Object.fromEntries(Object.entries(view.filter).map(([k, v]) => [swap(k), v])),
        sort: same(sort) ? (view.sort.startsWith("-") ? "-" : "") + to : view.sort,
        group_by: swap(view.group_by),
        fields: view.fields.map(swap),
        date: swap(view.date),
        end: swap(view.end),
      };
      if (serializeView(next) !== serializeView(view)) await this.fs.writeText(path, serializeView(next));
    }
    const settings: NovelSettings = JSON.parse(JSON.stringify(this.settings));
    const key = Object.keys(settings.properties).find(same);
    if (key) {
      settings.properties = Object.fromEntries(Object.entries(settings.properties).map(([k, v]) => [k === key ? to : k, v]));
    }
    for (const type of Object.values(settings.types)) type.properties = type.properties.map(swap);
    if (same(settings.tree.dot)) settings.tree.dot = to;
    await this.saveSettings(settings);
    return { notes, skipped };
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
    const clash = parent.kind !== "manuscript" && parent.fileTitle.toLowerCase() === node.fileTitle.toLowerCase();
    const moved = clash ? { ...node, fileTitle: this.uniqueTitle(parent, node.fileTitle, path) } : node;
    const sequence = [...siblings.slice(0, clamped), moved, ...siblings.slice(clamped)];
    // The moved item gets a new number; its siblings keep theirs where they can.
    const orders = assignOrders(sequence.map((n) => (n === moved ? null : n.order)));
    const moves = this.orderMovesFrom(parentPath, sequence, orders);
    await this.apply(moves);
    return this.movedPath(moves, path);
  }

  /**
   * Sets the title shown for a scene, chapter or part without renaming its file: the
   * `title` property, removed when it is empty or the same as the file name.
   */
  async retitle(path: string, title: string): Promise<void> {
    const node = this.node(path);
    const clean = title.trim();
    await this.setProperties(path, { [TITLE]: clean === "" || clean === node.fileTitle ? undefined : clean });
  }

  async rename(path: string, title: string): Promise<string> {
    const node = this.node(path);
    const clean = sanitizeTitle(title);
    if (clean === "" || clean === node.fileTitle) return path;
    const parent = parentOf(this.manuscript, path)!;
    const unique = this.uniqueTitle(parent, clean, path);
    const name = node.order === null ? unique : formatName(node.order, unique);
    const to = join(parent.path, node.kind === "scene" ? name + ".md" : name);
    await this.apply([{ from: path, to }]);
    return to;
  }

  /**
   * Settles a conflict copy: keep the original as it is, take the copy's text instead, or
   * write the copy's differences into the original as revisions signed by the copy's
   * author, to accept or reject one by one. Whichever text is set aside goes to .trash;
   * before a merge the original is also kept as a snapshot named `snapshotName`.
   */
  async resolveConflict(conflict: ConflictCopy, how: "original" | "copy" | "merge", snapshotName: string, fallbackAuthor: string): Promise<void> {
    if (how === "copy" || (how === "merge" && !isMarkdown(conflict.original))) {
      await this.toTrash(conflict.original);
      await this.fs.rename(conflict.path, conflict.original);
      await this.reload();
      return;
    }
    if (how === "merge") {
      await takeSnapshot(this.fs, conflict.original, snapshotName);
      const original = await this.fs.readText(conflict.original);
      const copy = await this.fs.readText(conflict.path);
      const merged = mergeAsRevisions(splitNote(original).body, splitNote(copy).body, conflict.who ?? fallbackAuthor, today());
      await this.fs.writeText(conflict.original, replaceBody(original, merged));
    }
    await this.trash(conflict.path);
  }

  /**
   * Moves a scene, chapter, part, note, file or folder to the project's .trash folder,
   * where Obsidian keeps deleted notes too, so it can be recovered. Returns where it went.
   */
  async trash(path: string): Promise<string> {
    // Its conflict copies go with it, or they would show as files of their own.
    for (const copy of this.conflictCopies(path)) await this.toTrash(copy);
    const target = await this.toTrash(path);
    await this.reload();
    return target;
  }

  /** Moves one item to .trash, noting where it was; returns where it went. */
  private async toTrash(path: string): Promise<string> {
    const target = await this.freeName(TRASH, basename(path));
    await this.fs.mkdir(TRASH);
    await this.fs.rename(path, target);
    await noteTrashed(this.fs, target, path);
    return target;
  }

  /** Puts an item of the trash back where it was (or in the Laboratory); returns its path. */
  async restore(item: TrashItem): Promise<string> {
    const path = await restoreFromTrash(this.fs, item, this.settings.folders.laboratory);
    await this.reload();
    return path;
  }

  /** Deletes items of the trash for good. */
  async deleteForever(items: TrashItem[]): Promise<void> {
    await deleteFromTrash(this.fs, items);
  }

  // Finding and replacing across notes

  /** The notes under `within` (every folder when empty) whose text holds `query`. */
  async findAll(query: string, options: FindOptions, within: string[] = []): Promise<NoteMatches[]> {
    if (!query) return [];
    const index = await this.index();
    const out: NoteMatches[] = [];
    for (const path of this.files) {
      if (!isMarkdown(path) || (within.length && !within.some((w) => isWithin(path, w)))) continue;
      const note = index.notes.get(path);
      if (!note) continue;
      const ranges = findIn(note.body, query, options);
      if (ranges.length) out.push({ path, occurrences: occurrences(note.body, ranges) });
    }
    return out;
  }

  /**
   * Replaces the chosen matches, each note read again from disk: a match that is no
   * longer there is skipped. Scenes are copied to a snapshot named `snapshotName` first.
   */
  async replaceAll(chosen: { path: string; ranges: Range[] }[], query: string, replacement: string, options: FindOptions, snapshotName: string): Promise<Replaced> {
    const result: Replaced = { count: 0, notes: [] };
    for (const { path, ranges } of chosen) {
      if (!ranges.length || !(await this.fs.exists(path))) continue;
      const before = await this.fs.readText(path);
      const body = bodyOf(before);
      const now = findIn(body, query, options);
      const still = ranges.filter((r) => now.some((n) => n.from === r.from && n.to === r.to));
      if (!still.length) continue;
      if (isWithin(path, this.settings.folders.manuscript)) await takeSnapshot(this.fs, path, snapshotName);
      const after = replaceBody(before, replaceIn(body, still, replacement, options));
      await this.writeNote(path, after);
      result.count += still.length;
      result.notes.push({ path, before, after });
    }
    return result;
  }

  /** Undoes a replacement in the notes nobody changed since; returns the notes it could not undo. */
  async undoReplace(replaced: Replaced): Promise<string[]> {
    const skipped: string[] = [];
    for (const note of replaced.notes) {
      const now = (await this.fs.exists(note.path)) ? await this.fs.readText(note.path) : null;
      if (now !== note.after) {
        skipped.push(note.path);
        continue;
      }
      await this.writeNote(note.path, note.before);
    }
    return skipped;
  }

  /**
   * Adds a book read from another program after what the manuscript holds: at its end, or
   * at the end of the part `into` names. When `continueChapter` names a chapter, the text
   * before the book's first heading becomes further scenes of it, for a novel kept in
   * several files whose chapter runs on from one file to the next. Files are written
   * directly (a reload per scene would be slow on a long novel). A title that cannot be a
   * file name as it is, or that repeats another, is kept as the `title` property.
   */
  async importBook(book: ImportedBook, options: { into?: string; continueChapter?: string } = {}): Promise<void> {
    const step = 10;
    const nextOrder = (node: ManuscriptNode) => Math.max(0, ...node.children.map((c) => c.order ?? 0)) + step;
    const fileName = (title: string, taken: Set<string>) => {
      const base = sanitizeTitle(title) || "Untitled";
      let name = base;
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
      taken.add(name.toLowerCase());
      return name;
    };
    const withTitle = (title: string, file: string, body = "", synopsis = "") => {
      const clean = title.trim();
      const properties: Properties = {};
      if (clean && clean !== file) properties[TITLE] = clean;
      if (synopsis.trim()) properties[SYNOPSIS] = synopsis.trim();
      return Object.keys(properties).length ? writeProperties(body, properties) : body;
    };
    if (book.hasParts && !this.settings.structure.parts) {
      // With parts on, a folder at the top reads as a part: the chapters already there say they are not.
      for (const c of this.manuscript.children) {
        if (c.kind !== "chapter") continue;
        const note = folderNotePath(c.path);
        const text = (await this.fs.exists(note)) ? await this.fs.readText(note) : "";
        await this.fs.writeText(note, writeProperties(text, { kind: "chapter" }));
      }
      await this.saveSettings({ ...this.settings, structure: { ...this.settings.structure, parts: true } });
    }
    const continued = options.continueChapter ? findNode(this.manuscript, options.continueChapter) : null;
    const opening = book.parts[0]?.chapters[0];
    if (continued && opening?.untitled) {
      const taken = new Set([continued.fileTitle.toLowerCase(), ...continued.children.map((c) => c.fileTitle.toLowerCase())]);
      let order = nextOrder(continued);
      for (const scene of opening.scenes) {
        const file = fileName(scene.title, taken);
        await this.fs.writeText(join(continued.path, formatName(order, file) + ".md"), withTitle(scene.title, file, scene.text ? scene.text + "\n" : "", scene.synopsis));
        order += step;
      }
      book = { ...book, parts: [{ ...book.parts[0], chapters: book.parts[0].chapters.slice(1) }, ...book.parts.slice(1)] };
      await this.reload();
    }
    // Chapters go into a part only when the book has none of its own.
    const into = options.into && !book.hasParts ? findNode(this.manuscript, options.into) : null;
    const root = into && into.kind === "part" ? into : this.manuscript;
    const rootTaken = new Set([...(root === this.manuscript ? [] : [root.fileTitle.toLowerCase()]), ...root.children.map((c) => c.fileTitle.toLowerCase())]);
    let rootOrder = nextOrder(root);
    const writeChapter = async (dir: string, order: number, chapter: ImportedBook["parts"][number]["chapters"][number], taken: Set<string>) => {
      const name = fileName(chapter.title, taken);
      const path = join(dir, formatName(order, name));
      await this.fs.mkdir(path);
      // A prologue or epilogue is said so; a chapter outside the parts must say it is one.
      const kind = /^(prolog(?:ue|o)?|prólogo)$/i.test(chapter.title.trim())
        ? "prologue"
        : /^(epilog(?:ue|o)?|epílogo)$/i.test(chapter.title.trim())
          ? "epilogue"
          : dir === this.manuscript.path && this.settings.structure.parts
            ? "chapter"
            : null;
      const note = withTitle(chapter.title, name, "", chapter.synopsis);
      if (kind || note) await this.fs.writeText(folderNotePath(path), kind ? writeProperties(note, { kind }) : note);
      // A scene may not share its chapter's name, or it would be read as the chapter's note.
      const scenes = new Set([name.toLowerCase()]);
      let sceneOrder = step;
      for (const scene of chapter.scenes) {
        const file = fileName(scene.title, scenes);
        await this.fs.writeText(join(path, formatName(sceneOrder, file) + ".md"), withTitle(scene.title, file, scene.text ? scene.text + "\n" : "", scene.synopsis));
        sceneOrder += step;
      }
    };
    for (const part of book.parts) {
      if (book.hasParts && part.title) {
        const name = fileName(part.title, rootTaken);
        const path = join(root.path, formatName(rootOrder, name));
        rootOrder += step;
        await this.fs.mkdir(path);
        await this.fs.writeText(folderNotePath(path), writeProperties(withTitle(part.title, name, "", part.synopsis), { kind: "part" }));
        const taken = new Set([name.toLowerCase()]);
        let order = step;
        for (const chapter of part.chapters) {
          await writeChapter(path, order, chapter, taken);
          order += step;
        }
      } else {
        for (const chapter of part.chapters) {
          await writeChapter(root.path, rootOrder, chapter, rootTaken);
          rootOrder += step;
        }
      }
    }
    await this.reload();
  }

  /**
   * Writes the documents another program keeps beside the book as notes, each group where
   * `destinations` says (as `noteDestination` guesses when it says nothing): into a type's
   * folder of the Story Bible, Research or the Laboratory, keeping the folders below. In
   * Research and the Laboratory a group keeps a folder of its own, except Scrivener's own
   * Research. Nothing already there is overwritten: a note with a name in use gets a number.
   */
  async importNotes(notes: ImportedNote[], destinations: Record<string, NoteDestination> = {}): Promise<void> {
    if (!notes.length) return;
    const { folders } = this.settings;
    const taken = new Set<string>();
    const free = async (dir: string, title: string, extension: string) => {
      const base = sanitizeTitle(title) || "Untitled";
      for (let n = 1; ; n++) {
        const path = join(dir, `${n === 1 ? base : `${base} ${n}`}.${extension}`);
        if (!taken.has(path.toLowerCase()) && !(await this.fs.exists(path))) {
          taken.add(path.toLowerCase());
          return path;
        }
      }
    };
    const clean = (name: string) => sanitizeTitle(name) || "Untitled";
    for (const note of notes) {
      const to = destinations[note.group] ?? noteDestination(this.settings.types, note.group, note.research);
      if (to === "skip") continue;
      const type = to.startsWith("codex:") ? this.settings.types[to.slice("codex:".length)] : undefined;
      // The group's own text, or a group that is one document, is a note at the top of where it goes.
      const own = note.title === note.group && !note.folders.length;
      const base = type ? join(folders.codex, type.folder) : join(to === "laboratory" ? folders.laboratory : folders.research, ...(note.research || own ? [] : [clean(note.group)]));
      const dir = join(base, ...note.folders.map(clean));
      await this.fs.mkdir(dir);
      if (note.file) {
        await this.fs.writeBytes(await free(dir, note.title, note.file.extension), note.file.bytes);
        continue;
      }
      const path = await free(dir, note.title, "md");
      const body = note.text ? note.text + "\n" : "";
      const properties: Properties = {};
      if (note.title.trim() !== stripExt(basename(path))) properties[TITLE] = note.title.trim();
      if (note.synopsis?.trim()) properties[SYNOPSIS] = note.synopsis.trim();
      await this.fs.writeText(path, Object.keys(properties).length ? writeProperties(body, properties) : body);
    }
    await this.reload();
  }

  /**
   * Joins scenes into the first of them in reading order, wherever they are: their texts
   * follow one another as paragraphs, the first keeps its properties, and the others go to
   * .trash. Links to the others lead to the first. Returns the scene that holds the text.
   */
  async mergeScenes(paths: string[]): Promise<string> {
    const chosen = scenesOf(this.manuscript).map((n) => n.path).filter((p) => paths.includes(p));
    if (chosen.length < 2) return chosen[0] ?? "";
    // A copy left by a sync service would lose its original: it is settled first.
    const conflicted = this.conflicts.find((c) => chosen.includes(c.original));
    if (conflicted) throw new MergeConflictError(conflicted.original);
    const [first, ...rest] = chosen;
    await this.autoSnapshot(first);
    const bodies: string[] = [];
    for (const path of chosen) bodies.push((await this.readBody(path)).trim());
    // Written directly, so the writing log does not count moved words as new ones.
    await this.fs.writeText(first, replaceBody(await this.fs.readText(first), bodies.filter(Boolean).join("\n\n") + "\n"));
    const before = [...this.files];
    const after = before.filter((f) => !rest.includes(f));
    const renames = new Map(rest.map((p) => [p, first]));
    for (const file of after) {
      if (!isMarkdown(file)) continue;
      const updated = rewriteLinks(await this.fs.readText(file), file, renames, before, after);
      if (updated !== null) await this.fs.writeText(file, updated);
    }
    for (const path of rest) await this.toTrash(path);
    await this.reload();
    return first;
  }

  /** A new scene with `body` as its text, or, without one, the scene template's text if there is a template. */
  async createScene(parentPath: string, index: number, title: string, body?: string): Promise<string> {
    const parent = this.node(parentPath);
    const clean = this.uniqueTitle(parent, sanitizeTitle(title) || "Untitled");
    let text = body ?? "";
    if (body === undefined && (await this.fs.exists(this.sceneTemplatePath()))) text = fillTemplate(await this.fs.readText(this.sceneTemplatePath()), clean);
    return this.insertNew(parent, index, clean, async (path) => this.fs.writeText(path + ".md", text), ".md");
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
    await this.writeKeptHalf(path, before, after);
    return this.createScene(parent.path, index + 1, title, after);
  }

  /**
   * Writes the half of a split scene that stays. For the writing log the text that moves
   * to the new scene is not deleted: only what was typed since the last save counts.
   */
  private async writeKeptHalf(path: string, before: string, after: string): Promise<void> {
    const log = this.onSceneWritten;
    const old = log && (await this.fs.exists(path)) ? sizeOf(splitNote(await this.fs.readText(path)).body) : NO_TEXT;
    this.onSceneWritten = null;
    try {
      await this.writeBody(path, before);
    } finally {
      this.onSceneWritten = log;
    }
    const kept = sizeOf(before);
    const moved = sizeOf(after);
    log?.(path, old, { words: kept.words + moved.words, characters: kept.characters + moved.characters });
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

    await this.writeKeptHalf(path, before, after);
    // At the top of a manuscript with parts, a folder reads as a part unless it says otherwise.
    const kind = holder.kind === "manuscript" && this.settings.structure.parts ? "chapter" : undefined;
    const newChapter = await this.createContainer(holder.path, chapterIndex + 1, chapterTitle, kind);
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
    return (await this.insertAt(parent, index, title, create, ext)).path;
  }

  /** Makes room among `parent`'s children and creates an item there; also says where the renumbered siblings went. */
  private async insertAt(
    parent: ManuscriptNode,
    index: number,
    title: string,
    create: (pathWithoutExt: string, moved: (path: string) => string) => Promise<void>,
    ext: string,
  ): Promise<{ path: string; moved: (path: string) => string }> {
    const placeholder = "\u0000new";
    const sequence = [...parent.children];
    const clamped = Math.max(0, Math.min(index, sequence.length));
    const fake: ManuscriptNode = {
      kind: ext ? "scene" : "chapter", path: placeholder, name: "", order: null, title, fileTitle: title, notePath: null, children: [],
    };
    sequence.splice(clamped, 0, fake);
    const orders = assignOrders(sequence.map((n) => n.order));
    const moves = this.orderMovesFrom(parent.path, sequence, orders).filter((m) => m.from !== placeholder);
    const moved = await this.apply(moves);
    const path = join(parent.path, formatName(orders[clamped], title));
    await create(path, moved);
    await this.reload();
    return { path: path + ext, moved };
  }

  /**
   * A title not used by the item's siblings nor by its container: a child named like its
   * folder would be read as the folder note. A renamed container also avoids its
   * children's titles.
   */
  private uniqueTitle(parent: ManuscriptNode, title: string, except?: string): string {
    const taken = new Set(parent.children.filter((c) => c.path !== except).map((c) => c.fileTitle.toLowerCase()));
    if (parent.kind !== "manuscript") taken.add(parent.fileTitle.toLowerCase());
    const self = except ? findNode(this.manuscript, except) : null;
    for (const child of self?.children ?? []) taken.add(child.fileTitle.toLowerCase());
    if (!taken.has(title.toLowerCase())) return title;
    let n = 2;
    while (taken.has(`${title} ${n}`.toLowerCase())) n++;
    return `${title} ${n}`;
  }

  private orderMovesFrom(parentPath: string, sequence: ManuscriptNode[], orders: number[]): Move[] {
    const moves: Move[] = [];
    sequence.forEach((node, i) => {
      const name = formatName(orders[i], node.fileTitle) + (node.kind === "scene" ? ".md" : "");
      const to = join(parentPath, name);
      if (to !== node.path) moves.push({ from: node.path, to });
    });
    return moves;
  }

  /** The conflict copies of a file, by the names sync services give them. */
  private conflictCopies(path: string): string[] {
    if (!this.files.includes(path)) return [];
    return this.conflicts.filter((c) => c.original === path).map((c) => c.path);
  }

  private async writeJournal(journal: MoveJournal): Promise<void> {
    await this.fs.writeText(MOVE_JOURNAL, JSON.stringify(journal));
  }

  /** Two passes through temporary names, so that swapping two names never collides. */
  private async twoPass(moves: Move[]): Promise<void> {
    const temps = moves.map(tempName);
    for (let i = 0; i < moves.length; i++) await this.fs.rename(moves[i].from, temps[i]);
    for (let i = 0; i < moves.length; i++) await this.fs.rename(temps[i], moves[i].to);
  }

  /**
   * Settles renames that stopped between the two passes. With the first temporary name still
   * there the second pass had not begun, and everything goes back where it was; without it the
   * second pass was under way, and it is completed. Returns whether the renames are all made.
   */
  private async settle(moves: Move[]): Promise<boolean> {
    const temps = moves.map(tempName);
    const waiting: boolean[] = [];
    for (const temp of temps) waiting.push(await this.fs.exists(temp));
    if (!waiting.some(Boolean)) {
      // No temporary name left: either nothing had started, or everything was renamed a moment
      // before the journal could say so. A name that is gone, with the new ones all there, tells.
      let arrived = true;
      let left = false;
      for (const m of moves) {
        if (!(await this.fs.exists(m.to))) arrived = false;
        if (!(await this.fs.exists(m.from))) left = true;
      }
      return moves.length > 0 && arrived && left;
    }
    const forward = !waiting[0];
    for (let i = 0; i < moves.length; i++) {
      if (!waiting[i]) continue;
      const target = forward ? moves[i].to : moves[i].from;
      // Never over a file that is there: the temporary name stays, to be looked at by hand.
      if (!(await this.fs.exists(target))) await this.fs.rename(temps[i], target);
    }
    return forward;
  }

  /**
   * Finishes or undoes a reordering that was interrupted, when the project opens.
   * Returns what was done, for the notice shown to the writer.
   */
  private async recoverMoves(): Promise<"undone" | "completed" | null> {
    if (!(await this.fs.exists(MOVE_JOURNAL))) return null;
    let journal: MoveJournal | null = null;
    try {
      const read = JSON.parse(await this.fs.readText(MOVE_JOURNAL)) as MoveJournal;
      if (Array.isArray(read.moves) && Array.isArray(read.before) && Array.isArray(read.done)) journal = read;
    } catch {
      // An unreadable journal says nothing: it is dropped below.
    }
    let result: "undone" | "completed" | null = null;
    if (journal) {
      if (!journal.done.includes("files")) {
        // Nothing to settle means the renames had not started, or had all been made a moment
        // before the journal said so: the files are where they should be either way.
        if (await this.settle(journal.moves)) journal.done.push("files");
        else result = "undone";
      }
      if (journal.done.includes("files")) {
        if (journal.snapshots && !journal.done.includes("snapshots")) {
          // Snapshots put back are moved again from the start by finishMoves.
          if (await this.settle(journal.snapshots)) journal.done.push("snapshots");
          else delete journal.snapshots;
        }
        this.files = journal.before;
        await this.finishMoves(journal);
        result = "completed";
      }
    }
    await this.fs.remove(MOVE_JOURNAL);
    return result;
  }

  /**
   * What follows the renames: folder notes take their folders' names, snapshots and the record
   * of comments follow their scenes, wikilinks are rewritten. Each step is noted in the journal,
   * so that an interrupted run takes up where it stopped.
   */
  private async finishMoves(journal: MoveJournal): Promise<Map<string, string>> {
    const { before, moves } = journal;
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
      if (oldNote !== newNote) {
        if (await this.fs.exists(oldNote)) await this.fs.rename(oldNote, newNote);
        if (before.includes(folderNotePath(m.from))) renames.set(folderNotePath(m.from), newNote);
      }
    }

    // Snapshots follow their scene, again through temporary names.
    if (!journal.done.includes("snapshots")) {
      const snapshotMoves: Move[] = [];
      for (const [from, to] of renames) {
        if (isMarkdown(from) && (await this.fs.exists(snapshotDir(from)))) {
          snapshotMoves.push({ from: snapshotDir(from), to: snapshotDir(to) });
        }
      }
      journal.snapshots = snapshotMoves;
      await this.writeJournal(journal);
      await this.twoPass(snapshotMoves);
      journal.done.push("snapshots");
      await this.writeJournal(journal);
    }

    // The record of comments and revisions follows its scenes too.
    if (!journal.done.includes("history")) {
      await moveHistory(this.fs, renames);
      journal.done.push("history");
      await this.writeJournal(journal);
    }

    const after = before.map((f) => renames.get(f) ?? f);
    for (const file of before) {
      if (!isMarkdown(file)) continue;
      const newPath = renames.get(file) ?? file;
      if (!(await this.fs.exists(newPath))) continue;
      const text = await this.fs.readText(newPath);
      const updated = rewriteLinks(text, file, renames, before, after, newPath);
      if (updated !== null) await this.fs.writeText(newPath, updated);
    }
    await this.fs.remove(MOVE_JOURNAL);
    return renames;
  }

  private movedPath(moves: Move[], path: string): string {
    return moves.find((m) => m.from === path)?.to ?? path;
  }

  /**
   * Performs renames, renames folder notes with their folders, then fixes wikilinks.
   * Returns where each path of before the moves is now.
   */
  private async apply(moves: Move[]): Promise<(path: string) => string> {
    if (moves.length === 0) return (path) => path;
    await this.beforeMove?.();
    const before = [...this.files];
    // A file's conflict copies take its new name, or they would show as files of their own.
    moves = moves.concat(
      moves.flatMap((m) => {
        const from = stripExt(basename(m.from));
        const to = stripExt(basename(m.to));
        return this.conflictCopies(m.from).map((copy) => ({ from: copy, to: join(dirname(m.to), to + basename(copy).slice(from.length)) }));
      }),
    );

    // What is about to happen is written down first: if Dante closes halfway, the next opening
    // puts the files back or finishes the job, and no scene stays under a hidden name.
    const journal: MoveJournal = { before, moves, done: [] };
    await this.writeJournal(journal);
    await this.twoPass(moves);
    journal.done.push("files");
    await this.writeJournal(journal);
    const renames = await this.finishMoves(journal);
    await this.reload();
    const moved = (path: string) => renames.get(path) ?? moves.reduce((p, m) => rebase(p, m.from, m.to), path);
    this.onMoved?.(moved);
    return moved;
  }
}

/** A template's text for a new note: {{title}} and {{date}} filled in. */
function fillTemplate(template: string, title: string): string {
  const clean = sanitizeTitle(title) || "Untitled";
  const date = new Date().toISOString().slice(0, 10);
  return template.replace(/\{\{\s*title\s*\}\}/g, () => clean).replace(/\{\{\s*date\s*\}\}/g, () => date);
}
