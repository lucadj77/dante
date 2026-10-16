import { formatNumber } from "../numbers";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  NumberFormat,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  TextRun,
  type IParagraphStyleOptions,
  type IRunOptions,
  type ISectionOptions,
} from "docx";
import { PAGE_SIZES, surnames, type DocxSettings, type Separator } from "../settings";
import type { Block, Book, BookEntry, Run } from "./book";

// Every paragraph uses a named Word style and carries no direct formatting, so that
// changing a style in Word (Normal, Heading 1…) changes all the text that uses it.

const TWIPS_PER_CM = 566.93;
const HEADINGS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];

/** Headings of the paratext, in the language of the novel. */
export const PARATEXT_LABELS: Record<string, { authorNote: string; acknowledgements: string }> = {
  en: { authorNote: "Author’s note", acknowledgements: "Acknowledgements" },
  it: { authorNote: "Nota dell’autore", acknowledgements: "Ringraziamenti" },
  es: { authorNote: "Nota del autor", acknowledgements: "Agradecimientos" },
  fr: { authorNote: "Note de l’auteur", acknowledgements: "Remerciements" },
};

function runs(items: Run[]): TextRun[] {
  return items.map((r) =>
    r.lineBreak
      ? new TextRun({ break: 1 })
      : new TextRun({ text: r.text, italics: r.italic, bold: r.bold, strike: r.strike, font: r.code ? "Courier New" : undefined }),
  );
}

function plain(text: string, options: Partial<IRunOptions> = {}): TextRun[] {
  return text.split("\n").map((line, i) => new TextRun({ ...options, text: line, break: i > 0 ? 1 : undefined }));
}

/** Rounds to the nearest hundred, as is customary for manuscript word counts. */
export function approxWords(n: number, language: string): string {
  return formatNumber(Math.round(n / 100) * 100 || n, language);
}

/** Plain paragraphs of a paratext written as Markdown-free text. */
function textParagraphs(text: string, style: string): Paragraph[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => new Paragraph({ style, children: plain(p) }));
}

function styles(opts: DocxSettings, typeset: boolean): IParagraphStyleOptions[] {
  const size = opts.fontSize * 2;
  const line = Math.round(240 * opts.lineSpacing);
  const indent = Math.round(opts.indent * TWIPS_PER_CM);
  const body = typeset ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;
  const centered = { alignment: AlignmentType.CENTER, indent: { firstLine: 0 } };
  return [
    {
      id: "Normal",
      name: "Normal",
      quickFormat: true,
      run: { font: opts.font, size },
      paragraph: { alignment: body, indent: { firstLine: indent }, spacing: { line, before: 0, after: 0 } },
    },
    { id: "FirstParagraph", name: "First Paragraph", basedOn: "Normal", next: "Normal", quickFormat: true, paragraph: { indent: { firstLine: 0 } } },
    { id: "BlockText", name: "Block Text", basedOn: "Normal", next: "Normal", paragraph: { indent: { left: indent, right: indent, firstLine: 0 } } },
    { id: "SceneBreak", name: "Scene Break", basedOn: "Normal", next: "FirstParagraph", quickFormat: true, paragraph: { ...centered, spacing: { before: line / 2, after: line / 2 } } },
    // An empty line of fixed height pushes openings down the page: word processors drop
    // the space before a paragraph at the top of a page.
    { id: "Opening", name: "Opening", basedOn: "Normal", paragraph: { ...centered, spacing: { line: typeset ? 2400 : 2880, lineRule: LineRuleType.EXACT } } },
    { id: "PartOpening", name: "Part Opening", basedOn: "Opening", paragraph: { spacing: { line: typeset ? 3600 : 4320, lineRule: LineRuleType.EXACT } } },
    { id: "Title", name: "Title", basedOn: "Normal", next: "Subtitle", quickFormat: true, run: { size: typeset ? size * 3 : size, bold: typeset }, paragraph: { ...centered } },
    { id: "Subtitle", name: "Subtitle", basedOn: "Normal", next: "Normal", quickFormat: true, run: { italics: true, size: typeset ? Math.round(size * 1.4) : size }, paragraph: { ...centered, spacing: { before: 200 } } },
    { id: "Author", name: "Author", basedOn: "Normal", paragraph: { ...centered, spacing: { before: 400 } } },
    { id: "Dedication", name: "Dedication", basedOn: "Normal", run: { italics: true }, paragraph: { ...centered } },
    { id: "Epigraph", name: "Epigraph", basedOn: "Normal", run: { italics: true }, paragraph: { alignment: AlignmentType.RIGHT, indent: { left: indent * 3, firstLine: 0 } } },
    { id: "EpigraphSource", name: "Epigraph Source", basedOn: "Normal", paragraph: { alignment: AlignmentType.RIGHT, indent: { firstLine: 0 }, spacing: { before: 120 } } },
    { id: "Colophon", name: "Colophon", basedOn: "Normal", run: { size: Math.max(16, size - 4) }, paragraph: { ...centered, spacing: { line: 240 } } },
    { id: "Code", name: "Code", basedOn: "Normal", paragraph: { indent: { firstLine: 0 } }, run: { font: "Courier New" } },
  ];
}

