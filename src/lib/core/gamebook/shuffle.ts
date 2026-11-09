// Shuffling the numbers of a gamebook, as the plugin does: fixed paragraphs stay, a
// relative paragraph moves together with its anchor (the whole chain is one block, its
// distances kept), every other paragraph gets a number at random. Of many tries the one
// where a paragraph and the ones it leads to are farthest apart wins, so that the reader
// cannot guess the next paragraph by looking nearby.
import { readDocument } from "./frontmatter";
import { findWikiLinks } from "./links";
import type { Paragraph } from "./paragraphs";

export type ShuffleError =
  | { kind: "anchorCycle"; paths: string[] }
  | { kind: "noAnchor"; path: string; anchor: string }
  | { kind: "fixedClash"; number: number; paths: string[] }
  | { kind: "outOfRange"; paths: string[] }
  | { kind: "noRoom"; paths: string[] };

export type ShuffleResult = { ok: true; numbers: Map<string, number>; spread: number } | { ok: false; errors: ShuffleError[] };

interface Block {
  root: Paragraph;
  members: { paragraph: Paragraph; offset: number }[];
  min: number;
  max: number;
}

const TRIES_PER_BLOCK = 200;
const TRIES = 30;

/**
 * New numbers for the paragraphs of one folder. `start` is the number the reader begins
 * from: a free paragraph that has it keeps it, as if it were fixed.
 */
export function shuffle(paragraphs: Paragraph[], options: { start?: number; random?: () => number } = {}): ShuffleResult {
  const random = options.random ?? Math.random;
  const byTitle = new Map(paragraphs.map((p) => [p.title, p]));
  const fixed = (p: Paragraph) => p.numberType === "fixed" || (p.numberType === "free" && p.number === options.start);

  const missing: ShuffleError[] = [];
  for (const p of paragraphs) {
    if (p.numberType === "relative" && p.anchor && !byTitle.has(p.anchor)) missing.push({ kind: "noAnchor", path: p.path, anchor: p.anchor });
  }
  if (missing.length) return { ok: false, errors: missing };
  const cycle = findCycle(paragraphs, byTitle);
  if (cycle) return { ok: false, errors: [{ kind: "anchorCycle", paths: cycle }] };

  const blocks = blocksOf(paragraphs, byTitle);
  const fixedNumbers = new Map<string, number>();
  const taken = new Map<number, string[]>();
  for (const b of blocks) {
    if (!fixed(b.root)) continue;
    for (const m of b.members) {
      const n = b.root.number + m.offset;
      fixedNumbers.set(m.paragraph.path, n);
      taken.set(n, [...(taken.get(n) ?? []), m.paragraph.path]);
    }
  }
  const clashes = [...taken].filter(([, paths]) => paths.length > 1);
  if (clashes.length) return { ok: false, errors: clashes.map(([number, paths]) => ({ kind: "fixedClash", number, paths })) };

  const size = Math.max(paragraphs.length, ...taken.keys(), 0);
  // A relative paragraph whose anchor is not written moves on its own, like a free one.
  const free = blocks.filter((b) => !fixed(b.root));
  const outside = free.filter((b) => 1 - b.min > size - b.max);
  if (outside.length) return { ok: false, errors: outside.map((b) => ({ kind: "outOfRange", paths: b.members.map((m) => m.paragraph.path) })) };

  let best: Map<string, number> | null = null;
  let bestSpread = -Infinity;
  for (let t = 0; t < TRIES; t++) {
    const placed = place(free, taken, size, random);
    if (!placed) continue;
    const all = new Map([...fixedNumbers, ...placed]);
    const s = spread(paragraphs, byTitle, all);
    if (s > bestSpread) {
      bestSpread = s;
      best = all;
    }
  }
  if (!best) {
    const stuck = free.find((b) => place([b], taken, size, random) === null) ?? free[0];
    return { ok: false, errors: [{ kind: "noRoom", paths: stuck.members.map((m) => m.paragraph.path) }] };
  }
  return { ok: true, numbers: best, spread: bestSpread };
}

