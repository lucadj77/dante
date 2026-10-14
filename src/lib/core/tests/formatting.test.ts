import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { toggleFormat, type Format } from "$lib/editor/formatting";

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
