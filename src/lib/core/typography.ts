import type { QuoteStyle, TypographySettings } from "./settings";

// Typographic conventions applied when exporting. The files keep what was typed.

const STRAIGHT_APOSTROPHE = /(?<=[\p{L}\p{N}])'(?=\p{L})/gu;
const STRAIGHT_QUOTES = /["“”]/g;
/** Opening and closing marks of each style that uses quotation marks. */
export const QUOTE_MARKS: Partial<Record<QuoteStyle, [string, string]>> = {
  guillemets: ["«", "»"],
  guillemetsSpaced: ["«\u202F", "\u202F»"],
  guillemetsReversed: ["»", "«"],
  curly: ["“", "”"],
  curlySingle: ["‘", "’"],
  low: ["„", "“"],
  lowPolish: ["„", "”"],
  swedish: ["”", "”"],
};
export const isDashStyle = (style: QuoteStyle) => style === "dash" || style === "dashAttached";
// French spacing: a narrow no-break space before ; ! ? and inside guillemets, a no-break space before :.
const FRENCH_TIGHT = /[ \t\u00A0\u202F]*([;!?])/g;
const FRENCH_COLON = /(?<=\S)[ \t\u00A0\u202F]*:(?=\s|$)/g;
const THREE_DOTS = /(?<!\.)\.\.\.(?!\.)/g;
const ACCENTED_CAPITAL = /\bE'(?=\s|$)/gm;
const DOUBLE_SPACE = /(?<=\S) {2,}(?=\S)/g;
const SPACE_BEFORE_PUNCTUATION = /[ \t]+(?=[,.;:!?…»”])/g;
const SPACE_INSIDE_GUILLEMETS = /«[ \t]+|[ \t]+»/g;
// A dash opening a line of dialogue, but not a rule such as "---" or a list of dashes.
const DIALOGUE = /^([ \t]*)(?:-{1,2}|–|—)[ \t]*(?=[^\s\-–—])/gm;
// Stand-in for dialogue dashes until the chosen sign is set.
const DIALOGUE_MARK = "\u0001";

/**
 * Turns dialogue in guillemets or straight quotes into dialogue opened by a dash:
 * «Vieni» disse lui «è tardi.» becomes — Vieni — disse lui — è tardi.
 * A line that ends its paragraph is not closed; one followed by narration is closed
 * with a dash. Dashes are left as DIALOGUE_MARK for the caller to set. Em dashes already
 * in the text count as dialogue dashes, so text typed with dashes keeps them.
 * `attached` follows the Spanish way: the dash touches the words it introduces or closes,
 * —Ven —dijo él— es tarde.
 */
function dialogueWithDashes(text: string, attached = false): string {
  // Em dashes already typed are dialogue too.
  const out = text.replace(DIALOGUE, attached ? `$1${DIALOGUE_MARK}` : `$1${DIALOGUE_MARK} `).replaceAll("—", DIALOGUE_MARK);
  let result = "";
  let open = false;
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    const opens = c === "«" || (c === '"' && !open);
    const closes = c === "»" || (c === '"' && open);
    if (opens) {
      open = true;
      const atStart = /(^|\n)[ \t]*$/.test(result);
      // Spanish: the dash that resumes dialogue closes the narration, touching its last word.
      if (attached && !atStart) result = result.trimEnd() + `${DIALOGUE_MARK} `;
      else result += attached ? DIALOGUE_MARK : `${DIALOGUE_MARK} `;
      while (out[i + 1] === " ") i++;
    } else if (closes) {
      open = false;
      const rest = out.slice(i + 1);
      result = result.trimEnd();
      // At the end of the paragraph, or before closing punctuation only, the line stays open.
      if (/^[\s.,;:!?…]*$/.test(rest)) continue;
      // Punctuation stays where the author put it: only the quotation mark becomes a dash.
      result += ` ${DIALOGUE_MARK}`;
      if (attached) while (out[i + 1] === " ") i++;
      else if (!/^\s/.test(out.slice(i + 1))) result += " ";
    } else {
      result += c;
    }
  }
  // A closing dash typed at the end of the paragraph is dropped: the line stays open.
  return result.replace(new RegExp(`\\s*${DIALOGUE_MARK}\\s*$`), "");
}

/** Applies the conventions to one paragraph: quotes alternate opening and closing within it. */
function paragraph(text: string, rules: TypographySettings): string {
  let out = text;
  if (rules.apostrophes) out = out.replace(STRAIGHT_APOSTROPHE, "’");
  if (rules.ellipsis) out = out.replace(THREE_DOTS, "…").replace(ACCENTED_CAPITAL, "È");
  if (isDashStyle(rules.quotes)) {
    out = dialogueWithDashes(out, rules.quotes === "dashAttached");
  } else if (rules.quotes !== "keep") {
    const [open, close] = QUOTE_MARKS[rules.quotes] ?? ["“", "”"];
    // Guillemets typed in another style become the chosen marks too.
    if (rules.quotes !== "guillemets") out = out.replace(/«[ \t\u00A0\u202F]*|[ \t\u00A0\u202F]*»/g, (m) => (m.includes("«") ? open : close));
    let opening = true;
    out = out.replace(rules.quotes === "guillemetsReversed" || rules.quotes === "guillemets" ? STRAIGHT_QUOTES : /"/g, () => {
      const mark = opening ? open : close;
      opening = !opening;
      return mark;
    });
  }
  out = out.replaceAll(DIALOGUE_MARK, rules.dialogueDash === "en" ? "–" : "—");
  if (rules.spaces) {
    out = out
      .replace(DOUBLE_SPACE, " ")
      .replace(SPACE_BEFORE_PUNCTUATION, "")
      .replace(SPACE_INSIDE_GUILLEMETS, (m) => m.trim());
  }
  if (rules.quotes === "guillemetsSpaced") {
    out = out
      .replace(/«[ \t\u00A0\u202F]*/g, "«\u202F")
      .replace(/[ \t\u00A0\u202F]*»/g, "\u202F»")
      .replace(FRENCH_TIGHT, "\u202F$1")
      .replace(FRENCH_COLON, "\u00A0:");
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
