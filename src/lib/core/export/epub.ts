import { separatorParts, type DocxSettings, type Separator } from "../settings";
import type { Block, Book, BookEntry, BookImage, Run } from "./book";
import { PARATEXT_LABELS } from "./docx";
import { zip } from "./zip";

// The book as an EPUB 3 ebook: one XHTML file per part, chapter and page of front and
// back matter, with a table of contents. Readers choose font and size, so only the
// structure, separators and headings come from the export settings.

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const lines = (text: string) => text.split("\n").map(escapeXml).join("<br/>");

/** A paragraph's runs as XHTML; `imageFile` gives where an image inside the text is in the book. */
function runs(items: Run[], imageFile?: (image: BookImage) => string): string {
  return items
    .map((r) => {
      if (r.image) {
        if (!imageFile) return "";
        return `<img class="inline" src="${imageFile(r.image)}" alt="${escapeXml(r.image.alt)}" style="width: ${Math.round(r.image.width)}px; max-width: 100%;"/>`;
      }
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
p.first, h1 + p, h2 + p, h3 + p, h4 + p, .break + p, .empty + p, blockquote + p { text-indent: 0; }
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
p.item { text-indent: -1.5em; text-align: left; }
p.item.more { text-indent: 0; }
p.item .marker { display: inline-block; width: 1.5em; text-indent: 0; }
p.align-center, p.align-right { text-indent: 0; }
p.align-center { text-align: center; }
p.align-right { text-align: right; }
p.align-left { text-align: left; }
p.align-justify { text-align: justify; }
pre { white-space: pre-wrap; font-size: 0.9em; }
table { border-collapse: collapse; margin: 1em auto; }
th, td { border: 1px solid #999; padding: 0.2em 0.5em; text-align: left; vertical-align: top; }
th { font-weight: bold; }
div.image { margin: 1em 0; text-indent: 0; }
div.image.align-center { text-align: center; }
div.image.align-right { text-align: right; }
img.inline { vertical-align: middle; }
caption { caption-side: bottom; font-style: italic; font-size: 0.9em; padding-top: 0.3em; }
div.image p.caption { text-indent: 0; font-style: italic; font-size: 0.9em; margin-top: 0.3em; }
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

/** An image that opens the ebook. */
export interface EpubCover {
  data: Uint8Array | string;
  mediaType: "image/png" | "image/jpeg" | "image/svg+xml";
}

const COVER_EXT: Record<EpubCover["mediaType"], string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" };

/** Renders the book as an EPUB file. `id` identifies the book across exports. */
export function bookToEpub(book: Book, opts: DocxSettings, id: string, now = new Date(), css = "", cover?: EpubCover): Uint8Array {
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
  // Each image file goes in once, however many times the text shows it.
  const images = new Map<string, { file: string; data: Uint8Array; mime: string }>();
  const imageFile = (image: BookImage): string => {
    let entry = images.get(image.path);
    if (!entry) {
      const ext = image.mime === "image/jpeg" ? "jpg" : image.mime === "image/gif" ? "gif" : "png";
      entry = { file: `images/image${images.size + 1}.${ext}`, data: image.data, mime: image.mime };
      images.set(image.path, entry);
    }
    return entry.file;
  };
  const add = (label: string, html: string, part = false, inPart = false) => {
    chapters.push({ file: `text${String(chapters.length + 1).padStart(3, "0")}.xhtml`, label, html, part, inPart });
  };

  const coverFile = cover ? `cover.${COVER_EXT[cover.mediaType]}` : "";
  if (cover) {
    // Styled here, not in the stylesheet, so a stylesheet of the author's cannot break it.
    add(
      "",
      page(title, language, `<div style="margin: 0; padding: 0; text-align: center; height: 100%;"><img src="${coverFile}" alt="${escapeXml(title)}" style="max-width: 100%; max-height: 100%; height: 100%; object-fit: contain;"/></div>`, "cover"),
    );
  }
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

  const blank = (n: number) => `<p class="break blank"></p>`.repeat(n);
  const characters = () => {
    const parts = separatorParts(opts.sceneSeparator, opts.lineSign);
    return blank(parts.before) + (parts.lines.length ? `<p class="break">${lines(parts.lines.join("\n"))}</p>` : "") + blank(parts.after);
  };
  const separator = (kind: Separator): string => {
    if (kind === "characters") return characters();
    if (kind === "blankLine") return blank(1);
    if (kind === "twoBlankLines") return blank(2);
    if (kind === "pageBreak") return `<div class="pagebreak"></div>`;
    return "";
  };
  const inline = (items: Run[]) => runs(items, imageFile);
  const blocks = (items: Block[], level: number): string => {
    let first = true;
    const out: string[] = [];
    for (const block of items) {
      if (block.type === "heading") out.push(`<h${Math.min(6, level + block.level)}>${inline(block.runs)}</h${Math.min(6, level + block.level)}>`);
      else if (block.type === "quote") out.push(`<blockquote><p>${inline(block.runs)}</p></blockquote>`);
      else if (block.type === "item") {
        // The bullet hangs out by 1.5em; each level goes in by as much.
        const left = `margin-left: ${(block.level + 1) * 1.5}em`;
        if (block.marker) out.push(`<p class="item" style="${left}"><span class="marker">${escapeXml(block.marker)}</span>${inline(block.runs)}</p>`);
        else out.push(`<p class="item more" style="${left}">${inline(block.runs)}</p>`);
      }
      else if (block.type === "break") out.push(characters());
      else if (block.type === "blank") out.push(`<p class="empty">&#160;</p>`);
      else if (block.type === "table") {
        const style = (i: number) => (block.align[i] ? ` style="text-align: ${block.align[i]}"` : "");
        const row = (cells: Run[][], tag: string) => `<tr>${cells.map((c, i) => `<${tag}${style(i)}>${runs(c)}</${tag}>`).join("")}</tr>`;
        const caption = block.caption ? `<caption>${inline(block.caption)}</caption>` : "";
        out.push(`<table>${caption}<thead>${row(block.header, "th")}</thead><tbody>${block.rows.map((r) => row(r, "td")).join("")}</tbody></table>`);
      } else if (block.type === "image") {
        const file = imageFile(block.image);
        out.push(`<div class="image${block.align ? ` align-${block.align}` : ""}"><img src="${file}" alt="${escapeXml(block.image.alt)}" style="width: ${Math.round(block.image.width)}px; max-width: 100%;"/>${block.caption ? `<p class="caption">${inline(block.caption)}</p>` : ""}</div>`);
      }
      else if (block.runs.length && block.runs.every((r) => r.code)) out.push(`<pre>${escapeXml(block.runs.map((r) => r.text).join(""))}</pre>`);
      else {
        const classes = [first ? "first" : "", block.align ? `align-${block.align}` : ""].filter(Boolean).join(" ");
        out.push(`<p${classes ? ` class="${classes}"` : ""}>${inline(block.runs)}</p>`);
      }
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
${(book.authors.length ? book.authors : [""]).map((a) => `<dc:creator>${escapeXml(a)}</dc:creator>`).join("\n")}
<dc:language>${escapeXml(language)}</dc:language>
<meta property="dcterms:modified">${modified}</meta>${cover ? '\n<meta name="cover" content="cover-image"/>' : ""}
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>${cover ? `\n<item id="cover-image" href="${coverFile}" media-type="${cover.mediaType}" properties="cover-image"/>` : ""}
${chapters.map((c, i) => `<item id="c${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`).join("\n")}${[...images.values()].map((img, i) => `\n<item id="img${i + 1}" href="${img.file}" media-type="${img.mime}"/>`).join("")}
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
      ...(cover ? [{ name: `OEBPS/${coverFile}`, data: cover.data }] : []),
      ...chapters.map((c) => ({ name: `OEBPS/${c.file}`, data: c.html })),
      ...[...images.values()].map((img) => ({ name: `OEBPS/${img.file}`, data: img.data })),
    ],
    now,
  );
}
