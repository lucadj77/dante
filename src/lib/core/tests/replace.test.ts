import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { adapt, findIn, occurrences, replaceIn } from "../replace";
import { listSnapshots } from "../snapshots";

const loose = { caseSensitive: false, wholeWord: false };
const word = { caseSensitive: false, wholeWord: true };

describe("find", () => {
  it("finds every match, in any case unless asked", () => {
    const text = "Renzo vide renzo. RENZO!";
    expect(findIn(text, "renzo", loose)).toHaveLength(3);
    expect(findIn(text, "renzo", { caseSensitive: true, wholeWord: false })).toEqual([{ from: 11, to: 16 }]);
  });

  it("matches whole words only when asked, accented letters included", () => {
    const text = "Renzo e Renzone, città e cittàdina";
    expect(findIn(text, "renzo", loose)).toHaveLength(2);
    expect(findIn(text, "renzo", word)).toEqual([{ from: 0, to: 5 }]);
    expect(findIn(text, "città", word)).toEqual([{ from: 17, to: 22 }]);
  });

  it("leaves link targets, embeds, addresses, tags and comments alone", () => {
    const text = [
      "[[Renzo Tramaglino|Renzo]] parla con [[Renzo]].",
      "![[Renzo.png]] e [Renzo](Renzo.md)",
      '<span style="display:block;text-align:center">Renzo</span>',
      "{==Renzo==}{>>@Renzo 2026-10-26: Renzo qui?<<}",
    ].join("\n");
    const found = findIn(text, "Renzo", loose).map((r) => text.slice(r.from - 1, r.to + 1));
    // The alias, the link text, the centred paragraph and the commented words.
    expect(found).toEqual(["|Renzo]", "[Renzo]", ">Renzo<", "=Renzo="]);
  });

  it("treats the query as plain text", () => {
    expect(findIn("1+1 (sì)", "(sì)", loose)).toEqual([{ from: 4, to: 8 }]);
  });

  it("shows the words around each match, within its line", () => {
    const text = "Prima riga.\nQuel ramo del lago di Como, che volge a mezzogiorno.\nAltro.";
    const [o] = occurrences(text, findIn(text, "lago", loose), 10);
    expect(o.match).toBe("lago");
    expect(o.before).toBe("…ramo del ");
    expect(o.after).toBe(" di Como,…");
  });
});

describe("replace", () => {
  it("keeps a capital or all capitals when case does not count", () => {
    expect(adapt("Renzo", "carlo", loose)).toBe("Carlo");
    expect(adapt("RENZO", "carlo", loose)).toBe("CARLO");
    expect(adapt("renzo", "Carlo", loose)).toBe("Carlo");
    expect(adapt("Renzo", "carlo", { caseSensitive: true, wholeWord: false })).toBe("carlo");
  });

  it("replaces the chosen matches only", () => {
    const text = "Renzo, renzo e Renzo.";
    const ranges = findIn(text, "renzo", loose);
    expect(replaceIn(text, [ranges[0], ranges[2]], "carlo", loose)).toBe("Carlo, renzo e Carlo.");
  });

  it("replaces across the project, with a snapshot and a way back", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: Test\nlanguage: it\nfolders:\n  manuscript: Manoscritto\n  codex: Bibbia\n",
      "Manoscritto/010 Uno/010 Arrivo.md": "---\npov: Renzo\n---\nRenzo arriva. Lo vede [[Renzo]].\n",
      "Manoscritto/010 Uno/020 Casa.md": "Nessuno.\n",
      "Bibbia/Renzo.md": "Renzo è un filatore.\n",
    });
    const project = await Project.open(fs, "it");
    const found = await project.findAll("Renzo", word, ["Manoscritto"]);
    expect(found.map((f) => f.path)).toEqual(["Manoscritto/010 Uno/010 Arrivo.md"]);
    expect(found[0].occurrences).toHaveLength(1);

    const everywhere = await project.findAll("renzo", word);
    expect(everywhere.map((f) => f.path).sort()).toEqual(["Bibbia/Renzo.md", "Manoscritto/010 Uno/010 Arrivo.md"]);

    const done = await project.replaceAll(found.map((f) => ({ path: f.path, ranges: f.occurrences })), "Renzo", "Carlo", word, "Prima di sostituire");
    expect(done.count).toBe(1);
    // Properties and the link stay as they were.
    expect(fs.files.get("Manoscritto/010 Uno/010 Arrivo.md")).toBe("---\npov: Renzo\n---\nCarlo arriva. Lo vede [[Renzo]].\n");
    const snaps = await listSnapshots(fs, "Manoscritto/010 Uno/010 Arrivo.md");
    expect(snaps.map((s) => s.name)).toEqual(["Prima di sostituire"]);

    expect(await project.undoReplace(done)).toEqual([]);
    expect(fs.files.get("Manoscritto/010 Uno/010 Arrivo.md")).toBe("---\npov: Renzo\n---\nRenzo arriva. Lo vede [[Renzo]].\n");
  });

  it("skips matches that changed meanwhile, and notes changed after the replacement", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: Test\n", "Manuscript/010 One.md": "Anna and Anna.\n" });
    const project = await Project.open(fs);
    const found = await project.findAll("Anna", loose);
    fs.files.set("Manuscript/010 One.md", "Now Anna.\n");
    const done = await project.replaceAll(found.map((f) => ({ path: f.path, ranges: f.occurrences })), "Anna", "Bea", loose, "before");
    expect(done.count).toBe(0);

    const again = await project.replaceAll([{ path: "Manuscript/010 One.md", ranges: findIn("Now Anna.\n", "Anna", loose) }], "Anna", "Bea", loose, "before");
    expect(fs.files.get("Manuscript/010 One.md")).toBe("Now Bea.\n");
    fs.files.set("Manuscript/010 One.md", "Now Bea, edited.\n");
    expect(await project.undoReplace(again)).toEqual(["Manuscript/010 One.md"]);
    expect(fs.files.get("Manuscript/010 One.md")).toBe("Now Bea, edited.\n");
  });
});
