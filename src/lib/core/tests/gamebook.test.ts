import { describe, expect, it } from "vitest";
import { defaultBoxTypes, findBoxes } from "../gamebook/boxes";
import { readDocument, readList, setEntry, writeDocument } from "../gamebook/frontmatter";
import { findWikiLinks, linkForm } from "../gamebook/links";
import { GamebookIndex, lengthBand, pagesOf, readParagraph, warnings } from "../gamebook/paragraphs";
import { writeProperties } from "../frontmatter";
import { defaultSettings, parseSettings, serializeSettings } from "../settings";
import { loadManuscript } from "../manuscript";
import { MemoryFs } from "../fs";
import { addToList, newParagraphText, relabel, removeFromList, setParagraphFields } from "../gamebook/edit";
import { articleFix, fixArticles, startsWithVowel } from "../gamebook/articles";
import { Project } from "../project";
import { proseNumbers, shuffle } from "../gamebook/shuffle";

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
    expect(tree.children.map((c) => c.title)).toEqual(["00 regole", "Agguato", "Fuga", "Bosco", "Dimenticato", "Resa", "Enigma"]);
    expect(tree.children[1].number).toBe(1);
  });
});

describe("gamebook edits", () => {
  it("writes number, alias, type, ending and note as the plugin does", () => {
    const text = '---\nnumero: 3\naliases:\n  - "3"\n  - Bosco fitto\ncarattere:\n  - studioso\n---\nTesto.';
    const out = setParagraphFields(text, { number: 12, numberType: "fixed", ending: true, note: "Da rivedere: troppo corto" });
    expect(out).toBe('---\nnumero: 12\naliases:\n  - Bosco fitto\n  - "12"\ncarattere:\n  - studioso\nnumero_tipo: fisso\nfinale: true\nnote: "Da rivedere: troppo corto"\n---\nTesto.');
    const back = setParagraphFields(out, { numberType: "free", ending: false, note: "" });
    expect(back).toBe('---\nnumero: 12\naliases:\n  - Bosco fitto\n  - "12"\ncarattere:\n  - studioso\n---\nTesto.');
  });

  it("relabels references in the text and among the hidden ones", () => {
    const text = '---\nrimandi nascosti:\n  - "[[Bosco|3]]"\n---\nVai al **[[Bosco|3]]** o al **[[Boscaglia|3]]**.';
    expect(relabel(text, "Bosco", 3, 12)).toBe('---\nrimandi nascosti:\n  - "[[Bosco|12]]"\n---\nVai al **[[Bosco|12]]** o al **[[Boscaglia|3]]**.');
  });

  it("renumbers a paragraph and the references to it, and refuses a number taken", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\nlanguage: it\nfolders:\n  manuscript: Paragrafi\ngamebook:\n  enabled: true\n" });
    for (const f of book) await fs.writeText(f.path, f.text);
    const project = await Project.open(fs, "it");
    await project.setParagraph(`${DIR}/Fuga.md`, { number: 5 });
    expect(await fs.readText(`${DIR}/Fuga.md`)).toContain('numero: 5\naliases:\n  - "5"');
    expect(await fs.readText(`${DIR}/Agguato.md`)).toContain("**[[Fuga|5]]**");
    await expect(project.setParagraph(`${DIR}/Fuga.md`, { number: 8 })).rejects.toThrow("gamebook.numberTaken:8:Resa");
  });

  it("puts pages marked to go after the paragraphs at the end", async () => {
    const fs = new MemoryFs();
    for (const f of book) await fs.writeText(f.path, f.text);
    await fs.writeText(`${DIR}/Ringraziamenti.md`, "---\nposizione: dopo\n---\nGrazie.");
    const settings = defaultSettings("it");
    settings.folders.manuscript = DIR;
    settings.gamebook.enabled = true;
    const tree = await loadManuscript(fs, settings);
    expect(tree.children.map((c) => c.title).filter((t) => !/^[A-Z][a-z]+$/.test(t) || t === "Ringraziamenti")).toEqual(["00 regole", "Ringraziamenti"]);
    expect(tree.children.at(-1)?.position).toBe("after");
  });
});

