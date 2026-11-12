// Bringing in a book and its notes read from another program (Word, Scrivener, OpenDocument…).

import { writeProperties, type Properties } from "./frontmatter";
import type { ImportedNote } from "./import/scrivener";
import type { ImportedBook } from "./import/structure";
import { findNode, folderNotePath, SYNOPSIS, TITLE, type ManuscriptNode } from "./manuscript";
import { formatName, sanitizeTitle } from "./naming";
import { basename, join, stripExt } from "./path";
import type { Project } from "./project";
import { defaultTypes, type NoteType } from "./settings";

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

/**
 * Adds a book read from another program after what the manuscript holds: at its end, or
 * at the end of the part `into` names. When `continueChapter` names a chapter, the text
 * before the book's first heading becomes further scenes of it, for a novel kept in
 * several files whose chapter runs on from one file to the next. Files are written
 * directly (a reload per scene would be slow on a long novel). A title that cannot be a
 * file name as it is, or that repeats another, is kept as the `title` property.
 */
export async function importBookInto(project: Project, book: ImportedBook, options: { into?: string; continueChapter?: string } = {}): Promise<void> {
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
  if (book.hasParts && !project.settings.structure.parts) {
    // With parts on, a folder at the top reads as a part: the chapters already there say they are not.
    for (const c of project.manuscript.children) {
      if (c.kind !== "chapter") continue;
      const note = folderNotePath(c.path);
      const text = (await project.fs.exists(note)) ? await project.fs.readText(note) : "";
      await project.fs.writeText(note, writeProperties(text, { kind: "chapter" }));
    }
    await project.saveSettings({ ...project.settings, structure: { ...project.settings.structure, parts: true } });
  }
  const continued = options.continueChapter ? findNode(project.manuscript, options.continueChapter) : null;
  const opening = book.parts[0]?.chapters[0];
  if (continued && opening?.untitled) {
    const taken = new Set([continued.fileTitle.toLowerCase(), ...continued.children.map((c) => c.fileTitle.toLowerCase())]);
    let order = nextOrder(continued);
    for (const scene of opening.scenes) {
      const file = fileName(scene.title, taken);
      await project.fs.writeText(join(continued.path, formatName(order, file) + ".md"), withTitle(scene.title, file, scene.text ? scene.text + "\n" : "", scene.synopsis));
      order += step;
    }
    book = { ...book, parts: [{ ...book.parts[0], chapters: book.parts[0].chapters.slice(1) }, ...book.parts.slice(1)] };
    await project.reload();
  }
  // Chapters go into a part only when the book has none of its own.
  const into = options.into && !book.hasParts ? findNode(project.manuscript, options.into) : null;
  const root = into && into.kind === "part" ? into : project.manuscript;
  const rootTaken = new Set([...(root === project.manuscript ? [] : [root.fileTitle.toLowerCase()]), ...root.children.map((c) => c.fileTitle.toLowerCase())]);
  let rootOrder = nextOrder(root);
  const writeChapter = async (dir: string, order: number, chapter: ImportedBook["parts"][number]["chapters"][number], taken: Set<string>) => {
    const name = fileName(chapter.title, taken);
    const path = join(dir, formatName(order, name));
    await project.fs.mkdir(path);
    // A prologue or epilogue is said so; a chapter outside the parts must say it is one.
    const kind = /^(prolog(?:ue|o)?|prólogo)$/i.test(chapter.title.trim())
      ? "prologue"
      : /^(epilog(?:ue|o)?|epílogo)$/i.test(chapter.title.trim())
        ? "epilogue"
        : dir === project.manuscript.path && project.settings.structure.parts
          ? "chapter"
          : null;
    const note = withTitle(chapter.title, name, "", chapter.synopsis);
    if (kind || note) await project.fs.writeText(folderNotePath(path), kind ? writeProperties(note, { kind }) : note);
    // A scene may not share its chapter's name, or it would be read as the chapter's note.
    const scenes = new Set([name.toLowerCase()]);
    let sceneOrder = step;
    for (const scene of chapter.scenes) {
      const file = fileName(scene.title, scenes);
      await project.fs.writeText(join(path, formatName(sceneOrder, file) + ".md"), withTitle(scene.title, file, scene.text ? scene.text + "\n" : "", scene.synopsis));
      sceneOrder += step;
    }
  };
  for (const part of book.parts) {
    if (book.hasParts && part.title) {
      const name = fileName(part.title, rootTaken);
      const path = join(root.path, formatName(rootOrder, name));
      rootOrder += step;
      await project.fs.mkdir(path);
      await project.fs.writeText(folderNotePath(path), writeProperties(withTitle(part.title, name, "", part.synopsis), { kind: "part" }));
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
  await project.reload();
}

/**
 * Writes the documents another program keeps beside the book as notes, each group where
 * `destinations` says (as `noteDestination` guesses when it says nothing): into a type's
 * folder of the Story Bible, Research or the Laboratory, keeping the folders below. In
 * Research and the Laboratory a group keeps a folder of its own, except Scrivener's own
 * Research. Nothing already there is overwritten: a note with a name in use gets a number.
 */
export async function importNotesInto(project: Project, notes: ImportedNote[], destinations: Record<string, NoteDestination> = {}): Promise<void> {
  if (!notes.length) return;
  const { folders } = project.settings;
  const taken = new Set<string>();
  const free = async (dir: string, title: string, extension: string) => {
    const base = sanitizeTitle(title) || "Untitled";
    for (let n = 1; ; n++) {
      const path = join(dir, `${n === 1 ? base : `${base} ${n}`}.${extension}`);
      if (!taken.has(path.toLowerCase()) && !(await project.fs.exists(path))) {
        taken.add(path.toLowerCase());
        return path;
      }
    }
  };
  const clean = (name: string) => sanitizeTitle(name) || "Untitled";
  for (const note of notes) {
    const to = destinations[note.group] ?? noteDestination(project.settings.types, note.group, note.research);
    if (to === "skip") continue;
    const type = to.startsWith("codex:") ? project.settings.types[to.slice("codex:".length)] : undefined;
    // The group's own text, or a group that is one document, is a note at the top of where it goes.
    const own = note.title === note.group && !note.folders.length;
    const base = type ? join(folders.codex, type.folder) : join(to === "laboratory" ? folders.laboratory : folders.research, ...(note.research || own ? [] : [clean(note.group)]));
    const dir = join(base, ...note.folders.map(clean));
    await project.fs.mkdir(dir);
    if (note.file) {
      await project.fs.writeBytes(await free(dir, note.title, note.file.extension), note.file.bytes);
      continue;
    }
    const path = await free(dir, note.title, "md");
    const body = note.text ? note.text + "\n" : "";
    const properties: Properties = {};
    if (note.title.trim() !== stripExt(basename(path))) properties[TITLE] = note.title.trim();
    if (note.synopsis?.trim()) properties[SYNOPSIS] = note.synopsis.trim();
    await project.fs.writeText(path, Object.keys(properties).length ? writeProperties(body, properties) : body);
  }
  await project.reload();
}
