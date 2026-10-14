import type { ProjectFs } from "./fs";
import { readProperties } from "./frontmatter";
import { parseName } from "./naming";
import { levelHeading, type LevelHeading } from "./numbering";
import { basename, isMarkdown, join, stripExt } from "./path";
import type { NovelSettings } from "./settings";

export type ContainerKind = "part" | "chapter" | "prologue" | "epilogue";
export type NodeKind = ContainerKind | "scene" | "manuscript";

export const CONTAINER_KINDS: ContainerKind[] = ["part", "chapter", "prologue", "epilogue"];

/** Folder note property: `numbered: false` leaves a chapter or part without a number. */
export const NUMBERED = "numbered";

export interface ManuscriptNode {
  kind: NodeKind;
  /** Folder for containers, file for scenes. Also the node's identity. */
  path: string;
  /** File or folder name. */
  name: string;
  order: number | null;
  title: string;
  /** The folder note holding a container's properties, when it exists. */
  notePath: string | null;
  /** A chapter or part with `numbered: false` in its folder note: no number, and not counted. */
  unnumbered?: boolean;
  children: ManuscriptNode[];
}

/** A note in a folder with the folder's own name holds the folder's properties. */
export function folderNotePath(dir: string): string {
  return join(dir, basename(dir) + ".md");
}

function byOrder(a: ManuscriptNode, b: ManuscriptNode): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
  if (a.order === null && b.order !== null) return 1;
  if (a.order !== null && b.order === null) return -1;
  return a.title.localeCompare(b.title);
}

function isHidden(name: string): boolean {
  return name.startsWith(".") || name.startsWith("_");
}

export async function loadManuscript(fs: ProjectFs, settings: NovelSettings): Promise<ManuscriptNode> {
  const root = settings.folders.manuscript;
  const node: ManuscriptNode = {
    kind: "manuscript",
    path: root,
    name: root,
    order: null,
    title: root,
    notePath: null,
    children: [],
  };
  if (await fs.exists(root)) node.children = await loadChildren(fs, root, 0, settings);
  return node;
}

async function loadChildren(fs: ProjectFs, dir: string, depth: number, settings: NovelSettings): Promise<ManuscriptNode[]> {
  const entries = await fs.list(dir);
  const note = depth === 0 ? null : folderNotePath(dir);
  const children: ManuscriptNode[] = [];
  for (const entry of entries) {
    if (isHidden(entry.name) || entry.path === note) continue;
    if (entry.isDir) {
      children.push(await loadContainer(fs, entry.path, depth + 1, settings));
    } else if (isMarkdown(entry.path)) {
      const { order, title } = parseName(stripExt(entry.name));
      children.push({ kind: "scene", path: entry.path, name: entry.name, order, title, notePath: null, children: [] });
    }
  }
  return children.sort(byOrder);
}

async function loadContainer(fs: ProjectFs, dir: string, depth: number, settings: NovelSettings): Promise<ManuscriptNode> {
  const name = basename(dir);
  const notePath = folderNotePath(dir);
  let kind: ContainerKind = settings.structure.parts && depth === 1 ? "part" : "chapter";
  let hasNote = false;
  let unnumbered = false;
  if (await fs.exists(notePath)) {
    hasNote = true;
    const properties = readProperties(await fs.readText(notePath));
    unnumbered = properties[NUMBERED] === false;
    const declared = properties.kind;
    if (typeof declared === "string" && (CONTAINER_KINDS as string[]).includes(declared)) {
      kind = declared as ContainerKind;
    }
  }
  const { order, title } = parseName(name);
  return {
    kind,
    path: dir,
    name,
    order,
    title,
    notePath: hasNote ? notePath : null,
    unnumbered,
    children: await loadChildren(fs, dir, depth, settings),
  };
}

/** Every node of the tree, depth first, in reading order. */
export function flatten(node: ManuscriptNode): ManuscriptNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

export function scenesOf(node: ManuscriptNode): ManuscriptNode[] {
  return flatten(node).filter((n) => n.kind === "scene");
}

export function findNode(root: ManuscriptNode, path: string): ManuscriptNode | null {
  return flatten(root).find((n) => n.path === path) ?? null;
}

export function parentOf(root: ManuscriptNode, path: string): ManuscriptNode | null {
  for (const node of flatten(root)) {
    if (node.children.some((c) => c.path === path)) return node;
  }
  return null;
}

/** Nearest ancestor (or the node itself) of the given kinds. */
export function enclosing(root: ManuscriptNode, path: string, kinds: NodeKind[]): ManuscriptNode | null {
  let node = findNode(root, path);
  while (node && !kinds.includes(node.kind)) node = parentOf(root, node.path);
  return node;
}

export type HeadingInfo = LevelHeading;

/**
 * Heading of each part and chapter. Prologues and epilogues are not numbered and show
 * only their title. `titleOf` can replace a working title, as the export does with
 * published titles.
 */
export function headingInfo(
  root: ManuscriptNode,
  settings: NovelSettings,
  titleOf: (node: ManuscriptNode) => string = (node) => node.title,
): Map<string, HeadingInfo> {
  const out = new Map<string, HeadingInfo>();
  let part = 0;
  let chapter = 0;
  const numbered = (node: ManuscriptNode, level: NovelSettings["structure"]["part"], n: number) => {
    // "Parte prima": parts are feminine in Italian.
    out.set(node.path, levelHeading(level, n, titleOf(node), settings.language, level === settings.structure.part));
  };
  const visit = (node: ManuscriptNode) => {
    for (const child of node.children) {
      if ((child.kind === "part" || child.kind === "chapter") && child.unnumbered) {
        // Shown like a prologue: the title alone, and the count goes on without it.
        out.set(child.path, { text: titleOf(child), number: "", title: titleOf(child) });
      } else if (child.kind === "part") {
        part++;
        if (settings.structure.chapter.restartEachPart) chapter = 0;
        numbered(child, settings.structure.part, part);
      } else if (child.kind === "chapter") {
        chapter++;
        numbered(child, settings.structure.chapter, chapter);
      } else if (child.kind === "prologue" || child.kind === "epilogue") {
        out.set(child.path, { text: titleOf(child), number: "", title: titleOf(child) });
      }
      visit(child);
    }
  };
  visit(root);
  return out;
}

/** Displayed heading of each part and chapter, such as "Chapter 3: The letter". */
export function headings(root: ManuscriptNode, settings: NovelSettings): Map<string, string> {
  return new Map([...headingInfo(root, settings)].map(([path, info]) => [path, info.text]));
}
