// Reads an OpenDocument text (.odt, as LibreOffice and others write it) as headings and
// paragraphs in Markdown, like a Word file: bold, italic, strikethrough and highlighting
// are kept, from the automatic styles of the text; headings come from their outline level,
// the title and author from the file's metadata; footnotes become footnotes. Centred and
// right-aligned paragraphs keep their alignment.

import { setAlignment, type Align } from "../alignment";
import { escapeStart, renderFormatted, type DocBlock, type DocxContent, type Format } from "./docx";
import { unzip } from "./unzip";
import { child, descendants, isElement, parseXml, textOf, type XmlElement } from "./xml";

interface OdtStyle {
  parent: string | null;
  format: Format;
  align?: Align;
}

/** The styles of the text, by name: what each says of its own, and the style it builds on. */
function readStyles(roots: XmlElement[]): Map<string, OdtStyle> {
  const styles = new Map<string, OdtStyle>();
  for (const root of roots) {
    for (const style of descendants(root, "style:style")) {
      const name = style.attrs["style:name"];
      if (!name) continue;
      const text = child(style, "style:text-properties")?.attrs ?? {};
      const paragraph = child(style, "style:paragraph-properties")?.attrs ?? {};
      const format: Format = {};
      if (text["fo:font-weight"]) format.bold = text["fo:font-weight"] === "bold" || Number(text["fo:font-weight"]) >= 600;
      if (text["fo:font-style"]) format.italic = text["fo:font-style"] === "italic" || text["fo:font-style"] === "oblique";
      if (text["style:text-line-through-style"]) format.strike = text["style:text-line-through-style"] !== "none";
      if (text["fo:background-color"]) format.highlight = text["fo:background-color"] !== "transparent";
      const jc = paragraph["fo:text-align"];
      const align: Align | undefined = jc === "center" ? "center" : jc === "end" || jc === "right" ? "right" : undefined;
      styles.set(name, { parent: style.attrs["style:parent-style-name"] ?? null, format, ...(align ? { align } : {}) });
    }
  }
  return styles;
}

/** What a style says, with what the styles it builds on say where it is silent. */
function resolved(styles: Map<string, OdtStyle>, name: string | undefined): { format: Format; align?: Align } {
  const format: Format = {};
  let align: Align | undefined;
  const seen = new Set<string>();
  for (let id = name ?? null; id && !seen.has(id); id = styles.get(id)?.parent ?? null) {
    seen.add(id);
    const style = styles.get(id);
    if (!style) break;
    for (const key of Object.keys(style.format) as (keyof Format)[]) if (format[key] === undefined) format[key] = style.format[key];
    align ??= style.align;
  }
  return { format, align };
}

/** Whether a style is the one called `wanted`, or builds on it. */
function isStyle(styles: Map<string, OdtStyle>, name: string | undefined, wanted: string): boolean {
  const seen = new Set<string>();
  for (let id = name ?? null; id && !seen.has(id); id = styles.get(id)?.parent ?? null) {
    if (id.toLowerCase() === wanted) return true;
    seen.add(id);
  }
  return false;
}

/** The text of a note, in one line and without formatting. */
function noteText(note: XmlElement): string {
  const body = child(note, "text:note-body");
  if (!body) return "";
  return descendants(body, "text:p").map(plain).join(" ").replace(/\s+/g, " ").trim();
}

/** The text of an element as the reader sees it: spaces, tabs and line breaks included. */
function plain(element: XmlElement): string {
  return element.children
    .map((c) => {
      if (!isElement(c)) return c;
      if (c.name === "text:s") return " ".repeat(Number(c.attrs["text:c"] ?? 1) || 1);
      if (c.name === "text:tab") return "\t";
      if (c.name === "text:line-break") return "\n";
      if (c.name === "text:note" || c.name === "office:annotation" || c.name === "office:annotation-end") return "";
      return plain(c);
    })
    .join("");
}

