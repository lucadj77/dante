import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { wikilinks, type LinkHandler } from "$lib/editor/links";
import { insertWikilink } from "$lib/editor/formatting";
import { resolveAlias } from "$lib/core/wikilinks";

const notes = ["Story Bible/Characters/Corrado Olivieri.md", "Story Bible/Characters/Corrado Bassi.md", "Story Bible/Places/Olivieri.md"];
const aliases: Record<string, string[]> = {
  "Story Bible/Characters/Corrado Olivieri.md": ["Corrado", "Olivieri", "il commissario"],
  "Story Bible/Characters/Corrado Bassi.md": ["Bassi", "il commissario"],
};
const from = "Manuscript/010 Arrivo.md";
const aliasesOf = (p: string) => aliases[p] ?? [];

describe("resolveAlias", () => {
  it("finds the one note with that alias, in any case", () => {
    expect(resolveAlias("Corrado", from, notes, aliasesOf)).toBe("Story Bible/Characters/Corrado Olivieri.md");
    expect(resolveAlias("corrado", from, notes, aliasesOf)).toBe("Story Bible/Characters/Corrado Olivieri.md");
  });
  it("leaves a name that is a note's own name, and an alias of several notes", () => {
    expect(resolveAlias("Olivieri", from, notes, aliasesOf)).toBeNull();
    expect(resolveAlias("il commissario", from, notes, aliasesOf)).toBeNull();
    expect(resolveAlias("Nessuno", from, notes, aliasesOf)).toBeNull();
  });
});

const handler: LinkHandler = {
  open() {},
  resolves: () => false,
  suggestions: () => [],
  aliasOf: (name) => {
    const path = resolveAlias(name, from, notes, aliasesOf);
    return path ? path.split("/").pop()!.replace(/\.md$/, "") : null;
  },
};

function state(doc: string, anchor: number, head = anchor) {
  return EditorState.create({ doc, selection: EditorSelection.single(anchor, head), extensions: [wikilinks(handler)] });
}

describe("links to an alias", () => {
  it("are written as [[note|alias]] when closed by typing", () => {
    const s = state("Vide [[Corrado] e", 15);
    const next = s.update({ changes: { from: 15, insert: "]" }, selection: { anchor: 16 }, userEvent: "input.type" }).state;
    expect(next.doc.toString()).toBe("Vide [[Corrado Olivieri|Corrado]] e");
    expect(next.selection.main.head).toBe("Vide [[Corrado Olivieri|Corrado]]".length);
  });

  it("are written as [[note|alias]] when a selection is wrapped", () => {
    const s = state("Vide Corrado e", 5, 12);
    const next = s.update(insertWikilink(s), { userEvent: "input.format" }).state;
    expect(next.doc.toString()).toBe("Vide [[Corrado Olivieri|Corrado]] e");
  });

  it("keep a heading and leave other links alone", () => {
    const s = state("[[Corrado#Infanzia] [[Bassi]]", 18);
    const next = s.update({ changes: { from: 18, insert: "]" }, userEvent: "input.type" }).state;
    expect(next.doc.toString()).toBe("[[Corrado Olivieri#Infanzia|Corrado]] [[Bassi]]");
  });

  it("are not rewritten while the name is being typed inside the brackets", () => {
    const s = state("[[Corrad]]", 8);
    const next = s.update({ changes: { from: 8, insert: "o" }, userEvent: "input.type" }).state;
    expect(next.doc.toString()).toBe("[[Corrado]]");
  });

  it("are not rewritten when the name is an alias of several notes", () => {
    const s = state("[[il commissario]", 17);
    const next = s.update({ changes: { from: 17, insert: "]" }, userEvent: "input.type" }).state;
    expect(next.doc.toString()).toBe("[[il commissario]]");
  });
});
