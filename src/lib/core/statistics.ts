import { cleanSource } from "./export/book";
import { folderNotePath, GOAL, headings, type ManuscriptNode } from "./manuscript";
import { noteTitle, noteType, type NoteIndex, type NoteInfo } from "./notes";
import { isWithin } from "./path";
import { isWritingDay } from "./sessions";
import { projectStatus, type NovelSettings, type PageUnit } from "./settings";
import { plainText, textStats } from "./stats";
import { propertyDef as propertyDefOf } from "./properties";

// Numbers about the manuscript for the Statistics section: length, chapters, the notes
// of the Story Bible mentioned in the scenes, the most used words, and goals.

/** Pages of the text, by the page size in the settings (characters with spaces, or words). */
export function pageCount(text: { words: number; characters: number }, pages: NovelSettings["pages"]): number {
  return (pages.unit === "words" ? text.words : text.characters) / Math.max(1, pages.size);
}

export interface SceneStats {
  path: string;
  title: string;
  /** Path of the chapter (or prologue, epilogue) holding the scene; "" outside any. */
  chapter: string;
  /** Path of the part holding the scene; "" outside any. */
  part: string;
  words: number;
  characters: number;
  /** The text as read: no comments, revisions accepted, no Markdown. */
  text: string;
}

export interface ChapterStats {
  path: string;
  title: string;
  /** Path of the part holding the chapter; "" outside any. */
  part: string;
  scenes: number;
  words: number;
  characters: number;
}

export interface PartStats {
  /** "" for what lies outside the parts, such as a prologue: one last row for all of it. */
  path: string;
  title: string;
  chapters: number;
  scenes: number;
  words: number;
  characters: number;
}

export interface ManuscriptStats {
  scenes: SceneStats[];
  chapters: ChapterStats[];
  /** The parts in reading order, then a row for anything outside them; empty without parts. */
  parts: PartStats[];
  words: number;
  characters: number;
  charactersNoSpaces: number;
}

export function manuscriptStats(manuscript: ManuscriptNode, index: NoteIndex, settings: NovelSettings): ManuscriptStats {
  const titles = headings(manuscript, settings);
  const scenes: SceneStats[] = [];
  const chapters: ChapterStats[] = [];
  const parts: PartStats[] = [];
  // Prologues, epilogues, chapters and scenes outside the parts share one row.
  const outside: PartStats = { path: "", title: "", chapters: 0, scenes: 0, words: 0, characters: 0 };
  const label = (node: ManuscriptNode) => (titles.get(node.path) ?? node.title).replace(/\n/g, " · ");
  let characters = 0;
  let charactersNoSpaces = 0;
  const visit = (node: ManuscriptNode, part: PartStats | null, chapter: ChapterStats | null) => {
    for (const child of node.children) {
      if (child.kind === "scene") {
        const body = index.notes.get(child.path)?.body ?? "";
        const clean = cleanSource(body);
        const stats = textStats(clean);
        scenes.push({ path: child.path, title: child.title, chapter: chapter?.path ?? "", part: part?.path ?? "", words: stats.words, characters: stats.characters, text: plainText(clean) });
        characters += stats.characters;
        charactersNoSpaces += stats.charactersNoSpaces;
        for (const total of [chapter, part ?? outside]) {
          if (!total) continue;
          total.scenes++;
          total.words += stats.words;
          total.characters += stats.characters;
        }
      } else if (child.kind === "part") {
        const own: PartStats = { path: child.path, title: label(child), chapters: 0, scenes: 0, words: 0, characters: 0 };
        parts.push(own);
        visit(child, own, null);
      } else if (chapter) {
        // Folders inside a chapter count towards it.
        visit(child, part, chapter);
      } else {
        const own: ChapterStats = { path: child.path, title: label(child), part: part?.path ?? "", scenes: 0, words: 0, characters: 0 };
        chapters.push(own);
        (part ?? outside).chapters++;
        visit(child, part, own);
      }
    }
  };
  visit(manuscript, null, null);
  const withOutside = parts.length && outside.scenes + outside.chapters > 0 ? [...parts, outside] : parts;
  return { scenes, chapters, parts: withOutside, words: scenes.reduce((n, s) => n + s.words, 0), characters, charactersNoSpaces };
}

