import { describe, expect, it } from "vitest";
import { formatHeading, formatNumber, levelHeading, toRoman } from "../numbering";
import type { LevelSettings } from "../settings";

describe("numbering", () => {
  it("writes roman numerals", () => {
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(1987)).toBe("MCMLXXXVII");
  });

  it("writes numbers in words", () => {
    expect(formatNumber(21, "words", "en")).toBe("Twenty-one");
    expect(formatNumber(21, "words", "it")).toBe("ventuno");
    expect(formatNumber(23, "words", "it")).toBe("ventitré");
    expect(formatNumber(38, "words", "it")).toBe("trentotto");
    expect(formatNumber(108, "words", "it")).toBe("centotto");
    expect(formatNumber(103, "words", "it")).toBe("centotré");
    expect(formatNumber(250, "words", "it")).toBe("duecentocinquanta");
  });

  it("writes ordinals", () => {
    expect(formatNumber(1, "ordinal", "it", true)).toBe("prima");
    expect(formatNumber(11, "ordinal", "it")).toBe("undicesimo");
    expect(formatNumber(23, "ordinal", "it")).toBe("ventitreesimo");
    expect(formatNumber(26, "ordinal", "it")).toBe("ventiseiesimo");
    expect(formatNumber(3, "ordinal", "en")).toBe("Third");
    expect(formatNumber(21, "ordinal", "en")).toBe("Twenty-first");
    expect(formatNumber(40, "ordinal", "en")).toBe("Fortieth");
  });

  it("builds headings from a level's choices", () => {
    const level: LevelSettings = { numbering: "arabic", showLabel: true, label: "Capitolo", showTitle: true, separator: ". " };
    expect(levelHeading(level, 3, "La lettera", "it").text).toBe("Capitolo 3. La lettera");
    expect(levelHeading({ ...level, separator: "\n" }, 3, "La lettera", "it").text).toBe("Capitolo 3\nLa lettera");
    expect(levelHeading({ ...level, showLabel: false, numbering: "words" }, 3, "", "it").text).toBe("Tre");
    expect(levelHeading({ ...level, showTitle: false, numbering: "ordinal", label: "Parte" }, 1, "Casa", "it", true).text).toBe("Parte prima");
    expect(levelHeading({ ...level, numbering: "none" }, 3, "la lettera", "it").text).toBe("La lettera");
  });

  it("fills heading templates and drops dangling separators", () => {
    const pattern = "{label} {number}: {title}";
    expect(formatHeading(pattern, { label: "Chapter", number: "3", title: "The letter" })).toBe("Chapter 3: The letter");
    expect(formatHeading(pattern, { label: "Chapter", number: "3", title: "" })).toBe("Chapter 3");
    expect(formatHeading("{number}. {title}", { label: "", number: "III", title: "Home" })).toBe("III. Home");
  });
});
