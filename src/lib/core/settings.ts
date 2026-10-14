import { parseDocument } from "yaml";

export const SETTINGS_FILE = "dante.yaml";

export type NumberStyle = "arabic" | "roman" | "words" | "ordinal" | "none";

/** How the headings of a level (parts, chapters, scenes) are written. */
export interface LevelSettings {
  numbering: NumberStyle;
  /** Shows the label before the number, as in "Chapter 3". */
  showLabel: boolean;
  /** Word shown before the number, such as "Chapter". */
  label: string;
  showTitle: boolean;
  /** Text between number and title, such as ": " or ". "; "\n" puts the title on its own line. */
  separator: string;
}

/** How a new part, chapter or scene is set apart from what comes before it. */
export type Separator = "pageBreak" | "blankLine" | "characters" | "none";

export interface TypographySettings {
  /**
   * How dialogue is marked: «guillemets», “curly quotes”, or a dash opening each line of
   * dialogue as some Italian publishers do (— Vieni — disse). Straight quotes become the
   * chosen marks; with "dash", guillemets and straight quotes become dashes, while
   * “curly quotes” stay as quotation marks inside dialogue.
   */
  quotes: "keep" | "guillemets" | "curly" | "dash";
  /** Dash used for dialogue when quotes is "dash": em dash (—) or en dash (–). */
  dialogueDash: "em" | "en";
  /** Keeps a comma before the dash that closes a line: — Vieni, — disse. Otherwise — Vieni — disse. */
  dialogueComma: boolean;
  /** l'amico becomes l’amico. */
  apostrophes: boolean;
  /** ... becomes …, and E' becomes È. */
  ellipsis: boolean;
  /** Removes double spaces and spaces before punctuation. */
  spaces: boolean;
  /**
   * Dashes that set off an aside: "parola – inciso – parola" (en dash with spaces),
   * "parola — inciso — parola" (em dash with spaces), "word—aside—word" (em dash, closed).
   */
  dashes: "keep" | "enSpaced" | "emSpaced" | "emClosed";
  /** Number ranges such as 1990-2000: hyphen, or en dash as in 1990–2000. */
  ranges: "keep" | "enDash";
  /** Quotes, apostrophes, ellipses and dashes are also corrected while typing. */
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
  /** Headings of scenes in the exported book; none by default. */
  scene: LevelSettings;
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

const LABELS: Record<string, { part: string; chapter: string; scene: string }> = {
  en: { part: "Part", chapter: "Chapter", scene: "Scene" },
  it: { part: "Parte", chapter: "Capitolo", scene: "Scena" },
  es: { part: "Parte", chapter: "Capítulo", scene: "Escena" },
  fr: { part: "Partie", chapter: "Chapitre", scene: "Scène" },
};

/** Folder names of a new project, in the language of the novel. */
const FOLDERS: Record<string, NovelSettings["folders"]> = {
  en: { codex: "Codex", research: "Research", laboratory: "Laboratory", manuscript: "Manuscript", views: "Views", templates: "Templates" },
  it: { codex: "Codex", research: "Ricerca", laboratory: "Laboratorio", manuscript: "Manoscritto", views: "Viste", templates: "Modelli" },
  es: { codex: "Códex", research: "Investigación", laboratory: "Laboratorio", manuscript: "Manuscrito", views: "Vistas", templates: "Plantillas" },
  fr: { codex: "Codex", research: "Recherche", laboratory: "Laboratoire", manuscript: "Manuscrit", views: "Vues", templates: "Modèles" },
};

export function defaultFolders(language: string): NovelSettings["folders"] {
  return { ...(FOLDERS[language.slice(0, 2)] ?? FOLDERS.en) };
}

/** Folder names in English, the app's base language, for projects that already use them. */
export const ENGLISH_FOLDERS = FOLDERS.en;

export function defaultSettings(language = "en"): NovelSettings {
  const labels = LABELS[language.slice(0, 2)] ?? LABELS.en;
  return {
    title: "",
    subtitle: "",
    author: "",
    language,
    folders: defaultFolders(language),
    structure: {
      parts: false,
      part: { numbering: "roman", showLabel: true, label: labels.part, showTitle: true, separator: ": " },
      chapter: {
        numbering: "arabic",
        showLabel: true,
        label: labels.chapter,
        showTitle: true,
        separator: ": ",
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
        scene: { numbering: "none", showLabel: false, label: labels.scene, showTitle: false, separator: ". " },
        sceneNumbersRestart: true,
        omitSingleSceneHeading: true,
      },
      typography: {
        quotes: language.startsWith("it") || language.startsWith("fr") || language.startsWith("es") ? "guillemets" : "curly",
        apostrophes: true,
        ellipsis: true,
        spaces: true,
        dashes: language.startsWith("it") ? "enSpaced" : language.startsWith("en") ? "emClosed" : "emSpaced",
        ranges: "enDash",
        dialogueDash: "em",
        dialogueComma: true,
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
  // Files written before the heading choices existed had a template such as "{label} {number}: {title}".
  const structure = isObject(raw) && isObject(raw.structure) ? raw.structure : {};
  for (const kind of ["part", "chapter"] as const) {
    const level = structure[kind];
    if (!isObject(level) || typeof level.pattern !== "string" || level.showTitle !== undefined) continue;
    const pattern = level.pattern;
    const target = settings.structure[kind];
    target.showLabel = pattern.includes("{label}");
    target.showTitle = pattern.includes("{title}");
    const between = /\{number\}([^{}]*)\{title\}/.exec(pattern);
    if (between) target.separator = between[1];
    if (!pattern.includes("{number}")) target.numbering = "none";
  }
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