export type LengthUnit = "words" | "characters";
export type LengthLevel = "scene" | "chapter" | "part";

export interface LengthRow {
  path: string;
  title: string;
  /** Chapter or part holding a scene, part holding a chapter; "" when none. */
  within: string;
  /** Scenes in a chapter or part; 0 for a scene. */
  scenes: number;
  /** Words, or characters with spaces. */
  length: number;
  /** Share of the whole manuscript, 0 to 1. */
  share: number;
}

export interface LengthAnalysis {
  rows: LengthRow[];
  total: number;
  average: number;
  median: number;
  shortest: LengthRow | null;
  longest: LengthRow | null;
}

/** Length of each scene, chapter or part, in words or in characters with spaces. */
export function lengthAnalysis(stats: ManuscriptStats, level: LengthLevel, unit: LengthUnit): LengthAnalysis {
  const of = (x: { words: number; characters: number }) => (unit === "words" ? x.words : x.characters);
  const total = unit === "words" ? stats.words : stats.characters;
  const name = new Map<string, string>([...stats.chapters, ...stats.parts].map((x) => [x.path, x.title]));
  const items =
    level === "scene"
      ? stats.scenes.map((s) => ({ path: s.path, title: s.title, within: name.get(s.chapter || s.part) ?? "", scenes: 0, length: of(s) }))
      : level === "chapter"
        ? stats.chapters.map((c) => ({ path: c.path, title: c.title, within: name.get(c.part) ?? "", scenes: c.scenes, length: of(c) }))
        : stats.parts.map((p) => ({ path: p.path, title: p.title, within: "", scenes: p.scenes, length: of(p) }));
  const rows = items.map((x) => ({ ...x, share: total > 0 ? x.length / total : 0 }));
  // The row outside the parts is not a part: it stays out of the averages.
  const measured = rows.filter((r) => r.path !== "");
  const sorted = [...measured].sort((a, b) => a.length - b.length);
  const mid = sorted.length >> 1;
  return {
    rows,
    total,
    average: measured.length ? measured.reduce((n, r) => n + r.length, 0) / measured.length : 0,
    median: !sorted.length ? 0 : sorted.length % 2 ? sorted[mid].length : (sorted[mid - 1].length + sorted[mid].length) / 2,
    shortest: sorted[0] ?? null,
    longest: sorted[sorted.length - 1] ?? null,
  };
}

/** Words too common to tell anything about a style, by language. */
export const STOPWORDS: Record<string, string> = {
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

/** The notes of the Story Bible (any typed note outside the manuscript and the templates). */
function bible(index: NoteIndex, settings: NovelSettings): { note: NoteInfo; type: string; title: string; pattern: RegExp }[] {
  const out: { note: NoteInfo; type: string; title: string; pattern: RegExp }[] = [];
  for (const note of index.notes.values()) {
    if (isWithin(note.path, settings.folders.manuscript) || isWithin(note.path, settings.folders.templates)) continue;
    const type = noteType(note.path, note.properties, settings);
    if (!type) continue;
    const title = noteTitle(note.path);
    const names = [...new Set([title, ...note.aliases])].filter((n) => n.trim()).sort((a, b) => b.length - a.length);
    // Whole words, as written: "Marta" is not found in "Martina", and a place called
    // "Casa" is not every "casa" in the text.
    // The character before is matched rather than looked behind, which macOS 10.15 does not know.
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${names.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu");
    out.push({ note, type, title, pattern });
  }
  return out;
}

/** Notes of the Story Bible (any typed note) and how often the scenes name them. */
export function mentions(stats: ManuscriptStats, index: NoteIndex, settings: NovelSettings): Mention[] {
  const out: Mention[] = [];
  for (const { note, type, title, pattern } of bible(index, settings)) {
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

export interface SceneSheet {
  path: string;
  title: string;
  type: string;
}

/**
 * The Story Bible notes a scene names (by name or alias, as the mentions do) or links to,
 * in the order the text first names them; notes only linked, as from a property, come last.
 */
export function sceneSheets(text: string, linked: string[], index: NoteIndex, settings: NovelSettings): SceneSheet[] {
  const found: (SceneSheet & { at: number })[] = [];
  for (const { note, type, title, pattern } of bible(index, settings)) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    // The name starts after the character matched before it.
    const at = match ? match.index + match[1].length : linked.includes(note.path) ? Infinity : -1;
    if (at >= 0) found.push({ path: note.path, title, type, at });
  }
  return found.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title)).map(({ path, title, type }) => ({ path, title, type }));
}

export interface GoalProgress {
  /** 0 to 1. */
  share: number;
  remaining: number;
  /** Whole days left until the deadline, today included; null without a deadline. */
  daysLeft: number | null;
  /** Writing days among them (all of them when no days are chosen). */
  writingDaysLeft: number | null;
  /** Words a writing day needed to finish on time; null without a deadline or once finished. */
  perDay: number | null;
}

export function goalProgress(words: number, goal: number, deadline: string, today = new Date(), days: number[] = []): GoalProgress {
  const remaining = Math.max(0, goal - words);
  let daysLeft: number | null = null;
  let writingDaysLeft: number | null = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
  if (m) {
    const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    daysLeft = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    writingDaysLeft = 0;
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) if (isWritingDay(day, days)) writingDaysLeft++;
  }
  return {
    share: goal > 0 ? Math.min(1, words / goal) : 0,
    remaining,
    daysLeft,
    writingDaysLeft,
    perDay: writingDaysLeft !== null && remaining > 0 ? Math.ceil(remaining / Math.max(1, writingDaysLeft)) : null,
  };
}

