import { describe, expect, it } from "vitest";
import { formatHeading, formatNumber, toRoman } from "../numbering";

describe("numbering", () => {
  it("writes roman numerals", () => {
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(1987)).toBe("MCMLXXXVII");
  });

  it("writes numbers in words", () => {
    expect(formatNumber(21, "words", "en")).toBe("Twenty-one");
    expect(formatNumber(21, "words", "it")).toBe("Ventuno");
    expect(formatNumber(23, "words", "it")).toBe("Ventitré");
    expect(formatNumber(38, "words", "it")).toBe("Trentotto");
    expect(formatNumber(108, "words", "it")).toBe("Centotto");
    expect(formatNumber(103, "words", "it")).toBe("Centotré");
    expect(formatNumber(250, "words", "it")).toBe("Duecentocinquanta");
  });

  it("fills heading templates and drops dangling separators", () => {
    const pattern = "{label} {number}: {title}";
    expect(formatHeading(pattern, { label: "Chapter", number: "3", title: "The letter" })).toBe("Chapter 3: The letter");
    expect(formatHeading(pattern, { label: "Chapter", number: "3", title: "" })).toBe("Chapter 3");
    expect(formatHeading("{number}. {title}", { label: "", number: "III", title: "Home" })).toBe("III. Home");
  });
});
