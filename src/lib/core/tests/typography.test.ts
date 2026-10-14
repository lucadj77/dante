import { describe, expect, it } from "vitest";
import { applyTypography } from "../typography";
import type { TypographySettings } from "../settings";

const all: TypographySettings = { quotes: "guillemets", apostrophes: true, ellipsis: true, spaces: true, dialogueDash: "em", whileTyping: true };

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

describe("dialogue dashes", () => {
  const dialogue: TypographySettings = { ...all, quotes: "dash" };

  it("opens dialogue lines with an em dash and leaves other dashes as typed", () => {
    expect(applyTypography("- Vieni - disse - subito.", dialogue)).toBe("— Vieni - disse - subito.");
    expect(applyTypography("-- Sì.", dialogue)).toBe("— Sì.");
    expect(applyTypography("---", dialogue)).toBe("---");
    expect(applyTypography("Anni 1990-2000, socio-economico.", dialogue)).toBe("Anni 1990-2000, socio-economico.");
    expect(applyTypography("- Vieni.", { ...dialogue, quotes: "keep" })).toBe("- Vieni.");
  });
});

describe("dialogue with dashes", () => {
  const rules: TypographySettings = { ...all, quotes: "dash" };

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

  it("keeps dialogue dashes typed by the author", () => {
    expect(applyTypography("— Vieni — disse - piano - lui.", rules)).toBe("— Vieni — disse - piano - lui.");
    expect(applyTypography("— Vieni — disse.", { ...rules, dialogueDash: "en" })).toBe("– Vieni – disse.");
  });
});
