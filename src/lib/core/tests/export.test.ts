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
});
