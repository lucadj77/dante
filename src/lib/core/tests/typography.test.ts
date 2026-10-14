import { describe, expect, it } from "vitest";
import { applyTypography } from "../typography";
import type { TypographySettings } from "../settings";

const all: TypographySettings = { quotes: "guillemets", apostrophes: true, ellipsis: true, spaces: true, dashes: "keep", ranges: "keep", dialogueDash: "em", whileTyping: true };

describe("typography", () => {
  it("applies Italian conventions", () => {
    expect(applyTypography(`"Non so..." disse l'amico  , "E' tardi ."`, all)).toBe("«Non so…» disse l’amico, «È tardi.»");
  });

  it("restarts quote pairs at each paragraph", () => {
    expect(applyTypography(`"Uno\n\n"Due"`, all)).toBe("«Uno\n\n«Due»");
  });

  it("uses curly quotes or keeps them as typed", () => {
    expect(applyTypography(`"Yes," she said.`, { ...all, quotes: "curly" })).toBe("“Yes,” she said.");
    expect(applyTypography(`"Yes"`, { ...all, quotes: "keep" })).toBe(`"Yes"`);
  });

  it("closes guillemets tight and leaves code alone", () => {
    expect(applyTypography("« Ciao »", all)).toBe("«Ciao»");
    expect(applyTypography("```\nl'a  \"b\"\n```", all)).toBe("```\nl'a  \"b\"\n```");
  });

  it("leaves a leading apostrophe and a lone E unchanged", () => {
    expect(applyTypography("'sto E basta", all)).toBe("'sto E basta");
  });
});

describe("dashes", () => {
  const rules: TypographySettings = { ...all, quotes: "keep", dashes: "enSpaced", ranges: "enDash" };
  const dialogue: TypographySettings = { ...rules, quotes: "dash" };

  it("sets asides in the chosen style", () => {
    const text = "Lui - disse - era stanco. Lei -- forse -- no. Poi—niente.";
    expect(applyTypography(text, rules)).toBe("Lui – disse – era stanco. Lei – forse – no. Poi – niente.");
    expect(applyTypography(text, { ...rules, dashes: "emSpaced" })).toBe("Lui — disse — era stanco. Lei — forse — no. Poi — niente.");
    expect(applyTypography(text, { ...rules, dashes: "emClosed" })).toBe("Lui—disse—era stanco. Lei—forse—no. Poi—niente.");
  });

  it("keeps hyphens in compounds and turns ranges into en dashes", () => {
    expect(applyTypography("Il dibattito socio-economico, anni 1990-2000, pp. 12 - 18.", rules)).toBe(
      "Il dibattito socio-economico, anni 1990–2000, pp. 12–18.",
    );
    expect(applyTypography("1990-2000", { ...rules, ranges: "keep" })).toBe("1990-2000");
  });

  it("opens dialogue lines with an em dash and leaves rules alone", () => {
    expect(applyTypography("- Vieni - disse - subito.", dialogue)).toBe("— Vieni – disse – subito.");
    expect(applyTypography("-- Sì.", dialogue)).toBe("— Sì.");
    expect(applyTypography("---", dialogue)).toBe("---");
    expect(applyTypography("- Vieni.", { ...rules, quotes: "keep" })).toBe("- Vieni.");
  });

  it("handles a dash before punctuation or at the end", () => {
    expect(applyTypography("Lui - disse -, poi uscì.", rules)).toBe("Lui – disse –, poi uscì.");
    expect(applyTypography("E poi -", rules)).toBe("E poi –");
  });
});

describe("dialogue with dashes", () => {
  const rules: TypographySettings = { ...all, quotes: "dash", dashes: "enSpaced", ranges: "enDash" };

  it("opens each line with a dash and closes it only before narration", () => {
    expect(applyTypography("«Vieni.»", rules)).toBe("— Vieni.");
    expect(applyTypography("«Vieni» disse lui.", rules)).toBe("— Vieni — disse lui.");
    expect(applyTypography("«Vieni,» disse lui, «è tardi.»", rules)).toBe("— Vieni, — disse lui, — è tardi.");
    expect(applyTypography('"Vieni", disse.', rules)).toBe("— Vieni —, disse.");
    expect(applyTypography("Si voltò. «Vieni.»", rules)).toBe("Si voltò. — Vieni.");
  });

  it("uses an en dash on request and keeps curly quotes as quotations", () => {
    expect(applyTypography("«Vieni» disse.", { ...rules, dialogueDash: "en" })).toBe("– Vieni – disse.");
    expect(applyTypography("«Ha detto “domani”» rispose.", rules)).toBe("— Ha detto “domani” — rispose.");
  });

  it("keeps dialogue dashes apart from aside dashes", () => {
    expect(applyTypography("— Vieni — disse - piano - lui.", rules)).toBe("— Vieni – disse – piano – lui.".replace("Vieni –", "Vieni —"));
  });
});
