/** Property values as edited in a text field: lists as comma-separated text. */
export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Reads the text of a field back, keeping the kind of value it had before. */
export function parseValue(text: string, previous: unknown): unknown {
  if (Array.isArray(previous)) return text.split(",").map((s) => s.trim()).filter(Boolean);
  if (typeof previous === "number" && text.trim() !== "" && !Number.isNaN(Number(text))) return Number(text);
  if (typeof previous === "boolean") return text.trim() === "true";
  return text;
}
