import type { DocxSettings, Separator } from "../settings";
import type { Block, Book, BookEntry, Run } from "./book";
import { PARATEXT_LABELS } from "./docx";
import { zip } from "./zip";

// The book as an EPUB 3 ebook: one XHTML file per part, chapter and page of front and
// back matter, with a table of contents. Readers choose font and size, so only the
// structure, separators and headings come from the export settings.

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const lines = (text: string) => text.split("\n").map(escapeXml).join("<br/>");

function runs(items: Run[]): string {
  return items
    .map((r) => {
      if (r.lineBreak) return "<br/>";
      let out = escapeXml(r.text);
      if (r.code) out = `<code>${out}</code>`;
      if (r.italic) out = `<em>${out}</em>`;
      if (r.bold) out = `<strong>${out}</strong>`;
      if (r.strike) out = `<s>${out}</s>`;
      return out;
    })
    .join("");
}

/** The ebook's default stylesheet; the project can replace it (export.epubCss). */
export const EPUB_CSS = `body { font-family: serif; line-height: 1.5; margin: 0 5%; }
p { margin: 0; text-indent: 1.2em; text-align: justify; }
p.first, h1 + p, h2 + p, h3 + p, h4 + p, .break + p, blockquote + p { text-indent: 0; }
h1, h2, h3, h4, h5, h6 { text-align: center; font-weight: normal; margin: 2em 0 1.5em; page-break-after: avoid; }
h1 { font-size: 1.6em; font-weight: bold; margin-top: 4em; }
h2 { font-size: 1.3em; font-weight: bold; margin-top: 3em; }
h3 { font-size: 1.1em; font-style: italic; }
.part h1 { margin-top: 30%; }
.break { text-indent: 0; text-align: center; margin: 1em 0; }
.blank { margin: 1.5em 0 0; }
.pagebreak { page-break-before: always; }
blockquote { margin: 0.5em 2em; }
blockquote p { text-indent: 0; }
pre { white-space: pre-wrap; font-size: 0.9em; }
.title { text-align: center; margin-top: 30%; }
.title h1 { margin: 0 0 0.5em; font-size: 2em; }
.subtitle { font-size: 1.3em; font-style: italic; text-indent: 0; text-align: center; }
.author { text-indent: 0; text-align: center; margin-top: 2em; }
.dedication p { text-align: center; text-indent: 0; font-style: italic; margin-top: 30%; }
.epigraph { margin: 30% 0 0 30%; }
.epigraph p { text-align: right; text-indent: 0; font-style: italic; }
.epigraph p.source { font-style: normal; margin-top: 0.5em; }
.colophon p { text-align: center; text-indent: 0; font-size: 0.85em; margin-top: 1em; }
`;

