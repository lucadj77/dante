// Changes to a paragraph's own properties, written line by line as the plugin writes them, so
// the file stays exactly as the plugin expects: every other key keeps its place and its text.
import { readDocument, readList, removeEntry, setEntry, unquote, writeDocument, type Frontmatter } from "./frontmatter";
import { KEYS } from "./paragraphs";

const NUMERIC = /^\d+$/;

/** The number in `numero`, and in `aliases` in place of the old number; aliases written by hand stay. */
function withNumber(fm: Frontmatter | null, number: number): Frontmatter {
  let out = setEntry(fm, KEYS.number, { kind: "scalar", text: String(number) });
  const kept = readList(out, KEYS.aliases).filter((a) => !NUMERIC.test(unquote(a)) || unquote(a) === String(number));
  const aliases = kept.some((a) => unquote(a) === String(number)) ? kept : [...kept, `"${number}"`];
  out = setEntry(out, KEYS.aliases, { kind: "list", items: aliases });
  return out;
}

/** A value on one line, in double quotes when YAML would read it otherwise. */
export function scalar(text: string): string {
  const line = text.replace(/\s*\n\s*/g, " ").trim();
  if (/^[\w\sàèéìòùÀÈÉÌÒÙ.,;!?'()-]*$/.test(line) && !/^[-?]/.test(line) && !/^(true|false|null|yes|no|~|\d[\d.]*)$/i.test(line)) return line;
  return `"${line.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export interface ParagraphChanges {
  number?: number;
  /** Free removes `numero_tipo`, as the plugin leaves it out for free paragraphs; relative needs `anchor` and `offset`. */
  numberType?: "free" | "fixed" | "relative";
  /** For a relative paragraph: the title of the paragraph it follows, and by how much. */
  anchor?: string;
  offset?: number;
  ending?: boolean;
  /** Empty removes the key. */
  note?: string;
}

export function setParagraphFields(text: string, changes: ParagraphChanges): string {
  const doc = readDocument(text);
  let fm = doc.frontmatter;
  if (changes.number !== undefined) fm = withNumber(fm, changes.number);
  if (changes.numberType === "fixed") fm = setEntry(fm, KEYS.numberType, { kind: "scalar", text: "fisso" });
  else if (changes.numberType === "free" && fm) fm = removeEntry(fm, KEYS.numberType);
  else if (changes.numberType === "relative") fm = setEntry(fm, KEYS.numberType, { kind: "scalar", text: "relativo" });
  if (changes.numberType && changes.numberType !== "relative" && fm) fm = removeEntry(removeEntry(fm, KEYS.anchor), KEYS.offset);
  if (changes.anchor !== undefined) fm = setEntry(fm, KEYS.anchor, { kind: "scalar", text: `"[[${changes.anchor}]]"` });
  if (changes.offset !== undefined) fm = setEntry(fm, KEYS.offset, { kind: "scalar", text: String(changes.offset) });
  if (changes.ending === true) fm = setEntry(fm, KEYS.ending, { kind: "scalar", text: "true" });
  else if (changes.ending === false && fm) fm = removeEntry(fm, KEYS.ending);
  if (changes.note !== undefined) {
    if (changes.note.trim()) fm = setEntry(fm, KEYS.note, { kind: "scalar", text: scalar(changes.note) });
    else if (fm) fm = removeEntry(fm, KEYS.note);
  }
  if (fm && fm.entries.length === 0) return doc.body.replace(/^\n/, "");
  return writeDocument({ frontmatter: fm, body: doc.body });
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every reference to `title` labelled with the old number gets the new one, in the text and in the hidden references. */
export function relabel(text: string, title: string, from: number, to: number): string {
  const link = new RegExp(`\\[\\[(\\s*${escape(title)}\\s*)\\|\\s*${from}\\s*\\]\\]`, "g");
  return text.replace(link, (_, target: string) => `[[${target}|${to}]]`);
}


export interface NewParagraph {
  number: number;
  numberType: "free" | "fixed" | "relative";
  anchor?: string;
  offset?: number;
}

/** A new paragraph's file, with the keys in the order the plugin writes them. */
export function newParagraphText(p: NewParagraph): string {
  const lines = [`${KEYS.number}: ${p.number}`];
  if (p.numberType === "fixed") lines.push(`${KEYS.numberType}: fisso`);
  if (p.numberType === "relative" && p.anchor !== undefined && p.offset !== undefined) lines.push(`${KEYS.numberType}: relativo`, `${KEYS.anchor}: "[[${p.anchor}]]"`, `${KEYS.offset}: ${p.offset}`);
  lines.push(`${KEYS.aliases}:`, `  - "${p.number}"`, `${KEYS.note}:`);
  return `---\n${lines.join("\n")}\n---\n`;
}

/**
 * Adds a value to a list property (a hidden reference, a keyword): one value stays on the
 * key's line, two or more become a list, as the plugin writes them. A value already there is not added again.
 */
export function addToList(text: string, key: string, value: string): string {
  const doc = readDocument(text);
  const items = readList(doc.frontmatter, key);
  if (items.some((i) => unquote(i) === unquote(value))) return text;
  const next = [...items, value];
  const fm = setEntry(doc.frontmatter, key, next.length === 1 ? { kind: "scalar", text: next[0] } : { kind: "list", items: next });
  return writeDocument({ frontmatter: fm, body: doc.body });
}

/** Takes a value out of a list property; the key goes when nothing is left. */
export function removeFromList(text: string, key: string, value: string): string {
  const doc = readDocument(text);
  if (!doc.frontmatter) return text;
  const items = readList(doc.frontmatter, key);
  const next = items.filter((i) => unquote(i) !== unquote(value));
  if (next.length === items.length) return text;
  const fm = next.length === 0 ? removeEntry(doc.frontmatter, key) : setEntry(doc.frontmatter, key, next.length === 1 ? { kind: "scalar", text: next[0] } : { kind: "list", items: next });
  return writeDocument({ frontmatter: fm, body: doc.body });
}

/** A hidden reference as the plugin writes it, in quotes so YAML does not read the brackets as a list. */
export function hiddenReference(title: string, number: number): string {
  return `"[[${title}|${number}]]"`;
}