/** What the manuscript tree shows beside an item: its length, its goal and the coloured dot of a scene. */
export interface TreeMark {
  /** In the project's unit, words or characters. */
  words: number;
  /** Words (or characters) to reach; 0 without a goal. */
  goal: number;
  /** The value of the property the dot shows (the stage of work, unless chosen otherwise), as read; "" when none. */
  status: string;
  /** Where the stage stands among the project's stages, 0 (first) to 3 (last); null when it is not one of them, or the dot shows another property. */
  tone: number | null;
  /** The colour of a value of another property, 0 to 7, the same for the same value; null for the stage of work. */
  hue?: number | null;
  /** The property the dot shows. */
  property?: string;
  /** A colour the writer chose for this value, as #rrggbb, in place of the usual one. */
  color?: string;
}

/** How many colours the dots have for a property other than the stage of work. */
export const DOT_HUES = 8;

/** The dots' usual colours for a property other than the stage of work, as the tree draws them. */
export const DOT_COLORS = ["#d9534f", "#e8913a", "#c7a923", "#4ea65a", "#2fa3a3", "#4a7fd6", "#8c63d6", "#d064a6"];

/** One value of the dot's property, as the legend of colours lists it. */
export interface DotValue {
  value: string;
  /** Its usual colour: a hue (0 to 7) for another property, a tone (0 to 3) for the stage of work. */
  hue: number | null;
  tone: number | null;
  /** The colour chosen for it, as #rrggbb; "" for the usual one. */
  color: string;
}

/** The property the tree's dot shows, and whether it is the stage of work. */
export function dotProperty(settings: NovelSettings): { name: string; isStatus: boolean } {
  const status = projectStatus(settings);
  const name = settings.tree?.dot?.trim() || status.name;
  return { name, isStatus: name.toLowerCase() === status.name.toLowerCase() };
}

/** The colour chosen for a value of the dot's property; "" for the usual one. */
export function chosenColor(settings: NovelSettings, property: string, value: string): string {
  const colors = settings.tree?.colors ?? {};
  const own = colors[property] ?? Object.entries(colors).find(([k]) => k.toLowerCase() === property.toLowerCase())?.[1];
  return own?.[value.trim().toLowerCase()] ?? "";
}

/**
 * Every value of the dot's property with its colour: the allowed values first, then those
 * the scenes hold, in reading order, as the tree gives them colours.
 */
export function dotLegend(manuscript: ManuscriptNode, marks: Map<string, TreeMark>, settings: NovelSettings): DotValue[] {
  const { name, isStatus } = dotProperty(settings);
  const status = projectStatus(settings);
  const out: DotValue[] = [];
  const seen = new Set<string>();
  const push = (value: string, hue: number | null) => {
    if (!value || seen.has(value.toLowerCase())) return;
    seen.add(value.toLowerCase());
    out.push({ value, hue: isStatus ? null : hue, tone: isStatus ? statusTone(value, status.values) : null, color: chosenColor(settings, name, value) });
  };
  const defined = isStatus ? status.values : (propertyDefOf(settings.properties, name)?.values ?? []);
  defined.forEach((v, i) => push(v, i % DOT_HUES));
  const visit = (node: ManuscriptNode) => {
    if (node.kind === "scene") {
      const mark = marks.get(node.path);
      // A list shows its values together: the legend lists the value as the tree reads it.
      if (mark?.status) push(mark.status, mark.hue ?? null);
    } else node.children.forEach(visit);
  };
  visit(manuscript);
  return out;
}

