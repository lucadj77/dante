import { describe, expect, it } from "vitest";
import { formatNumber } from "../numbers";

describe("numbers", () => {
  it("groups thousands from 1,000 up, as the language writes them", () => {
    expect(formatNumber(1234, "it")).toBe("1.234");
    expect(formatNumber(12345, "it")).toBe("12.345");
    expect(formatNumber(1234, "es")).toBe("1.234");
    expect(formatNumber(1234, "en")).toBe("1,234");
    expect(formatNumber(999, "it")).toBe("999");
    expect(formatNumber(1234.56, "it", 1)).toBe("1.234,6");
  });
});
