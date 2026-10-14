import { parseDocument } from "yaml";

export const SETTINGS_FILE = "dante.yaml";

export type NumberStyle = "arabic" | "roman" | "words" | "none";

export interface LevelSettings {
  /** Word shown before the number, such as "Chapter". */
  label: string;
  numbering: NumberStyle;
  /** Heading template with {label}, {number} and {title}. */
  pattern: string;
}

/** How a new part, chapter or scene is set apart from what comes before it. */
export type Separator = "pageBreak" | "blankLine" | "characters" | "none";

/** What a scene shows above its text in the exported book. */
export type SceneHeading = "none" | "title" | "number" | "numberAndTitle";

export interface TypographySettings {
  /** Straight quotes become «guillemets» or “curly quotes”, or stay as they are. */
  quotes: "keep" | "guillemets" | "curly";
  /** l'amico becomes l’amico. */
  apostrophes: boolean;
  /** ... becomes …, and E' becomes È. */
  ellipsis: boolean;
  /** Removes double spaces and spaces before punctuation. */
  spaces: boolean;
  /** Quotes, apostrophes and ellipses are also corrected while typing. */
  whileTyping: boolean;
}

/** Texts around the novel. Empty ones are left out. */
export interface ParatextSettings {
  dedication: string;
  epigraph: string;
  epigraphSource: string;
  authorNote: string;
  acknowledgements: string;
  colophon: string;
}

export interface DocxSettings {
  /** Standard manuscript for agents and publishers, or a typeset, readable book. */
  profile: "manuscript" | "typeset";
  font: string;
  /** Points. */
  fontSize: number;
  /** 1, 1.5 or 2. */
  lineSpacing: number;
  /** First-line indent of paragraphs, in centimetres. */
  indent: number;
  /** Characters between scenes, such as "* * *" or "#", when sceneBreak is "characters". */
  sceneSeparator: string;
  titlePage: boolean;
  /** Page header: author, title and page number, or the title in a typeset book. */
  header: boolean;
  partBreak: Separator;
  chapterBreak: Separator;
  sceneBreak: Separator;
  /** Number above the title on two lines, or the whole heading on one line. */
  headingLayout: "oneLine" | "twoLines";
  sceneHeadings: SceneHeading;
  sceneNumbering: NumberStyle;
  /** Scene numbers start again in each chapter. */
  sceneNumbersRestart: boolean;
  /** No scene heading in a chapter with a single scene. */
  omitSingleSceneHeading: boolean;
}

export interface NovelSettings {
  title: string;
  subtitle: string;
  author: string;
  /** Language of the novel (not of the interface), as a BCP 47 code. */
  language: string;
  folders: {
    codex: string;
    research: string;
    laboratory: string;
    manuscript: string;
    views: string;
    templates: string;
  };
  structure: {
    /** When true, the first level of folders in the manuscript are parts. */
    parts: boolean;
    part: LevelSettings;
    chapter: LevelSettings & {
      /** Restart chapter numbers at each part. */
      restartEachPart: boolean;
    };
  };
  export: {
    docx: DocxSettings;
    /** Applied to the exported text only; the files keep what was typed. */
    typography: TypographySettings;
    paratext: ParatextSettings;
  };
}

const LABELS: Record<string, { part: string; chapter: string }> = {
  en: { part: "Part", chapter: "Chapter" },
  it: { part: "Parte", chapter: "Capitolo" },
  es: { part: "Parte", chapter: "Capítulo" },
  fr: { part: "Partie", chapter: "Chapitre" },
};

export function defaultSettings(language = "en"): NovelSettings {
  const labels = LABELS[language.slice(0, 2)] ?? LABELS.en;
  return {
    title: "",
    subtitle: "",
    author: "",
    language,
    folders: {
      codex: "Codex",
      research: "Research",
      laboratory: "Laboratory",
      manuscript: "Manuscript",
      views: "Views",
      templates: "Templates",
    },
    structure: {
      parts: false,
      part: { label: labels.part, numbering: "roman", pattern: "{label} {number}: {title}" },
      chapter: {
        label: labels.chapter,
        numbering: "arabic",
        pattern: "{label} {number}: {title}",
        restartEachPart: false,
      },
    },
    export: {
      docx: {
        profile: "manuscript",
        font: "Times New Roman",
        fontSize: 12,
        lineSpacing: 2,
        indent: 1.27,
        sceneSeparator: "#",
        titlePage: true,
        header: true,
        partBreak: "pageBreak",
        chapterBreak: "pageBreak",
        sceneBreak: "characters",
        headingLayout: "oneLine",
        sceneHeadings: "none",
        sceneNumbering: "arabic",
        sceneNumbersRestart: true,
        omitSingleSceneHeading: true,
      },
      typography: {
        quotes: language.startsWith("it") || language.startsWith("fr") || language.startsWith("es") ? "guillemets" : "curly",
        apostrophes: true,
        ellipsis: true,
        spaces: true,
        whileTyping: true,
      },
      paratext: {
        dedication: "",
        epigraph: "",
        epigraphSource: "",
        authorNote: "",
        acknowledgements: "",
        colophon: "",
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fills what the file leaves out with defaults, recursively. */
function merge<T>(defaults: T, value: unknown): T {
  if (!isObject(defaults) || !isObject(value)) {
    return value === undefined || value === null || typeof value !== typeof defaults ? defaults : (value as T);
  }
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) out[key] = merge((defaults as Record<string, unknown>)[key], value[key]);
  return out as T;
}

export function parseSettings(text: string): NovelSettings {
  const doc = parseDocument(text);
  const raw = doc.errors.length === 0 ? doc.toJS() : {};
  const language = isObject(raw) && typeof raw.language === "string" ? raw.language : "en";
  const settings = merge(defaultSettings(language), raw);
  // Files written before chapterBreak existed said only whether chapters start a new page.
  const docx = isObject(raw) && isObject(raw.export) && isObject(raw.export.docx) ? raw.export.docx : {};
  if (docx.chapterBreak === undefined && docx.chapterNewPage === false) settings.export.docx.chapterBreak = "blankLine";
  return settings;
}

/** Writes settings back into the existing YAML text, keeping comments and unknown keys. */
export function serializeSettings(settings: NovelSettings, previous = ""): string {
  let doc = parseDocument(previous);
  if (doc.errors.length > 0 || !isObject(doc.toJS() ?? {})) doc = parseDocument("");
  const write = (path: string[], value: unknown) => {
    if (isObject(value)) {
      for (const [k, v] of Object.entries(value)) write([...path, k], v);
    } else {
      doc.setIn(path, value);
    }
  };
  write([], settings);
  return doc.toString({ lineWidth: 0 });
}
