/** Property values as edited in a text field: lists as comma-separated text. */
export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Properties that Obsidian always reads as lists, whatever they held before. */
const LISTS = new Set(["aliases", "alias", "tags", "cssclasses"]);

/** Hint shown under a property edited as a list. */
export function isList(key: string, value: unknown): boolean {
  return Array.isArray(value) || LISTS.has(key.toLowerCase());
}

/** Reads the text of a field back, keeping the kind of value it had before. */
export function parseValue(text: string, previous: unknown, key = ""): unknown {
  if (isList(key, previous)) return text.split(",").map((s) => s.trim()).filter(Boolean);
  if (typeof previous === "number" && text.trim() !== "" && !Number.isNaN(Number(text))) return Number(text);
  if (typeof previous === "boolean") return text.trim() === "true";
  return text;
}
