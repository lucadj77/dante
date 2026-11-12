import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildBook } from "../export/book";
import { bookToDocx, docxBytes } from "../export/docx";
import { bookToEpub } from "../export/epub";
import { bookToTypst } from "../export/typst";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { defaultHeadings, defaultSettings, parseSettings, serializeSettings } from "../settings";

const YAML = `title: Test
language: it
structure:
  parts: true
export:
  docx:
    profile: typeset
    fontSize: 11
    lineSpacing: 1.3
    scene:
      numbering: arabic
      showTitle: true
    omitSingleSceneHeading: false
    headings:
      chapter:
        font: Georgia
        size: 20
        align: right
        italic: true
        uppercase: true
        before: 30
        after: 18
        lineSpacing: 1
      scene:
        align: left
        bold: true
`;

async function sample() {
  const fs = new MemoryFs({
    "dante.yaml": YAML,
    "Manuscript/010 Il ritorno/010 La lettera/010 Alla stazione.md": "Il treno arrivò.",
    "Manuscript/010 Il ritorno/010 La lettera/020 Il treno delle sei.md": "Nessuno scese.",
    "Manuscript/010 Il ritorno/Il ritorno.md": "---\nkind: part\n---\n",
  });
  const project = await Project.open(fs);
  return { project, book: await buildBook(project) };
}

describe("heading styles", () => {
  it("start as the layout had them before they could be chosen", () => {
    const old = parseSettings("export:\n  docx:\n    profile: typeset\n    fontSize: 11\n    lineSpacing: 1.15\n").export.docx;
    expect(old.headings).toEqual(defaultHeadings(old, false));
    expect(old.headings.chapter).toMatchObject({ size: 16.5, bold: true, align: "center", after: 14 });
    expect(defaultSettings("it").export.docx.headings.chapter).toMatchObject({ size: 12, bold: true, after: 24, lineSpacing: 2 });
  });

  it("keep what the writer chose and complete the rest", () => {
    const docx = parseSettings(YAML).export.docx;
    expect(docx.lineSpacing).toBe(1.3);
    expect(docx.headings.chapter).toMatchObject({ font: "Georgia", size: 20, align: "right", italic: true, uppercase: true, before: 30, after: 18, lineSpacing: 1 });
    expect(docx.headings.scene).toMatchObject({ align: "left", bold: true, size: 11 });
    expect(docx.headings.part).toEqual(defaultHeadings(docx, true).part);
    const again = parseSettings(serializeSettings(parseSettings(YAML))).export.docx;
    expect(again.headings).toEqual(docx.headings);
  });

  it("refuse numbers out of range", () => {
    const docx = parseSettings("export:\n  docx:\n    lineSpacing: 40\n    headings:\n      chapter:\n        size: -3\n        align: middle\n        lineSpacing: 0\n").export.docx;
    expect(docx.lineSpacing).toBe(3);
    expect(docx.headings.chapter).toMatchObject({ size: 6, align: "center", lineSpacing: 0.8 });
  });

  it("reach the styles of the Word file", async () => {
    const { project, book } = await sample();
    const bytes = await docxBytes(bookToDocx(book, project.settings.export.docx, { words: "parole" }));
    const styles = strFromU8(unzipSync(bytes)["word/styles.xml"]);
    const chapter = /<w:style [^>]*w:styleId="Heading2".*?<\/w:style>/.exec(styles)?.[0] ?? "";
    expect(chapter).toContain('w:ascii="Georgia"');
    expect(chapter).toContain('<w:sz w:val="40"/>');
    expect(chapter).toContain("<w:caps");
    expect(chapter).toContain('<w:jc w:val="right"/>');
    expect(chapter).toMatch(/<w:spacing [^>]*w:before="600"/);
    expect(chapter).toMatch(/<w:spacing [^>]*w:after="360"/);
    expect(chapter).toMatch(/<w:spacing [^>]*w:line="240"/);
    const scene = /<w:style [^>]*w:styleId="Heading3".*?<\/w:style>/.exec(styles)?.[0] ?? "";
    expect(scene).toContain('<w:jc w:val="left"/>');
    // The text takes the free line spacing: 1.3 lines of 240.
    expect(/<w:style [^>]*w:styleId="Normal".*?<\/w:style>/.exec(styles)?.[0]).toMatch(/w:line="312"/);
  });

  it("reach the PDF source, which the application compiles", async () => {
    const { project, book } = await sample();
    const source = bookToTypst(book, project.settings.export.docx, { words: "parole" });
    expect(source).toContain('if it.level == 2 { set align(right); set par(leading: 0em); set text(font: ("Georgia", "Libertinus Serif", "New Computer Modern"), size: 20pt, weight: "bold", style: "italic"); block(above: 33.96pt, below: 21.96pt, upper(it.body)) }');
    expect(source).toContain("if it.level == 3 { set align(left)");
    // The same text the Rust test compiles: run with UPDATE_FIXTURES=1 to write it again.
    const fixture = new URL("../../../../src-tauri/src/fixtures/headings.typ", import.meta.url);
    if (process.env.UPDATE_FIXTURES) (await import("node:fs")).writeFileSync(fixture, source);
    expect(readFileSync(fixture, "utf8")).toBe(source);
  });

  it("change in the ebook only what the writer changed", async () => {
    const { project, book } = await sample();
    const css = (opts = project.settings.export.docx) => strFromU8(unzipSync(bookToEpub(book, opts, "id", new Date(2026, 10, 12)))["OEBPS/style.css"]);
    expect(css()).toContain('h2 { font-family: "Georgia", serif; font-size: 1.82em; text-align: right; font-style: italic; text-transform: uppercase; margin-top: 1.5em; margin-bottom: 0.9em; line-height: 1.2; }');
    expect(css()).toContain("h3 { text-align: left; font-weight: bold; }");
    expect(css()).not.toContain(".part h1 { font");
    const plain = { ...project.settings.export.docx, headings: defaultHeadings(project.settings.export.docx, true) };
    expect(css(plain)).not.toContain("/* Titoli */");
  });
});
