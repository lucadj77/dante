// A few numbers about how the manuscript is written, for the Statistics section: sentences
// that run long, adverbs, how much of the text is dialogue, and the same word used again a
// few words later. They are estimates read from the words alone, to point at passages worth
// a second look, not rules.

import { STOPWORDS, type WordCount } from "./statistics";

export interface StyleScene {
  path: string;
  title: string;
  /** The text as read: no comments or Markdown, one paragraph per line. */
  text: string;
}

/**
 * Where a passage is in the scene, for the editor to select it: the `nth` time `word` appears
 * as a whole word (any case), through the `throughNth` use of `through` after it. Counted in
 * the text as read, so a word only in a comment can move the count.
 */
export interface Place {
  word: string;
  nth: number;
  through: string;
  throughNth: number;
  /** A whole sentence: its stop and closing quotes are selected too. */
  sentence?: boolean;
}

export interface LongSentence {
  path: string;
  title: string;
  words: number;
  /** The start of the sentence. */
  excerpt: string;
  place: Place;
}

export interface Repetition {
  path: string;
  title: string;
  word: string;
  /** Words between the two uses. */
  distance: number;
  /** The passage from the first use to the second. */
  excerpt: string;
  place: Place;
}

export interface StyleReport {
  words: number;
  sentences: number;
  /** Words per sentence. */
  average: number;
  /** Sentences longer than the limit, longest first. */
  long: LongSentence[];
  longCount: number;
  adverbs: WordCount[];
  adverbCount: number;
  /** Words spoken by the characters, between quotes or after a dialogue dash. */
  dialogue: number;
  /** The closest repetitions first. */
  repetitions: Repetition[];
  repetitionCount: number;
}

export interface StyleOptions {
  /** A sentence with more words than this is long. */
  longSentence?: number;
  /** A word used again within this many words is a repetition, unless at most one word lies between. */
  window?: number;
  /** How many examples of each kind to keep. */
  examples?: number;
}

const WORD = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const count = (text: string) => text.match(WORD)?.length ?? 0;

