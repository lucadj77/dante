import type { TypographySettings } from "./settings";

// Typographic conventions applied when exporting. The files keep what was typed.

const STRAIGHT_APOSTROPHE = /(?<=[\p{L}\p{N}])'(?=\p{L})/gu;
const STRAIGHT_QUOTES = /["“”]/g;
const THREE_DOTS = /(?<!\.)\.\.\.(?!\.)/g;
const ACCENTED_CAPITAL = /\bE'(?=\s|$)/gm;
const DOUBLE_SPACE = /(?<=\S) {2,}(?=\S)/g;
const SPACE_BEFORE_PUNCTUATION = /[ \t]+(?=[,.;:!?…»”])/g;
const SPACE_INSIDE_GUILLEMETS = /«[ \t]+|[ \t]+»/g;
// A dash opening a line of dialogue, but not a rule such as "---" or a list of dashes.
const DIALOGUE = /^([ \t]*)(?:-{1,3}|–|—)[ \t]*(?=[^\s\-–—])/gm;
const RANGE = /(?<=\d)[ \t]*(?:--?|–)[ \t]*(?=\d)/g;
// Double hyphens and en or em dashes after a word, with or without spaces.
const ASIDE_DASH = /(?<=[^\s\-–—])[ \t]*(?:--|–|—)[ \t]*(?=[^\s\-–—]|$)/gm;
// A single hyphen with spaces on both sides, or with a space before and punctuation after.
const ASIDE_HYPHEN = /(?<=[^\s\-–—])[ \t]+-(?:[ \t]+(?=\S)|(?=[,.;:!?»”]|[ \t]*$))/gm;

const ASIDE: Record<Exclude<TypographySettings["dashes"], "keep">, string> = {
  enSpaced: " – ",
  emSpaced: " — ",
  emClosed: "—",
};

function dashes(text: string, rules: TypographySettings): string {
  let out = text;
  // Placeholders keep dialogue and ranges apart from the asides converted next.
  if (rules.dialogueDash) out = out.replace(DIALOGUE, "$1\u0001");
  if (rules.ranges === "enDash") out = out.replace(RANGE, "\u0002");
  if (rules.dashes !== "keep") {
    const aside = ASIDE[rules.dashes];
    const place = (match: string, offset: number, whole: string) => {
      // At the end of a line nothing follows the dash, so it keeps only the space before.
      const atEnd = offset + match.length === whole.length || whole[offset + match.length] === "\n";
      return atEnd ? aside.trimEnd() : aside;
    };
    out = out.replace(ASIDE_DASH, place).replace(ASIDE_HYPHEN, place);
    // Before closing punctuation an aside dash has no space after it.
    out = out.replace(/([–—]) (?=[,.;:!?»”])/g, "$1");
  }
  return out.replace(/\u0001/g, "— ").replace(/\u0002/g, "–");
}

/** Applies the conventions to one paragraph: quotes alternate opening and closing within it. */
function paragraph(text: string, rules: TypographySettings): string {
  let out = text;
  if (rules.apostrophes) out = out.replace(STRAIGHT_APOSTROPHE, "’");
  if (rules.ellipsis) out = out.replace(THREE_DOTS, "…").replace(ACCENTED_CAPITAL, "È");
  if (rules.quotes !== "keep") {
    const [open, close] = rules.quotes === "guillemets" ? ["«", "»"] : ["“", "”"];
    let opening = true;
    out = out.replace(STRAIGHT_QUOTES, () => {
      const mark = opening ? open : close;
      opening = !opening;
      return mark;
    });
  }
  out = dashes(out, rules);
  if (rules.spaces) {
    out = out
      .replace(DOUBLE_SPACE, " ")
      .replace(SPACE_BEFORE_PUNCTUATION, "")
      .replace(SPACE_INSIDE_GUILLEMETS, (m) => m.trim());
  }
  return out;
}

/** Applies the conventions to Markdown text, paragraph by paragraph; code is left alone. */
export function applyTypography(markdown: string, rules: TypographySettings): string {
  let inFence = false;
  return markdown
    .split(/(\n[ \t]*\n)/)
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk;
      const fences = (chunk.match(/^```/gm) ?? []).length;
      const wasInFence = inFence;
      if (fences % 2 === 1) inFence = !inFence;
      return wasInFence || fences > 0 ? chunk : paragraph(chunk, rules);
    })
    .join("");
}
