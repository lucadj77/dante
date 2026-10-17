import { describe, expect, it } from "vitest";
import { embeddedPart, expandEmbeds, findNoteEmbeds } from "../embeds";
import { buildBook } from "../export/book";
import { MemoryFs } from "../fs";
import { Project } from "../project";

const NOTE = "# Casa\n\nIntro.\n\n## Cucina\n\nPentole.\n\n### Dispensa\n\nFarina.\n\n## Giardino\n\nRose. ^rose\n\nAltro.";

describe("embedded notes", () => {
  it("finds note embeds, not images", () => {
    expect(findNoteEmbeds("A ![[Casa#Cucina|x]] b ![[foto.png]] c ![[Nota]]").map((e) => [e.target, e.section])).toEqual([
      ["Casa", "Cucina"],
      ["Nota", ""],
    ]);
  });

  it("takes a section with its subsections, or a marked paragraph", () => {
    expect(embeddedPart(NOTE, "cucina")).toBe("## Cucina\n\nPentole.\n\n### Dispensa\n\nFarina.");
    expect(embeddedPart(NOTE, "Giardino")).toBe("## Giardino\n\nRose. ^rose\n\nAltro.");
    expect(embeddedPart(NOTE, "^rose")).toBe("Rose.");
    expect(embeddedPart(NOTE, "Cantina")).toBeNull();
  });

  it("expands nested embeds and stops at loops", async () => {
    const files: Record<string, string> = {
      "A.md": "Uno ![[B]]",
      "B.md": "---\ntype: x\n---\nDue ![[A]] ![[C#^c]]",
      "C.md": "Tre. ^c",
    };
    const text = await expandEmbeds("Inizio\n\n![[A]]\n\n![[Manca]]", "S.md", ["S.md", ...Object.keys(files)], async (p) => files[p]);
    expect(text.replace(/\s+/g, " ").trim()).toBe("Inizio Uno Due Tre. ![[Manca]]");
  });

  it("puts the embedded text in the export", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: T\n",
      "Manuscript/010 Uno/010 Scena.md": "Prima.\n\n![[Lettera#Testo]]\n\nDopo.",
      "Research/Lettera.md": "# Note\n\nNon questo.\n\n# Testo\n\nCara *Marta*.",
    });
    const book = await buildBook(await Project.open(fs));
    const blocks = book.entries[0].scenes[0].blocks;
    expect(blocks.map((b) => (b.type === "paragraph" || b.type === "heading" ? b.runs.map((r) => r.text).join("") : b.type))).toEqual([
      "Prima.",
      "Testo",
      "Cara Marta.",
      "Dopo.",
    ]);
  });
});
