// Footnotes as Markdown writes them: `^[the note, written where it is called]`, or `[^1]`
// with `[^1]: the note` on a paragraph of its own elsewhere in the same text.

/** Where the `[` at `open` closes in the same paragraph, counting the brackets inside; -1 if it does not. */
export function closingBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return i;
    else if (c === "\n" && (text[i + 1] === "\n" || i + 1 === text.length)) return -1;
  }
  return -1;
}

export interface FootnoteRange {
  from: number;
  to: number;
  /** "inline" is `^[…]`, "call" is `[^1]`, "definition" is the `[^1]:` that opens a note's text. */
  kind: "inline" | "call" | "definition";
}

const CALL = /\^\[|\[\^([^\]\s]+)\](:?)/g;

/** The footnotes written in a text, in order. */
export function findFootnotes(text: string): FootnoteRange[] {
  const out: FootnoteRange[] = [];
  CALL.lastIndex = 0;
  for (let m = CALL.exec(text); m; m = CALL.exec(text)) {
    if (m.index > 0 && text[m.index - 1] === "\\") continue;
    if (m[1] !== undefined) {
      const atStart = m.index === 0 || text[m.index - 1] === "\n";
      out.push({ from: m.index, to: m.index + m[0].length - (m[2] && !atStart ? 1 : 0), kind: m[2] && atStart ? "definition" : "call" });
      continue;
    }
    const close = closingBracket(text, m.index + 1);
    if (close < 0) continue;
    out.push({ from: m.index, to: close + 1, kind: "inline" });
    CALL.lastIndex = close + 1;
  }
  return out;
}
