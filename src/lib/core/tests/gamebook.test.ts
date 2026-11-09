import { describe, expect, it } from "vitest";
import { defaultBoxTypes, findBoxes } from "../gamebook/boxes";
import { readDocument, readList, setEntry, writeDocument } from "../gamebook/frontmatter";
import { findWikiLinks, linkForm } from "../gamebook/links";
import { GamebookIndex, lengthBand, pagesOf, readParagraph, warnings } from "../gamebook/paragraphs";
import { writeProperties } from "../frontmatter";
import { defaultSettings, parseSettings, serializeSettings } from "../settings";
import { loadManuscript } from "../manuscript";
import { MemoryFs } from "../fs";

const types = defaultBoxTypes("it");
const options = { boxTypes: types, unit: "characters" as const };
const DIR = "Paragrafi";

function par(title: string, number: number, body: string, extra = "") {
  return { path: `${DIR}/${title}.md`, text: `---\nnote: ""\nnumero: ${number}\naliases:\n  - "${number}"\n${extra}---\n${body}` };
}

const book = [
  par("Agguato", 1, "Corri o ti fermi?\n\n::: {custom-style=\"box\"} \n🤔 **Devi agire in fretta!**\n\nSe corri leggi il **[[Fuga|2]]**, se ti fermi l'**[[Resa|8]]**.\n:::\n", "numero_tipo: fisso\n"),
  par("Fuga", 2, "Scappi nel bosco. Vai al **[[Bosco|3]]**."),
  par("Resa", 8, "::: {custom-style=\"box\"}\n😢 **Fine**\n\nRicomincia dall'**[[Agguato|1]]**.\n:::", "finale: true\n"),
  par("Bosco", 3, "", "rimandi nascosti: \"[[Enigma|32]]\"\n"),
  par("Enigma", 32, "Il numero è la risposta.", "carattere:\n  - studioso\n"),
  par("Dimenticato", 4, "Nessuno arriva qui. Vedi [[33]]."),
  { path: `${DIR}/00 regole.md`, text: "# Regole\n\nLeggi dal paragrafo 1." },
];

describe("gamebook frontmatter", () => {
  it("reads lists and inline values as the plugin does", () => {
    const { frontmatter } = readDocument('---\naliases: ["5"]\ncarattere:\n  - mondano\n  - "studioso"\n---\ntext');
    expect(readList(frontmatter, "aliases")).toEqual(['["5"]']);
    expect(readList(frontmatter, "carattere")).toEqual(["mondano", '"studioso"']);
  });

  it("rewrites one key and leaves the others byte for byte", () => {
    const text = '---\nnote: "PARAGRAFO FISSO: 89"\nnumero: 89\naliases:\n  - "89"\n---\nbody';
    const doc = readDocument(text);
    doc.frontmatter = setEntry(doc.frontmatter, "numero", { kind: "scalar", text: "12" });
    expect(writeDocument(doc)).toBe('---\nnote: "PARAGRAFO FISSO: 89"\nnumero: 12\naliases:\n  - "89"\n---\nbody');
  });

  it("stays readable by the plugin when Dante sets a property", () => {
    const text = '---\nnote: "Agguato"\nnumero: 1\naliases:\n  - "1"\n---\nbody';
    const written = writeProperties(text, { note: "Agguato di Antonio" });
    expect(written).toContain('aliases:\n  - "1"');
    expect(readParagraph("Paragrafi/A.md", written, options)?.number).toBe(1);
  });
});

describe("gamebook links and boxes", () => {
  it("tells canonical, unlabelled and bare links apart", () => {
    const forms = findWikiLinks("[[A|2]] [[B]] [[33]] ![[img.png]] [[C#x]]").map(linkForm);
    expect(forms).toEqual(["canonical", "unlabelled", "bare", "other", "other"]);
  });

  it("finds boxes by their emoji, with or without the variation selector", () => {
    const text = '::: {custom-style="box"}  \n❤ **Carattere**\n:::\n\n::: {custom-style="box"}\n🌟 nuovo\n::: ';
    const boxes = findBoxes(text, types);
    expect(boxes.map((b) => b.type)).toEqual(["trait", ""]);
    expect(boxes[1].emoji).toBe("🌟");
  });

  it("recognizes a type the gamebook adds", () => {
    const own = [...types, { id: "magic", emoji: "🌟", name: "Magia", color: "#aa00aa", text: "", property: "magie", ending: false }];
    expect(findBoxes('::: {custom-style="box"}\n🌟 nuovo\n:::', own)[0].type).toBe("magic");
  });
});

