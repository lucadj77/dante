import { describe, expect, it } from "vitest";
import { dialogueSample } from "../typography";

describe("dialogueSample", () => {
  it("takes the first spoken paragraph and the one after it", () => {
    const scene = "# Arrivo\n\nIl treno si fermò.\n\n\"Sei tu?\" chiese Anna...\n\nNessuno rispose.\n\nPoi il silenzio.";
    expect(dialogueSample(scene)).toBe("\"Sei tu?\" chiese Anna...\nNessuno rispose.");
  });

  it("knows dashes and the quotes of other countries", () => {
    expect(dialogueSample("Buio.\n\n— Vieni — disse.")).toBe("— Vieni — disse.");
    expect(dialogueSample("Buio.\n\n- Vieni - disse.")).toBe("- Vieni - disse.");
    expect(dialogueSample("Buio.\n\nDisse: «Vieni».")).toBe("Disse: «Vieni».");
    expect(dialogueSample("Dark.\n\nShe said: “Come”.")).toBe("She said: “Come”.");
  });

  it("leaves lists alone and says when nobody speaks", () => {
    expect(dialogueSample("- pane\n- latte\n\nIl treno si fermò.")).toBeNull();
    expect(dialogueSample("")).toBeNull();
  });

  it("shortens a long paragraph at a word", () => {
    const long = `"Vieni" disse, ${"e poi ancora parole ".repeat(30)}`;
    const sample = dialogueSample(long, 60) ?? "";
    expect(sample.length).toBeLessThanOrEqual(61);
    expect(sample.endsWith("…")).toBe(true);
  });
});
