import { describe, expect, it } from "vitest";
import { applyTypography } from "../typography";
import { defaultQuotes, type TypographySettings } from "../settings";

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

describe("dialogue conventions of other countries", () => {
  const rules = (quotes: TypographySettings["quotes"]): TypographySettings => ({ ...all, quotes });

  it("uses each country's quotation marks", () => {
    const text = `"Komm", sagte er.`;
    expect(applyTypography(text, rules("low"))).toBe("„Komm“, sagte er.");
    expect(applyTypography(text, rules("guillemetsReversed"))).toBe("»Komm«, sagte er.");
    expect(applyTypography(`"Chodź" - powiedział.`, rules("lowPolish"))).toBe("„Chodź” - powiedział.");
    expect(applyTypography(`"Kom", sa han.`, rules("swedish"))).toBe("”Kom”, sa han.");
    expect(applyTypography(`"Come in," she said.`, rules("curlySingle"))).toBe("‘Come in,’ she said.");
    // Guillemets typed by habit take the chosen marks.
    expect(applyTypography("«Komm», sagte er.", rules("low"))).toBe("„Komm“, sagte er.");
  });

  it("spaces French guillemets and high punctuation", () => {
    expect(applyTypography(`"Viens !" dit-il. Pourquoi ? Voici : rien.`, rules("guillemetsSpaced"))).toBe(
      "« Viens ! » dit-il. Pourquoi ? Voici : rien.",
    );
    expect(applyTypography("« Viens »", rules("guillemetsSpaced"))).toBe("« Viens »");
  });

  it("writes Spanish dialogue with the dash against the words", () => {
    expect(applyTypography("«Ven» dijo él «es tarde.»", rules("dashAttached"))).toBe("—Ven —dijo él— es tarde.");
    expect(applyTypography("- Ven.", rules("dashAttached"))).toBe("—Ven.");
  });

  it("picks the usual convention from the novel's language", () => {
    expect([defaultQuotes("it"), defaultQuotes("fr"), defaultQuotes("es"), defaultQuotes("de-AT"), defaultQuotes("en-GB"), defaultQuotes("en")]).toEqual([
      "guillemets",
      "guillemetsSpaced",
      "dashAttached",
      "low",
      "curlySingle",
      "curly",
    ]);
  });
});

describe("dialogue typed with dashes, exported with quotation marks", () => {
  const rules = (quotes: TypographySettings["quotes"]): TypographySettings => ({ ...all, quotes });

  it("turns each dash into an opening or closing mark", () => {
    expect(applyTypography("— Vieni.", all)).toBe("«Vieni.»");
    expect(applyTypography("— Vieni — disse lui.", all)).toBe("«Vieni» disse lui.");
    expect(applyTypography("— Vieni, — disse lui, — è tardi.", all)).toBe("«Vieni,» disse lui, «è tardi.»");
    expect(applyTypography("— Vieni —, disse.", all)).toBe("«Vieni», disse.");
    expect(applyTypography("- Vieni - disse - subito.", all)).toBe("«Vieni» disse «subito.»");
    expect(applyTypography("-- Sì.", all)).toBe("«Sì.»");
    expect(applyTypography("– Sì – rispose.", rules("curly"))).toBe("“Sì” rispose.");
  });

  it("works line by line and leaves narration alone", () => {
    expect(applyTypography("— Vieni.\n— No — disse.", all)).toBe("«Vieni.»\n«No» disse.");
    expect(applyTypography("Lui — senza fretta — si alzò.", all)).toBe("Lui — senza fretta — si alzò.");
    expect(applyTypography("---", all)).toBe("---");
    expect(applyTypography("- uno\n- due", all)).toBe("«uno»\n«due»");
  });

  it("leaves hyphens in words and dashes of another kind", () => {
    expect(applyTypography("— Il socio-economico, anni 1990–2000.", all)).toBe("«Il socio-economico, anni 1990–2000.»");
    expect(applyTypography("— Vieni — disse - piano - lui.", all)).toBe("«Vieni» disse - piano - lui.");
  });

  it("reads Spanish dialogue too", () => {
    expect(applyTypography("—Ven —dijo él— es tarde.", rules("curly"))).toBe("“Ven” dijo él “es tarde.”");
    expect(applyTypography("—Ven —dijo él—.", rules("curly"))).toBe("“Ven” dijo él.");
  });

  it("uses each style's marks", () => {
    expect(applyTypography("— Komm — sagte er.", rules("low"))).toBe("„Komm“ sagte er.");
    expect(applyTypography("— Viens ! — dit-il.", rules("guillemetsSpaced"))).toBe("«\u202FViens\u202F!\u202F» dit-il.");
    expect(applyTypography("— Vieni.", rules("keep"))).toBe("— Vieni.");
  });
});
