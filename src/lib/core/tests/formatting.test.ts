import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, type TransactionSpec } from "@codemirror/state";
import { cycleHeading, insertLink, insertSeparator, insertWikilink, toggleCode, toggleFormat, toggleLines, type Format } from "$lib/editor/formatting";

function apply(doc: string, from: number, to: number, format: Format) {
  const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
  const next = state.update(toggleFormat(state, format)).state;
  const { from: f, to: t } = next.selection.main;
  return [next.doc.toString(), next.doc.sliceString(f, t)];
}

describe("formatting", () => {
  it("wraps the selection and keeps it selected", () => {
    expect(apply("una parola qui", 4, 10, "bold")).toEqual(["una **parola** qui", "parola"]);
    expect(apply("una parola qui", 4, 10, "italic")).toEqual(["una *parola* qui", "parola"]);
    expect(apply("una parola qui", 4, 10, "strike")).toEqual(["una ~~parola~~ qui", "parola"]);
  });

  it("removes the markers when they are already there", () => {
    expect(apply("una **parola** qui", 6, 12, "bold")).toEqual(["una parola qui", "parola"]);
    expect(apply("una *parola* qui", 5, 11, "italic")).toEqual(["una parola qui", "parola"]);
    expect(apply("una **parola** qui", 4, 14, "bold")).toEqual(["una parola qui", "parola"]);
  });

  it("tells italic and bold apart", () => {
    expect(apply("una **parola** qui", 6, 12, "italic")).toEqual(["una ***parola*** qui", "parola"]);
    expect(apply("una ***parola*** qui", 7, 13, "italic")).toEqual(["una **parola** qui", "parola"]);
  });

  it("puts the cursor between the markers without a selection", () => {
    const state = EditorState.create({ doc: "ab", selection: EditorSelection.cursor(1) });
    const next = state.update(toggleFormat(state, "italic")).state;
    expect(next.doc.toString()).toBe("a**b");
    expect(next.selection.main.head).toBe(2);
  });
});

describe("line formats", () => {
  const run = (doc: string, from: number, to: number, f: (s: EditorState) => TransactionSpec) => {
    const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) });
    return state.update(f(state)).state.doc.toString();
  };

  it("turns lines into lists and back, replacing another list type", () => {
    expect(run("uno\ndue", 0, 7, (s) => toggleLines(s, "bullet"))).toBe("- uno\n- due");
    expect(run("- uno\n- due", 0, 11, (s) => toggleLines(s, "bullet"))).toBe("uno\ndue");
    expect(run("- uno\n- due", 0, 11, (s) => toggleLines(s, "ordered"))).toBe("1. uno\n2. due");
    expect(run("uno", 0, 0, (s) => toggleLines(s, "task"))).toBe("- [ ] uno");
    expect(run("- [ ] uno", 0, 0, (s) => toggleLines(s, "bullet"))).toBe("- uno");
    expect(run("uno", 0, 0, (s) => toggleLines(s, "quote"))).toBe("> uno");
  });

  it("cycles headings", () => {
    expect(run("Titolo", 0, 0, cycleHeading)).toBe("# Titolo");
    expect(run("# Titolo", 0, 0, cycleHeading)).toBe("## Titolo");
    expect(run("### Titolo", 0, 0, cycleHeading)).toBe("Titolo");
  });

  it("makes inline code within a line and a block over several", () => {
    expect(run("usa x qui", 4, 5, toggleCode)).toBe("usa `x` qui");
    expect(run("a\nb", 0, 3, toggleCode)).toBe("```\na\nb\n```");
    expect(run("```\na\nb\n```", 4, 7, toggleCode)).toBe("a\nb");
  });

  it("inserts links, wikilinks and a scene separator", () => {
    expect(run("vedi qui", 5, 8, insertLink)).toBe("vedi [qui]()");
    expect(run("vedi Marta", 5, 10, insertWikilink)).toBe("vedi [[Marta]]");
    expect(run("Fine.", 5, 5, insertSeparator)).toBe("Fine.\n\n* * *\n\n");
  });
});

it("keeps typing after a prefix added on an empty line", () => {
  const state = EditorState.create({ doc: "", selection: EditorSelection.cursor(0) });
  const next = state.update(toggleLines(state, "task")).state;
  expect(next.update({ changes: { from: next.selection.main.head, insert: "x" } }).state.doc.toString()).toBe("- [ ] x");
});