/** A property value as the tree's tooltip reads it: "[[Renzo|R.]]" is "R.", a list is "a, b". */
export function dotValue(value: unknown): string {
  const one = (v: unknown): string => {
    if (v === null || v === undefined || typeof v === "object") return "";
    const text = String(v).trim();
    const link = /^\[\[([^\]|]*)(?:\|([^\]]*))?\]\]$/.exec(text);
    if (!link) return text;
    return (link[2] ?? link[1].split("#")[0].split("/").pop() ?? "").trim();
  };
  return Array.isArray(value) ? value.map(one).filter(Boolean).join(", ") : one(value);
}

/** The words (or characters, in the project's unit) a scene or folder note should reach, from its `goal` property. */
export function goalOf(properties: Record<string, unknown>): number {
  const value = Number(properties[GOAL]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** Where a stage stands among the stages, from 0 to 3, so the first and last always look the same. */
export function statusTone(value: string, values: string[]): number | null {
  const i = values.findIndex((v) => v.toLowerCase() === value.trim().toLowerCase());
  if (i < 0) return null;
  return values.length > 1 ? Math.round((i / (values.length - 1)) * 3) : 3;
}

/**
 * Length, goal and stage of every scene, chapter and part. `words` gives the length of a
 * scene's text in the project's unit, from the text the editor may hold newer than the index.
 */
export function treeMarks(manuscript: ManuscriptNode, index: NoteIndex, settings: NovelSettings, words: (path: string, body: string) => number): Map<string, TreeMark> {
  const status = projectStatus(settings);
  // The dot shows the stage of work, or the property chosen in the settings (as the point of view).
  const chosen = settings.tree?.dot?.trim() ?? "";
  const property = chosen || status.name;
  const isStatus = property.toLowerCase() === status.name.toLowerCase();
  // Another property's values take colours in the order of its allowed values, then in reading order.
  const hues = new Map<string, number>();
  for (const v of settings.properties[property]?.values ?? []) if (!hues.has(v.toLowerCase())) hues.set(v.toLowerCase(), hues.size);
  const out = new Map<string, TreeMark>();
  const visit = (node: ManuscriptNode): number => {
    if (node.kind === "scene") {
      const note = index.notes.get(node.path);
      const properties = note?.properties ?? {};
      const key = Object.keys(properties).find((k) => k === property) ?? Object.keys(properties).find((k) => k.toLowerCase() === property.toLowerCase());
      const value = key ? dotValue(properties[key]) : "";
      const n = words(node.path, note?.body ?? "");
      const mark: TreeMark = { words: n, goal: goalOf(properties), status: value, tone: isStatus && value ? statusTone(value, status.values) : null };
      if (!isStatus) {
        let hue: number | null = null;
        if (value) {
          if (!hues.has(value.toLowerCase())) hues.set(value.toLowerCase(), hues.size);
          hue = hues.get(value.toLowerCase())! % DOT_HUES;
        }
        mark.hue = hue;
        mark.property = property;
      }
      const color = value ? chosenColor(settings, property, value) : "";
      if (color) mark.color = color;
      out.set(node.path, mark);
      return n;
    }
    const n = node.children.reduce((sum, child) => sum + visit(child), 0);
    if (node.kind !== "manuscript") {
      const note = index.notes.get(node.notePath ?? folderNotePath(node.path));
      out.set(node.path, { words: n, goal: goalOf(note?.properties ?? {}), status: "", tone: null });
    }
    return n;
  };
  visit(manuscript);
  return out;
}

/**
 * How long a scene is as the statistics count it (revisions accepted, no comments), in
 * words or in characters with spaces included.
 */
export function sceneSize(body: string, unit: PageUnit = "words"): number {
  const stats = textStats(cleanSource(body));
  return unit === "characters" ? stats.characters : stats.words;
}