function findCycle(paragraphs: Paragraph[], byTitle: Map<string, Paragraph>): string[] | null {
  const done = new Set<string>();
  for (const p of paragraphs) {
    if (done.has(p.path)) continue;
    const stack: string[] = [];
    let current: Paragraph | undefined = p;
    while (current && current.numberType === "relative" && current.anchor) {
      if (done.has(current.path)) break;
      const at = stack.indexOf(current.path);
      if (at !== -1) return stack.slice(at);
      stack.push(current.path);
      current = byTitle.get(current.anchor);
    }
    for (const path of stack) done.add(path);
  }
  return null;
}

/** Each paragraph with the root of its chain of anchors and its distance from it. */
function blocksOf(paragraphs: Paragraph[], byTitle: Map<string, Paragraph>): Block[] {
  const memo = new Map<string, { root: Paragraph; offset: number }>();
  const resolve = (p: Paragraph): { root: Paragraph; offset: number } => {
    const known = memo.get(p.path);
    if (known) return known;
    let out: { root: Paragraph; offset: number };
    if (p.numberType !== "relative" || !p.anchor) out = { root: p, offset: 0 };
    else {
      const parent = resolve(byTitle.get(p.anchor)!);
      out = { root: parent.root, offset: parent.offset + (p.offset ?? 0) };
    }
    memo.set(p.path, out);
    return out;
  };
  const byRoot = new Map<string, Block>();
  for (const p of paragraphs) {
    const { root, offset } = resolve(p);
    let b = byRoot.get(root.path);
    if (!b) byRoot.set(root.path, (b = { root, members: [], min: 0, max: 0 }));
    b.members.push({ paragraph: p, offset });
    b.min = Math.min(b.min, offset);
    b.max = Math.max(b.max, offset);
  }
  return [...byRoot.values()];
}

function place(blocks: Block[], fixed: Map<number, string[]>, size: number, random: () => number): Map<string, number> | null {
  const taken = new Set(fixed.keys());
  const numbers = new Map<string, number>();
  for (const b of blocks) {
    const low = 1 - b.min;
    const high = size - b.max;
    let placed = false;
    for (let t = 0; t < TRIES_PER_BLOCK && !placed; t++) {
      const x = low + Math.floor(random() * (high - low + 1));
      if (b.members.some((m) => taken.has(x + m.offset))) continue;
      for (const m of b.members) {
        numbers.set(m.paragraph.path, x + m.offset);
        taken.add(x + m.offset);
      }
      placed = true;
    }
    if (!placed) return null;
  }
  return numbers;
}

/** The smallest distance between a paragraph and one it leads to: the larger, the better. */
function spread(paragraphs: Paragraph[], byTitle: Map<string, Paragraph>, numbers: Map<string, number>): number {
  let least = Infinity;
  for (const p of paragraphs) {
    const from = numbers.get(p.path);
    if (from === undefined) continue;
    for (const r of p.references) {
      const to = byTitle.get(r.target);
      const n = to ? numbers.get(to.path) : undefined;
      if (n !== undefined) least = Math.min(least, Math.abs(from - n));
    }
  }
  return least === Infinity ? 0 : least;
}

/** A number written in the prose, not as a reference, that may name a paragraph. */
export interface ProseNumber {
  number: number;
  /** The words around it, to recognise it. */
  context: string;
}

// "vai al 25", "torna al paragrafo 12", "il 7": an article or "paragrafo" before a number;
// in English "turn to 25", "go back to section 12", "paragraph 7".
const PROSE = /(^|[^\p{L}\p{N}_])((?:al|il|l['’]|all['’]|dal|dall['’]|del|dell['’]|nel|nell['’]|sul|sull['’]|paragrafo|paragrafi|par\.)[ \t]*)(\d{1,4})(?![\p{N}])/giu;
const PROSE_EN = /(^|[^\p{L}\p{N}_])((?:to|sections?|paragraphs?|para\.|§)[ \t]*)(\d{1,4})(?![\p{N}])/giu;

/**
 * The numbers in the text, outside references, that come after an article or "paragrafo"
 * and are the number of a paragraph: a shuffle will not change them, so they are worth a look.
 */
