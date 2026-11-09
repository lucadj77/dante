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

/** A value without its question mark, and whether it had one. */
export function readValue(value: string): { key: string; asked: boolean } {
  const n = normal(value);
  const asked = n.endsWith("?");
  return { key: asked ? n.replace(/\s*\?$/, "") : n, asked };
}

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

export interface StateIssue {
  /**
   * unobtainable: asked here, but no paragraph the reader can pass through before gives it,
   * so the way that needs it can never be taken; neverGiven: asked, and given nowhere;
   * neverAsked: given, and asked nowhere.
   */
  kind: "unobtainable" | "neverGiven" | "neverAsked";
  path: string;
  property: string;
  value: string;
}

/**
 * The game state of one folder, from the paragraph the reader starts at. What the reader may
 * have on reaching a paragraph is what is given on at least one way there (the paragraph
 * itself included, since it can give before it asks).
 */
export function gameState(index: GamebookIndex, scope: string, start: number, properties: string[]): StateIssue[] {
  const paragraphs = index.inScope(scope);
  const issues: StateIssue[] = [];
  const keyOf = (property: string, key: string) => `${property}\u0000${key}`;
  const gives = new Map<string, Set<string>>();
  const asks = new Map<string, { property: string; value: string; key: string }[]>();
  const givenAnywhere = new Set<string>();
  const askedAnywhere = new Set<string>();
  for (const p of paragraphs) {
    const g = new Set<string>();
    const a: { property: string; value: string; key: string }[] = [];
    for (const property of properties) {
      for (const value of p.lists[property] ?? []) {
        const { key, asked } = readValue(value);
        if (!key) continue;
        if (asked) {
          a.push({ property, value: value.trim(), key: keyOf(property, key) });
          askedAnywhere.add(keyOf(property, key));
        } else {
          g.add(keyOf(property, key));
          givenAnywhere.add(keyOf(property, key));
        }
      }
    }
    gives.set(p.path, g);
    asks.set(p.path, a);
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

  const neverGiven = new Set<string>();
  for (const p of paragraphs) {
    const arriving = may.get(p.path);
    for (const a of asks.get(p.path)!) {
      if (!givenAnywhere.has(a.key)) {
        const once = `${p.path}\u0000${a.key}`;
        if (neverGiven.has(once)) continue;
        neverGiven.add(once);
        issues.push({ kind: "neverGiven", path: p.path, property: a.property, value: a.value });
      } else if (arriving && !arriving.has(a.key) && !gives.get(p.path)!.has(a.key)) {
        issues.push({ kind: "unobtainable", path: p.path, property: a.property, value: a.value });
      }
    }
  }
  const reported = new Set<string>();
  for (const p of paragraphs) {
    for (const property of properties) {
      for (const value of p.lists[property] ?? []) {
        const { key, asked } = readValue(value);
        const k = keyOf(property, key);
        if (!key || asked || askedAnywhere.has(k) || reported.has(k)) continue;
        reported.add(k);
        issues.push({ kind: "neverAsked", path: p.path, property, value: value.trim() });
      }
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
