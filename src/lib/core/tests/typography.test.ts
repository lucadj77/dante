import { describe, expect, it } from "vitest";
import { applyTypography } from "../typography";
import type { TypographySettings } from "../settings";

const all: TypographySettings = { quotes: "guillemets", apostrophes: true, ellipsis: true, spaces: true, whileTyping: true };

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
