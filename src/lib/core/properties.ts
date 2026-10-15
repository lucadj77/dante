// Property definitions: a property named in dante.yaml has a kind (text, number, date…) and,
// optionally, the values it may take. Every note with a property of that name uses it, so
// "place" is the same choice of places in every scene. Values are written as Obsidian writes
// them: numbers, true/false, dates as YYYY-MM-DD, lists as YAML lists, links as "[[Name]]".

export const PROPERTY_KINDS = ["text", "number", "date", "checkbox", "list", "link"] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export interface PropertyDef {
  kind: PropertyKind;
  /** Allowed values of a text (one of them) or a list (any of them); empty means free. */
  values: string[];
  /** A link's notes: only notes of this type are offered; "" offers every note. */
  note_type: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Definitions as written in dante.yaml; a bare kind ("date") is short for { kind: date }. */
export function parsePropertyDefs(value: unknown): Record<string, PropertyDef> {
  const out: Record<string, PropertyDef> = {};
  if (!isObject(value)) return out;
  for (const [name, raw] of Object.entries(value)) {
    if (!name.trim()) continue;
    const spec = typeof raw === "string" ? { kind: raw } : isObject(raw) ? raw : null;
    if (!spec) continue;
    const kind = (PROPERTY_KINDS as readonly string[]).includes(spec.kind as string) ? (spec.kind as PropertyKind) : "text";
    const values = Array.isArray(spec.values) ? [...new Set(spec.values.filter((v) => v !== null && v !== undefined).map((v) => String(v).trim()).filter(Boolean))] : [];
    out[name] = { kind, values, note_type: typeof spec.note_type === "string" ? spec.note_type.trim() : "" };
  }
  return out;
}

/** What dante.yaml holds for the definitions: only what differs from a plain text. */
export function serializePropertyDefs(defs: Record<string, PropertyDef>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(defs)) {
    const entry: Record<string, unknown> = { kind: def.kind };
    if (def.values.length && (def.kind === "text" || def.kind === "list")) entry.values = [...def.values];
    if (def.note_type && def.kind === "link") entry.note_type = def.note_type;
    out[name] = entry;
  }
  return out;
}

/** The definition of a property, matching its name without regard to case. */
export function propertyDef(defs: Record<string, PropertyDef>, name: string): PropertyDef | null {
  if (name in defs) return defs[name];
  const lower = name.toLowerCase();
  for (const [key, def] of Object.entries(defs)) if (key.toLowerCase() === lower) return def;
  return null;
}

/** The value a new property starts with. */
export function emptyValue(def: PropertyDef | null): unknown {
  if (!def) return "";
  if (def.kind === "list") return [];
  if (def.kind === "checkbox") return false;
  return "";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A value read into the definition's kind; what cannot be read stays as written. */
export function coerce(value: unknown, def: PropertyDef): unknown {
  if (value === undefined || value === null) return value;
  switch (def.kind) {
    case "number": {
      if (typeof value === "number") return value;
      const text = String(value).trim().replace(",", ".");
      return text !== "" && !Number.isNaN(Number(text)) ? Number(text) : value;
    }
    case "checkbox":
      if (typeof value === "boolean") return value;
      if (/^(true|yes|sì|si|x|1)$/i.test(String(value).trim())) return true;
      if (/^(false|no|0|)$/i.test(String(value).trim())) return false;
      return value;
    case "list":
      return Array.isArray(value) ? value : String(value).split(",").map((s) => s.trim()).filter(Boolean);
    case "date":
      return value instanceof Date ? value.toISOString().slice(0, 10) : value;
    default:
      return Array.isArray(value) ? value.map(String).join(", ") : value;
  }
}

/** Why a value does not fit its definition, or null when it does. */
export function problem(value: unknown, def: PropertyDef): "kind" | "value" | null {
  if (value === undefined || value === null || value === "") return null;
  switch (def.kind) {
    case "number":
      return typeof value === "number" ? null : "kind";
    case "checkbox":
      return typeof value === "boolean" ? null : "kind";
    case "date":
      return typeof value === "string" && DATE.test(value) ? null : "kind";
    case "list":
      if (!Array.isArray(value)) return "kind";
      return def.values.length && value.some((v) => !matches(def.values, String(v))) ? "value" : null;
    case "text":
      if (typeof value === "object") return "kind";
      return def.values.length && !matches(def.values, String(value)) ? "value" : null;
    default:
      return null;
  }
}

function matches(values: string[], value: string): boolean {
  return values.some((v) => v.toLowerCase() === value.toLowerCase());
}

/** The definitions with one property defined anew (null removes it), keeping its written name. */
export function withDef(defs: Record<string, PropertyDef>, name: string, def: PropertyDef | null): Record<string, PropertyDef> {
  const key = Object.keys(defs).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
  const out = { ...defs };
  if (def) out[key] = def;
  else delete out[key];
  return out;
}

/** A short sign for each kind, shown before the property's name. */
export const KIND_ICONS: Record<PropertyKind | "", string> = { "": "·", text: "T", number: "#", date: "◷", checkbox: "☑", list: "≡", link: "↗" };
