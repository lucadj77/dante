import { pale } from "./docx";
import { PAGE_SIZES, separatorParts, surnames, type DocxSettings, type HeadingKind, type HeadingStyle, type Separator } from "../settings";
import { PARATEXT_LABELS, approxWords, hasContents } from "./docx";
import type { Block, Book, BookEntry, Run } from "./book";

// The book as a Typst document, compiled to PDF by the desktop app. Every piece of text
// goes in as a Typst string, so nothing the author wrote can be read as markup.

/** A Typst string literal. */
export function str(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
}

/** Text as content: lines joined by line breaks. */
function lines(text: string): string {
  return text
    .split("\n")
    .map((line) => `#${str(line)}`)
    .join("#linebreak()");
}

const TYPST_IMAGE = /\.(png|jpe?g|gif|svg|webp)$/i;

/** True for a picture Typst can read from its file. */
export const typstImage = (path: string) => TYPST_IMAGE.test(path);

/** An image on a line of text, its middle at the middle of the lowercase letters, as in the editor. */
function inlineImage(r: Run, maxWidth: number): string {
  const image = r.image!;
  // Typst reads the file from the project folder; formats it cannot read are left out.
  if (!TYPST_IMAGE.test(image.path)) return "";
  const width = Math.min(image.width / 96, maxWidth);
  return `#box(baseline: 50% - 0.25em, image(${str("/" + image.path)}, width: ${+width.toFixed(3)}in${image.alt ? `, alt: ${str(image.alt)}` : ""}))`;
}

/** A run of text; images are no wider than `maxWidth` inches. */
function run(r: Run, maxWidth = 6.5): string {
  if (r.footnote) return `#footnote[${r.footnote.map((n) => run(n, maxWidth)).join("")}]`;
  if (r.image) return inlineImage(r, maxWidth);
  if (r.lineBreak) return "#linebreak()";
  if (r.code) return `#raw(${str(r.text)})`;
  let out = str(r.text);
  if (r.size) out = `text(size: ${r.size}pt, ${out})`;
  if (r.italic) out = `emph(${out})`;
  if (r.bold) out = `strong(${out})`;
  if (r.strike) out = `strike(${out})`;
  // A gamebook's reference leads to the label of its paragraph's number.
  if (r.link) return `#link(<${r.link}>)[#${out}]`;
  return `#${out}`;
}

const runsOf = (items: Run[], maxWidth?: number) => items.map((r) => run(r, maxWidth)).join("");

/** Fonts tried in order: the chosen one, then fonts shipped with the app. */
function fonts(font: string): string {
  const list = [font, "Libertinus Serif", "New Computer Modern"].filter((f, i, all) => f && all.indexOf(f) === i);
  return `(${list.map(str).join(", ")})`;
}

const cm = (n: number) => `${+n.toFixed(2)}cm`;


/**
 * Renders the book with the same choices as the DOCX: manuscript or typeset book.
 * `coverSvg` opens it on a page of its own; with `coverImage`, a picture of the project,
 * the picture fills that page and `coverSvg` (the texts) lies over it.
 */
