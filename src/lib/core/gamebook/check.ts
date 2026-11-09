// What the "Libro game" view checks beyond the warnings of each paragraph: the register of
// the values written in the boxes' properties, with the ones that look like typos of each
// other, and the game state, that is whether what a paragraph asks of the reader can have
// been given to them on the way there.
//
// The convention is the plugin's: in a property such as `carattere`, «diplomatico» gives the
// reader the trait and «diplomatico?» marks a paragraph that asks whether they have it.

import type { GamebookIndex, Paragraph } from "./paragraphs";

export interface RegisterEntry {
  value: string;
  paragraphs: Paragraph[];
}

export interface Register {
  property: string;
  entries: RegisterEntry[];
  /** Pairs of values so close that one may be a typo of the other. */
  duplicates: { a: string; b: string }[];
}

const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = a[i - 1] === b[j - 1] ? diagonal : 1 + Math.min(diagonal, row[j], row[j - 1]);
      diagonal = above;
    }
  }
  return row[b.length];
}

/**
 * Two values may be the same one written twice: few changes apart (two at most, none when
 * only capitals or spaces differ) and fewer than 30% of the longer one. «x» and «x?» are
 * never a typo of each other: one gives, the other asks.
 */
export function likelyDuplicate(a: string, b: string): boolean {
  const x = normal(a);
  const y = normal(b);
  if (x.endsWith("?") !== y.endsWith("?") && x.replace(/\s*\?$/, "") === y.replace(/\s*\?$/, "")) return false;
  const d = levenshtein(x, y);
  return d <= 2 && d < Math.max(x.length, y.length) * 0.3;
}

/** Every value of one property across the paragraphs, in alphabetical order. */
export function register(paragraphs: Paragraph[], property: string): Register {
  const by = new Map<string, Paragraph[]>();
  for (const p of paragraphs) {
    for (const raw of p.lists[property] ?? []) {
      const value = raw.trim();
      if (value) by.set(value, [...(by.get(value) ?? []), p]);
    }
  }
  const entries = [...by]
    .map(([value, list]) => ({ value, paragraphs: [...new Set(list)].sort((a, b) => a.number - b.number) }))
    .sort((a, b) => a.value.localeCompare(b.value, "it"));
  const duplicates: { a: string; b: string }[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (likelyDuplicate(entries[i].value, entries[j].value)) duplicates.push({ a: entries[i].value, b: entries[j].value });
    }
  }
  return { property, entries, duplicates };
}

/** What a paragraph's prose gives the reader and asks of them. */
export interface SaidState {
  /** Values in bold or italics in a sentence that tells to mark or circle them. */
  gives: string[];
  /** Sentences that ask whether the reader has something, in lower case and without marks. */
  asks: { text: string; emphasized: string[]; strong: boolean; negated: boolean }[];
}

const EMPHASIS = /(\*{1,3})([^*\n]+?)\1/g;
const GIVE = /(^|[^\p{L}])(segna|cerchia|annota)(?![\p{L}])/iu;
const ASK = /(^|[^\p{L}])(se|hai|possiedi|avevi)(?![\p{L}])/iu;
// The phrases that show a sentence speaks of the reader's sheet, not of the story.
const SHEET = /parol[ae] chiave|caratteristic|tratt[oi]|cerchiat|segnat|tra le note|scheda|tra gli oggetti/iu;
const HAVE = /(^|[^\p{L}])(hai|possiedi|avevi)(?![\p{L}])/iu;
const NEGATION = /(^|[^\p{L}])(non|nessun[oa]?|senza|né)(?![\p{L}])/iu;

/**
 * Reads the game state in the prose, the way Missione Cavaliere writes it: «Segna la parola
 * chiave **lavanda**» gives, «Se hai la parola chiave **lavanda**, leggi…» asks. Which words of
 * an asking sentence are values is decided later, against the values the book gives somewhere.
 */
export function stateInText(body: string): SaidState {
  const gives: string[] = [];
  const asks: SaidState["asks"] = [];
  const text = body.replace(/\[\[[^\]]*\]\]/g, " ").replace(/([.!;:])\s+/g, "$1\n");
  for (const sentence of text.split(/\n+/)) {
    const strong = SHEET.test(sentence);
    const emphasized = [...sentence.matchAll(EMPHASIS)].map((m) => keyOf(m[2]));
    // Without a word on the sheet, only a value in bold after «hai» or «possiedi» counts.
    if (!strong && !(emphasized.length && HAVE.test(sentence))) continue;
    if (strong && GIVE.test(sentence)) {
      for (const m of sentence.matchAll(EMPHASIS)) {
        const v = m[2].trim();
        if (v && !/^\d+$/.test(v)) gives.push(v);
      }
    } else if (ASK.test(sentence)) {
      const plain = ` ${normal(sentence.replace(/[*_]/g, "").replace(/[^\p{L}\p{N}'’ -]/gu, " "))} `;
      asks.push({ text: plain, emphasized, strong, negated: NEGATION.test(sentence) });
    }
  }
  return { gives, asks };
}

export interface StateIssue {
  /**
   * unobtainable: asked here, but no paragraph the reader can pass through before gives it,
   * so the way that needs it can never be taken; neverGiven: asked with "?", and given
   * nowhere; neverAsked: given, and asked nowhere, neither with "?" nor in the prose.
   */
  kind: "unobtainable" | "neverGiven" | "neverAsked";
  path: string;
  /** The property the value is written in, or "" when it is only in the text. */
  property: string;
  value: string;
}