describe("gamebook writing", () => {
  it("knows which numbers start with a vowel", () => {
    expect([1, 8, 11, 80, 89, 800, 8000, 11000].every(startsWithVowel)).toBe(true);
    expect([2, 10, 18, 100, 1000, 1800].some(startsWithVowel)).toBe(false);
  });

  it("corrects the article before a reference", () => {
    expect(articleFix("Vai al ", 8)).toEqual({ from: 4, text: "all'" });
    expect(articleFix("Vai all'", 12)).toEqual({ from: 4, text: "al " });
    expect(articleFix("vai al **", 11)).toEqual({ from: 4, text: "all'**" });
    expect(articleFix("Leggi il ", 3)).toBeNull();
    expect(articleFix("Leggi l’", 7)).toEqual({ from: 6, text: "il " });
    expect(articleFix("Fossil ", 8)).toBeNull();
    const text = "Vai al **[[Fuga|8]]** o all'**[[Resa|12]]**, non al [[Fuga|3]].";
    expect(fixArticles(text, (t) => (t === "Fuga" ? 8 : t === "Resa" ? 12 : null)).text).toBe("Vai all'**[[Fuga|8]]** o al **[[Resa|12]]**, non al [[Fuga|3]].");
  });

  it("writes new paragraphs and list properties as the plugin does", () => {
    expect(newParagraphText({ number: 7, numberType: "free" })).toBe('---\nnumero: 7\naliases:\n  - "7"\nnote:\n---\n');
    expect(newParagraphText({ number: 9, numberType: "relative", anchor: "Bosco", offset: 2 })).toBe('---\nnumero: 9\nnumero_tipo: relativo\nancora: "[[Bosco]]"\nscarto: 2\naliases:\n  - "9"\nnote:\n---\n');
    const one = addToList('---\nnumero: 1\n---\nTesto', "rimandi nascosti", '"[[Bosco|3]]"');
    expect(one).toBe('---\nnumero: 1\nrimandi nascosti: "[[Bosco|3]]"\n---\nTesto');
    const two = addToList(one, "rimandi nascosti", '"[[Fuga|2]]"');
    expect(two).toBe('---\nnumero: 1\nrimandi nascosti:\n  - "[[Bosco|3]]"\n  - "[[Fuga|2]]"\n---\nTesto');
    expect(removeFromList(removeFromList(two, "rimandi nascosti", '"[[Fuga|2]]"'), "rimandi nascosti", '"[[Bosco|3]]"')).toBe('---\nnumero: 1\n---\nTesto');
  });

  it("creates paragraphs, makes one relative and moves its followers with it", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\nlanguage: it\nfolders:\n  manuscript: Paragrafi\ngamebook:\n  enabled: true\n" });
    for (const f of book) await fs.writeText(f.path, f.text);
    const project = await Project.open(fs, "it");
    const made = await project.createParagraph(DIR, "Grotta", { numberType: "free" });
    expect(made.number).toBe(5);
    await expect(project.createParagraph(DIR, "Grotta", { numberType: "free" })).rejects.toThrow("gamebook.exists:Grotta");
    await expect(project.createParagraph(DIR, "Lago", { numberType: "fixed", number: 8 })).rejects.toThrow("gamebook.numberTaken:8:Resa");
    await project.setParagraph(`${DIR}/Grotta.md`, { numberType: "relative", anchor: "Enigma", offset: 1 });
    expect(await fs.readText(`${DIR}/Grotta.md`)).toContain('numero: 33\naliases:\n  - "33"\nnote:\nnumero_tipo: relativo\nancora: "[[Enigma]]"\nscarto: 1');
    await project.setParagraph(`${DIR}/Enigma.md`, { number: 40 });
    expect(await fs.readText(`${DIR}/Grotta.md`)).toContain("numero: 41");
    expect(await fs.readText(`${DIR}/Bosco.md`)).toContain('"[[Enigma|40]]"');
    await expect(project.setParagraph(`${DIR}/Enigma.md`, { numberType: "relative", anchor: "Grotta", offset: 1 })).rejects.toThrow("gamebook.anchorCycle:Grotta");
  });

  it("creates a page without a number, before the paragraphs", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\nlanguage: it\nfolders:\n  manuscript: Paragrafi\ngamebook:\n  enabled: true\n" });
    for (const f of book) await fs.writeText(f.path, f.text);
    const project = await Project.open(fs, "it");
    const path = await project.createPage(DIR, "Regole");
    expect(path).toBe(`${DIR}/Regole.md`);
    expect(await project.createPage(DIR, "Regole")).toBe(`${DIR}/Regole 2.md`);
    const page = project.manuscript.children.find((c) => c.path === path);
    expect(page?.number).toBeUndefined();
    expect(project.manuscript.children[0].number).toBeUndefined();
  });

  it("keeps the label when a paragraph is renamed", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\nlanguage: it\nfolders:\n  manuscript: Paragrafi\ngamebook:\n  enabled: true\n" });
    for (const f of book) await fs.writeText(f.path, f.text);
    const project = await Project.open(fs, "it");
    await project.rename(`${DIR}/Fuga.md`, "Fuga nel bosco");
    expect(await fs.readText(`${DIR}/Agguato.md`)).toContain("**[[Fuga nel bosco|2]]**");
    expect(await fs.exists(`${DIR}/Fuga nel bosco.md`)).toBe(true);
  });
});

