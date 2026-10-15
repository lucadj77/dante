import { describe, expect, it } from "vitest";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { readDocument, readDocx } from "../import/docx";
import { counts, ownTitle, structure } from "../import/structure";
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

  it("joins runs with the same marks and leaves out deleted text", () => {
    const xml = `<w:body><w:p><w:r><w:rPr><w:i/></w:rPr><w:t>one </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>two</w:t></w:r><w:del><w:r><w:delText>gone</w:delText></w:r></w:del></w:p></w:body>`;
    expect(readDocument(xml)).toEqual([{ kind: "paragraph", text: "*one two*" }]);
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