/** A value as compared: lower case, without "?", a leading "-" or a count such as "(15)". */
function keyOf(value: string): string {
  return normal(value).replace(/\s*\?$/, "").replace(/\s*\(\d+\)$/, "");
}

/**
 * The game state of one folder, from the paragraph the reader starts at. What the reader may
 * have on reaching a paragraph is what is given on at least one way there (the paragraph
 * itself included, since it can give before it asks). Values are compared whatever property
 * they are in, so «riflessi» given as a keyword answers «riflessi?» written as a trait.
 * A value with a leading "-", as «-studioso», takes something away: it is neither given nor asked.
 */
export function gameState(index: GamebookIndex, scope: string, start: number, properties: string[]): StateIssue[] {
  const paragraphs = index.inScope(scope);
  const issues: StateIssue[] = [];
  const gives = new Map<string, Set<string>>();
  const given = new Set<string>();
  const asked = new Set<string>();
  // First what is given, to know which emphasized words of the prose are values.
  for (const p of paragraphs) {
    const g = new Set<string>();
    for (const property of properties) {
      for (const value of p.lists[property] ?? []) {
        const n = normal(value);
        if (!n || n.startsWith("-") || n.endsWith("?")) continue;
        g.add(keyOf(value));
      }
    }
    for (const value of p.said.gives) g.add(keyOf(value));
    for (const k of g) given.add(k);
    gives.set(p.path, g);
  }
  const vocabulary = [...given].filter((k) => /^[\p{L}\p{N}'’ -]+$/u.test(k));
  // Then what is asked: each entry is satisfied by any of its keys.
  const asks = new Map<string, { keys: string[]; property: string; value: string; marked: boolean }[]>();
  for (const p of paragraphs) {
    const list: { keys: string[]; property: string; value: string; marked: boolean }[] = [];
    for (const property of properties) {
      for (const value of p.lists[property] ?? []) {
        const n = normal(value);
        if (!n.endsWith("?") || n.startsWith("-")) continue;
        const k = keyOf(value);
        if (!k) continue;
        asked.add(k);
        list.push({ keys: [k], property, value: value.trim(), marked: true });
      }
    }
    for (const a of p.said.asks) {
      const keys = vocabulary.filter((k) => (a.strong ? a.text.includes(` ${k} `) : a.emphasized.includes(k)));
      for (const k of keys) asked.add(k);
      if (keys.length && !a.negated) list.push({ keys, property: "", value: keys.join(" / "), marked: false });
    }
    asks.set(p.path, list);
  }

  // What may be had on arriving: the smallest fixed point, from nothing at the start.
  const first = index.byNumber(scope, start);
  const may = new Map<string, Set<string>>();
  if (first) {
    may.set(first.path, new Set());
    const queue = [first];
    const queued = new Set([first.path]);
    while (queue.length) {
      const p = queue.shift()!;
      queued.delete(p.path);
      const leaving = new Set([...may.get(p.path)!, ...gives.get(p.path)!]);
      for (const { to } of index.outgoing(p)) {
        if (!to || to.scope !== scope) continue;
        const known = may.get(to.path);
        let grew = !known;
        const next = known ?? new Set<string>();
        for (const k of leaving) {
          if (!next.has(k)) {
            next.add(k);
            grew = true;
          }
        }
        may.set(to.path, next);
        if (grew && !queued.has(to.path)) {
          queued.add(to.path);
          queue.push(to);
        }
      }
    }
  }

  for (const p of paragraphs) {
    const arriving = may.get(p.path);
    const own = gives.get(p.path)!;
    const seen = new Set<string>();
    for (const a of asks.get(p.path)!) {
      const id = a.keys.join("\u0000");
      if (seen.has(id)) continue;
      seen.add(id);
      if (a.marked && !given.has(a.keys[0])) issues.push({ kind: "neverGiven", path: p.path, property: a.property, value: a.value });
      else if (arriving && !a.keys.some((k) => arriving.has(k) || own.has(k))) issues.push({ kind: "unobtainable", path: p.path, property: a.property, value: a.value });
    }
  }
  const reported = new Set<string>();
  for (const p of paragraphs) {
    const values = [...properties.flatMap((property) => (p.lists[property] ?? []).map((value) => ({ property, value }))), ...p.said.gives.map((value) => ({ property: "", value }))];
    for (const { property, value } of values) {
      const n = normal(value);
      const k = keyOf(value);
      if (!k || n.startsWith("-") || n.endsWith("?") || asked.has(k) || reported.has(k)) continue;
      reported.add(k);
      issues.push({ kind: "neverAsked", path: p.path, property, value: value.trim() });
    }
  }
  const order = { neverGiven: 0, unobtainable: 1, neverAsked: 2 };
  const number = new Map(paragraphs.map((p) => [p.path, p.number]));
  return issues.sort((a, b) => order[a.kind] - order[b.kind] || number.get(a.path)! - number.get(b.path)!);
}

/** The properties the boxes write to, once each. */
export function stateProperties(boxes: { property: string }[]): string[] {
  return [...new Set(boxes.map((b) => b.property).filter(Boolean))];
}
