import { describe, expect, it } from "vitest";
import { buildBook, markdownToBlocks } from "../export/book";
import { bookToDocx, docxBytes } from "../export/docx";
import { bookToEpub } from "../export/epub";
import { bookToTypst } from "../export/typst";
import { bookToMarkdown } from "../export/markdown";
import { attachmentFolder, findImages, imageSize, resolveImagePath, withWidth } from "../images";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { defaultSettings } from "../settings";
import { textStats } from "../stats";
import { unzip } from "../import/unzip";

// A real 1×1 PNG, and its header claiming 400×200 for size tests.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const wide = () => {
  const bytes = PNG.slice();
  new DataView(bytes.buffer).setUint32(16, 400);
  new DataView(bytes.buffer).setUint32(20, 200);
  return bytes;
};

describe("images in the text", () => {
  it("finds Obsidian's embeds, with description and size", () => {
    const found = findImages("Prima ![[foto.jpg|300]] poi ![[Nota]] e ![[a.png|Una casa|200x100]] e ![Mare|250](Allegati/mare%20blu.png) e ![](<b c.gif>).");
    expect(found.map((f) => [f.target, f.wiki, f.alt, f.width, f.height])).toEqual([
      ["foto.jpg", true, "", 300, undefined],
      ["a.png", true, "Una casa", 200, 100],
      ["Allegati/mare blu.png", false, "Mare", 250, undefined],
      ["b c.gif", false, "", undefined, undefined],
    ]);
  });

  it("writes a new width, or none", () => {
    const [wiki, md] = findImages("![[a.png|Casa|200]] ![Mare](x/mare.png)");
    expect(withWidth(wiki, 400)).toBe("![[a.png|Casa|400]]");
    expect(withWidth(wiki, null)).toBe("![[a.png|Casa]]");
    expect(withWidth(md, 300)).toBe("![Mare|300](x/mare.png)");
  });

  it("resolves ![](…) relative to the note, then to the project", () => {
    const files = ["Manoscritto/cap/img/a.png", "Allegati/b.png"];
    expect(resolveImagePath("img/a.png", "Manoscritto/cap/scena.md", files)).toBe("Manoscritto/cap/img/a.png");
    expect(resolveImagePath("../cap/img/a.png", "Manoscritto/cap/scena.md", files)).toBe("Manoscritto/cap/img/a.png");
    expect(resolveImagePath("Allegati/b.png", "Manoscritto/cap/scena.md", files)).toBe("Allegati/b.png");
    expect(resolveImagePath("https://x.org/a.png", "s.md", files)).toBeNull();
  });

  it("reads sizes from file headers", () => {
    expect(imageSize(wide(), "image/png")).toEqual({ width: 400, height: 200 });
    expect(imageSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"></svg>'), "image/svg+xml")).toEqual({ width: 120, height: 60 });
    expect(imageSize(new Uint8Array([1, 2, 3]), "image/png")).toBeNull();
  });

  it("leaves images and table bars out of the counts", () => {
    expect(textStats("Testo ![[a.png|300]] ![x](b.png)\n\n| A | [[n\\|B]] |\n|---|:-:|\n| uno | due |").words).toBe(5);
  });

  it("follows Obsidian's attachment folder setting", () => {
    expect(attachmentFolder(undefined, "M/c/s.md", "Allegati")).toBe("Allegati");
    expect(attachmentFolder("/", "M/c/s.md", "Allegati")).toBe("");
    expect(attachmentFolder("./", "M/c/s.md", "Allegati")).toBe("M/c");
    expect(attachmentFolder("./img", "M/c/s.md", "Allegati")).toBe("M/c/img");
    expect(attachmentFolder("Media", "M/c/s.md", "Allegati")).toBe("Media");
  });
});

describe("tables and images in the export", () => {
  it("reads a table with alignment and inline marks", () => {
    const blocks = markdownToBlocks("| Fase | *Stato* |\n|:--|--:|\n| 0 | **ok** |\n| 1 |  |");
    expect(blocks).toEqual([
      {
        type: "table",
        align: ["left", "right"],
        header: [[{ text: "Fase" }], [{ text: "Stato", italic: true }]],
        rows: [
          [[{ text: "0" }], [{ text: "ok", bold: true }]],
          [[{ text: "1" }], []],
        ],
      },
    ]);
  });

  const project = async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nauthor: Ada Rossi\nlanguage: it\n",
      "Manuscript/010 Uno/010 Scena.md":
        'Prima.\n\n<span style="display:block;text-align:center">![[casa.png|Casa|300]]</span>\n\n| Fase | Documento |\n|---|:---:|\n| 0 | [[Idea\\|L\'idea]] |\n\nTesto ![[manca.png]] dopo.\n',
    });
    await fs.writeBytes("Allegati/casa.png", wide());
    return Project.open(fs);
  };

  it("carries images and tables into the book", async () => {
    const book = await buildBook(await project());
    const blocks = book.entries[0].scenes[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "image", "table", "paragraph"]);
    const image = blocks[1];
    expect(image.type === "image" && [image.image.path, image.image.width, image.image.height, image.image.alt, image.align]).toEqual(["Allegati/casa.png", 300, 150, "Casa", "center"]);
    const table = blocks[2];
    expect(table.type === "table" && table.rows[0][1]).toEqual([{ text: "L’idea" }]);
    // A missing image goes, its text stays.
    expect(blocks[3].type === "paragraph" && blocks[3].runs.map((r) => r.text).join("")).toBe("Testo dopo.");
    expect(book.words).toBe(7);
  });

  it("writes them in every format", async () => {
    const book = await buildBook(await project());
    const settings = defaultSettings("it").export.docx;

    const read = async (files: Map<string, () => Promise<Uint8Array>>, name: string) => new TextDecoder().decode(await files.get(name)!());
    const docx = await unzip(await docxBytes(bookToDocx(book, settings, { words: "parole" })));
    const xml = await read(docx, "word/document.xml");
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Documento");
    expect([...docx.keys()].some((k) => k.startsWith("word/media/"))).toBe(true);

    const typst = bookToTypst(book, settings, { words: "parole" });
    expect(typst).toContain('image("/Allegati/casa.png", width: 3.125in, alt: "Casa")');
    expect(typst).toContain("#align(center, image(");
    expect(typst).toContain("table(columns: 2, align: (left, center,)");

    const epub = await unzip(bookToEpub(book, settings, "id"));
    expect(epub.has("OEBPS/images/image1.png")).toBe(true);
    let html = "";
    for (const name of epub.keys()) if (name.endsWith(".xhtml")) html += await read(epub, name);
    expect(html).toContain('<div class="image align-center"><img src="images/image1.png" alt="Casa" style="width: 300px; max-width: 100%;"/></div>');
    expect(html).toContain('<th style="text-align: center">Documento</th>');
    expect(await read(epub, "OEBPS/content.opf")).toContain('href="images/image1.png" media-type="image/png"');

    const md = bookToMarkdown(book, settings);
    expect(md).toContain('<span style="display:block;text-align:center">![[Allegati/casa.png|Casa|300]]</span>');
    expect(md).toContain("| Fase | Documento |\n| --- | :---: |\n| 0 | L’idea |");
  });
});
