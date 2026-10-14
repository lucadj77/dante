import { describe, expect, it } from "vitest";
import { buildBook, cleanSource, markdownToBlocks } from "../export/book";
import { bookToDocx, docxBytes } from "../export/docx";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { defaultSettings, parseSettings } from "../settings";

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
      "dante.yaml": "title: L'eredità\nauthor: Ada Rossi\nlanguage: it\nstructure:\n  chapter:\n    separator: \"\\n\"\nexport:\n  docx:\n    scene:\n      numbering: arabic\n      showTitle: true\n    omitSingleSceneHeading: true\n",
      "Manuscript/010 Ritorno/010 Ritorno.md": "---\npublished_title: Il ritorno a casa\n---\n",
      "Manuscript/010 Ritorno/010 Arrivo.md": "---\npublished_title: Il treno\n---\n\"Sei tu...\" disse l'uomo.",
      "Manuscript/010 Ritorno/020 Casa.md": "La casa.",
      "Manuscript/020 Lettera/010 Busta.md": "Una busta.",
    });
    const book = await buildBook(await Project.open(fs));
    expect(book.title).toBe("L’eredità");
    const [first, second] = book.entries;
    expect(first.heading).toBe("Capitolo 1\nIl ritorno a casa");
    expect(first.scenes.map((s) => s.heading)).toEqual(["1. Il treno", "2. Casa"]);
    // A chapter with one scene shows no scene heading.
    expect(second.scenes.map((s) => s.heading)).toEqual([""]);
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
      const opts = { ...project.settings.export.docx, profile };
      const xml = await documentXml(await docxBytes(bookToDocx(book, opts, { words: "words" })));
      expect(xml).toContain('w:pStyle w:val="FirstParagraph"');
      expect(xml).toContain('w:pStyle w:val="Normal"');
      expect(xml).toContain('w:pStyle w:val="Heading1"');
      expect(xml).toContain("To M.");
      expect(xml).toContain("Acknowledgements");
    }
  });

  it("uses the chosen page size whatever the profile", async () => {
    const fs = new MemoryFs({ "Manuscript/010 Return/010 Arrival.md": "The train." });
    const project = await Project.open(fs);
    const book = await buildBook(project);
    const docx = project.settings.export.docx;
    const a5 = await documentXml(await docxBytes(bookToDocx(book, { ...docx, profile: "manuscript", pageSize: "a5" }, { words: "words" })));
    expect(a5).toMatch(/w:pgSz w:w="8391" w:h="11906"/);
    const custom = { ...docx, profile: "typeset" as const, pageSize: "custom" as const, pageWidth: 17, pageHeight: 24 };
    expect(await documentXml(await docxBytes(bookToDocx(book, custom, { words: "words" })))).toMatch(/w:pgSz w:w="9638" w:h="13606"/);
    expect(parseSettings("export:\n  docx:\n    profile: typeset\n").export.docx.pageSize).toBe("a5");
  });
});

/** The main XML part of a DOCX file. */
async function documentXml(bytes: Uint8Array): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  return zip.file("word/document.xml")!.async("string");
}

describe("lists, tasks and highlights", () => {
  it("keeps bullets, numbers and boxes, and drops highlight marks", () => {
    const blocks = markdownToBlocks(cleanSource("- uno\n- due\n\n1. primo\n2. secondo\n\n- [ ] da fare\n- [x] fatto\n\nUn ==punto== chiave."));
    const text = blocks.map((b) => (b.type === "break" ? "---" : b.runs.map((r) => r.text).join("")));
    expect(text).toEqual(["• uno", "• due", "1. primo", "2. secondo", "☐ da fare", "☑ fatto", "Un punto chiave."]);
  });
});
