import { describe, expect, it } from "vitest";
import { styleReport } from "../style";

const scene = (text: string, path = "Manoscritto/010 Uno/010 A.md") => ({ path, title: "A", text });

describe("style", () => {
  it("counts sentences and finds the long ones", () => {
    const long = Array.from({ length: 45 }, (_, i) => `parola${i}`).join(" ") + ".";
    const report = styleReport([scene(`Renzo arrivò. Era tardi! Perché?\n${long}`)], "it");
    expect(report.sentences).toBe(4);
    expect(report.longCount).toBe(1);
    expect(report.long[0].words).toBe(45);
    expect(report.average).toBeCloseTo(report.words / 4);
  });

  it("finds adverbs by their ending, leaving out the words that only look like them", () => {
    const it = styleReport([scene("Parlò lentamente, poi rapidamente e ancora lentamente. Fu clemente con la mente.")], "it");
    expect(it.adverbs).toEqual([
      { word: "lentamente", count: 2 },
      { word: "rapidamente", count: 1 },
    ]);
    const en = styleReport([scene("She only walked slowly with her family, quietly.")], "en");
    expect(en.adverbs.map((a) => a.word)).toEqual(["quietly", "slowly"]);
  });

  it("counts the words of dialogue, with quotes or with dashes", () => {
    const report = styleReport([scene("— Vieni, — disse Renzo, — è tardi.\nLucia rispose: «Sì, arrivo».\nNarrazione sola.")], "it");
    // "Vieni" and "è tardi", then "Sì, arrivo".
    expect(report.dialogue).toBe(5);
  });

  it("finds the same word used again a few words later", () => {
    const report = styleReport([scene("La porta si aprì e dalla porta entrò il vento.\nMolto dopo, lontano, una porta.")], "it", { window: 6 });
    expect(report.repetitionCount).toBe(1);
    expect(report.repetitions[0]).toMatchObject({ word: "porta", distance: 4, excerpt: "porta si aprì e dalla porta" });
    // Common words and short ones are not repetitions.
    expect(styleReport([scene("Il gatto e il cane e il topo.")], "it").repetitionCount).toBe(0);
    // Nor a word said twice in a row.
    expect(styleReport([scene("Zitto, zitto, per carità, sempre e sempre.")], "it").repetitionCount).toBe(0);
  });
});
