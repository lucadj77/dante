// One door for every document Dante can read as a book: Word, OpenDocument, RTF, and
// Markdown or plain text. Each gives the same headings and paragraphs, shown in the same
// preview before anything is written.

import { escapeStart, readDocx, type DocBlock, type DocxContent } from "./docx";
import { readOdt } from "./odt";
import { rtfParagraphs } from "./rtf";

/** The extensions of the documents that can be imported, without the dot. */
export const DOCUMENT_EXTENSIONS = ["docx", "odt", "rtf", "md", "markdown", "txt"];

const extension = (name: string) => (/\.([^./\\]+)$/.exec(name)?.[1] ?? "").toLowerCase();

/** Whether a file can be imported, by its name. */
export function isDocument(name: string): boolean {
  return DOCUMENT_EXTENSIONS.includes(extension(name));
}

/** Text as bytes say it: UTF-8, or Windows-1252 when the bytes are not UTF-8. */
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/**
 * A Markdown file as headings and paragraphs. The properties at its top give title and
 * author when they name them; what is between blank lines stays together, as written.
 */
export function readMarkdown(text: string): DocxContent {
  let source = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  let title = "";
  let author = "";
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (front) {
    source = source.slice(front[0].length);
    const value = (key: string) => new RegExp(`^${key}:[ \\t]*["']?(.*?)["']?[ \\t]*$`, "mi").exec(front[1])?.[1] ?? "";
    title = value("title");
    author = value("author");
  }
  const blocks: DocBlock[] = [];
  let paragraph: string[] = [];
  let fence = false;
  let blank = 0;
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const line of source.split("\n")) {
    if (/^(```|~~~)/.test(line)) fence = !fence;
    const heading = fence ? null : /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
    if (heading) {
      flush();
      blank = 0;
      if (heading[2]) blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    } else if (!fence && !line.trim()) {
      flush();
      // More than one blank line in a row is a space the writer left: kept as empty paragraphs.
      if (++blank > 1 && blocks.length) blocks.push({ kind: "paragraph", text: "" });
    } else {
      blank = 0;
      paragraph.push(line);
    }
  }
  flush();
  return { title, author, blocks };
}

/** Plain text: each line is a paragraph, an empty line an empty paragraph. */
export function readPlainText(text: string): DocxContent {
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return { title: "", author: "", blocks: lines.map((line) => ({ kind: "paragraph", text: line.trim() ? escapeStart(line.trim().replace(/[\\*_`]/g, "\\$&")) : "" })) };
}

/** Reads a document of any of the kinds Dante imports, told apart by the file's name. */
export async function readDocumentFile(bytes: Uint8Array, name: string, labels: { note: string } = { note: "Note" }): Promise<DocxContent> {
  switch (extension(name)) {
    case "docx":
      return readDocx(bytes, labels);
    case "odt":
      return readOdt(bytes);
    case "rtf":
      // RTF is ASCII: every other character is written as an escape.
      return { title: "", author: "", blocks: rtfParagraphs(new TextDecoder("latin1").decode(bytes)).map((text) => ({ kind: "paragraph", text })) };
    case "md":
    case "markdown":
      return readMarkdown(decodeText(bytes));
    case "txt":
      return readPlainText(decodeText(bytes));
    default:
      throw new Error(`Unknown kind of document: ${name}`);
  }
}