/** A paragraph or heading as Markdown; headings keep no bold of their own. */
function paragraphText(paragraph: XmlElement, styles: Map<string, OdtStyle>, base: Format, heading: boolean): string {
  let out = "";
  let pieces: { text: string; format: Format }[] = [];
  const flush = () => {
    out += renderFormatted(pieces);
    pieces = [];
  };
  const visit = (element: XmlElement, format: Format) => {
    for (const c of element.children) {
      if (!isElement(c)) {
        if (c) pieces.push({ text: c, format });
        continue;
      }
      switch (c.name) {
        case "text:span": {
          const own = resolved(styles, c.attrs["text:style-name"]).format;
          const next: Format = { ...format };
          for (const key of Object.keys(own) as (keyof Format)[]) next[key] = own[key];
          visit(c, next);
          break;
        }
        case "text:s":
          pieces.push({ text: " ".repeat(Number(c.attrs["text:c"] ?? 1) || 1), format });
          break;
        case "text:tab":
          pieces.push({ text: " ", format });
          break;
        case "text:line-break":
          flush();
          out += "\n";
          break;
        case "text:note": {
          const note = noteText(c);
          flush();
          if (note) out += `^[${renderFormatted([{ text: note, format: {} }]).replace(/\\?([\[\]])/g, "\\$1")}]`;
          break;
        }
        case "office:annotation":
        case "office:annotation-end":
        case "text:bookmark":
        case "text:soft-page-break":
          break;
        default:
          // Links, changes kept in the text and the like: their text is the document's.
          visit(c, format);
      }
    }
  };
  visit(paragraph, heading ? {} : base);
  flush();
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

/** The blocks of the document's body, from its `content.xml`; `stylesXml` is the file's `styles.xml`. */
export function readOdtContent(contentXml: string, stylesXml = ""): DocBlock[] {
  const content = parseXml(contentXml);
  const styles = readStyles(stylesXml ? [parseXml(stylesXml), content] : [content]);
  const body = descendants(content, "office:text")[0];
  if (!body) throw new Error("Not an OpenDocument text");
  const blocks: DocBlock[] = [];
  const visit = (element: XmlElement) => {
    for (const node of element.children) {
      if (!isElement(node)) continue;
      if (node.name === "text:h") {
        const text = paragraphText(node, styles, {}, true).replace(/\s*\n\s*/g, " ");
        if (text) blocks.push({ kind: "heading", level: Math.min(6, Math.max(1, Number(node.attrs["text:outline-level"] ?? 1) || 1)), text });
      } else if (node.name === "text:p" && isStyle(styles, node.attrs["text:style-name"], "title")) {
        // The book's title, as in a Word file.
        const text = paragraphText(node, styles, {}, true).replace(/\s*\n\s*/g, " ");
        if (text) blocks.push({ kind: "heading", level: 0, text });
      } else if (node.name === "text:p") {
        const style = resolved(styles, node.attrs["text:style-name"]);
        const text = paragraphText(node, styles, style.format, false);
        blocks.push({ kind: "paragraph", text: text ? setAlignment(escapeStart(text), style.align ?? null) : "" });
      } else if (node.name === "text:tracked-changes" || node.name === "text:table-of-content" || node.name === "office:forms" || node.name === "text:sequence-decls") {
        // Not the text of the book.
      } else {
        // Lists, sections, tables and frames: their paragraphs in reading order.
        visit(node);
      }
    }
  };
  visit(body);
  return blocks;
}

/** Reads the text, title and author of an .odt file. */
export async function readOdt(bytes: Uint8Array): Promise<DocxContent> {
  const files = await unzip(bytes);
  const read = async (name: string) => {
    const file = files.get(name);
    return file ? new TextDecoder().decode(await file()) : "";
  };
  const content = await read("content.xml");
  if (!content) throw new Error("Not an OpenDocument text");
  const blocks = readOdtContent(content, await read("styles.xml"));
  const meta = parseXml(await read("meta.xml"));
  const tag = (name: string) => descendants(meta, name).map(textOf).join("").trim();
  return { title: tag("dc:title"), author: tag("dc:creator") || tag("meta:initial-creator"), blocks };
}
