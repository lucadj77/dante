import { describe, expect, it } from "vitest";
import { textStats } from "../stats";

describe("stats", () => {
  it("counts prose, not syntax", () => {
    const s = textStats("# Title\n\nShe said **hello** to [[Marta Rinaldi|Marta]]. L'albero è alto.{>>note<<}");
    expect(s.words).toBe(9);
    expect(s.characters).toBe("Title She said hello to Marta. L'albero è alto.".length);
  });

  it("handles empty text", () => {
    expect(textStats("  \n")).toEqual({ words: 0, characters: 0, charactersNoSpaces: 0 });
  });

  it("counts pending revisions as accepted, without their marks", () => {
    const clean = textStats("Il gatto nero dorme.");
    expect(textStats("Il gatto {--bianco--}{++nero++} dorme.{>>@ada 2026-11-11: ok?<<}")).toEqual(clean);
    expect(textStats("Il gatto {~~bianco~>nero~~} {==dorme==}.")).toEqual(clean);
  });
});