describe("gamebook index", () => {
  const index = new GamebookIndex(book, options);

  it("reads paragraphs and leaves other notes out", () => {
    expect(index.all().map((p) => p.number)).toEqual([1, 2, 3, 4, 8, 32]);
    const first = index.get(`${DIR}/Agguato.md`)!;
    expect(first.numberType).toBe("fixed");
    expect(first.references.map((r) => r.target)).toEqual(["Fuga", "Resa"]);
    expect(index.get(`${DIR}/Bosco.md`)!.empty).toBe(true);
    expect(index.get(`${DIR}/Resa.md`)!.hasEndingBox).toBe(true);
    expect(index.get(`${DIR}/Enigma.md`)!.lists.carattere).toEqual(["studioso"]);
  });

  it("follows hidden references and finds where each paragraph comes from", () => {
    expect(index.incoming(`${DIR}/Enigma.md`).map((i) => i.from.number)).toEqual([3]);
    expect(index.incoming(`${DIR}/Agguato.md`).map((i) => i.from.number)).toEqual([8]);
  });

  it("finds orphans, dead ends, unreachable paragraphs and bare links", () => {
    const w = warnings(index, 1);
    expect(w.get(`${DIR}/Dimenticato.md`)).toEqual(["orphan", "deadEnd", "bareLink"]);
    expect(w.get(`${DIR}/Enigma.md`)).toEqual(["deadEnd"]);
    expect(w.has(`${DIR}/Resa.md`)).toBe(false);
    expect(w.has(`${DIR}/Agguato.md`)).toBe(false);
    expect(index.firstFreeNumber(DIR)).toBe(5);
  });

  it("marks a label that no longer matches the number", () => {
    const stale = new GamebookIndex([par("A", 1, "[[B|7]]"), par("B", 2, "fine", "finale: true\n")], options);
    expect(warnings(stale, 1).get(`${DIR}/A.md`)).toEqual(["staleLabel"]);
  });
});

describe("gamebook measures", () => {
  it("bands lengths and estimates pages", () => {
    expect(lengthBand(300, 400, 1600)).toBe("short");
    expect(lengthBand(2000, 400, 1600)).toBe("long");
    expect(lengthBand(900, 400, 1600)).toBe("normal");
    expect(pagesOf([100, 1700, 900], 1600, true)).toBe(4);
    expect(pagesOf([100, 1700, 900], 1600, false)).toBe(2);
  });
});

describe("gamebook settings and manuscript", () => {
  it("keeps a novel's dante.yaml free of gamebook settings", () => {
    expect(serializeSettings(defaultSettings("it"))).not.toContain("gamebook");
  });

  it("writes and reads the module with its own box types", () => {
    const settings = defaultSettings("it");
    settings.gamebook.enabled = true;
    settings.gamebook.boxes = [...settings.gamebook.boxes, { id: "magic", emoji: "🌟", name: "Magia", color: "#aa00aa", text: "", property: "magie", ending: false }];
    const back = parseSettings(serializeSettings(settings));
    expect(back.gamebook.enabled).toBe(true);
    expect(back.gamebook.boxes.map((b) => b.id)).toEqual(["choice", "trait", "item", "encounter", "ending", "confirm", "magic"]);
  });

  it("orders paragraphs by number and keeps their names as titles", async () => {
    const fs = new MemoryFs();
    for (const f of book) await fs.writeText(f.path, f.text);
    const settings = defaultSettings("it");
    settings.folders.manuscript = DIR;
    settings.gamebook.enabled = true;
    const tree = await loadManuscript(fs, settings);
    expect(tree.children.map((c) => c.title)).toEqual(["Agguato", "Fuga", "Bosco", "Dimenticato", "Resa", "Enigma", "00 regole"]);
    expect(tree.children[0].number).toBe(1);
  });
});
