import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { hiddenGap, paragraphEnter, paragraphs } from "$lib/editor/paragraphs";

function state(doc: string, at: number) {
  const s = EditorState.create({ doc, selection: EditorSelection.cursor(at), extensions: [markdown({ base: markdownLanguage }), paragraphs] });
  ensureSyntaxTree(s, s.doc.length, 5000);
  return s;
}

function enter(doc: string, at: number) {
  const s = state(doc, at);
  const spec = paragraphEnter(s);
  if (!spec) return null;
  const next = s.update(spec).state;
  return [next.doc.toString(), next.selection.main.head] as const;
}

const hidden = (s: EditorState) => {
  const out: number[] = [];
  for (let n = 1; n <= s.doc.lines; n++) if (hiddenGap(s, s.doc.line(n).from)) out.push(n);
  return out;
};

describe("Enter as in a word processor", () => {
  it("starts a new paragraph, writing the empty line", () => {
    expect(enter("Uno due", 3)).toEqual(["Uno\n\ndue", 5]);
    expect(enter("Uno", 3)).toEqual(["Uno\n\n", 5]);
    // At the end of a file ending with a line break.
    expect(enter("Uno\n", 4)).toEqual(["Uno\n\n", 5]);
  });

  it("drops the spaces left at the end of the paragraph", () => {
    expect(enter("Uno  ", 5)).toEqual(["Uno\n\n", 5]);
  });

  it("writes a blank line that shows on a paragraph still empty", () => {
    expect(enter("Uno\n\n", 5)).toEqual(["Uno\n\n&nbsp;\n\n", 13]);
  });

  it("leaves a blank line that shows above a paragraph when at its start", () => {
    expect(enter("Uno\n\nDue", 5)).toEqual(["Uno\n\n&nbsp;\n\nDue", 13]);
  });

  it("leaves Enter to Markdown in lists, quotes and code, and before the first paragraph", () => {
    expect(enter("- uno", 5)).toBeNull();
    expect(enter("> uno", 5)).toBeNull();
    expect(enter("```\ncodice\n```", 10)).toBeNull();
    expect(enter("", 0)).toBeNull();
  });
});

describe("empty lines between paragraphs", () => {
  it("hides them, however many, and shows those at the start and end", () => {
    expect(hidden(state("\nUno\n\nDue\n\n\nTre\n", 1))).toEqual([3, 5, 6]);
  });

  it("shows the gaps around the empty paragraph the cursor is on", () => {
    // Uno, gap, cursor, gap, Due: the cursor line is a paragraph being started.
    expect(hidden(state("Uno\n\n\n\nDue", 5))).toEqual([2, 4]);
    expect(hidden(state("Uno\n\n\n\nDue", 0))).toEqual([2, 3, 4]);
  });

  it("keeps the empty lines of code and of the properties", () => {
    expect(hidden(state("```\nuno\n\ndue\n```", 0))).toEqual([]);
    expect(hidden(state("---\ntitle: x\n---\n\nUno\n\nDue", 20))).toEqual([6]);
  });
});