export function bookToTypst(book: Book, opts: DocxSettings, labels: { words: string; length?: string }, coverSvg = "", coverImage = ""): string {
  const typeset = opts.profile === "typeset";
  const title = book.title || "Untitled";
  const hasParts = book.entries.some((e) => e.kind === "part");
  const chapterLevel = hasParts ? 2 : 1;
  const sceneLevel = chapterLevel + 1;
  const paratextLabels = PARATEXT_LABELS[book.language.slice(0, 2)] ?? PARATEXT_LABELS.en;

  const [width, height] = opts.pageSize === "custom" ? [opts.pageWidth, opts.pageHeight] : (PAGE_SIZES[opts.pageSize] ?? PAGE_SIZES.a4);
  const m = opts.margins;
  const textWidth = width - m.left - m.right;
  // Lines measured from ascender to descender are about one font size apart; the leading adds the rest.
  const leading = Math.max(0, (opts.lineSpacing - 1) * 1.2);
  const size = opts.fontSize;
  // Openings on a new page start lower down, parts lower still.
  const opening = typeset ? 4.2 : 5;
  const partOpening = typeset ? 6.3 : 7.6;

  const out: string[] = [];
  const emit = (line: string) => out.push(line);

  emit(`// Made by Dante from the manuscript of ${str(title)}. Edit the novel, not this file.`);
  emit(`#set document(title: ${str(title)}, author: (${book.authors.map((a) => `${str(a)},`).join(" ")}))`);
  emit(`#set page(width: ${cm(width)}, height: ${cm(height)}, margin: (top: ${cm(m.top)}, bottom: ${cm(m.bottom)}, left: ${cm(m.left)}, right: ${cm(m.right)}), header: none, footer: none)`);
  emit(`#set text(font: ${fonts(opts.font)}, size: ${size}pt, lang: ${str(book.language.slice(0, 2) || "en")}, hyphenate: ${typeset}, top-edge: "ascender", bottom-edge: "descender")`);
  // A gamebook's paragraphs have their own alignment, indent and space after.
  const gx = book.gamebook;
  const spacing = `${+leading.toFixed(2)}em${gx?.spacing ? ` + ${gx.spacing}pt` : ""}`;
  emit(`#set par(justify: ${gx ? gx.justify : typeset}, leading: ${+leading.toFixed(2)}em, spacing: ${spacing}, first-line-indent: ${cm(gx ? gx.indent : opts.indent)})`);
  // The text keeps the quotes the author or the typography settings chose.
  emit(`#set smartquote(enabled: false)`);
  const headingSizes = typeset ? [1.5, 1.3, 1, 1, 1, 1] : [1, 1, 1, 1, 1, 1];
  // Parts, chapters and scenes look as the writer chose; a gamebook's numbers have their own look.
  const chosen: [number, HeadingKind][] = [...(hasParts ? [[1, "part"] as [number, HeadingKind]] : []), [chapterLevel, "chapter"], ...(gx ? [] : [[sceneLevel, "scene"] as [number, HeadingKind]])];
  // Space in points, plus the gap the text itself leaves between two lines.
  const gap = leading * size;
  const look = (h: HeadingStyle) =>
    [
      `set align(${h.align})`,
      `set par(leading: ${+Math.max(0, (h.lineSpacing - 1) * 1.2).toFixed(2)}em)`,
      `set text(${h.font ? `font: ${fonts(h.font)}, ` : ""}size: ${+h.size.toFixed(2)}pt, weight: ${h.bold ? '"bold"' : '"regular"'}, style: ${h.italic ? '"italic"' : '"normal"'})`,
      `block(above: ${+(h.before + gap).toFixed(2)}pt, below: ${+(h.after + gap).toFixed(2)}pt, ${h.uppercase ? "upper(it.body)" : "it.body"})`,
    ].join("; ");
  emit(`#show heading: it => {`);
  emit(`  set par(first-line-indent: 0pt, justify: false)`);
  emit(`  ${chosen.map(([level, kind]) => `if it.level == ${level} { ${look(opts.headings[kind])} } else `).join("")}{`);
  emit(`    set align(center)`);
  emit(`    let sizes = (${headingSizes.map((s) => `${s}em`).join(", ")})`);
  emit(`    set text(size: sizes.at(calc.min(it.level, 6) - 1), weight: if it.level <= ${chapterLevel} or ${typeset} and it.level == 2 { "bold" } else { "regular" }, style: if it.level > ${chapterLevel} and ${typeset} { "italic" } else { "normal" })`);
  emit(`    block(above: ${+(leading + 1).toFixed(2)}em, below: ${+(leading + 1).toFixed(2)}em, it.body)`);
  emit(`  }`);
  emit(`}`);
  emit(`#let separator(body) = align(center, block(above: ${+(leading + 0.6).toFixed(2)}em, below: ${+(leading + 0.6).toFixed(2)}em, body))`);
  emit("");

  // The cover fills the first page, edge to edge.
  const picture = coverImage ? `, background: image(${str("/" + coverImage)}, width: 100%, height: 100%, fit: "cover")` : "";
  if (coverSvg) emit(`#page(margin: 0pt, header: none, footer: none${picture}, image(bytes(${str(coverSvg)}), format: "svg", width: 100%, height: 100%, fit: "cover"))`);

  // Front matter: title page, dedication, epigraph, each on its own page.
  let pages = 0;
  const page = (content: () => void) => {
    if (pages++) emit("#pagebreak()");
    content();
  };
  if (opts.titlePage) {
    page(() => {
      if (typeset) {
        emit(`#v(${cm(partOpening)})`);
        emit(`#align(center)[#text(size: 3em, weight: "bold", ${str(title)})]`);
        if (book.subtitle) emit(`#align(center)[#v(0.5em)#text(size: 1.4em, style: "italic", ${str(book.subtitle)})]`);
        emit(`#align(center)[#v(2em)#"❧"#v(1em)#${str(book.author)}]`);
      } else {
        emit(`#grid(columns: (1fr, 1fr), ${str(book.author)}, align(right, ${str(labels.length ?? `${approxWords(book.words, book.language)} ${labels.words}`)}))`);
        emit(`#v(${cm(partOpening)})`);
        emit(`#align(center)[#${str(title.toUpperCase())}]`);
        if (book.subtitle) emit(`#align(center)[#emph(${str(book.subtitle)})]`);
        emit(`#align(center)[#v(1em)#${str(book.author)}]`);
      }
    });
  }
  const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const { paratext } = book;
  if (paratext.dedication.trim()) {
    page(() => {
      emit(`#v(${cm(opening)})`);
      for (const p of paragraphs(paratext.dedication)) emit(`#align(center, emph[${lines(p)}])\n`);
    });
  }
  if (paratext.epigraph.trim()) {
    page(() => {
      emit(`#v(${cm(opening)})`);
      for (const p of paragraphs(paratext.epigraph)) emit(`#align(right, block(width: 70%, align(right, emph[${lines(p)}])))\n`);
      if (paratext.epigraphSource.trim()) emit(`#align(right)[#${str(paratext.epigraphSource.trim())}]`);
    });
  }

  // The table of contents, of parts and chapters, on a page of its own.
  if (hasContents(book, opts)) {
    page(() => {
      emit(`#v(${cm(opening)})`);
      emit(`#outline(title: [${lines(paratextLabels.contents)}], depth: ${chapterLevel})`);
    });
  }

  // The novel: the header and page numbers start here, from page 1 in a typeset book.
  const surname = surnames(book.authors);
  const header = !opts.header
    ? "none"
    : typeset
      ? `align(center, text(size: 0.85em, style: "italic", ${str(title)}))`
      : `align(right, ${str(`${surname} / ${title.toUpperCase()} / `)} + context counter(page).display())`;
  const footer = typeset ? `align(center, text(size: 0.85em, context counter(page).display()))` : "none";
  emit("");
  // A new page setting always starts a new page.
  emit(`#set page(header: ${header}, footer: ${footer})`);
  if (typeset) emit(`#counter(page).update(1)`);

  let started = false;
  /** What separates the next unit from the previous one; true when it starts a page. */
  const blank = (n: number) => {
    if (n > 0) emit(`#v(${+(n * (leading + 1)).toFixed(2)}em)`);
  };
  /** The separator's characters, with the blank lines written around them. */
  const characters = () => {
    const parts = separatorParts(opts.sceneSeparator, opts.lineSign);
    blank(parts.before);
    if (parts.lines.length) emit(`#separator[${lines(parts.lines.join("\n"))}]`);
    blank(parts.after);
  };
  const separate = (separator: Separator): boolean => {
    if (!started) return true;
    if (separator === "blankLine") blank(1);
    if (separator === "twoBlankLines") blank(2);
    if (separator === "characters") characters();
    if (separator === "pageBreak") emit("#pagebreak(weak: true)");
    return separator === "pageBreak";
  };
  const heading = (level: number, text: string, newPage: boolean, part = false) => {
    // A heading that opens a page sits as far down as the writer chose.
    const top = opts.headings[part ? "part" : "chapter"].top;
    if (newPage && top > 0) emit(`#v(${cm(top)})`);
    emit(`#heading(level: ${level})[${lines(text)}]`);
  };
  const runs = (items: Run[]) => runsOf(items, textWidth / 2.54);
  // A figure or a table with its caption under it, on the same page.
  const withCaption = (content: string, items: Run[] | undefined, align: string) =>
    items
      ? `#block(breakable: false, width: 100%)[${content} #set par(first-line-indent: 0pt, justify: false); #align(${align}, text(size: 0.9em, style: "italic")[${runs(items)}])]\n`
      : `${content}\n`;
  const blocks = (items: Block[], level: number) => {
    // The blocks of a gamebook's box go in one frame.
    let open: number | null = null;
    const close = () => {
      if (open !== null) emit("]\n");
      open = null;
    };
    for (const block of items) {
      if (open !== null && block.box?.id !== open) close();
      if (block.box && open === null) {
        emit(`#block(width: 100%, inset: (x: 10pt, y: 8pt), radius: 3pt, breakable: true, fill: rgb("#${pale(block.box.color)}"), stroke: (left: 3pt + rgb("${block.box.color}"), rest: 0.6pt + rgb("${block.box.color}")))[#set par(first-line-indent: 0pt)`);
        open = block.box.id;
      }
      if (block.type === "heading") emit(`#heading(level: ${Math.min(6, level + block.level)})[${runs(block.runs)}]\n`);
      else if (block.type === "quote") emit(`#pad(x: ${cm(opts.indent || 1)})[${runs(block.runs)}]\n`);
      else if (block.type === "item") {
        // The bullet hangs out by 1.5em; each level goes in by as much. The blank line
        // makes the text a paragraph, or Typst would not hang it.
        const lead = block.marker ? `#box(width: 1.5em)[#${str(block.marker)}]` : "";
        emit(`#pad(left: ${(block.level + (block.marker ? 0 : 1)) * 1.5}em)[#set par(first-line-indent: 0pt, hanging-indent: ${block.marker ? "1.5em" : "0pt"}, justify: false)\n\n${lead}${runs(block.runs)}\n]\n`);
      }
      else if (block.type === "break") {
        characters();
        emit("");
      }
      else if (block.type === "blank") emit(`#v(${+(leading + 1).toFixed(2)}em)\n`);
      else if (block.type === "table") {
        const cells = (row: Run[][], head: boolean) => row.map((c) => (head ? `strong[${runs(c)}]` : `[${runs(c)}]`)).join(", ");
        const align = block.align.map((a) => a ?? "left").join(", ");
        emit(withCaption(`#align(center, block(width: 100%, table(columns: ${block.header.length}, align: (${align},), inset: 0.4em, table.header(${cells(block.header, true)}), ${block.rows.map((r) => cells(r, false)).join(", ")})))`, block.caption, "center"));
      } else if (block.type === "image") {
        // Typst reads the file from the project folder; formats it cannot read are left out.
        if (!TYPST_IMAGE.test(block.image.path)) continue;
        const width = Math.min(block.image.width / 96, textWidth / 2.54);
        const align = block.align === "center" || block.align === "right" ? block.align : "left";
        emit(withCaption(`#align(${align}, image(${str("/" + block.image.path)}, width: ${+width.toFixed(3)}in${block.image.alt ? `, alt: ${str(block.image.alt)}` : ""}))`, block.caption, align));
      }
      else if (block.runs.length && block.runs.every((r) => r.code)) emit(`#raw(block: true, ${str(block.runs.map((r) => r.text).join(""))})\n`);
      else if (block.align === "center" || block.align === "right") {
        // Set rules in a content block, not an align block, so the spacing stays a paragraph's.
        emit(`#[#set align(${block.align}); #set par(first-line-indent: 0pt, justify: false); ${runs(block.runs)}]\n`);
      } else if (block.align) emit(`#[#set par(justify: ${block.align === "justify"}); ${runs(block.runs)}]\n`);
      else emit(`${runs(block.runs)}\n`);
    }
    close();
  };
  const entry = (e: BookEntry) => {
    if (e.kind === "part") {
      heading(1, e.heading, separate(opts.partBreak), true);
      started = true;
      return;
    }
    if (e.heading) {
      heading(chapterLevel, e.heading, separate(opts.chapterBreak));
      started = true;
    }
    e.scenes.forEach((scene, i) => {
      if (started && (i > 0 || !e.heading)) separate(i > 0 ? opts.sceneBreak : opts.chapterBreak);
      started = true;
      if (scene.heading && book.gamebook) {
        const gx = book.gamebook;
        const font = gx.numberFont ? `font: ${fonts(gx.numberFont)}, ` : "";
        const body = `#text(${font}size: ${gx.size}pt, weight: ${gx.numberBold ? '"bold"' : '"regular"'}, style: ${gx.numberItalic ? '"italic"' : '"normal"'})[${lines(scene.heading)}]`;
        emit(`#heading(level: ${sceneLevel}, outlined: false)[${gx.align === "left" ? `#align(left)[${body}]` : body}]${scene.anchor ? ` <${scene.anchor}>` : ""}`);
      } else if (scene.heading) emit(`#heading(level: ${sceneLevel})[${lines(scene.heading)}]`);
      blocks(scene.blocks, sceneLevel);
    });
  };
  book.entries.forEach(entry);

  // Back matter, each on its own page.
  const backPage = (label: string, text: string) => {
    if (!text.trim()) return;
    emit("#pagebreak()");
    if (opts.headings.chapter.top > 0) emit(`#v(${cm(opts.headings.chapter.top)})`);
    emit(`#heading(level: ${chapterLevel}, outlined: false)[#${str(label)}]`);
    for (const p of paragraphs(text)) emit(`${lines(p)}\n`);
  };
  backPage(paratextLabels.authorNote, paratext.authorNote);
  backPage(paratextLabels.acknowledgements, paratext.acknowledgements);
  if (paratext.colophon.trim()) {
    emit("#pagebreak()");
    emit(`#align(center + bottom, text(size: 0.85em)[${paragraphs(paratext.colophon).map(lines).join("#parbreak()")}])`);
  }
  return out.join("\n") + "\n";
}
