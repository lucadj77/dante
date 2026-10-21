import { describe, expect, it } from "vitest";
import { buildBook, cleanSource, markdownToBlocks } from "../export/book";
import { bookToDocx, docxBytes } from "../export/docx";
import { bookToEpub } from "../export/epub";
import { bookToTypst, str } from "../export/typst";
import { crc32 } from "../export/zip";
import { bookToMarkdown, escapeMarkdown } from "../export/markdown";
import { coverSvg } from "../cover";
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
      "dante.yaml": "title: L'eredità\nauthor: Ada Rossi\nlanguage: it\nstructure:\n  chapter:\n    separator: \"\\n\"\nexport:\n  typography:\n    quotes: guillemets\n  docx:\n    scene:\n      numbering: arabic\n      showTitle: true\n    omitSingleSceneHeading: true\n",
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
    const text = blocks.map((b) => (b.type === "item" ? `${b.marker} ` : "") + (b.type === "break" || b.type === "blank" || b.type === "table" || b.type === "image" ? "---" : b.runs.map((r) => r.text).join("")));
    expect(text).toEqual(["• uno", "• due", "1. primo", "2. secondo", "☐ da fare", "☑ fatto", "Un punto chiave."]);
  });

  it("gives each item its level, and later paragraphs of an item no marker", () => {
    const blocks = markdownToBlocks("- uno\n    1. dentro\n\n    ancora uno\n- due");
    expect(blocks.map((b) => (b.type === "item" ? [b.marker, b.level] : b.type))).toEqual([["•", 0], ["1.", 1], ["", 0], ["•", 0]]);
  });

  it("writes lists back as Markdown lists, and hangs them in the other formats", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\n",
      "Manuscript/010 Uno/010 Scena.md": "Prima.\n\n- uno\n  - dentro\n- [x] fatto\n\n1. primo\n\nDopo.",
    });
    const project = await Project.open(fs);
    const book = await buildBook(project);
    const md = bookToMarkdown(book, project.settings.export.docx);
    expect(md).toContain("Prima.\n\n- uno\n    - dentro\n- [x] fatto\n\n1. primo\n\nDopo.");
    const xml = await documentXml(await docxBytes(bookToDocx(book, project.settings.export.docx, { words: "words" })));
    expect(xml).toContain('<w:pStyle w:val="ListParagraph"/>');
    expect(xml).toMatch(/<w:ind w:left="714" w:hanging="357"\/>/);
  });
});

describe("scenes outside chapters", () => {
  it("continue the chapter before them instead of starting a new one", async () => {
    const fs = new MemoryFs({
      "Manuscript/005 Opening.md": "Before any chapter.",
      "Manuscript/010 Start/010 Empty.md": "",
      "Manuscript/020 Loose.md": "The text.",
      "Manuscript/030 Next/010 Train.md": "Train.",
    });
    const book = await buildBook(await Project.open(fs));
    expect(book.entries.map((e) => [e.kind, e.scenes.length])).toEqual([["loose", 1], ["chapter", 2], ["chapter", 1]]);
  });
});

describe("PDF and EPUB", () => {
  const sample = () =>
    new MemoryFs({
      "dante.yaml": "title: Test \"quoted\"\nauthor: Ada Rossi\nlanguage: it\nstructure:\n  parts: true\nexport:\n  typography:\n    quotes: guillemets\n",
      "Manuscript/010 One/010 One.md": "---\nkind: part\n---\n",
      "Manuscript/010 One/010 Start/010 A.md": "Uno *due* #tre = \\ $4 // <b>.",
      "Manuscript/010 One/010 Start/020 B.md": "Quattro.",
      "Manuscript/900 Epilogue/900 Epilogue.md": "---\nkind: epilogue\n---\n",
      "Manuscript/900 Epilogue/010 End.md": "Fine.",
    });

  it("writes the text as Typst strings, never as markup", async () => {
    const book = await buildBook(await Project.open(sample()));
    const source = bookToTypst(book, defaultSettings("it").export.docx, { words: "parole" });
    expect(source).toContain('#"Uno "#emph("due")#" #tre = \\\\ $4 // <b>."');
    expect(source).toContain('#set document(title: "Test «quoted»", author: ("Ada Rossi",))');
    expect(str('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
    expect(source).toContain('#heading(level: 1)[#"Parte I: One"]');
    expect(source).toContain('lang: "it"');
  });

  it("makes an EPUB with the mimetype first and a nested table of contents", async () => {
    const book = await buildBook(await Project.open(sample()));
    const bytes = bookToEpub(book, defaultSettings("it").export.docx, "id", new Date(2026, 9, 15));
    const text = new TextDecoder().decode(bytes);
    // The mimetype is stored first and uncompressed, right after its 30-byte header.
    expect(text.slice(30, 58)).toBe("mimetypeapplication/epub+zip");
    expect(text).toMatch(/<li><a href="text\d+\.xhtml">Parte I: One<\/a><ol>\s*<li><a href="text\d+\.xhtml">Capitolo 1: Start<\/a><\/li>\s*<\/ol><\/li>\s*<li><a href="text\d+\.xhtml">Epilogue<\/a><\/li>/);
    expect(text).toContain("Uno <em>due</em> #tre = \\ $4 // &lt;b&gt;.");
  });

  it("computes the CRC-32 of zip entries", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });
});

describe("EPUB stylesheet", () => {
  it("uses the project's stylesheet when there is one", async () => {
    const { bookToEpub, EPUB_CSS } = await import("../export/epub");
    const { defaultSettings } = await import("../settings");
    const book = { title: "T", subtitle: "", author: "A", authors: ["A"], language: "it", paratext: defaultSettings("it").export.paratext, entries: [], words: 0, characters: 0 };
    const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
    expect(text(bookToEpub(book, defaultSettings("it").export.docx, "id"))).toContain(EPUB_CSS.slice(0, 40));
    expect(text(bookToEpub(book, defaultSettings("it").export.docx, "id", new Date(), "p { color: red; }"))).toContain("p { color: red; }");
  });
});

describe("markdown export", () => {
  it("writes the whole novel as one file", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nauthor: Ada Rossi\nlanguage: it\nexport:\n  paratext:\n    dedication: A Bruno\n",
      "Manuscript/010 Return/010 Arrival.md": "---\nstatus: draft\n---\nThe *train* left{>>@luca: why?<<}.\n\n- not a list",
      "Manuscript/010 Return/020 House.md": "# 1 house\n\nThe house.",
    });
    const project = await Project.open(fs);
    const md = bookToMarkdown(await buildBook(project), project.settings.export.docx);
    expect(md).toBe(
      [
        "---\ntitle: Test\nauthor: Ada Rossi\nlang: it\n---",
        "# Test",
        "Ada Rossi",
        "*A Bruno*",
        "## Capitolo 1: Return",
        "The *train* left.",
        "- not a list",
        "\\#",
        "#### 1 house",
        "The house.",
      ].join("\n\n") + "\n",
    );
  });

  it("escapes markup in the text", () => {
    expect(escapeMarkdown("a_b *c* [d] #e")).toBe("a\\_b \\*c\\* \\[d\\] \\#e");
  });
});