describe("gamebook shuffle", () => {
  const seeded = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  it("keeps fixed paragraphs and the start, and moves a relative one with its anchor", () => {
    const index = new GamebookIndex(
      [
        par("Inizio", 1, "Vai al **[[A|2]]**."),
        par("A", 2, "Vai al **[[B|3]]**."),
        par("B", 3, "Vai al **[[C|4]]**."),
        par("C", 4, "Vai al **[[D|5]]**."),
        par("D", 5, "", 'numero_tipo: relativo\nancora: "[[C]]"\nscarto: 1\n'),
        par("Fisso", 6, "", "numero_tipo: fisso\n"),
      ],
      options,
    );
    for (let seed = 1; seed < 20; seed++) {
      const result = shuffle(index.inScope(DIR), { start: 1, random: seeded(seed) });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const n = (t: string) => result.numbers.get(`${DIR}/${t}.md`)!;
      expect(n("Inizio")).toBe(1);
      expect(n("Fisso")).toBe(6);
      expect(n("D")).toBe(n("C") + 1);
      expect(new Set(result.numbers.values()).size).toBe(6);
    }
  });

  it("reports two fixed paragraphs on the same number and a cycle of anchors", () => {
    const clash = new GamebookIndex([par("A", 1, "", "numero_tipo: fisso\n"), par("B", 1, "", "numero_tipo: fisso\n")], options);
    expect(shuffle(clash.inScope(DIR))).toMatchObject({ ok: false, errors: [{ kind: "fixedClash", number: 1 }] });
    const cycle = new GamebookIndex([par("A", 1, "", 'numero_tipo: relativo\nancora: "[[B]]"\nscarto: 1\n'), par("B", 2, "", 'numero_tipo: relativo\nancora: "[[A]]"\nscarto: 1\n')], options);
    expect(shuffle(cycle.inScope(DIR))).toMatchObject({ ok: false, errors: [{ kind: "anchorCycle" }] });
  });

  it("finds paragraph numbers written in the prose", () => {
    const found = proseNumbers("---\nnumero: 1\n---\nTorna al 12 o vai al **[[A|3]]**; il paragrafo 3 è chiuso, hai 40 monete.", (n) => n === 12 || n === 3 || n === 40);
    expect(found.map((f) => f.number)).toEqual([12, 3]);
  });

  it("renumbers the book at once, swapping numbers, and undoes it", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\nlanguage: it\nfolders:\n  manuscript: Paragrafi\ngamebook:\n  enabled: true\n" });
    for (const f of book) await fs.writeText(f.path, f.text);
    const project = await Project.open(fs, "it");
    const numbers = new Map([
      [`${DIR}/Fuga.md`, 8],
      [`${DIR}/Resa.md`, 2],
      [`${DIR}/Bosco.md`, 11],
    ]);
    await project.renumberParagraphs(numbers, "Prima del rimescolamento");
    const agguato = await fs.readText(`${DIR}/Agguato.md`);
    expect(agguato).toContain("Se corri leggi l'**[[Fuga|8]]**, se ti fermi il **[[Resa|2]]**.");
    expect(await fs.readText(`${DIR}/Fuga.md`)).toContain('numero: 8\naliases:\n  - "8"');
    expect(await fs.readText(`${DIR}/Fuga.md`)).toContain("Vai all'**[[Bosco|11]]**.");
    const [op] = await project.gamebookOperations();
    expect(op.numbers[`${DIR}/Fuga.md`]).toBe(2);

    // Text written after the shuffle stays when only the numbers go back.
    await fs.writeText(`${DIR}/Bosco.md`, (await fs.readText(`${DIR}/Bosco.md`)) + "Nuovo testo.");
    await project.reload();
    await project.undoGamebookOperation(op.id, true, "Prima del ripristino");
    expect(await fs.readText(`${DIR}/Agguato.md`)).toContain("Se corri leggi il **[[Fuga|2]]**, se ti fermi l'**[[Resa|8]]**.");
    expect(await fs.readText(`${DIR}/Bosco.md`)).toContain("Nuovo testo.");
    expect(await fs.readText(`${DIR}/Bosco.md`)).toContain("numero: 3");

    // The whole operation goes back to the snapshots.
    await project.undoGamebookOperation(op.id, false, "");
    expect(await fs.readText(`${DIR}/Bosco.md`)).not.toContain("Nuovo testo.");
    expect(await fs.readText(`${DIR}/Agguato.md`)).toBe(book[0].text);
  });
});
