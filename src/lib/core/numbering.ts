import type { LevelSettings, NumberStyle } from "./settings";

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  let out = "";
  for (const [value, symbol] of ROMAN) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

const EN_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function englishWords(n: number): string {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? "-" + EN_ONES[n % 10] : "");
  const rest = n % 100;
  return EN_ONES[Math.floor(n / 100)] + " hundred" + (rest ? " " + englishWords(rest) : "");
}

const IT_ONES = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci",
  "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const IT_TENS = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];

function italianWords(n: number): string {
  if (n < 20) return IT_ONES[n];
  if (n < 100) {
    const unit = n % 10;
    let tens = IT_TENS[Math.floor(n / 10)];
    // "ventuno", "trentotto": the vowel drops before "uno" and "otto".
    if (unit === 1 || unit === 8) tens = tens.slice(0, -1);
    const word = tens + (unit ? IT_ONES[unit] : "");
    return unit === 3 ? word.replace(/tre$/, "tré") : word;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? "cento" : IT_ONES[hundreds] + "cento";
  if (!rest) return head;
  const tail = rest === 3 ? "tré" : italianWords(rest);
  // "centotto", "centottanta": the final vowel of "cento" drops before "otto".
  return (tail.startsWith("o") ? head.slice(0, -1) : head) + tail;
}

const EN_ORDINALS: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth",
};

function englishOrdinal(n: number): string {
  const words = englishWords(n);
  const last = words.split(/[ -]/).pop()!;
  const ordinal = EN_ORDINALS[last] ?? (last.endsWith("y") ? last.slice(0, -1) + "ieth" : last + "th");
  return words.slice(0, words.length - last.length) + ordinal;
}

const IT_ORDINALS = ["", "primo", "secondo", "terzo", "quarto", "quinto", "sesto", "settimo", "ottavo", "nono", "decimo"];

function italianOrdinal(n: number, feminine: boolean): string {
  let word: string;
  if (n <= 10) {
    word = IT_ORDINALS[n];
  } else {
    const cardinal = italianWords(n);
    // "ventitreesimo", "trentaseiesimo": the cardinal loses its last vowel, except "tré" and "sei".
    if (cardinal.endsWith("tré")) word = cardinal.slice(0, -1) + "eesimo";
    else if (cardinal.endsWith("sei")) word = cardinal + "esimo";
    else word = cardinal.slice(0, -1) + "esimo";
  }
  return feminine ? word.slice(0, -1) + "a" : word;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A number in the given style. Words are lowercase, except in English where they are
 * capitalized as in "Chapter One"; headings capitalize their first letter themselves.
 * `feminine` gives "prima" instead of "primo", as in "Parte prima".
 */
export function formatNumber(n: number, style: NumberStyle, language = "en", feminine = false): string {
  const english = !language.startsWith("it");
  switch (style) {
    case "none":
      return "";
    case "roman":
      return toRoman(n);
    case "words":
      if (n < 1 || n > 999) return String(n);
      return english ? capitalize(englishWords(n)) : italianWords(n);
    case "ordinal":
      if (n < 1 || n > 999) return String(n);
      return english ? capitalize(englishOrdinal(n)) : italianOrdinal(n, feminine);
    default:
      return String(n);
  }
}

export interface LevelHeading {
  /** The whole heading; a line break separates number and title when chosen. */
  text: string;
  /** Label and number, such as "Chapter 3"; empty when not numbered. */
  number: string;
  /** Empty when the level shows no title. */
  title: string;
}

/** Builds a heading from a level's choices: number style, label, title and separator. */
export function levelHeading(level: LevelSettings, n: number, title: string, language = "en", feminine = false): LevelHeading {
  const digits = formatNumber(n, level.numbering, language, feminine);
  const number = digits === "" ? "" : capitalize(level.showLabel && level.label.trim() ? `${level.label.trim()} ${digits}` : digits);
  // A title that only repeats the number, as "Chapter 3" brought in from Word, is not shown twice.
  const repeats = title.trim().toLowerCase() === number.toLowerCase();
  const shownTitle = level.showTitle && !(number && repeats) ? title : "";
  const text = number && shownTitle ? number + level.separator + shownTitle : number || shownTitle;
  return { text: capitalize(text), number, title: shownTitle };
}

/**
 * Fills a heading template. Separators left dangling by an empty placeholder are
 * removed, so "{label} {number}: {title}" with no title gives "Chapter 3".
 */
export function formatHeading(pattern: string, values: { label: string; number: string; title: string }): string {
  let out = pattern;
  for (const key of ["label", "number", "title"] as const) {
    if (values[key] === "") {
      out = out.replace(new RegExp(`\\s*[:.\\-–—]?\\s*\\{${key}\\}`), "");
    }
    out = out.replaceAll(`{${key}}`, values[key]);
  }
  return out.replace(/^[\s:.\-–—]+|[\s:.\-–—]+$/g, "").replace(/\s+/g, " ");
}
