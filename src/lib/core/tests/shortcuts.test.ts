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

import { comboOf, refusal, setShortcuts, shortcutOf, signOf, customShortcuts } from "../../editor/shortcuts";

const press = (key: string, code: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({ key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

describe("shortcuts the user can change", () => {
  it("reads a key press by the place of the key", () => {
    expect(comboOf(press("b", "KeyB", { metaKey: true }), true)).toBe("Mod-b");
    expect(comboOf(press("b", "KeyB", { ctrlKey: true }), false)).toBe("Mod-b");
    // Italian keyboard: Shift+7 types "/"; on the Mac Alt+M types "µ".
    expect(comboOf(press("/", "Digit7", { metaKey: true, shiftKey: true }), true)).toBe("Mod-Shift-7");
    expect(comboOf(press("µ", "KeyM", { metaKey: true, altKey: true }), true)).toBe("Mod-Alt-m");
    expect(comboOf(press("Enter", "Enter", { ctrlKey: true, shiftKey: true }), false)).toBe("Mod-Shift-Enter");
    expect(comboOf(press("F5", "F5"), false)).toBe("F5");
    expect(comboOf(press("ArrowUp", "ArrowUp", { ctrlKey: true }), false)).toBe("");
    expect(comboOf(press("Shift", "ShiftLeft", { shiftKey: true }), false)).toBe("");
  });

  it("refuses a bare key, what Dante already uses and what another command has", () => {
    expect(refusal("b", "bold", {})).toEqual({ kind: "weak" });
    expect(refusal("Shift-b", "bold", {})).toEqual({ kind: "weak" });
    expect(refusal("F5", "bold", {})).toBeNull();
    expect(refusal("Mod-z", "bold", {})).toEqual({ kind: "reserved" });
    expect(refusal("Mod-Shift-f", "bold", {})).toEqual({ kind: "reserved" });
    expect(refusal("Mod-i", "bold", {})).toEqual({ kind: "taken", by: "italic" });
    // Italic moved elsewhere frees its usual keys.
    expect(refusal("Mod-i", "bold", { italic: "Mod-Shift-i" })).toBeNull();
    expect(refusal("Mod-Shift-i", "bold", { italic: "Mod-Shift-i" })).toEqual({ kind: "taken", by: "italic" });
    expect(refusal("Shift-Mod-b", "bold", {})).toBeNull();
  });

  it("keeps only the changes that can be used", () => {
    setShortcuts({ bold: "Mod-Shift-b", italic: "Mod-i", strike: "Mod-z", link: "Mod-Shift-b", nonsense: "Mod-j", code: 3 });
    expect(customShortcuts()).toEqual({ bold: "Mod-Shift-b" });
    expect(shortcutOf("bold")).toBe("Mod-Shift-b");
    expect(shortcutOf("link")).toBe("Mod-k");
    setShortcuts(null);
    expect(shortcutOf("bold")).toBe("Mod-b");
  });

  it("writes a combination as the interface's texts do", () => {
    expect(signOf("Mod-b")).toBe("⌘B");
    expect(signOf("Mod-Shift-x")).toBe("⌘⇧X");
    expect(signOf("Mod-Alt-m")).toBe("⌘⌥M");
    expect(signOf("Mod-Shift-Enter")).toBe("⌘⇧↩");
    expect(signOf("Mod-Shift-.")).toBe("⌘⇧.");
    expect(signOf("F5")).toBe("F5");
    expect(pcShortcuts(signOf("Mod-Alt-m"), "it")).toBe("Ctrl+Alt+M");
    expect(pcShortcuts(signOf("Mod-Shift-Enter"), "en")).toBe("Ctrl+Shift+Enter");
  });
});
