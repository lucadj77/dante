import { describe, expect, it } from "vitest";
import { pcShortcuts } from "../../i18n";

describe("shortcut labels outside the Mac", () => {
  it("spells out the modifiers in the usual order", () => {
    expect(pcShortcuts("Sposta su (⌥⌘↑)", "it")).toBe("Sposta su (Ctrl+Alt+↑)");
    expect(pcShortcuts("Cerca (⌘⇧F)", "it")).toBe("Cerca (Ctrl+Maiusc+F)");
    expect(pcShortcuts("Search (⌘⇧F)", "en")).toBe("Search (Ctrl+Shift+F)");
    expect(pcShortcuts("Commento (⌘⌥M)", "it")).toBe("Commento (Ctrl+Alt+M)");
  });

  it("names Enter and keeps other keys", () => {
    expect(pcShortcuts("⌘↩ divide la scena, ⌘⇧↩ il capitolo", "it")).toBe("Ctrl+Invio divide la scena, Ctrl+Maiusc+Invio il capitolo");
    expect(pcShortcuts("Zoom (⌘+), (⌘0), (⌘⇧.)", "en")).toBe("Zoom (Ctrl++), (Ctrl+0), (Ctrl+Shift+.)");
    expect(pcShortcuts("Corsivo (⌘I)", "fr")).toBe("Corsivo (Ctrl+I)");
  });

  it("names a click and the Enter of the comment box", () => {
    expect(pcShortcuts("⌘clic apre", "it")).toBe("Ctrl+clic apre");
    expect(pcShortcuts("⌥click", "en")).toBe("Alt+click");
    expect(pcShortcuts("Scrivi un commento (⌘↵ per aggiungerlo)", "it")).toBe("Scrivi un commento (Ctrl+Invio per aggiungerlo)");
  });
});
