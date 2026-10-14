/**
 * Comments and revisions in CriticMarkup (https://github.com/CriticMarkup/CriticMarkup-toolkit),
 * each followed by a signature comment:
 *
 *   La porta era {--chiusa--}{>>@anna 2026-10-14<<}{++socchiusa++}{>>@anna 2026-10-14<<}.
 *   {==Il vento portava odore di sale.==}{>>@luca 2026-10-13: troppo presto?<<}{>>@anna 2026-10-14: sì<<}
 *
 * A reply is one more comment right after the previous one.
 */

export type ItemKind = "addition" | "deletion" | "substitution" | "highlight" | "comment";

export interface Comment {
  from: number;
  to: number;
  author: string | null;
  date: string | null;
  /** The comment's words, empty for a bare signature. */
  text: string;
}

/** A change or a comment thread, with the comments that follow it. */
export interface CriticItem {
  kind: ItemKind;
  /** The whole item: the mark and the comments after it. */
  from: number;
  to: number;
  /** The mark alone, delimiters included; for a comment thread, its first comment. */
  markFrom: number;
  markTo: number;
  /** What the mark holds: added, deleted or highlighted text; the old text of a substitution. */
  contentFrom: number;
  contentTo: number;
  /** The new text of a substitution. */
  newFrom?: number;
  newTo?: number;
  /** Signer of the change, or author of the first comment. */
  author: string | null;
  date: string | null;
  comments: Comment[];
}

const MARK = /\{\+\+([\s\S]*?)\+\+\}|\{--([\s\S]*?)--\}|\{~~([\s\S]*?)~>([\s\S]*?)~~\}|\{==([\s\S]*?)==\}|\{>>([\s\S]*?)<<\}/g;
const SIGNED = /^@(.+?)\s+(\d{4}-\d{2}-\d{2})\s*(?::\s*([\s\S]*))?$/;
const SIGNED_UNDATED = /^@(\S+)\s*(?::\s*([\s\S]*))?$/;

/** Reads "@name date: words", "@name: words" or plain words. */
export function parseComment(body: string): Omit<Comment, "from" | "to"> {
  const text = body.trim();
  const dated = SIGNED.exec(text);
  if (dated) return { author: dated[1].trim(), date: dated[2], text: (dated[3] ?? "").trim() };
  const undated = SIGNED_UNDATED.exec(text);
  if (undated) return { author: undated[1], date: null, text: (undated[2] ?? "").trim() };
  return { author: null, date: null, text };
}

/** Every change and comment thread in the text, in order. */
export function parseCritic(text: string): CriticItem[] {
  const items: CriticItem[] = [];
  let last: CriticItem | null = null;
  for (const m of text.matchAll(MARK)) {
    const from = m.index!;
    const to = from + m[0].length;
    if (m[6] !== undefined) {
      const comment: Comment = { from, to, ...parseComment(m[6]) };
      if (last && last.to === from) {
        last.comments.push(comment);
        last.to = to;
        if (last.author === null && comment.author) {
          last.author = comment.author;
          last.date = comment.date;
        }
        continue;
      }
      last = { kind: "comment", from, to, markFrom: from, markTo: to, contentFrom: from + 3, contentTo: to - 3, author: comment.author, date: comment.date, comments: [comment] };
      items.push(last);
      continue;
    }
    const kind: ItemKind = m[1] !== undefined ? "addition" : m[2] !== undefined ? "deletion" : m[3] !== undefined ? "substitution" : "highlight";
    last = { kind, from, to, markFrom: from, markTo: to, contentFrom: from + 3, contentTo: to - 3, author: null, date: null, comments: [] };
    if (kind === "substitution") {
      last.contentTo = from + 3 + m[3].length;
      last.newFrom = last.contentTo + 2;
      last.newTo = to - 3;
    }
    items.push(last);
  }
  return items;
}

/** The item's comments that have words, leaving out bare signatures. */
export function discussion(item: CriticItem): Comment[] {
  return item.comments.filter((c) => c.text);
}

export function isChange(item: CriticItem): boolean {
  return item.kind === "addition" || item.kind === "deletion" || item.kind === "substitution";
}

