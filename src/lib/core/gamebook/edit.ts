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
function scalar(text: string): string {
  const line = text.replace(/\s*\n\s*/g, " ").trim();
  if (/^[\w\sàèéìòùÀÈÉÌÒÙ.,;!?'()-]*$/.test(line) && !/^[-?]/.test(line) && !/^(true|false|null|yes|no|~|\d[\d.]*)$/i.test(line)) return line;
  return `"${line.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export interface ParagraphChanges {
  number?: number;
  /** Free removes `numero_tipo`, as the plugin leaves it out for free paragraphs. */
  numberType?: "free" | "fixed";
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

