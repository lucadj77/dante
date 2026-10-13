import type { NumberStyle } from "./settings";

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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatNumber(n: number, style: NumberStyle, language = "en"): string {
  switch (style) {
    case "none":
      return "";
    case "roman":
      return toRoman(n);
    case "words":
      if (n < 1 || n > 999) return String(n);
      return capitalize(language.startsWith("it") ? italianWords(n) : englishWords(n));
    default:
      return String(n);
  }
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
