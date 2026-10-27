// Reads a Scrivener project (a folder ending in .scriv) as the document an import works on.
// The binder of the .scrivx file gives the structure: inside the Draft (or Manuscript)
// folder, each folder and each text becomes a heading, one level deeper at each step, so a
// folder of texts reads as a chapter of scenes. Each text's words come from its RTF file,
// and the synopsis Scrivener keeps beside it becomes the synopsis of the scene or chapter.
// Scrivener 3 keeps a text in Files/Data/<UUID>/content.rtf; Scrivener 2 and the first
// Windows versions in Files/Docs/<ID>.rtf.
// The rest of the binder (Research, Characters, Places and any other folder, but not the
// Trash) becomes notes, kept with the folders they are in; PDFs and pictures come as files.

import type { DocBlock, DocxContent } from "./docx";
import { rtfParagraphs } from "./rtf";
import { child, childrenNamed, descendants, parseXml, textOf, type XmlElement } from "./xml";

/** Why a Scrivener project cannot be read, for a message in the writer's language. */
export class ScrivenerError extends Error {
  constructor(public reason: "empty" | "notProject" | "noDraft") {
    super(reason === "empty" ? "The file is empty" : reason === "noDraft" ? "The Scrivener project has no Draft folder" : "Not a Scrivener project");
  }
}

/** The files of a Scrivener project, by their path inside the .scriv folder; null when missing. */
export type ScrivenerFiles = (path: string) => Promise<Uint8Array | null>;

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** A document of the project outside the draft, made into a note or a file of the new project. */
export interface ImportedNote {
  /** The folders of the binder it is in, from the top; inside Research, from Research down. */
  folders: string[];
  /** It is in Scrivener's Research folder. */
  research: boolean;
  title: string;
  /** Markdown text of a text document or of a folder that has one. */
  text?: string;
  synopsis?: string;
  /** A PDF, picture or other file kept as it is. */
  file?: { bytes: Uint8Array; extension: string };
}

/** The folder of the binder that is the book. */
function draftFolder(binder: XmlElement): XmlElement | undefined {
  const top = childrenNamed(binder, "BinderItem");
  return top.find((item) => item.attrs.Type === "DraftFolder") ?? top.find((item) => /^(draft|manuscript|bozza|manoscritto)$/i.test(titleOf(item)));
}

function titleOf(item: XmlElement): string {
  const own = child(item, "Title");
  return own ? textOf(own).trim() : "";
}

/** Files a document that is not a text may be: Scrivener says its extension, older versions do not. */
const FILE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "gif", "tiff", "tif", "heic", "webp", "docx", "txt", "md"];

function itemsIn(item: XmlElement): XmlElement[] {
  const children = child(item, "Children");
  return children ? childrenNamed(children, "BinderItem") : [];
}

