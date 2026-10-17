import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView, type DecorationSet } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { tablePreview } from "$lib/editor/tables";
import { formatTable, parseTable, splitRow, tableModel } from "../tables";

const lines = (text: string) => {
  let from = 0;
  return text.split("\n").map((t) => {
    const l = { text: t, from };
    from += t.length + 1;
    return l;
  });
};

describe("tables in the live preview", () => {
  it("splits rows, keeping escaped pipes and wikilinks in their cell", () => {
    expect(splitRow("| 1 | [[01 Idea iniziale]] | approvato | 0 |").map((c) => c.text)).toEqual(["1", "[[01 Idea iniziale]]", "approvato", "0"]);
    expect(splitRow("a | b \\| c").map((c) => c.text)).toEqual(["a", "b | c"]);
    expect(splitRow("| [[nota|alias]] | [[x\\|y]] |").map((c) => c.text)).toEqual(["[[nota|alias]]", "[[x|y]]"]);
    expect(splitRow("| uno | due |", 10)[1].from).toBe(18);
  });

  it("reads the header, the alignment and the rows", () => {
    const t = parseTable(lines("| Fase | Stato |\n|:---|---:|\n| 0 | approvato |\n| 1 | bozza |"));
    expect(t?.header.map((c) => c.text)).toEqual(["Fase", "Stato"]);
    expect(t?.align).toEqual(["left", "right"]);
    expect(t?.rows.map((r) => r.map((c) => c.text))).toEqual([["0", "approvato"], ["1", "bozza"]]);
    expect(parseTable(lines("| a | b |\n| c | d |"))).toBeNull();
  });

  const replaced = (state: EditorState) => {
    const ranges: [number, number][] = [];
    for (const deco of state.facet(EditorView.decorations)) {
      if (typeof deco === "function") continue;
      (deco as DecorationSet).between(0, state.doc.length, (from, to) => {
        ranges.push([from, to]);
      });
    }
    return ranges;
  };
  const doc = "Prima\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nDopo";
  const make = (anchor: number) => {
    const state = EditorState.create({ doc, selection: { anchor }, extensions: [markdown({ base: markdownLanguage }), tablePreview] });
    ensureSyntaxTree(state, state.doc.length);
    // A transaction lets the field see the finished syntax tree.
    return state.update({}).state;
  };

  it("draws the table as a block while the editor is not being edited", () => {
    const table = doc.indexOf("| A");
    expect(replaced(make(0))).toEqual([[table, doc.indexOf("\n\nDopo")]]);
  });

  it("lines the columns up, keeping escaped bars and missing cells", () => {
    const model = tableModel(["| Fase | Documento |", "|:--|:-:|", "| 0 | [[Idea\\|L'idea]] |", "| 10 |"]);
    expect(model).toEqual({ align: ["left", "center"], rows: [["Fase", "Documento"], ["0", "[[Idea\\|L'idea]]"], ["10", ""]] });
    expect(formatTable(model!)).toEqual([
      "| Fase | Documento        |",
      "| :--- | :--------------: |",
      "| 0    | [[Idea\\|L'idea]] |",
      "| 10   |                  |",
    ]);
    expect(formatTable({ align: [null, "right"], rows: [["", ""]] })).toEqual(["|     |     |", "| --- | --: |"]);
    expect(tableModel(["| a |", "| b |"])).toBeNull();
  });
});