function headingStyles(opts: DocxSettings, typeset: boolean) {
  const size = opts.fontSize * 2;
  const line = Math.round(240 * opts.lineSpacing);
  const base = { font: opts.font, color: "000000" };
  const centered = { alignment: AlignmentType.CENTER, indent: { firstLine: 0 } };
  // Word's own heading styles, so the navigation pane and the table of contents work.
  return {
    heading1: { run: { ...base, size: typeset ? Math.round(size * 1.5) : size, bold: true }, paragraph: { ...centered, spacing: { after: line } }, next: "FirstParagraph" },
    heading2: { run: { ...base, size: typeset ? Math.round(size * 1.3) : size, bold: typeset }, paragraph: { ...centered, spacing: { after: line } }, next: "FirstParagraph" },
    heading3: { run: { ...base, size, bold: false, italics: typeset }, paragraph: { ...centered, spacing: { before: line, after: line / 2 } }, next: "FirstParagraph" },
    heading4: { run: { ...base, size, italics: true }, paragraph: { ...centered, spacing: { before: line / 2, after: line / 2 } }, next: "FirstParagraph" },
    heading5: { run: { ...base, size, italics: true }, paragraph: { ...centered }, next: "FirstParagraph" },
    heading6: { run: { ...base, size, italics: true }, paragraph: { ...centered }, next: "FirstParagraph" },
  };
}