/** Reads the project whose .scrivx file is `scrivx`, finding the documents with `files`. */
export async function readScrivener(scrivx: string, files: ScrivenerFiles, name = "", untitled = "Untitled"): Promise<DocxContent> {
  const project = parseXml(scrivx);
  const binder = descendants(project, "Binder")[0];
  if (!binder) throw new ScrivenerError("notProject");
  const meta = (tag: string) => {
    const found = descendants(project, tag)[0];
    return found ? textOf(found).trim() : "";
  };

  const text = async (path: string) => {
    const bytes = await files(path);
    return bytes ? decode(bytes) : null;
  };
  /** The RTF of a binder item and its synopsis, wherever this version of Scrivener keeps them. */
  const documentOf = async (item: XmlElement) => {
    const uuid = item.attrs.UUID;
    const id = item.attrs.ID;
    const rtf = (uuid ? await text(`Files/Data/${uuid}/content.rtf`) : null) ?? (id ? await text(`Files/Docs/${id}.rtf`) : null);
    const synopsis = (uuid ? await text(`Files/Data/${uuid}/synopsis.txt`) : null) ?? (id ? await text(`Files/Docs/${id}_synopsis.txt`) : null);
    return { paragraphs: rtf ? rtfParagraphs(rtf) : [], synopsis: synopsis?.trim() ?? "" };
  };

  const blocks: DocBlock[] = [];
  const visit = async (item: XmlElement, level: number) => {
    const title = titleOf(item);
    const { paragraphs, synopsis } = await documentOf(item);
    const heading: DocBlock = { kind: "heading", level, text: title || untitled };
    if (synopsis) heading.synopsis = synopsis;
    blocks.push(heading);
    for (const p of paragraphs) blocks.push({ kind: "paragraph", text: p });
    for (const inner of itemsIn(item)) await visit(inner, level + 1);
  };
  const book = draftFolder(binder);
  for (const item of book ? itemsIn(book) : []) await visit(item, 1);
  if (!blocks.length) throw new ScrivenerError("noDraft");

  const notes: ImportedNote[] = [];
  /** The file of a document that is not a text, such as a PDF in Research. */
  const fileOf = async (item: XmlElement) => {
    const uuid = item.attrs.UUID;
    const id = item.attrs.ID;
    const said = descendants(item, "FileExtension")[0];
    const extensions = said ? [textOf(said).trim().toLowerCase()] : FILE_EXTENSIONS;
    for (const extension of extensions) {
      const bytes = (uuid ? await files(`Files/Data/${uuid}/content.${extension}`) : null) ?? (id ? await files(`Files/Docs/${id}.${extension}`) : null);
      if (bytes) return { bytes, extension };
    }
    return null;
  };
  const collect = async (item: XmlElement, folders: string[], research: boolean) => {
    const title = titleOf(item) || untitled;
    const inner = itemsIn(item);
    const { paragraphs, synopsis } = await documentOf(item);
    const text = paragraphs.filter((p) => p.trim()).join("\n\n");
    const isText = /^(Text|Folder)$/.test(item.attrs.Type ?? "Text") || !!text;
    if (isText) {
      // A folder is a note only when it has words of its own; its documents go inside it.
      if (text || synopsis || item.attrs.Type !== "Folder") notes.push({ folders, research, title, text, synopsis: synopsis || undefined });
    } else {
      const file = await fileOf(item);
      if (file) notes.push({ folders, research, title, file });
    }
    for (const each of inner) await collect(each, [...folders, title], research);
  };
  for (const item of childrenNamed(binder, "BinderItem")) {
    if (item === book || item.attrs.Type === "TrashFolder") continue;
    // Research is a place of its own in Dante too: what is in it goes there without the folder's name.
    if (item.attrs.Type === "ResearchFolder") {
      const { paragraphs, synopsis } = await documentOf(item);
      const text = paragraphs.filter((p) => p.trim()).join("\n\n");
      if (text) notes.push({ folders: [], research: true, title: titleOf(item) || untitled, text, synopsis: synopsis || undefined });
      for (const each of itemsIn(item)) await collect(each, [], true);
    } else await collect(item, [], false);
  }
  return { title: meta("ProjectTitle") || name, author: meta("FullName") || meta("AuthorName"), blocks, notes };
}

/**
 * Reads a Scrivener project from a zip of its .scriv folder, wherever the folder is inside
 * it. `entries` are the zip's files by path.
 */
export async function readScrivenerZip(entries: Map<string, () => Promise<Uint8Array>>, untitled?: string): Promise<DocxContent> {
  const scrivx = [...entries.keys()].filter((p) => /\.scrivx$/i.test(p) && !p.split("/").some((s) => s.startsWith("._") || s === "__MACOSX")).sort((a, b) => a.length - b.length)[0];
  if (!scrivx) throw new ScrivenerError("notProject");
  const root = scrivx.includes("/") ? scrivx.slice(0, scrivx.lastIndexOf("/") + 1) : "";
  const read = async (path: string) => {
    const file = entries.get(root + path);
    return file ? file() : null;
  };
  const name = scrivx.slice(root.length).replace(/\.scrivx$/i, "");
  return readScrivener(decode(await entries.get(scrivx)!()), read, name, untitled);
}
