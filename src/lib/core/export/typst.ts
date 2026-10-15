import { PAGE_SIZES, type DocxSettings, type Separator } from "../settings";
import { PARATEXT_LABELS, approxWords } from "./docx";
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

function run(r: Run): string {
  if (r.lineBreak) return "#linebreak()";
  if (r.code) return `#raw(${str(r.text)})`;
  let out = str(r.text);
  if (r.italic) out = `emph(${out})`;
  if (r.bold) out = `strong(${out})`;
  if (r.strike) out = `strike(${out})`;
  return `#${out}`;
}

const runs = (items: Run[]) => items.map(run).join("");

/** Fonts tried in order: the chosen one, then fonts shipped with the app. */
function fonts(font: string): string {
  const list = [font, "Libertinus Serif", "New Computer Modern"].filter((f, i, all) => f && all.indexOf(f) === i);
  return `(${list.map(str).join(", ")})`;
}

const cm = (n: number) => `${+n.toFixed(2)}cm`;

/** Renders the book with the same choices as the DOCX: manuscript or typeset book. */
export function bookToTypst(book: Book, opts: DocxSettings, labels: { words: string }): string {
  const typeset = opts.profile === "typeset";
  const title = book.title || "Untitled";
  const hasParts = book.entries.some((e) => e.kind === "part");
  const chapterLevel = hasParts ? 2 : 1;
  const sceneLevel = chapterLevel + 1;
  const paratextLabels = PARATEXT_LABELS[book.language.slice(0, 2)] ?? PARATEXT_LABELS.en;

  const [width, height] = opts.pageSize === "custom" ? [opts.pageWidth, opts.pageHeight] : (PAGE_SIZES[opts.pageSize] ?? PAGE_SIZES.a4);
  // Book-sized pages have narrower margins than office paper, where the manuscript keeps an inch.
  const small = Math.min(width, height) < 18;
  const margin = small ? 2 : 2.54;
  // Lines measured from ascender to descender are about one font size apart; the leading adds the rest.
  const leading = Math.max(0, (opts.lineSpacing - 1) * 1.2);
  const size = opts.fontSize;
  // Openings on a new page start lower down, parts lower still.
  const opening = typeset ? 4.2 : 5;
  const partOpening = typeset ? 6.3 : 7.6;

  const out: string[] = [];
  const emit = (line: string) => out.push(line);

  emit(`// Made by Dante from the manuscript of ${str(title)}. Edit the novel, not this file.`);
  emit(`#set document(title: ${str(title)}, author: ${str(book.author)})`);
  emit(`#set page(width: ${cm(width)}, height: ${cm(height)}, margin: ${cm(margin)}, header: none, footer: none)`);
  emit(`#set text(font: ${fonts(opts.font)}, size: ${size}pt, lang: ${str(book.language.slice(0, 2) || "en")}, hyphenate: ${typeset}, top-edge: "ascender", bottom-edge: "descender")`);
  emit(`#set par(justify: ${typeset}, leading: ${+leading.toFixed(2)}em, spacing: ${+leading.toFixed(2)}em, first-line-indent: ${cm(opts.indent)})`);
  // The text keeps the quotes the author or the typography settings chose.
  emit(`#set smartquote(enabled: false)`);
  const headingSizes = typeset ? [1.5, 1.3, 1, 1, 1, 1] : [1, 1, 1, 1, 1, 1];
  emit(`#show heading: it => {`);
  emit(`  set align(center)`);
  emit(`  set par(first-line-indent: 0pt, justify: false)`);
  emit(`  let sizes = (${headingSizes.map((s) => `${s}em`).join(", ")})`);
  emit(`  set text(size: sizes.at(calc.min(it.level, 6) - 1), weight: if it.level <= ${chapterLevel} or ${typeset} and it.level == 2 { "bold" } else { "regular" }, style: if it.level > ${chapterLevel} and ${typeset} { "italic" } else { "normal" })`);
  emit(`  block(above: ${+(leading + 1).toFixed(2)}em, below: ${+(leading + 1).toFixed(2)}em, it.body)`);
  emit(`}`);
  emit(`#let separator(body) = align(center, block(above: ${+(leading + 0.6).toFixed(2)}em, below: ${+(leading + 0.6).toFixed(2)}em, body))`);
  emit("");

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
        emit(`#grid(columns: (1fr, 1fr), ${str(book.author)}, align(right, ${str(`${approxWords(book.words)} ${labels.words}`)}))`);
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

  // The novel: the header and page numbers start here, from page 1 in a typeset book.
  const surname = book.author.trim().split(/\s+/).pop() ?? "";
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
  const separate = (separator: Separator): boolean => {
    if (!started) return true;
    if (separator === "blankLine") emit(`#v(${+(leading + 1).toFixed(2)}em)`);
    if (separator === "characters") emit(`#separator[${lines(opts.sceneSeparator)}]`);
    if (separator === "pageBreak") emit("#pagebreak(weak: true)");
    return separator === "pageBreak";
  };
  const heading = (level: number, text: string, newPage: boolean, part = false) => {
    if (newPage) emit(`#v(${cm(part ? partOpening : opening)})`);
    emit(`#heading(level: ${level})[${lines(text)}]`);
  };
  const blocks = (items: Block[], level: number) => {
    for (const block of items) {
      if (block.type === "heading") emit(`#heading(level: ${Math.min(6, level + block.level)})[${runs(block.runs)}]\n`);
      else if (block.type === "quote") emit(`#pad(x: ${cm(opts.indent || 1)})[${runs(block.runs)}]\n`);
      else if (block.type === "break") emit(`#separator[${lines(opts.sceneSeparator)}]\n`);
      else if (block.runs.length && block.runs.every((r) => r.code)) emit(`#raw(block: true, ${str(block.runs.map((r) => r.text).join(""))})\n`);
      else emit(`${runs(block.runs)}\n`);
    }
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
      if (scene.heading) emit(`#heading(level: ${sceneLevel})[${lines(scene.heading)}]`);
      blocks(scene.blocks, sceneLevel);
    });
  };
  book.entries.forEach(entry);

  // Back matter, each on its own page.
  const backPage = (label: string, text: string) => {
    if (!text.trim()) return;
    emit("#pagebreak()");
    emit(`#v(${cm(opening)})`);
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