/** Renders the book as a standard manuscript or as a typeset book. */
/** Renders the book as a Word document; `coverPng`, a 2:3 image, fills the first page. */
export function bookToDocx(book: Book, opts: DocxSettings, labels: { words: string }, coverPng?: Uint8Array): Document {
  const typeset = opts.profile === "typeset";
  const title = book.title || "Untitled";
  const hasParts = book.entries.some((e) => e.kind === "part");
  // Parts take Heading 1 when there are any; chapters and scenes move down a level.
  const partLevel = 0;
  const chapterLevel = hasParts ? 1 : 0;
  const sceneLevel = chapterLevel + 1;
  const paratextLabels = PARATEXT_LABELS[book.language.slice(0, 2)] ?? PARATEXT_LABELS.en;

  const body: Paragraph[] = [];
  // Nothing goes before the first opening, so it needs no break.
  let started = false;

  /** Adds what separates the next unit from the previous one; true when it starts a page. */
  const separate = (separator: Separator): boolean => {
    if (!started) return true;
    if (separator === "blankLine") body.push(new Paragraph({ style: "SceneBreak", children: [] }));
    if (separator === "characters") body.push(new Paragraph({ style: "SceneBreak", children: plain(opts.sceneSeparator) }));
    return separator === "pageBreak";
  };

  const heading = (level: number, text: string, newPage: boolean, part = false) => {
    const children = plain(text);
    // Openings on a new page start lower down.
    if (newPage) body.push(new Paragraph({ style: part ? "PartOpening" : "Opening", pageBreakBefore: started, children: [] }));
    body.push(new Paragraph({ heading: HEADINGS[level], children }));
  };

  const blocks = (items: Block[], level: number) => {
    // No indent after a heading, a separator or a quote: the usual typographic rule.
    let first = true;
    for (const block of items) {
      if (block.type === "heading") {
        body.push(new Paragraph({ heading: HEADINGS[Math.min(5, level + block.level)], children: runs(block.runs) }));
      } else if (block.type === "quote") {
        body.push(new Paragraph({ style: "BlockText", children: runs(block.runs) }));
      } else if (block.type === "break") {
        body.push(new Paragraph({ style: "SceneBreak", children: plain(opts.sceneSeparator) }));
      } else {
        const code = block.runs.every((r) => r.code);
        body.push(new Paragraph({ style: code ? "Code" : first ? "FirstParagraph" : "Normal", children: runs(block.runs) }));
      }
      first = block.type !== "paragraph";
    }
  };

  const entry = (e: BookEntry) => {
    if (e.kind === "part") {
      heading(partLevel, e.heading, separate(opts.partBreak), true);
      started = true;
      return;
    }
    if (e.heading) {
      heading(chapterLevel, e.heading, separate(opts.chapterBreak));
      started = true;
    }
    e.scenes.forEach((scene, i) => {
      if (started && (i > 0 || !e.heading)) {
        if (separate(i > 0 ? opts.sceneBreak : opts.chapterBreak)) body.push(new Paragraph({ style: "SceneBreak", pageBreakBefore: true, children: [] }));
      }
      started = true;
      if (scene.heading) body.push(new Paragraph({ heading: HEADINGS[sceneLevel], children: plain(scene.heading) }));
      blocks(scene.blocks, sceneLevel);
    });
  };
  book.entries.forEach(entry);

  // Paratext before and after the novel, each on its own page.
  const { paratext } = book;
  const front: Paragraph[][] = [];
  if (paratext.dedication.trim()) {
    front.push([new Paragraph({ style: "Opening", children: [] }), ...textParagraphs(paratext.dedication, "Dedication")]);
  }
  if (paratext.epigraph.trim()) {
    const page = [new Paragraph({ style: "Opening", children: [] }), ...textParagraphs(paratext.epigraph, "Epigraph")];
    if (paratext.epigraphSource.trim()) page.push(new Paragraph({ style: "EpigraphSource", children: plain(paratext.epigraphSource.trim()) }));
    front.push(page);
  }
  const back: Paragraph[][] = [];
  const backPage = (label: string, text: string) => {
    if (!text.trim()) return;
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p, i) => new Paragraph({ style: i === 0 ? "FirstParagraph" : "Normal", children: plain(p) }));
    back.push([new Paragraph({ style: "Opening", children: [] }), new Paragraph({ heading: HEADINGS[chapterLevel], children: plain(label) }), ...paragraphs]);
  };
  backPage(paratextLabels.authorNote, paratext.authorNote);
  backPage(paratextLabels.acknowledgements, paratext.acknowledgements);
  if (paratext.colophon.trim()) back.push(textParagraphs(paratext.colophon, "Colophon"));

  const onNewPage = (pages: Paragraph[][]): Paragraph[] =>
    pages.flatMap((page) => [new Paragraph({ pageBreakBefore: true, children: [] }), ...page]);

  const titlePage: Paragraph[] = [];
  if (opts.titlePage) {
    if (typeset) {
      titlePage.push(
        new Paragraph({ style: "PartOpening", children: [] }),
        new Paragraph({ style: "Title", children: plain(title) }),
      );
      if (book.subtitle) titlePage.push(new Paragraph({ style: "Subtitle", children: plain(book.subtitle) }));
      titlePage.push(
        new Paragraph({ style: "Author", children: plain("❧") }),
        new Paragraph({ style: "Author", children: plain(book.author) }),
      );
    } else {
      titlePage.push(
        new Paragraph({ style: "FirstParagraph", children: plain(book.author) }),
        new Paragraph({ style: "FirstParagraph", alignment: AlignmentType.RIGHT, children: plain(`${approxWords(book.words, book.language)} ${labels.words}`) }),
        new Paragraph({ style: "PartOpening", children: [] }),
        new Paragraph({ style: "Title", children: plain(title.toUpperCase()) }),
      );
      if (book.subtitle) titlePage.push(new Paragraph({ style: "Subtitle", children: plain(book.subtitle) }));
      titlePage.push(new Paragraph({ style: "Author", children: plain(book.author) }));
    }
  }

  const [width, height] = opts.pageSize === "custom" ? [opts.pageWidth, opts.pageHeight] : PAGE_SIZES[opts.pageSize] ?? PAGE_SIZES.a4;
  const twips = (cm: number) => Math.round((cm / 2.54) * 1440);
  // Book-sized pages have narrower margins than office paper, where the manuscript keeps an inch.
  const small = Math.min(width, height) < 18;
  const margin = twips(small ? 2 : 2.54);
  const page = {
    size: { width: twips(width), height: twips(height) },
    margin: { top: margin, bottom: margin, left: margin, right: margin, header: twips(small ? 1 : 1.25), footer: twips(small ? 1 : 1.25) },
  };

  const surname = surnames(book.authors);
  const header = !opts.header
    ? undefined
    : typeset
      ? new Header({ children: [new Paragraph({ style: "Colophon", children: plain(title, { italics: true }) })] })
      : new Header({
          children: [
            new Paragraph({
              style: "FirstParagraph",
              alignment: AlignmentType.RIGHT,
              children: [new TextRun(`${surname} / ${title.toUpperCase()} / `), new TextRun({ children: [PageNumber.CURRENT] })],
            }),
          ],
        });
  // A typeset book numbers its pages at the foot; a manuscript has the number in the header.
  const footer = typeset ? new Footer({ children: [new Paragraph({ style: "Colophon", children: [new TextRun({ children: [PageNumber.CURRENT] })] })] }) : undefined;

  const sections: ISectionOptions[] = [];
  if (coverPng) {
    // The cover on a page of its own without margins, as large as the page allows.
    const px = (cm: number) => Math.floor((cm / 2.54) * 96);
    // A little under the page height, or Word moves the image to a page of its own.
    const scale = Math.min(px(width) / 2, (px(height) * 0.98) / 3);
    sections.push({
      properties: { page: { size: page.size, margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
          children: [new ImageRun({ type: "png", data: coverPng, transformation: { width: Math.floor(scale * 2), height: Math.floor(scale * 3) } })],
        }),
      ],
    });
  }
  const frontMatter = [...titlePage, ...(titlePage.length ? onNewPage(front) : onNewPage(front).slice(1))];
  if (typeset) {
    // Title page and front matter have no header and no page number; the text starts at page 1.
    if (frontMatter.length) sections.push({ properties: { page }, children: frontMatter });
    sections.push({
      properties: { page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } }, type: SectionType.NEXT_PAGE },
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      children: [...body, ...onNewPage(back)],
    });
  } else {
    const children = [...frontMatter, ...(frontMatter.length && body.length ? onNewPage([body]) : body), ...onNewPage(back)];
    sections.push({
      properties: { titlePage: opts.titlePage, page },
      headers: header ? { default: header, first: new Header({ children: [] }) } : undefined,
      children,
    });
  }

  return new Document({
    creator: book.author,
    title,
    styles: {
      default: {
        document: { run: { font: opts.font, size: opts.fontSize * 2 } },
        ...headingStyles(opts, typeset),
      },
      paragraphStyles: styles(opts, typeset),
    },
    sections,
  });
}

export async function docxBytes(document: Document): Promise<Uint8Array> {
  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
}
