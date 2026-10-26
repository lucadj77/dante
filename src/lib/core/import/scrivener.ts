// Reads a Scrivener project (a folder ending in .scriv) as the document an import works on.
// The binder of the .scrivx file gives the structure: inside the Draft (or Manuscript)
// folder, each folder and each text becomes a heading, one level deeper at each step, so a
// folder of texts reads as a chapter of scenes. Each text's words come from its RTF file,
// and the synopsis Scrivener keeps beside it becomes the synopsis of the scene or chapter.
// Scrivener 3 keeps a text in Files/Data/<UUID>/content.rtf; Scrivener 2 and the first
// Windows versions in Files/Docs/<ID>.rtf.

import type { DocBlock, DocxContent } from "./docx";
import { rtfParagraphs } from "./rtf";
import { child, childrenNamed, descendants, parseXml, textOf, type XmlElement } from "./xml";

/** The files of a Scrivener project, by their path inside the .scriv folder; null when missing. */
export type ScrivenerFiles = (path: string) => Promise<Uint8Array | null>;

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** The binder items inside the draft, the part of the project that is the book. */
function draft(binder: XmlElement): XmlElement[] {
  const top = childrenNamed(binder, "BinderItem");
  const folder = top.find((item) => item.attrs.Type === "DraftFolder") ?? top.find((item) => /^(draft|manuscript|bozza|manoscritto)$/i.test(textOf(child(item, "Title") ?? item).trim()));
  return folder ? itemsIn(folder) : [];
}

function itemsIn(item: XmlElement): XmlElement[] {
  const children = child(item, "Children");
  return children ? childrenNamed(children, "BinderItem") : [];
}

/** Reads the project whose .scrivx file is `scrivx`, finding the documents with `files`. */
export async function readScrivener(scrivx: string, files: ScrivenerFiles, name = "", untitled = "Untitled"): Promise<DocxContent> {
  const project = parseXml(scrivx);
  const binder = descendants(project, "Binder")[0];
  if (!binder) throw new Error("Not a Scrivener project");
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
    const own = child(item, "Title");
    const title = own ? textOf(own).trim() : "";
    const { paragraphs, synopsis } = await documentOf(item);
    const heading: DocBlock = { kind: "heading", level, text: title || untitled };
    if (synopsis) heading.synopsis = synopsis;
    blocks.push(heading);
    for (const p of paragraphs) blocks.push({ kind: "paragraph", text: p });
    for (const inner of itemsIn(item)) await visit(inner, level + 1);
  };
  for (const item of draft(binder)) await visit(item, 1);
  if (!blocks.length) throw new Error("The Scrivener project has no Draft folder");
  return { title: meta("ProjectTitle") || name, author: meta("FullName") || meta("AuthorName"), blocks };
}

/**
 * Reads a Scrivener project from a zip of its .scriv folder, wherever the folder is inside
 * it. `entries` are the zip's files by path.
 */
export async function readScrivenerZip(entries: Map<string, () => Promise<Uint8Array>>, untitled?: string): Promise<DocxContent> {
  const scrivx = [...entries.keys()].filter((p) => /\.scrivx$/i.test(p) && !p.split("/").some((s) => s.startsWith("._") || s === "__MACOSX")).sort((a, b) => a.length - b.length)[0];
  if (!scrivx) throw new Error("No .scrivx file in the zip");
  const root = scrivx.includes("/") ? scrivx.slice(0, scrivx.lastIndexOf("/") + 1) : "";
  const read = async (path: string) => {
    const file = entries.get(root + path);
    return file ? file() : null;
  };
  const name = scrivx.slice(root.length).replace(/\.scrivx$/i, "");
  return readScrivener(decode(await entries.get(scrivx)!()), read, name, untitled);
}
