// File and folder names in the manuscript carry their position as a numeric
// prefix: "010 Arrival.md". The prefix only orders; displayed numbers are computed.

export const ORDER_STEP = 10;
const PREFIX = /^(\d+)\s+(.*)$/;
// Characters that break file names on some system or break Obsidian wikilinks.
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/g;

export interface ParsedName {
  order: number | null;
  title: string;
}

export function parseName(name: string): ParsedName {
  const match = PREFIX.exec(name);
  if (!match || match[2].trim() === "") return { order: null, title: name };
  return { order: Number(match[1]), title: match[2] };
}

export function formatName(order: number, title: string, width = 3): string {
  return `${String(order).padStart(width, "0")} ${title}`;
}

export function sanitizeTitle(title: string): string {
  return title.replace(FORBIDDEN, " ").replace(/\s+/g, " ").trim().replace(/\.+$/, "");
}

/**
 * Chooses new order numbers for a sequence of siblings already in the desired order,
 * changing as few of them as possible. Items whose current number already fits are
 * kept; the others get a number in the gap around them. When a gap is too small,
 * the whole sequence is renumbered with ORDER_STEP.
 */
export function assignOrders(current: (number | null)[]): number[] {
  const keep = longestIncreasing(current);
  const result: (number | null)[] = current.map((o, i) => (keep.has(i) ? o : null));

  let i = 0;
  while (i < result.length) {
    if (result[i] !== null) {
      i++;
      continue;
    }
    let j = i;
    while (j < result.length && result[j] === null) j++;
    const count = j - i;
    let low = i === 0 ? 0 : (result[i - 1] as number);
    if (j < result.length) {
      const high = result[j] as number;
      // At the start, 0 itself is free: "000 Prologue" before "010 ...".
      if (i === 0 && Math.floor(high / (count + 1)) < 1) low = -1;
      const step = Math.floor((high - low) / (count + 1));
      if (step < 1) return current.map((_, k) => (k + 1) * ORDER_STEP);
      for (let k = 0; k < count; k++) result[i + k] = low + step * (k + 1);
    } else {
      for (let k = 0; k < count; k++) result[i + k] = low + ORDER_STEP * (k + 1);
    }
    i = j;
  }
  return result as number[];
}

/** Indexes of a longest strictly increasing subsequence of the non-null values. */
function longestIncreasing(values: (number | null)[]): Set<number> {
  const idx: number[] = [];
  values.forEach((v, i) => {
    // A kept item must leave room for the items before it (numbers start at 0).
    if (v !== null && v >= i) idx.push(i);
  });
  const best: number[] = idx.map(() => 1);
  const prev: number[] = idx.map(() => -1);
  for (let a = 0; a < idx.length; a++) {
    for (let b = 0; b < a; b++) {
      // Leave room for the items between the two kept ones.
      const gap = idx[a] - idx[b];
      if ((values[idx[a]] as number) - (values[idx[b]] as number) >= gap && best[b] + 1 > best[a]) {
        best[a] = best[b] + 1;
        prev[a] = b;
      }
    }
  }
  let end = -1;
  for (let a = 0; a < idx.length; a++) {
    if (end === -1 || best[a] > best[end]) end = a;
  }
  const keep = new Set<number>();
  while (end !== -1) {
    keep.add(idx[end]);
    end = prev[end];
  }
  return keep;
}