function page(title: string, language: string, body: string, kind = ""): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="UTF-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body${kind ? ` class="${kind}"` : ""}>
${body}
</body>
</html>
`;
}

interface Chapter {
  file: string;
  /** Shown in the table of contents; none for pages without a heading. */
  label: string;
  /** Chapters inside a part are listed under it. */
  inPart: boolean;
  part: boolean;
  html: string;
}

/** Renders the book as an EPUB file. `id` identifies the book across exports. */
export function bookToEpub(book: Book, opts: DocxSettings, id: string, now = new Date(), css = ""): Uint8Array {
  const language = book.language || "en";
  const title = book.title || "Untitled";
  const hasParts = book.entries.some((e) => e.kind === "part");
  const chapterTag = hasParts ? "h2" : "h1";
  const sceneTag = hasParts ? "h3" : "h2";
  const paratextLabels = PARATEXT_LABELS[language.slice(0, 2)] ?? PARATEXT_LABELS.en;
  const paragraphs = (text: string, cls = "") =>
    text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p${cls ? ` class="${cls}"` : ""}>${lines(p)}</p>`)
      .join("\n");

  const chapters: Chapter[] = [];
  const add = (label: string, html: string, part = false, inPart = false) => {
    chapters.push({ file: `text${String(chapters.length + 1).padStart(3, "0")}.xhtml`, label, html, part, inPart });
  };

  const front: string[] = [];
  if (opts.titlePage) {
    front.push(
      page(title, language, `<div class="title"><h1>${lines(title)}</h1>${book.subtitle ? `<p class="subtitle">${lines(book.subtitle)}</p>` : ""}<p class="author">${escapeXml(book.author)}</p></div>`),
    );
  }
  if (book.paratext.dedication.trim()) front.push(page(title, language, `<div class="dedication">${paragraphs(book.paratext.dedication)}</div>`));
  if (book.paratext.epigraph.trim()) {
    const source = book.paratext.epigraphSource.trim() ? `<p class="source">${lines(book.paratext.epigraphSource.trim())}</p>` : "";
    front.push(page(title, language, `<div class="epigraph">${paragraphs(book.paratext.epigraph)}${source}</div>`));
  }
  for (const html of front) add("", html);

  const separator = (kind: Separator): string => {
    if (kind === "characters") return `<p class="break">${lines(opts.sceneSeparator)}</p>`;
    if (kind === "blankLine") return `<p class="break blank"></p>`;
    if (kind === "pageBreak") return `<div class="pagebreak"></div>`;
    return "";
  };
  const blocks = (items: Block[], level: number): string => {
    let first = true;
    const out: string[] = [];
    for (const block of items) {
      if (block.type === "heading") out.push(`<h${Math.min(6, level + block.level)}>${runs(block.runs)}</h${Math.min(6, level + block.level)}>`);
      else if (block.type === "quote") out.push(`<blockquote><p>${runs(block.runs)}</p></blockquote>`);
      else if (block.type === "break") out.push(`<p class="break">${lines(opts.sceneSeparator)}</p>`);
      else if (block.runs.length && block.runs.every((r) => r.code)) out.push(`<pre>${escapeXml(block.runs.map((r) => r.text).join(""))}</pre>`);
      else out.push(`<p${first ? ' class="first"' : ""}>${runs(block.runs)}</p>`);
      first = block.type !== "paragraph";
    }
    return out.join("\n");
  };

  let inPart = false;
  let current: { label: string; body: string[] } | null = null;
  const flush = () => {
    if (current) add(current.label, page(current.label || title, language, current.body.join("\n")), false, inPart);
    current = null;
  };
  for (const e of book.entries as BookEntry[]) {
    if (e.kind === "part") {
      flush();
      add(e.heading.replace(/\n/g, " "), page(e.heading, language, `<h1>${lines(e.heading)}</h1>`, "part"), true);
      inPart = true;
      continue;
    }
    // A prologue or an epilogue stands outside the parts.
    if (e.kind === "prologue" || e.kind === "epilogue") {
      flush();
      inPart = false;
    }
    // A new chapter starts a new file unless the settings run chapters together.
    if (!current || opts.chapterBreak === "pageBreak" || e.kind === "loose") {
      flush();
      current = { label: e.heading.replace(/\n/g, " "), body: [] };
    } else {
      current.body.push(separator(opts.chapterBreak));
    }
    const level = Number(sceneTag.slice(1));
    if (e.heading) current.body.push(`<${chapterTag}>${lines(e.heading)}</${chapterTag}>`);
    e.scenes.forEach((scene, i) => {
      if (i > 0) current!.body.push(separator(opts.sceneBreak));
      if (scene.heading) current!.body.push(`<${sceneTag}>${lines(scene.heading)}</${sceneTag}>`);
      current!.body.push(blocks(scene.blocks, level));
    });
  }
  flush();

  const back = (label: string, text: string) => {
    if (text.trim()) add(label, page(label, language, `<${chapterTag}>${escapeXml(label)}</${chapterTag}>\n${paragraphs(text)}`));
  };
  back(paratextLabels.authorNote, book.paratext.authorNote);
  back(paratextLabels.acknowledgements, book.paratext.acknowledgements);
  if (book.paratext.colophon.trim()) add("", page(title, language, `<div class="colophon">${paragraphs(book.paratext.colophon)}</div>`));

  // The table of contents: parts with their chapters inside.
  const toc: string[] = [];
  let open = false;
  for (const c of chapters) {
    if (!c.label) continue;
    if (open && !c.inPart) {
      toc.push("</ol></li>");
      open = false;
    }
    if (c.part) {
      if (open) toc.push("</ol></li>");
      toc.push(`<li><a href="${c.file}">${escapeXml(c.label)}</a><ol>`);
      open = true;
    } else {
      toc.push(`<li><a href="${c.file}">${escapeXml(c.label)}</a></li>`);
    }
  }
  if (open) toc.push("</ol></li>");
  // A part without chapters would leave an empty list, which EPUB does not allow.
  const tocHtml = toc.join("\n").replace(/<ol>\n<\/ol>/g, "");
  const nav = page(title, language, `<nav epub:type="toc" id="toc"><h1>${escapeXml(title)}</h1><ol>\n${tocHtml || `<li><a href="${chapters[0]?.file ?? "nav.xhtml"}">${escapeXml(title)}</a></li>`}\n</ol></nav>`);

  const modified = now.toISOString().replace(/\.\d+Z$/, "Z");
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${language}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">urn:uuid:${id}</dc:identifier>
<dc:title>${escapeXml(title)}</dc:title>
<dc:creator>${escapeXml(book.author)}</dc:creator>
<dc:language>${escapeXml(language)}</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>
${chapters.map((c, i) => `<item id="c${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`).join("\n")}
</manifest>
<spine>
${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join("\n")}
</spine>
</package>
`;
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`;
  return zip(
    [
      { name: "mimetype", data: "application/epub+zip" },
      { name: "META-INF/container.xml", data: container },
      { name: "OEBPS/content.opf", data: opf },
      { name: "OEBPS/nav.xhtml", data: nav },
      { name: "OEBPS/style.css", data: css.trim() ? css : EPUB_CSS },
      ...chapters.map((c) => ({ name: `OEBPS/${c.file}`, data: c.html })),
    ],
    now,
  );
}
