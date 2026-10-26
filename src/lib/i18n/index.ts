import { en, type MessageKey } from "./en";
import { it } from "./it";

// Adding a language means adding a file like it.ts and listing it here.
export const LANGUAGES: Record<string, { name: string; messages: Partial<Record<MessageKey, string>> }> = {
  en: { name: "English", messages: en },
  it: { name: "Italiano", messages: it },
};

/** Messages write shortcuts with the Mac symbols; elsewhere they read as Ctrl+Alt+... */
const IS_MAC = typeof navigator === "undefined" || /Mac|iPhone|iPad/.test(navigator.userAgent);

const KEY_NAMES: Record<string, Record<string, string>> = {
  en: { "⌘": "Ctrl", "⌃": "Ctrl", "⌥": "Alt", "⇧": "Shift", "↩": "Enter", "↵": "Enter", "⌫": "Backspace" },
  it: { "⌘": "Ctrl", "⌃": "Ctrl", "⌥": "Alt", "⇧": "Maiusc", "↩": "Invio", "↵": "Invio", "⌫": "Backspace" },
};

/** Rewrites "⌥⌘↑" as "Ctrl+Alt+↑", in the order Windows and Linux use. */
export function pcShortcuts(text: string, language: string): string {
  const names = KEY_NAMES[language] ?? KEY_NAMES.en;
  // A click ("⌘clic", "⌥click") keeps its word: "Ctrl+clic".
  return text.replace(/([⌃⌥⇧⌘]+)(clic(?:k)?|.)/gu, (_, mods: string, key: string) => {
    const parts = ["⌘", "⌃", "⌥", "⇧"].filter((m) => mods.includes(m)).map((m) => names[m]);
    return [...new Set(parts), names[key] ?? (key.length > 1 ? key : key.toUpperCase())].join("+");
  });
}

export function translate(language: string, key: MessageKey, values: Record<string, string | number> = {}): string {
  let text = LANGUAGES[language]?.messages[key] ?? en[key];
  if (!IS_MAC) text = pcShortcuts(text, language);
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
}

export type { MessageKey };