/** Today as YYYY-MM-DD, in local time. */
export function today(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escape(text: string): string {
  return text.replace(/<<\}/g, "<< }").replace(/\n+/g, " ").trim();
}

/** A signed comment; without words it is the signature of a change. */
export function commentMark(author: string, date: string, text = ""): string {
  const words = escape(text);
  return `{>>@${author} ${date}${words ? ": " + words : ""}<<}`;
}

/** A replacement of part of the text: `[from, to)` becomes `insert`. */
export interface Edit {
  from: number;
  to: number;
  insert: string;
}

/** Applies edits given in the coordinates of `text`. */
export function applyEdits(text: string, edits: Edit[]): string {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return out;
}

const slice = (text: string, from: number, to: number) => text.slice(from, to);

/** Accepting keeps the new text and removes the marks and the item's comments. */
export function acceptEdit(text: string, item: CriticItem): Edit {
  const keep =
    item.kind === "addition" || item.kind === "highlight"
      ? slice(text, item.contentFrom, item.contentTo)
      : item.kind === "substitution"
        ? slice(text, item.newFrom!, item.newTo!)
        : "";
  return { from: item.from, to: item.to, insert: keep };
}

/** Rejecting keeps the old text. */
export function rejectEdit(text: string, item: CriticItem): Edit {
  const keep =
    item.kind === "deletion" || item.kind === "substitution" || item.kind === "highlight"
      ? slice(text, item.contentFrom, item.contentTo)
      : "";
  return { from: item.from, to: item.to, insert: keep };
}

/**
 * Resolving a comment thread removes it from the file, with the highlight it was on.
 * On a change, only the discussion goes: the change and its signature stay.
 */
export function resolveEdit(text: string, item: CriticItem): Edit {
  if (!isChange(item)) return acceptEdit(text, item);
  const signature = item.comments.find((c) => !c.text);
  return { from: item.markTo, to: item.to, insert: signature ? slice(text, signature.from, signature.to) : "" };
}

/** A reply goes right after the item's last comment. */
export function replyEdit(item: CriticItem, author: string, date: string, words: string): Edit {
  return { from: item.to, to: item.to, insert: commentMark(author, date, words) };
}

/** A comment on `[from, to)`, highlighting it, or at a point when the range is empty. */
export function commentEdit(text: string, from: number, to: number, author: string, date: string, words: string): Edit {
  const comment = commentMark(author, date, words);
  // A double click often takes the space after the word too: it stays out of the highlight.
  const start = from;
  while (from < to && /\s/.test(text[from])) from++;
  while (to > from && /\s/.test(text[to - 1])) to--;
  if (from === to) return { from: start, to: start, insert: comment };
  return { from, to, insert: `{==${slice(text, from, to)}==}${comment}` };
}

/** Accepts or rejects every change; comments and highlights stay. */
export function settleAll(text: string, how: "accept" | "reject"): string {
  const edits = parseCritic(text)
    .filter(isChange)
    .map((item) => (how === "accept" ? acceptEdit(text, item) : rejectEdit(text, item)));
  return applyEdits(text, edits);
}

/** What the editor does with a change typed in revision mode. */
export interface Tracked extends Edit {
  /** Where the cursor goes, in the text after the edit. */
  cursor: number;
}

const same = (a: string | null, b: string) => a !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Turns a change typed in revision mode into CriticMarkup signed by `author`: typed text
 * becomes an addition, removed text a deletion. Typing inside one's own addition edits it
 * directly, and deleting next to one's own deletion extends it. Returns null when the
 * change applies as it is.
 */
