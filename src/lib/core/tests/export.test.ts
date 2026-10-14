import { describe, expect, it } from "vitest";
import { buildBook, cleanSource, markdownToBlocks } from "../export/book";
import { bookToDocx, docxBytes } from "../export/docx";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { defaultSettings } from "../settings";

describe("markdown to blocks", () => {
  it("keeps emphasis and drops markup", () => {
    const blocks = markdownToBlocks("She said *hello*\nto **Marta** and ~~left~~.\n\n> A quote\n\n---\n\nEnd.");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        runs: [
          { text: "She said " },
          { text: "hello", italic: true },
          { text: " to " },
          { text: "Marta", bold: true },
          { text: " and " },
          { text: "left", strike: true },
          { text: "." },
        ],
      },
      { type: "quote", runs: [{ text: "A quote" }] },
      { type: "break" },
      { type: "paragraph", runs: [{ text: "End." }] },
    ]);
  });

  it("removes comments, applies revisions and resolves wikilinks", () => {
    expect(cleanSource("The {--closed--}{++open++} door{>>@luca: why?<<} of [[Rinaldi House|the house]] and [[Codex/Marta]].")).toBe(
      "The open door of the house and Marta.",
    );
    expect(cleanSource("{--closed--}{++open++}", "reject")).toBe("closed");
  });
});

describe("book", () => {
  it("follows the manuscript order with computed headings", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nauthor: Ada Rossi\n",
      "Manuscript/000 Prologue/000 Prologue.md": "---\nkind: prologue\n---\n",
      "Manuscript/000 Prologue/010 Call.md": "Ring.",
      "Manuscript/010 Return/010 Arrival.md": "---\nstatus: draft\n---\nThe train.",
      "Manuscript/010 Return/020 House.md": "The house.",
    });
    const book = await buildBook(await Project.open(fs));
    expect(book.entries.map((e) => [e.kind, e.heading, e.scenes.length])).toEqual([
      ["prologue", "Prologue", 1],
      ["chapter", "Chapter 1: Return", 2],
    ]);
    expect(book.words).toBe(5);
    const bytes = await docxBytes(bookToDocx(book, defaultSettings().export.docx, { words: "words" }));
    // A DOCX file is a zip archive.
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
  });

  it("uses published titles, scene headings and typography", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: L'eredità\nauthor: Ada Rossi\nlanguage: it\nexport:\n  docx:\n    sceneHeadings: numberAndTitle\n    omitSingleSceneHeading: true\n",
      "Manuscript/010 Ritorno/010 Ritorno.md": "---\npublished_title: Il ritorno a casa\n---\n",
      "Manuscript/010 Ritorno/010 Arrivo.md": "---\npublished_title: Il treno\n---\n\"Sei tu...\" disse l'uomo.",
      "Manuscript/010 Ritorno/020 Casa.md": "La casa.",
      "Manuscript/020 Lettera/010 Busta.md": "Una busta.",
    });
    const book = await buildBook(await Project.open(fs));
    expect(book.title).toBe("L’eredità");
    const [first, second] = book.entries;
    expect([first.heading, first.number, first.title]).toEqual(["Capitolo 1: Il ritorno a casa", "Capitolo 1", "Il ritorno a casa"]);
    expect(first.scenes.map((s) => [s.number, s.title])).toEqual([["1", "Il treno"], ["2", "Casa"]]);
    // A chapter with one scene shows no scene heading.
    expect(second.scenes.map((s) => [s.number, s.title])).toEqual([["", ""]]);
    expect(first.scenes[0].blocks).toEqual([{ type: "paragraph", runs: [{ text: "«Sei tu…» disse l’uomo." }] }]);
    expect(book.characters).toBe("«Sei tu…» disse l’uomo.".length + "La casa.".length + "Una busta.".length);
  });

  it("renders both profiles with Word styles", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nauthor: Ada Rossi\nexport:\n  paratext:\n    dedication: To M.\n    acknowledgements: Thanks.\n",
      "Manuscript/010 Return/010 Arrival.md": "The train.\n\nThe station.",
    });
    const project = await Project.open(fs);
    const book = await buildBook(project);
    for (const profile of ["manuscript", "typeset"] as const) {
      const opts = { ...project.settings.export.docx, profile, headingLayout: "twoLines" as const };
      const xml = await documentXml(await docxBytes(bookToDocx(book, opts, { words: "words" })));
      expect(xml).toContain('w:pStyle w:val="FirstParagraph"');
      expect(xml).toContain('w:pStyle w:val="Normal"');
      expect(xml).toContain('w:pStyle w:val="Heading1"');
      expect(xml).toContain("To M.");
      expect(xml).toContain("Acknowledgements");
    }
  });
});

/** The main XML part of a DOCX file. */
async function documentXml(bytes: Uint8Array): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  return zip.file("word/document.xml")!.async("string");
}
