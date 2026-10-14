import { describe, expect, it } from "vitest";
import { assignOrders, formatName, parseName, sanitizeTitle } from "../naming";

describe("names", () => {
  it("parses the numeric prefix", () => {
    expect(parseName("010 Arrival")).toEqual({ order: 10, title: "Arrival" });
    expect(parseName("Arrival")).toEqual({ order: null, title: "Arrival" });
    expect(parseName("1984")).toEqual({ order: null, title: "1984" });
    expect(parseName("020 1984")).toEqual({ order: 20, title: "1984" });
  });

  it("formats with three digits", () => {
    expect(formatName(10, "Arrival")).toBe("010 Arrival");
    expect(formatName(1200, "Late")).toBe("1200 Late");
  });

  it("removes characters that break files or links", () => {
    expect(sanitizeTitle("  A/B: c?  [d]#e. ")).toBe("A B c d e");
  });
});

describe("assignOrders", () => {
  it("keeps numbers that are already in order", () => {
    expect(assignOrders([10, 20, 30])).toEqual([10, 20, 30]);
  });

  it("moves one item into the gap without touching the others", () => {
    expect(assignOrders([10, null, 20])).toEqual([10, 15, 20]);
    expect(assignOrders([0, 10, null, 20])).toEqual([0, 10, 15, 20]);
  });

  it("numbers new items", () => {
    expect(assignOrders([null])).toEqual([10]);
    expect(assignOrders([10, null])).toEqual([10, 20]);
    expect(assignOrders([null, 10])).toEqual([5, 10]);
  });

  it("renumbers everything when a gap is too small", () => {
    expect(assignOrders([10, null, 11])).toEqual([10, 20, 30]);
  });

  it("does not keep a number with no room for the items before it", () => {
    expect(assignOrders([null, null, 1])).toEqual([10, 20, 30]);
    expect(assignOrders([null, 2])).toEqual([1, 2]);
    expect(assignOrders([null, 1])).toEqual([0, 1]);
  });
});