describe("cover in exports", () => {
  it("opens the Word file, the EPUB and the PDF", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\nauthor: Ada\n", "Manuscript/010 One/010 A.md": "Text." });
    const project = await Project.open(fs);
    const book = await buildBook(project);
    const svg = coverSvg(project.settings, project.settings.cover);
    const epub = new TextDecoder("latin1").decode(bookToEpub(book, project.settings.export.docx, "id", new Date(), "", { data: svg, mediaType: "image/svg+xml" }));
    expect(epub).toContain('properties="cover-image"');
    expect(epub).toContain("OEBPS/cover.svg");
    expect(epub).toContain('<img src="cover.svg"');
    const docx = await docxBytes(bookToDocx(book, project.settings.export.docx, { words: "words" }, new Uint8Array([0x89, 0x50, 0x4e, 0x47])));
    expect(new TextDecoder("latin1").decode(docx)).toMatch(/word\/media\/[^"]+\.png/);
    const typst = bookToTypst(book, project.settings.export.docx, { words: "words" }, svg);
    expect(typst).toContain('#page(margin: 0pt, header: none, footer: none, image(bytes("<svg ');
  });
});

describe("addresses written between angle brackets", () => {
  it("keep the address in the text", () => {
    expect(markdownToBlocks("See <https://example.com> now.")).toEqual([{ type: "paragraph", runs: [{ text: "See https://example.com now." }] }]);
  });
});

describe("blank lines", () => {
  it("reads &nbsp;, <br> and a lone non-breaking space as a blank line, not a scene break", () => {
    for (const line of ["&nbsp;", "&#160;", "<br>", "<br />", " ", " &nbsp; "]) {
      const blocks = markdownToBlocks(cleanSource(`Uno.\n\n${line}\n\nDue.`));
      expect(blocks.map((b) => b.type)).toEqual(["paragraph", "blank", "paragraph"]);
    }
    // Inside a paragraph an entity is its character.
    expect(markdownToBlocks("A&nbsp;B &amp; C")).toEqual([{ type: "paragraph", runs: [{ text: "A B & C" }] }]);
  });

  it("keeps the blank line in every format", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nlanguage: fr\nexport:\n  typography:\n    frenchSpacing: true\n",
      "Manuscript/010 Uno/010 Scena.md": "Prima.\n\n&nbsp;\n\nDopo.",
    });
    const project = await Project.open(fs);
    const book = await buildBook(project);
    expect(book.entries[0].scenes[0].blocks.map((b) => b.type)).toEqual(["paragraph", "blank", "paragraph"]);
    expect(book.words).toBe(2);
    const settings = project.settings.export.docx;
    expect(bookToMarkdown(book, settings)).toContain("Prima.\n\n&nbsp;\n\nDopo.");
    expect(bookToTypst(book, settings, { words: "mots" })).toMatch(/"Prima\."\]?\n*#v\([\d.]+em\)\n/);
    const xml = await documentXml(await docxBytes(bookToDocx(book, settings, { words: "words" })));
    expect(xml).toMatch(/Prima\.<\/w:t><\/w:r><\/w:p><w:p><w:pPr><w:pStyle w:val="Normal"\/><\/w:pPr><\/w:p>/);
    expect(new TextDecoder().decode(bookToEpub(book, settings, "id"))).toBeTruthy();
  });
});