/** Sentences of a paragraph, with where each starts: up to a full stop, question or exclamation mark, or ellipsis. */
function sentences(paragraph: string): { text: string; at: number }[] {
  const out: { text: string; at: number }[] = [];
  for (const m of paragraph.matchAll(/[^.!?…]+(?:[.!?…]+["'»”’)\]]*|$)/g)) {
    const text = m[0].trim();
    if (count(text) > 0) out.push({ text, at: m.index! + m[0].length - m[0].trimStart().length });
  }
  return out;
}

// Letters, digits and "_" make a word for the editor's search, so "l’amico" holds the word "amico".
const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Where `word` stands as a whole word in `text`, in any case. */
export function wordPositions(text: string, word: string): number[] {
  const out: number[] = [];
  const hay = text.toLowerCase();
  const needle = word.toLowerCase();
  if (!needle || hay.length !== text.length) return out;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (WORD_CHAR.test(text[i - 1] ?? "") || WORD_CHAR.test(text[i + needle.length] ?? "")) continue;
    out.push(i);
  }
  return out;
}

/** The place of the passage from `start` (where `first` begins) to `end` (where `last` ends). */
function placeOf(text: string, first: string, start: number, last: string, end: number): Place {
  const firsts = wordPositions(text, first);
  const lasts = wordPositions(text, last);
  return {
    word: first,
    nth: Math.max(0, firsts.filter((p) => p < start).length),
    through: last,
    throughNth: Math.max(0, lasts.filter((p) => p >= start + first.length && p < end - last.length).length),
  };
}

// Adverbs by their ending, with the common words that end the same way and are not adverbs.
const ADVERBS: Record<string, { test: (word: string) => boolean; not: string }> = {
  it: { test: (w) => w.length >= 8 && w.endsWith("mente"), not: "clemente veemente semente fremente gemente dormente sedicente" },
  es: { test: (w) => w.length >= 8 && w.endsWith("mente"), not: "clemente demente simiente" },
  en: {
    test: (w) => w.length >= 5 && w.endsWith("ly"),
    not: "only family early reply apply supply holy ugly belly lily rely ally bully jelly silly hilly rally tally folly holly lovely lonely friendly likely unlikely curly oily deadly elderly costly lively chilly smelly butterfly assembly anomaly melancholy monopoly comply multiply imply july italy emily molly sally billy kelly firefly homely orderly",
  },
  fr: {
    test: (w) => w.length >= 7 && /[aeiouéèêiîûu]ment$/.test(w),
    not: "gouvernement appartement comportement sentiment jugement mouvement événement evenement logement changement commencement bâtiment monument argument élément document instrument traitement département enseignement développement paiement parlement règlement tourment ornement vêtement aliment ciment segment fragment testament supplément complément serment",
  },
};

/** The words of a dialogue in a paragraph: between quotes, or after a dialogue dash. */
function spoken(paragraph: string): number {
  const line = paragraph.trim();
  // "— Come, — said Renzo, — it is late.": the dashes take turns between speech and narration.
  if (/^[—–]/.test(line) || /^-\s/.test(line)) {
    return line
      .split(/^[—–-]\s?|\s[—–]\s?/)
      .reduce((n, segment, i) => n + (i % 2 === 1 ? count(segment) : 0), 0);
  }
  let n = 0;
  for (const m of line.matchAll(/«([^»]*)»|“([^”]*)”|"([^"]*)"/g)) n += count(m[1] ?? m[2] ?? m[3] ?? "");
  return n;
}

/** How the text reads, from its sentences, adverbs, dialogue and repeated words. */
export function styleReport(scenes: StyleScene[], language: string, options: StyleOptions = {}): StyleReport {
  const limit = options.longSentence ?? 40;
  const window = options.window ?? 30;
  const examples = options.examples ?? 20;
  const lang = language.slice(0, 2);
  const stop = new Set((STOPWORDS[lang] ?? STOPWORDS.en).split(" "));
  const adverb = ADVERBS[lang] ?? ADVERBS.en;
  const notAdverb = new Set(adverb.not.split(" "));

  let words = 0;
  let sentenceCount = 0;
  let dialogue = 0;
  const long: LongSentence[] = [];
  const adverbs = new Map<string, number>();
  const repetitions: Repetition[] = [];

  for (const scene of scenes) {
    let offset = 0;
    for (const paragraph of scene.text.split("\n")) {
      const at = offset;
      offset += paragraph.length + 1;
      if (!paragraph.trim()) continue;
      dialogue += spoken(paragraph);
      for (const { text: sentence, at: from } of sentences(paragraph)) {
        const n = count(sentence);
        sentenceCount++;
        if (n <= limit) continue;
        const words = [...sentence.matchAll(WORD)];
        const first = words[0];
        const last = words[words.length - 1];
        const start = at + from + first.index!;
        const place = { ...placeOf(scene.text, first[0], start, last[0], at + from + last.index! + last[0].length), sentence: true };
        long.push({ path: scene.path, title: scene.title, words: n, excerpt: sentence.length > 140 ? sentence.slice(0, 140) + "…" : sentence, place });
      }
    }
    // Repetitions run across the paragraphs of a scene, as the reader meets them.
    const tokens = [...scene.text.matchAll(WORD)];
    words += tokens.length;
    const last = new Map<string, number>();
    tokens.forEach((match, i) => {
      // Elided articles and prepositions: "l’amico" is "amico".
      const word = match[0].toLocaleLowerCase(language).replace(/^\p{L}{1,3}['’]/u, "");
      if (adverb.test(word) && !notAdverb.has(word)) adverbs.set(word, (adverbs.get(word) ?? 0) + 1);
      if ([...word].length < 4 || stop.has(word) || /^\p{N}+$/u.test(word)) return;
      const before = last.get(word);
      last.set(word, i);
      // A word said twice in a row ("zitto, zitto") or around one word ("sempre e sempre", "mano in mano") is usually meant.
      if (before === undefined || i - before > window || i - before <= 2) return;
      const start = tokens[before].index!;
      const end = match.index! + match[0].length;
      // The word itself, without the elided article: where "l’amico" has "amico".
      const used = (m: RegExpMatchArray) => m.index! + m[0].length - word.length;
      const place = placeOf(scene.text, word, used(tokens[before]), word, end);
      repetitions.push({ path: scene.path, title: scene.title, word, distance: i - before - 1, excerpt: scene.text.slice(start, end).replace(/\s+/g, " "), place });
    });
  }

  return {
    words,
    sentences: sentenceCount,
    average: sentenceCount ? words / sentenceCount : 0,
    long: long.sort((a, b) => b.words - a.words).slice(0, examples),
    longCount: long.length,
    adverbs: [...adverbs]
      .map(([word, n]) => ({ word, count: n }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, examples),
    adverbCount: [...adverbs.values()].reduce((a, b) => a + b, 0),
    dialogue,
    repetitions: [...repetitions].sort((a, b) => a.distance - b.distance).slice(0, examples),
    repetitionCount: repetitions.length,
  };
}