export function proseNumbers(text: string, isParagraph: (n: number) => boolean, language = "it"): ProseNumber[] {
  const { body } = readDocument(text);
  const links = findWikiLinks(body).map((l) => [l.from, l.to] as const);
  const out: ProseNumber[] = [];
  for (const m of body.matchAll(language.toLowerCase().startsWith("en") ? PROSE_EN : PROSE)) {
    const at = m.index! + m[1].length + m[2].length;
    if (links.some(([from, to]) => at >= from && at < to)) continue;
    const n = Number(m[3]);
    if (!isParagraph(n)) continue;
    const start = Math.max(0, at - 30);
    const end = Math.min(body.length, at + m[3].length + 20);
    out.push({ number: n, context: (start > 0 ? "…" : "") + body.slice(start, end).replace(/\s+/g, " ").trim() + (end < body.length ? "…" : "") });
  }
  return out;
}

/**
 * New numbers in the order the reader meets the paragraphs: the first one, then the
 * paragraphs it leads to in the order they appear in its text, then theirs, and so on
 * (hidden references after the ones in the text). Fixed paragraphs stay, a relative one
 * keeps its distance from its anchor, and those nobody reaches come last, in their order.
 */
export function reorder(paragraphs: Paragraph[], options: { start?: number } = {}): ShuffleResult {
  const byTitle = new Map(paragraphs.map((p) => [p.title, p]));
  for (const p of paragraphs) {
    if (p.numberType === "relative" && p.anchor && !byTitle.has(p.anchor)) return { ok: false, errors: [{ kind: "noAnchor", path: p.path, anchor: p.anchor }] };
  }
  const cycle = findCycle(paragraphs, byTitle);
  if (cycle) return { ok: false, errors: [{ kind: "anchorCycle", paths: cycle }] };

  const sorted = [...paragraphs].sort((a, b) => a.number - b.number);
  const first = sorted.find((p) => p.number === options.start) ?? sorted[0];
  // The order of reading: breadth first, from the first paragraph.
  const order: Paragraph[] = [];
  const seen = new Set<string>();
  const queue = first ? [first] : [];
  if (first) seen.add(first.path);
  while (queue.length) {
    const p = queue.shift()!;
    order.push(p);
    const refs = [...p.references].sort((a, b) => (a.hidden === b.hidden ? a.from - b.from : a.hidden ? 1 : -1));
    for (const r of refs) {
      const to = byTitle.get(r.target);
      if (to && !seen.has(to.path)) {
        seen.add(to.path);
        queue.push(to);
      }
    }
  }
  for (const p of sorted) if (!seen.has(p.path)) order.push(p);

  const blocks = blocksOf(paragraphs, byTitle);
  const blockOf = new Map<string, Block>();
  for (const b of blocks) for (const m of b.members) blockOf.set(m.paragraph.path, b);
  const fixedRoot = (b: Block) => b.root.numberType === "fixed";
  const numbers = new Map<string, number>();
  const taken = new Map<number, string[]>();
  for (const b of blocks) {
    if (!fixedRoot(b)) continue;
    for (const m of b.members) {
      const n = b.root.number + m.offset;
      numbers.set(m.paragraph.path, n);
      taken.set(n, [...(taken.get(n) ?? []), m.paragraph.path]);
    }
  }
  const clashes = [...taken].filter(([, paths]) => paths.length > 1);
  if (clashes.length) return { ok: false, errors: clashes.map(([number, paths]) => ({ kind: "fixedClash", number, paths })) };
  const used = new Set(taken.keys());
  let next = 1;
  for (const p of order) {
    if (numbers.has(p.path)) continue;
    const b = blockOf.get(p.path)!;
    const own = b.members.find((m) => m.paragraph.path === p.path)!.offset;
    // The paragraph takes the first free number from `next` on where its whole block fits.
    let x = next;
    while (b.members.some((m) => x - own + m.offset < 1 || used.has(x - own + m.offset))) x++;
    for (const m of b.members) {
      numbers.set(m.paragraph.path, x - own + m.offset);
      used.add(x - own + m.offset);
    }
    while (used.has(next)) next++;
  }
  return { ok: true, numbers, spread: spread(paragraphs, byTitle, numbers) };
}
