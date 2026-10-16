import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { alignOpen, extractAlignments, readAlignment, setAlignment } from "../alignment";
import { buildBook, markdownToBlocks } from "../export/book";
import { bookToDocx, docxBytes } from "../export/docx";
import { bookToEpub } from "../export/epub";
import { bookToMarkdown } from "../export/markdown";
import { bookToTypst } from "../export/typst";
import { readDocument } from "../import/docx";
import { counts, structure } from "../import/structure";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { defaultSettings } from "../settings";
import { textStats } from "../stats";
import { toggleAlign } from "$lib/editor/alignment";
import { unzip } from "../import/unzip";

const centered = (text: string) => `${alignOpen("center")}${text}</span>`;

describe("aligned paragraphs", () => {
  it("reads Dante's tag and the usual HTML ones", () => {
    expect(readAlignment(centered("Fine"))).toEqual({ align: "center", open: alignOpen("center").length, close: 7 });
    expect(readAlignment('<p align="right">Roma, 3 marzo</p>')?.align).toBe("right");
    expect(readAlignment("<div style='text-align: center'>*Fine*</div>  ")?.align).toBe("center");
    expect(readAlignment("Testo <span>qui</span>")).toBeNull();
    expect(readAlignment(`${alignOpen("right")}uno</span> e <span>due</span>`)).toBeNull();
  });

  it("sets, changes and removes the alignment", () => {
    expect(setAlignment("Fine", "center")).toBe(centered("Fine"));
    expect(setAlignment(centered("Fine"), "right")).toBe(`${alignOpen("right")}Fine</span>`);
    expect(setAlignment(centered("Fine"), null)).toBe("Fine");
  });

  it("takes the tags out of the text, numbering the paragraphs", () => {
    const { text, aligns } = extractAlignments(`Uno.\n\n${centered("*Due*")}\n\n\nTre.`);
    expect(text).toBe("Uno.\n\n*Due*\n\n\nTre.");
    expect([...aligns]).toEqual([[1, "center"]]);
  });

  it("does not count the tags as words", () => {
    expect(textStats(centered("Fine del *libro*")).words).toBe(3);
  });
});

describe("aligned paragraphs in the export", () => {
  const scene = `Tutto era finito.\n\n${centered("*Fine*")}\n\n${alignOpen("right")}Roma, "marzo" 1990</span>`;

  async function book() {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\nauthor: Ada\nlanguage: it\n", "Manuscript/010 Uno/010 Scena.md": scene });
    return buildBook(await Project.open(fs));
  }

  it("keeps the alignment, after typography, with the formatting inside", async () => {
    const blocks = (await book()).entries[0].scenes[0].blocks;
    expect(blocks).toEqual([
      { type: "paragraph", runs: [{ text: "Tutto era finito." }] },
      { type: "paragraph", runs: [{ text: "Fine", italic: true }], align: "center" },
      // The quotes inside the tag are left alone; the ones in the text follow the settings.
      { type: "paragraph", runs: [{ text: expect.stringMatching(/^Roma, .marzo. 1990$/) }], align: "right" },
    ]);
    expect(markdownToBlocks("Plain.")).toEqual([{ type: "paragraph", runs: [{ text: "Plain." }] }]);
  });

  it("writes it in every format", async () => {
    const b = await book();
    const opts = defaultSettings().export.docx;
    const md = bookToMarkdown(b, opts);
    expect(md).toContain(centered("*Fine*"));
    expect(md).toContain(alignOpen("right") + "Roma");

    const typst = bookToTypst(b, opts, { words: "parole" });
    expect(typst).toContain('#[#set align(center); #set par(first-line-indent: 0pt, justify: false); #emph("Fine")]');
    expect(typst).toContain("#[#set align(right);");

    const files = await unzip(bookToEpub(b, opts, "id"));
    const xhtml = await Promise.all([...files.keys()].filter((f) => f.endsWith(".xhtml")).map(async (f) => new TextDecoder().decode(await files.get(f)!())));
    expect(xhtml.join("")).toContain('<p class="align-center"><em>Fine</em></p>');
    expect(xhtml.join("")).toContain('<p class="align-right">Roma');

    const docx = await unzip(await docxBytes(bookToDocx(b, opts, { words: "parole" })));
    const document = new TextDecoder().decode(await docx.get("word/document.xml")!());
    expect(document).toContain('<w:pStyle w:val="Centered"/>');
    expect(document).toContain('<w:pStyle w:val="RightAligned"/>');
  });
});

describe("aligned paragraphs from Word", () => {
  it("keeps centred and right-aligned paragraphs, from the paragraph or its style", () => {
    const styles = `<w:styles><w:style w:type="paragraph" w:styleId="Firma"><w:name w:val="Firma"/><w:pPr><w:jc w:val="end"/></w:pPr></w:style></w:styles>`;
    const xml = `<w:body>
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>Fine</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Firma"/></w:pPr><w:r><w:t>Anna</w:t></w:r></w:p>
      <w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t>Giustificato.</w:t></w:r></w:p>
    </w:body>`;
    expect(readDocument(xml, { styles })).toEqual([
      { kind: "paragraph", text: centered("*Fine*") },
      { kind: "paragraph", text: `${alignOpen("right")}Anna</span>` },
      { kind: "paragraph", text: "Giustificato." },
    ]);
  });

  it("still finds centred chapter lines in a document without heading styles", () => {
    const xml = `<w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Capitolo 1</w:t></w:r></w:p><w:p><w:r><w:t>Testo della scena.</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Fine</w:t></w:r></w:p></w:body>`;
    const blocks = readDocument(xml);
    expect(blocks[0]).toEqual({ kind: "heading", level: 2, text: "Capitolo 1" });
    const book = structure(blocks, { start: "Inizio", scene: (n) => `Scena ${n}` });
    expect(counts(book).words).toBe(4);
  });
});

describe("the align command", () => {
  function run(doc: string, from: number, to = from, align: "center" | "right" = "center") {
    const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
    const next = state.update(toggleAlign(state, align)).state;
    return { doc: next.doc.toString(), cursor: next.selection.main.head };
  }

  it("wraps the paragraph under the cursor and keeps the cursor on the same text", () => {
    const doc = "Uno.\n\nFine\n\nTre.";
    const { doc: out, cursor } = run(doc, 8);
    expect(out).toBe(`Uno.\n\n${centered("Fine")}\n\nTre.`);
    expect(out.slice(cursor)).toMatch(/^ne<\/span>/);
    // At the end of the text the cursor stays before the closing tag.
    const end = run(doc, 10);
    expect(end.doc.slice(end.cursor)).toMatch(/^<\/span>/);
  });

  it("removes the alignment when it is already there, and switches between sides", () => {
    const doc = `${centered("Fine")}`;
    expect(run(doc, doc.length - 8).doc).toBe("Fine");
    expect(run(doc, doc.length - 8, doc.length - 8, "right").doc).toBe(`${alignOpen("right")}Fine</span>`);
  });

  it("leaves headings and lists alone", () => {
    expect(run("# Titolo", 3).doc).toBe("# Titolo");
    expect(run("- voce", 3).doc).toBe("- voce");
  });

  it("starts an aligned paragraph on an empty line, apart from its neighbours", () => {
    const { doc, cursor } = run("Uno.\n\nTre.", 5);
    expect(doc).toBe(`Uno.\n${centered("")}\n\nTre.`.replace("Uno.\n", "Uno.\n\n"));
    expect(doc.slice(cursor)).toMatch(/^<\/span>/);
  });
});
