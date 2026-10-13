import {
  AlignmentType,
  Document,
  Header,
  LineRuleType,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
  type IRunOptions,
} from "docx";
import type { DocxSettings } from "../settings";
import type { Block, Book, Run } from "./book";

const TWIPS_PER_CM = 566.93;

function runs(items: Run[], base: Partial<IRunOptions> = {}): TextRun[] {
  return items.map((r) =>
    r.lineBreak
      ? new TextRun({ ...base, break: 1 })
      : new TextRun({
          ...base,
          text: r.text,
          italics: r.italic,
          bold: r.bold || base.bold,
          strike: r.strike,
          font: r.code ? "Courier New" : undefined,
        }),
  );
}

/** Rounds to the nearest hundred, as is customary for manuscript word counts. */
function approxWords(n: number): string {
  return (Math.round(n / 100) * 100 || n).toLocaleString("en-US");
}

/** Renders the book in standard manuscript format. */
export function bookToDocx(book: Book, opts: DocxSettings, labels: { words: string }): Document {
  const indent = Math.round(opts.indent * TWIPS_PER_CM);
  const line = Math.round(240 * opts.lineSpacing);
  const children: Paragraph[] = [];
  const title = book.title || "Untitled";

  if (opts.titlePage) {
    children.push(
      new Paragraph({ children: [new TextRun(book.author)] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(`${approxWords(book.words)} ${labels.words}`)] }),
      new Paragraph({ spacing: { before: 4800 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: title.toUpperCase() })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(book.author)] }),
    );
  }

  // The first entry starts on a new page only after a title page.
  let first = !opts.titlePage;
  const newPage = () => {
    const brk = !first;
    first = false;
    return brk;
  };

  const blockParagraph = (block: Block, noIndent: boolean): Paragraph => {
    switch (block.type) {
      case "heading":
        return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: line, after: line }, children: runs(block.runs, { bold: true }) });
      case "quote":
        return new Paragraph({ indent: { left: indent, right: indent }, children: runs(block.runs) });
      case "break":
        return new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(opts.sceneSeparator)] });
      default:
        return new Paragraph({ indent: noIndent ? undefined : { firstLine: indent }, children: runs(block.runs) });
    }
  };

  for (const entry of book.entries) {
    const isPart = entry.kind === "part";
    if (entry.heading) {
      const pageBreakBefore = isPart || opts.chapterNewPage ? newPage() : false;
      // Openings start about a third of the way down the page. An empty line of fixed
      // height does it, because word processors drop the space before a paragraph at
      // the top of a page.
      children.push(
        new Paragraph({
          pageBreakBefore,
          spacing: { line: pageBreakBefore ? (isPart ? 4320 : 2880) : line, lineRule: LineRuleType.EXACT },
          children: [],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: line },
          children: [new TextRun({ text: entry.heading, bold: isPart })],
        }),
      );
    } else if (entry.scenes.length && newPage()) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    entry.scenes.forEach((scene, i) => {
      if (i > 0) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(opts.sceneSeparator)] }));
      // No indent after a heading, a separator or a break: the usual typographic rule.
      let afterBreak = true;
      for (const block of scene) {
        children.push(blockParagraph(block, afterBreak));
        afterBreak = block.type !== "paragraph";
      }
    });
  }

  const surname = book.author.trim().split(/\s+/).pop() ?? "";
  const header = opts.header
    ? {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun(`${surname} / ${title.toUpperCase()} / `), new TextRun({ children: [PageNumber.CURRENT] })],
            }),
          ],
        }),
      }
    : undefined;

  return new Document({
    creator: book.author,
    title,
    styles: {
      default: {
        document: {
          run: { font: opts.font, size: opts.fontSize * 2 },
          paragraph: { spacing: { line, before: 0, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: opts.titlePage,
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        headers: header ? { ...header, first: new Header({ children: [] }) } : undefined,
        children,
      },
    ],
  });
}

export async function docxBytes(document: Document): Promise<Uint8Array> {
  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
}