export function trackChange(
  text: string,
  change: Edit,
  author: string,
  date: string,
  backward = true,
): Tracked | null {
  const items = parseCritic(text);
  const sig = commentMark(author, date);
  const { from, to, insert } = change;
  const mine = (i: CriticItem) => same(i.author, author);
  // The editable part of an addition: its text, or the new text of a substitution.
  const addedPart = (i: CriticItem): [number, number] | null =>
    i.kind === "addition" ? [i.contentFrom, i.contentTo] : i.kind === "substitution" ? [i.newFrom!, i.newTo!] : null;
  const within = (i: CriticItem, a: number, b: number) => {
    const part = addedPart(i);
    return part !== null && a >= part[0] && b <= part[1];
  };

  // Highlighted text is plain text with a comment on it: nested marks are not allowed, so
  // edits there apply directly.
  if (items.some((i) => i.kind === "highlight" && from >= i.contentFrom && to <= i.contentTo)) return null;
  // Inside an addition, own or someone else's, the text is still a proposal: edit it directly.
  const host = items.find((i) => within(i, from, to));
  if (host) {
    const part = addedPart(host)!;
    const left = part[1] - part[0] - (to - from) + insert.length;
    // Deleting all of one's own addition removes it with its signature.
    if (left === 0 && host.kind === "addition" && mine(host)) return { from: host.from, to: host.to, insert: "", cursor: host.from };
    return null;
  }

  if (from === to) {
    if (!insert) return null;
    let at = from;
    // Next to one's own addition: continue it.
    const before = items.find((i) => i.kind === "addition" && mine(i) && i.to === at);
    const after = items.find((i) => i.kind === "addition" && mine(i) && i.markFrom === at);
    if (before) return { from: before.contentTo, to: before.contentTo, insert, cursor: before.contentTo + insert.length };
    if (after) return { from: after.contentFrom, to: after.contentFrom, insert, cursor: after.contentFrom + insert.length };
    // Inside a mark or a comment, the new text goes after the whole item.
    const inside = items.find((i) => at > i.from && at < i.to);
    if (inside) at = inside.to;
    const added = `{++${insert}++}`;
    return { from: at, to: at, insert: added + sig, cursor: at + 3 + insert.length };
  }

  // Inside a deletion or a comment there is nothing to delete.
  const container = items.find((i) => from >= i.from && to <= i.to);
  if (container && !(from === container.from && to === container.to)) {
    if (!insert) return { from, to: from, insert: "", cursor: backward ? from : to };
    const at = container.to;
    return { from: at, to: at, insert: `{++${insert}++}` + sig, cursor: at + 3 + insert.length };
  }

  const covered = items.filter((i) => i.from < to && i.to > from);
  if (!covered.length && !insert) {
    const removed = slice(text, from, to);
    // Next to one's own deletion: extend it.
    const right = items.find((i) => i.kind === "deletion" && mine(i) && i.markFrom === to);
    const left = items.find((i) => i.kind === "deletion" && mine(i) && i.to === from);
    const first = backward ? right ?? null : left ?? null;
    const second = backward ? left ?? null : right ?? null;
    for (const d of [first, second]) {
      if (!d) continue;
      if (d === right) {
        return { from, to: d.contentFrom, insert: "{--" + removed, cursor: from };
      }
      const tail = slice(text, d.contentTo, from);
      return { from: d.contentTo, to, insert: removed + tail, cursor: d.contentTo + removed.length + tail.length };
    }
    const mark = `{--${removed}--}` + sig;
    return { from, to, insert: mark, cursor: backward ? from : from + mark.length };
  }

  // A range across marks: plain stretches become deletions, one's own additions go, the rest stays.
  let lo = from;
  let hi = to;
  let out = "";
  let pos = from;
  const wrap = (a: number, b: number) => {
    if (b > a) out += `{--${slice(text, a, b)}--}` + sig;
  };
  for (const item of covered) {
    if (item.from < from) {
      // Partly covered at the start: kept whole.
      lo = item.from;
      out += slice(text, item.from, item.to);
      pos = item.to;
      continue;
    }
    wrap(pos, item.from);
    if (item.to > to) {
      hi = item.to;
      out += slice(text, item.from, item.to);
      pos = item.to;
      continue;
    }
    if (!(item.kind === "addition" && mine(item))) out += slice(text, item.from, item.to);
    pos = item.to;
  }
  wrap(pos, Math.max(pos, to));
  let cursor = backward && !insert ? lo : lo + out.length;
  if (insert) {
    out += `{++${insert}++}`;
    cursor = lo + out.length - 3;
    out += sig;
  }
  if (out === slice(text, lo, hi)) return { from, to: from, insert: "", cursor: backward ? from : to };
  return { from: lo, to: hi, insert: out, cursor };
}
