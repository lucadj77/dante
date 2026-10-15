import { describe, expect, it } from "vitest";
import { smartReplacement } from "$lib/editor/smartTypography";
import type { TypographySettings } from "../settings";

const it_: TypographySettings = { quotes: "guillemets", apostrophes: true, ellipsis: true, spaces: true, dialogueDash: "em", whileTyping: true };

describe("typing", () => {
  it("opens and closes quotes from the context", () => {
    expect(smartReplacement("", '"', it_)).toEqual({ back: 0, insert: "«" });
    expect(smartReplacement("disse ", '"', it_)).toEqual({ back: 0, insert: "«" });
    expect(smartReplacement("«Ciao", '"', it_)).toEqual({ back: 0, insert: "»" });
    expect(smartReplacement("She said ", '"', { ...it_, quotes: "curly" })).toEqual({ back: 0, insert: "“" });
  });

  it("corrects apostrophes, È and ellipses", () => {
    expect(smartReplacement("l", "'", it_)).toEqual({ back: 0, insert: "’" });
    expect(smartReplacement("Ma E", "'", it_)).toEqual({ back: 1, insert: "È" });
    expect(smartReplacement("Forse..", ".", it_)).toEqual({ back: 2, insert: "…" });
    expect(smartReplacement(" ", "'", it_)).toBeNull();
  });

  it("leaves wikilinks, code and disabled rules alone", () => {
    expect(smartReplacement("[[L", "'", it_)).toBeNull();
    expect(smartReplacement("`a", '"', it_)).toBeNull();
    expect(smartReplacement("l", "'", { ...it_, apostrophes: false })).toBeNull();
  });
});

describe("typing dashes", () => {
  it("leaves hyphens inside a sentence as typed", () => {
    expect(smartReplacement("Lui -", " ", it_)).toBeNull();
    expect(smartReplacement("Lui -", " ", { ...it_, quotes: "dash" })).toBeNull();
  });

  it("opens dialogue only when chosen", () => {
    expect(smartReplacement("-", " ", { ...it_, quotes: "dash" })).toEqual({ back: 1, insert: "— " });
    expect(smartReplacement("-", " ", it_)).toBeNull();
    expect(smartReplacement("", '"', { ...it_, quotes: "dash" })).toEqual({ back: 0, insert: "— " });
    expect(smartReplacement("— Vieni", '"', { ...it_, quotes: "dash" })).toEqual({ back: 0, insert: " —" });
  });
});

describe("typing dialogue of other countries", () => {
  it("opens and closes with each country's marks", () => {
    expect(smartReplacement("Er sagte ", '"', { ...it_, quotes: "low" })).toEqual({ back: 0, insert: "„" });
    expect(smartReplacement("„Komm", '"', { ...it_, quotes: "low" })).toEqual({ back: 0, insert: "“" });
    expect(smartReplacement("", '"', { ...it_, quotes: "guillemetsSpaced" })).toEqual({ back: 0, insert: "« " });
  });

  it("places the Spanish dash from the context", () => {
    const es = { ...it_, quotes: "dashAttached" as const };
    expect(smartReplacement("", '"', es)).toEqual({ back: 0, insert: "—" });
    expect(smartReplacement("—Ven", '"', es)).toEqual({ back: 0, insert: " —" });
    expect(smartReplacement("—Ven —dijo él", '"', es)).toEqual({ back: 0, insert: "—" });
    expect(smartReplacement("-", " ", es)).toEqual({ back: 1, insert: "—" });
  });
});
