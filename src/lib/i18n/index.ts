import { en, type MessageKey } from "./en";
import { it } from "./it";

// Adding a language means adding a file like it.ts and listing it here.
export const LANGUAGES: Record<string, { name: string; messages: Partial<Record<MessageKey, string>> }> = {
  en: { name: "English", messages: en },
  it: { name: "Italiano", messages: it },
};

export function translate(language: string, key: MessageKey, values: Record<string, string | number> = {}): string {
  const text = LANGUAGES[language]?.messages[key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
}

export type { MessageKey };
