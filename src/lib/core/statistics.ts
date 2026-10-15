import { cleanSource } from "./export/book";
import { headings, type ManuscriptNode } from "./manuscript";
import { noteTitle, noteType, type NoteIndex } from "./notes";
import { isWithin } from "./path";
import type { NovelSettings } from "./settings";
import { plainText, textStats } from "./stats";

// Numbers about the manuscript for the Statistics section: length, chapters, the notes
// of the Story Bible mentioned in the scenes, the most used words, and goals.

/** Characters in a standard page ("cartella editoriale"). */
export const PAGE_CHARACTERS = 1800;

export interface SceneStats {
  path: string;
  title: string;
  /** Path of the chapter (or prologue, epilogue) holding the scene; "" outside any. */
  chapter: string;
  words: number;
  characters: number;
  /** The text as read: no comments, revisions accepted, no Markdown. */
  text: string;
}

export interface ChapterStats {
  path: string;
  title: string;
  scenes: number;
  words: number;
  characters: number;
}

export interface ManuscriptStats {
  scenes: SceneStats[];
  chapters: ChapterStats[];
  words: number;
  characters: number;
  charactersNoSpaces: number;
}

export function manuscriptStats(manuscript: ManuscriptNode, index: NoteIndex, settings: NovelSettings): ManuscriptStats {
  const titles = headings(manuscript, settings);
  const scenes: SceneStats[] = [];
  const chapters: ChapterStats[] = [];
  let characters = 0;
  let charactersNoSpaces = 0;
  const visit = (node: ManuscriptNode, chapter: ChapterStats | null) => {
    for (const child of node.children) {
      if (child.kind === "scene") {
        const body = index.notes.get(child.path)?.body ?? "";
        const clean = cleanSource(body);
        const stats = textStats(clean);
        scenes.push({ path: child.path, title: child.title, chapter: chapter?.path ?? "", words: stats.words, characters: stats.characters, text: plainText(clean) });
        characters += stats.characters;
        charactersNoSpaces += stats.charactersNoSpaces;
        if (chapter) {
          chapter.scenes++;
          chapter.words += stats.words;
          chapter.characters += stats.characters;
        }
      } else if (child.kind === "part") {
        visit(child, null);
      } else {
        // Folders inside a chapter count towards it.
        const own = chapter ?? { path: child.path, title: (titles.get(child.path) ?? child.title).replace(/\n/g, " · "), scenes: 0, words: 0, characters: 0 };
        if (!chapter) chapters.push(own);
        visit(child, own);
      }
    }
  };
  visit(manuscript, null);
  return { scenes, chapters, words: scenes.reduce((n, s) => n + s.words, 0), characters, charactersNoSpaces };
}

/** Words too common to tell anything about a style, by language. */
const STOPWORDS: Record<string, string> = {
  en: "the a an and or but if of to in on at by for with from as is was were be been being are am it its this that these those he she they we you i me him her them us my your his their our not no so than then there here what which who whom when where why how all any some can could would should will shall may might must do does did have has had just into out up down over about after before more most also only very said one two",
  it: "il lo la i gli le un uno una e ed o ma se di a da in con su per tra fra del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col che chi cui non come più anche ancora già poi quando dove perché mentre così sono sei è siamo siete era erano fu stato stata essere ho hai ha abbiamo avete hanno aveva avevano avere mi ti si ci vi lui lei loro noi voi io tu me te sé suo sua suoi sue mio mia miei mie tuo tua nostro vostro questo questa questi queste quello quella quelli quelle tutto tutta tutti tutte niente nulla qualcosa ne lì là qui qua no sì solo poco molto tanto troppo fare fatto disse dice",
  es: "el la los las un una unos unas y o pero si de a en con por para del al que no se lo le les su sus es era fue ser ha había como más ya muy también me te nos os mi tu yo él ella ellos ellas este esta ese esa todo nada",
  fr: "le la les un une des et ou mais si de à en dans avec par pour du au aux que qui ne pas se ce cette ces il elle ils elles on je tu nous vous me te lui leur son sa ses mon ma mes est était fut être a avait avoir comme plus très aussi tout rien",
};

export interface WordCount {
  word: string;
  count: number;
}

/** The most frequent words of three letters or more, leaving out the commonest ones. */
export function frequentWords(texts: string[], language: string, limit = 30): WordCount[] {
  const stop = new Set((STOPWORDS[language.slice(0, 2)] ?? STOPWORDS.en).split(" "));
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const match of text.toLocaleLowerCase(language).matchAll(/[\p{L}]+(?:['’][\p{L}]+)*/gu)) {
      // Elided articles and prepositions: "l’amico" counts as "amico".
      const word = match[0].replace(/^\p{L}{1,3}['’]/u, "");
      if ([...word].length < 3 || stop.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

export interface Mention {
  path: string;
  title: string;
  type: string;
  /** Times the note's name or aliases appear in the scenes. */
  count: number;
  /** Scenes where it appears, in reading order. */
  scenes: string[];
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Notes of the Story Bible (any typed note) and how often the scenes name them. */
export function mentions(stats: ManuscriptStats, index: NoteIndex, settings: NovelSettings): Mention[] {
  const out: Mention[] = [];
  for (const note of index.notes.values()) {
    if (isWithin(note.path, settings.folders.manuscript) || isWithin(note.path, settings.folders.templates)) continue;
    const type = noteType(note.path, note.properties, settings);
    if (!type) continue;
    const title = noteTitle(note.path);
    const names = [...new Set([title, ...note.aliases])].filter((n) => n.trim()).sort((a, b) => b.length - a.length);
    // Whole words, as written: "Marta" is not found in "Martina", and a place called
    // "Casa" is not every "casa" in the text.
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu");
    const mention: Mention = { path: note.path, title, type, count: 0, scenes: [] };
    for (const scene of stats.scenes) {
      const found = scene.text.match(pattern)?.length ?? 0;
      if (!found) continue;
      mention.count += found;
      mention.scenes.push(scene.path);
    }
    out.push(mention);
  }
  return out.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

export interface GoalProgress {
  /** 0 to 1. */
  share: number;
  remaining: number;
  /** Whole days left until the deadline, today included; null without a deadline. */
  daysLeft: number | null;
  /** Words a day needed to finish on time; null without a deadline or once finished. */
  perDay: number | null;
}

export function goalProgress(words: number, goal: number, deadline: string, today = new Date()): GoalProgress {
  const remaining = Math.max(0, goal - words);
  let daysLeft: number | null = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
  if (m) {
    const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    daysLeft = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }
  return {
    share: goal > 0 ? Math.min(1, words / goal) : 0,
    remaining,
    daysLeft,
    perDay: daysLeft !== null && remaining > 0 ? Math.ceil(remaining / Math.max(1, daysLeft)) : null,
  };
}
