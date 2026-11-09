// The article before a reference changes with the number it names: «il 12» but «l'11»,
// «al 7» but «all'8». As the plugin does, only articles in front of a reference whose label
// is its paragraph's number are corrected; a label that is not a number, or not that
// paragraph's number, is left alone.
import { readDocument } from "./frontmatter";
import { findWikiLinks } from "./links";

/** Whether the number, said aloud in Italian, starts with a vowel: 1, 8, 11, 80-89, 800-899, 8000… */
export function startsWithVowel(n: number): boolean {
  if (!Number.isSafeInteger(n) || n < 1) return false;
  if (n >= 1_000_000) {
    let scale = 1_000_000;
    while (n / scale >= 1000) scale *= 1000;
    return startsWithVowel(Math.floor(n / scale));
  }
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    return thousands !== 1 && startsWithVowel(thousands);
  }
  if (n >= 100) return Math.floor(n / 100) === 8;
  return n === 1 || n === 8 || n === 11 || (n >= 80 && n <= 89);
}

/** Each article, with its form before a consonant and before a vowel. */
const FORMS: Record<string, [string, string]> = {
  il: ["il", "l'"],
  lo: ["il", "l'"],
  l: ["il", "l'"],
  al: ["al", "all'"],
  allo: ["al", "all'"],
  all: ["al", "all'"],
  dal: ["dal", "dall'"],
  dallo: ["dal", "dall'"],
  dall: ["dal", "dall'"],
  del: ["del", "dell'"],
  dello: ["del", "dell'"],
  dell: ["del", "dell'"],
  nel: ["nel", "nell'"],
  nello: ["nel", "nell'"],
  nell: ["nel", "nell'"],
  sul: ["sul", "sull'"],
  sullo: ["sul", "sull'"],
  sull: ["sul", "sull'"],
  col: ["col", "con l'"],
  collo: ["col", "con l'"],
  coll: ["col", "con l'"],
};

// No lookbehind (macOS 10.15): the character before the article is matched, and kept.
const ARTICLE = /(^|[^\p{L}\p{N}_])(il|lo|al|allo|dal|dallo|del|dello|nel|nello|sul|sullo|col|collo|(?:all|dall|dell|nell|sull|coll|l)['’])([ \t]*)((?:\*{1,2}|_{1,2})?)$/iu;

/**
 * The article at the end of `before`, rewritten for `number`: where it starts in `before`
 * and what replaces it up to the end. Null when there is no article or it is already right.
 */
export function articleFix(before: string, number: number): { from: number; text: string } | null {
  const m = ARTICLE.exec(before);
  if (!m) return null;
  const start = m.index + m[1].length;
  const old = before.slice(start);
  const form = m[2].replace(/['’]$/, "");
  const vowel = startsWithVowel(number);
  let next = FORMS[form.toLowerCase()][vowel ? 1 : 0];
  if (m[2].includes("’")) next = next.replace("'", "’");
  if (form.length > 1 && form === form.toUpperCase()) next = next.toUpperCase();
  else if (form[0] === form[0].toUpperCase()) next = next[0].toUpperCase() + next.slice(1);
  next += (vowel ? "" : m[3] || " ") + m[4];
  return next === old ? null : { from: start, text: next };
}

/**
 * Corrects the articles before every reference in the text whose label is its paragraph's
 * number. `numberOf` gives the number of the paragraph a target reaches, or null.
 */
export function fixArticles(text: string, numberOf: (target: string) => number | null): { text: string; count: number } {
  const { body } = readDocument(text);
  const offset = text.length - body.length;
  const edits: { from: number; to: number; text: string }[] = [];
  for (const link of findWikiLinks(body)) {
    if (link.embed || link.label === null || !/^\d+$/.test(link.label)) continue;
    const number = numberOf(link.target);
    if (number === null || number !== Number(link.label)) continue;
    const fix = articleFix(body.slice(0, link.from), number);
    if (fix) edits.push({ from: offset + fix.from, to: offset + link.from, text: fix.text });
  }
  let out = text;
  for (const e of [...edits].reverse()) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return { text: out, count: edits.length };
}
