import { describe, expect, it } from "vitest";
import { CommentRangeEnd, CommentRangeStart, CommentReference, Document, FootnoteReferenceRun, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { readDocument, readDocx } from "../import/docx";
import { counts, defaultBlankLines, defaultRoles, headingLevels, ownTitle, structure } from "../import/structure";
import { MemoryFs } from "../fs";
import { Project } from "../project";

const names = { start: "Start", scene: (n: number) => `Scene ${n}` };

async function docx(children: Paragraph[]) {
  const doc = new Document({ creator: "Ada", title: "The Book", sections: [{ children }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

describe("reading Word documents", () => {
  it("reads headings, paragraphs and formatting", async () => {
    const bytes = await docx([
      new Paragraph({ text: "Chapter 1: The call", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ children: [new TextRun("She "), new TextRun({ text: "never", italics: true }), new TextRun(" called "), new TextRun({ text: "back", bold: true }), new TextRun(".")] }),
      new Paragraph("* * *"),
      new Paragraph("Later & elsewhere."),
    ]);
    const content = await readDocx(bytes);
    expect(content.author).toBe("Ada");
    expect(content.title).toBe("The Book");
    expect(content.blocks).toEqual([
      { kind: "heading", level: 1, text: "Chapter 1: The call" },
      { kind: "paragraph", text: "She *never* called **back**." },
      { kind: "paragraph", text: "* * *" },
      { kind: "paragraph", text: "Later & elsewhere." },
    ]);
  });

  it("joins runs with the same marks and keeps tracked changes as revisions", () => {
    const xml = `<w:body><w:p><w:r><w:rPr><w:i/></w:rPr><w:t>one </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>two</w:t></w:r><w:del w:author="Anna" w:date="2026-10-14T10:00:00Z"><w:r><w:delText> gone</w:delText></w:r></w:del><w:ins w:author="Anna" w:date="2026-10-14T10:00:00Z"><w:r><w:t> new</w:t></w:r></w:ins></w:p></w:body>`;
    expect(readDocument(xml)).toEqual([{ kind: "paragraph", text: "*one two* {--gone--}{>>@Anna 2026-10-14<<} {++new++}{>>@Anna 2026-10-14<<}" }]);
  });

  it("keeps comments and footnotes as comments", async () => {
    const bytes = new Uint8Array(
      await Packer.toBuffer(
        new Document({
          comments: { children: [{ id: 0, author: "Anna Bianchi", date: new Date("2026-10-14T10:00:00Z"), children: [new Paragraph("too early?")] }] },
          footnotes: { 1: { children: [new Paragraph("True story.")] } },
          sections: [
            {
              children: [
                new Paragraph({
                  children: [
                    new CommentRangeStart(0),
                    new TextRun("The wind smelled of salt."),
                    new CommentRangeEnd(0),
                    new TextRun({ children: [new CommentReference(0)] }),
                    new FootnoteReferenceRun(1),
                  ],
                }),
              ],
            },
          ],
        }),
      ),
    );
    const content = await readDocx(bytes, { note: "Note" });
    expect(content.blocks).toEqual([
      { kind: "paragraph", text: "{==The wind smelled of salt.==}{>>@Anna Bianchi 2026-10-14: too early?<<}{>>Note: True story.<<}" },
    ]);
  });

  it("keeps highlighting and escapes what Markdown would misread", async () => {
    const content = await readDocx(
      await docx([
        new Paragraph({ children: [new TextRun({ text: "check", highlight: "yellow" }), new TextRun(" this *now*")] }),
        new Paragraph("- Come in, she said."),
        new Paragraph("3. Not a list"),
      ]),
    );
    expect(content.blocks).toEqual([
      { kind: "paragraph", text: "==check== this \\*now\\*" },
      { kind: "paragraph", text: "\\- Come in, she said." },
      { kind: "paragraph", text: "3\\. Not a list" },
    ]);
  });

  it("finds chapters by their words when the document has no heading styles", async () => {
    const content = await readDocx(await docx([new Paragraph("Capitolo primo"), new Paragraph("Testo."), new Paragraph("Capitolo secondo"), new Paragraph("Altro.")]));
    expect(content.blocks.map((b) => (b.kind === "heading" ? b.level : null))).toEqual([2, null, 2, null]);
  });
});

describe("the structure of an imported book", () => {
  const h = (level: number, text: string) => ({ kind: "heading" as const, level, text });
  const p = (text: string) => ({ kind: "paragraph" as const, text });

  it("splits chapters into scenes at scene breaks", () => {
    const book = structure([p("Opening words."), h(1, "Chapter 1"), p("One."), p("***"), p("Two."), h(1, "Chapter 2: Home"), p("Three.")], names);
    expect(book.hasParts).toBe(false);
    expect(book.parts[0].chapters.map((c) => [c.title, c.scenes.map((s) => [s.title, s.text])])).toEqual([
      ["Start", [["Scene 1", "Opening words."]]],
      ["Chapter 1", [["Scene 1", "One."], ["Scene 2", "Two."]]],
      ["Home", [["Scene 1", "Three."]]],
    ]);
  });

  it("reads parts when the first of two levels names them, titled scenes otherwise", () => {
    const parts = structure([h(1, "Part One: Away"), h(2, "Chapter 1"), p("A."), h(1, "Part Two"), h(2, "Chapter 2"), p("B.")], names);
    expect(parts.hasParts).toBe(true);
    expect(parts.parts.map((x) => [x.title, x.chapters.map((c) => c.title)])).toEqual([
      ["Away", ["Chapter 1"]],
      ["Part Two", ["Chapter 2"]],
    ]);
    const scenes = structure([h(1, "Return"), h(2, "Arrival"), p("A."), h(2, "The house"), p("B.")], names);
    expect(scenes.hasParts).toBe(false);
    expect(scenes.parts[0].chapters[0].scenes.map((s) => s.title)).toEqual(["Arrival", "The house"]);
    expect(counts(scenes)).toEqual({ parts: 0, chapters: 1, scenes: 2, words: 2 });
  });

  it("splits scenes at empty paragraphs unless they are spacing", () => {
    const one = [h(1, "Chapter 1"), p("A."), p("B."), p(""), p("C."), p("D.")];
    expect(defaultBlankLines(one)).toBe(1);
    expect(structure(one, names).parts[0].chapters[0].scenes.map((s) => s.text)).toEqual(["A.\n\nB.", "C.\n\nD."]);
    expect(structure(one, names, "", undefined, 0).parts[0].chapters[0].scenes).toHaveLength(1);
    // Empty paragraphs between every paragraph are spacing; two in a row still break.
    const spaced = [h(1, "Chapter 1"), p("A."), p(""), p("B."), p(""), p("C."), p(""), p(""), p("D."), p(""), p("E.")];
    expect(defaultBlankLines(spaced)).toBe(2);
    expect(structure(spaced, names).parts[0].chapters[0].scenes.map((s) => s.text)).toEqual(["A.\n\nB.\n\nC.", "D.\n\nE."]);
    expect(defaultBlankLines([p("A."), p("B.")])).toBe(0);
  });

  it("lets the writer choose what each heading level becomes", () => {
    const blocks = [h(1, "Return"), h(2, "Arrival"), p("A."), h(2, "The house"), p("B.")];
    expect(headingLevels(blocks)).toEqual([
      { level: 1, count: 1, examples: ["Return"] },
      { level: 2, count: 2, examples: ["Arrival", "The house"] },
    ]);
    expect(defaultRoles(blocks)).toEqual({ 1: "chapter", 2: "scene" });
    const asParts = structure(blocks, names, "", { 1: "part", 2: "chapter" });
    expect(asParts.hasParts).toBe(true);
    expect(asParts.parts.map((x) => [x.title, x.chapters.map((c) => c.title)])).toEqual([["Return", ["Arrival", "The house"]]]);
    const flat = structure(blocks, names, "", { 1: "chapter", 2: "text" });
    expect(flat.parts[0].chapters[0].scenes.map((s) => s.text)).toEqual(["## Arrival\n\nA.\n\n## The house\n\nB."]);
  });

  it("keeps a chapter's own title without its label and number", () => {
    expect(ownTitle("Capitolo 3: Il ritorno")).toBe("Il ritorno");
    expect(ownTitle("Chapter IV - Home")).toBe("Home");
    expect(ownTitle("Capitolo primo: La casa")).toBe("La casa");
    expect(ownTitle("Capitolo 3")).toBe("Capitolo 3");
    expect(ownTitle("Prologo")).toBe("Prologo");
  });
});

describe("importing into a project", () => {
  it("writes parts, chapters and scenes at the end of the manuscript", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: T\nlanguage: en\n" });
    const project = await Project.open(fs);
    const book = structure(
      [
        { kind: "heading", level: 1, text: "Prologue" },
        { kind: "paragraph", text: "Before." },
        { kind: "heading", level: 1, text: "Part One" },
        { kind: "heading", level: 2, text: "Chapter 1: What? Why" },
        { kind: "paragraph", text: "Words." },
      ],
      names,
    );
    // The prologue stands outside the parts, so the first level still reads as parts.
    expect(book.hasParts).toBe(true);
    await project.importBook(book);
    const titles = (n: typeof project.manuscript): unknown[] => n.children.map((c) => (c.children.length ? [c.kind, c.title, titles(c)] : [c.kind, c.title]));
    expect(titles(project.manuscript)).toEqual([
      ["prologue", "Prologue", [["scene", "Scene 1"]]],
      ["part", "Part One", [["chapter", "What? Why", [["scene", "Scene 1"]]]]],
    ]);
    expect(await fs.readText(project.manuscript.children[1].children[0].children[0].path)).toBe("Words.\n");
  });

  it("turns parts on when the book has them", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: T\nlanguage: en\n" });
    const project = await Project.open(fs);
    await project.importBook(structure([{ kind: "heading", level: 1, text: "Part One" }, { kind: "heading", level: 2, text: "Chapter 1" }, { kind: "paragraph", text: "A." }], names));
    expect(project.settings.structure.parts).toBe(true);
    expect(project.manuscript.children.map((c) => [c.kind, c.title, c.children.map((x) => [x.kind, x.title])])).toEqual([["part", "Part One", [["chapter", "Chapter 1"]]]]);
  });
});
