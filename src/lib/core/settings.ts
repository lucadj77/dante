import { parseDocument } from "yaml";
import { COVER_PALETTES, COVER_TEMPLATES, type CoverSettings } from "./cover";
import { authorsOf } from "./export/files";
import { parsePropertyDefs, serializePropertyDefs, type PropertyDef } from "./properties";

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

/**
 * How dialogue is marked, by the conventions of different countries:
 * - guillemets «Vieni» (Italy, Switzerland, Russia), guillemetsSpaced « Viens » (France),
 *   guillemetsReversed »Komm« (German books, Denmark);
 * - curly “Come” (United States), curlySingle ‘Come’ (United Kingdom), low „Komm“
 *   (Germany, Austria, Czechia), lowPolish „Chodź” (Poland, Hungary, Romania),
 *   swedish ”Kom” (Sweden, Finland);
 * - dash: — Vieni — disse (Italy), dashAttached: —Ven —dijo él— (Spain, Latin America,
 *   Portugal, Brazil).
 * Straight quotes become the chosen marks; with a dash, guillemets and straight quotes
 * become dashes, while curly quotes stay as quotation marks inside dialogue.
 */
export const QUOTE_STYLES = [
  "keep",
  "guillemets",
  "guillemetsSpaced",
  "guillemetsReversed",
  "curly",
  "curlySingle",
  "low",
  "lowPolish",
  "swedish",
  "dash",
  "dashAttached",
] as const;
export type QuoteStyle = (typeof QUOTE_STYLES)[number];

/** The usual way of marking dialogue in a language's books. */
export function defaultQuotes(language: string): QuoteStyle {
  const byLanguage: Record<string, QuoteStyle> = {
    it: "guillemets",
    fr: "guillemetsSpaced",
    es: "dashAttached",
    pt: "dashAttached",
    de: "low",
    cs: "low",
    sk: "low",
    pl: "lowPolish",
    hu: "lowPolish",
    ro: "lowPolish",
    sv: "swedish",
    fi: "swedish",
    da: "guillemetsReversed",
    ru: "guillemets",
    uk: "guillemets",
  };
  if (language.toLowerCase() === "en-gb") return "curlySingle";
  return byLanguage[language.slice(0, 2).toLowerCase()] ?? "curly";
}

export interface TypographySettings {
  quotes: QuoteStyle;
  /** Dash used for dialogue with a dash style: em dash (—) or en dash (–). */
  dialogueDash: "em" | "en";
  /** l'amico becomes l’amico. */
  apostrophes: boolean;
  /** ... becomes …, and E' becomes È. */
  ellipsis: boolean;
  /** Removes double spaces and spaces before punctuation. */
  spaces: boolean;
  /** Quotes, apostrophes, ellipses and dialogue dashes are also corrected while typing. */
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

/** Page sizes offered on export, width and height in centimetres. */
export const PAGE_SIZES = {
  a4: [21, 29.7],
  letter: [21.59, 27.94],
  a5: [14.8, 21],
  "15x21": [15, 21],
  "14x21": [14, 21],
  "13x20": [13, 20],
  "12x19": [12, 19],
  "17x24": [17, 24],
  // Paperback trim sizes common with English-language printers, in inches.
  "6x9in": [15.24, 22.86],
  "5.5x8.5in": [13.97, 21.59],
  "5x8in": [12.7, 20.32],
  bformat: [12.9, 19.8],
} as const satisfies Record<string, readonly [number, number]>;

export type PageSize = keyof typeof PAGE_SIZES | "custom";

export type PageUnit = "characters" | "words";

export type ExportFormat = "docx" | "pdf" | "epub" | "md";
export const EXPORT_FORMATS: ExportFormat[] = ["docx", "pdf", "epub", "md"];

export interface DocxSettings {
  /** Standard manuscript for agents and publishers, or a typeset, readable book. */
  profile: "manuscript" | "typeset";
  /** Chosen apart from the profile; "custom" uses pageWidth and pageHeight. */
  pageSize: PageSize;
  /** Centimetres, for a custom page size. */
  pageWidth: number;
  pageHeight: number;
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

/** A kind of note, such as a character or a place, defined in dante.yaml. */
export interface NoteType {
  /** Name shown in the app, such as "Character". */
  name: string;
  /** Subfolder of the Codex where new notes of this type go; notes there have this type. */
  folder: string;
  /** A character or emoji shown next to the notes. */
  icon: string;
  /** Properties a new note of this type starts with. */
  properties: string[];
}

export interface NovelSettings {
  title: string;
  subtitle: string;
  /** One name each, in the order they appear on the cover and the title page. */
  authors: string[];
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
  /**
   * Note types by id. The id is what a note's `type` property holds; a note without one
   * takes the type of the Codex folder it is in.
   */
  types: Record<string, NoteType>;
  /** Properties with a kind and allowed values, by name, shared by every note. */
  properties: Record<string, PropertyDef>;
  structure: {
    /** When true, the first level of folders in the manuscript are parts. */
    parts: boolean;
    part: LevelSettings;
    chapter: LevelSettings & {
      /** Restart chapter numbers at each part. */
      restartEachPart: boolean;
    };
  };
  /** Writing goals, shared by everyone working on the novel; 0 or "" means none. */
  goals: {
    /** Length of the finished novel, in words. */
    words: number;
    /** Date to finish by, as YYYY-MM-DD. */
    deadline: string;
    /** Words to write each day. */
    daily: number;
    /** Days of the week given to writing, 1 (Monday) to 7 (Sunday); the others are rest days. */
    days: number[];
  };
  /** The generated cover, shown among recent projects and, if chosen, in DOCX, PDF and EPUB. */
  cover: CoverSettings;
  /** What makes a page in the statistics and the export summary. */
  pages: {
    /** Characters (spaces included) or words. */
    unit: PageUnit;
    size: number;
  };
  export: {
    /** The format chosen last on the export page. */
    format: ExportFormat;
    /** Identifies the ebook across exports, so readers see a new version and not a new book. */
    epubId: string;
    /** The ebook's stylesheet when it is not the default one. */
    epubCss: string;
    /** The generated cover opens the exported book (DOCX, PDF, EPUB). */
    cover: boolean;
    /** Layout of DOCX and PDF; EPUB takes the structure and headings from it. */
    docx: DocxSettings;
    /** Applied to the exported text only; the files keep what was typed. */
    typography: TypographySettings;
    paratext: ParatextSettings;
    /** Revisions in CriticMarkup are accepted or rejected in the exported text. */
    revisions: "accept" | "reject";
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
  en: { codex: "Story Bible", research: "Research", laboratory: "Laboratory", manuscript: "Manuscript", views: "Views", templates: "Templates" },
  it: { codex: "Bibbia", research: "Ricerca", laboratory: "Laboratorio", manuscript: "Manoscritto", views: "Viste", templates: "Modelli" },
  es: { codex: "Biblia", research: "Investigación", laboratory: "Laboratorio", manuscript: "Manuscrito", views: "Vistas", templates: "Plantillas" },
  fr: { codex: "Bible", research: "Recherche", laboratory: "Laboratoire", manuscript: "Manuscrit", views: "Vues", templates: "Modèles" },
};

type TypeNames = Record<"character" | "place" | "object" | "event" | "group" | "plotline", [string, string, string[]]>;

/** Default types, with name, folder and suggested properties in the novel's language. */
const TYPES: Record<string, TypeNames> = {
  en: {
    character: ["Character", "Characters", ["role", "age", "appearance", "aliases"]],
    place: ["Place", "Places", ["region", "aliases"]],
    object: ["Object", "Objects", ["owner"]],
    event: ["Event", "Events", ["date", "place"]],
    group: ["Group", "Groups", ["members"]],
    plotline: ["Plotline", "Plotlines", ["status"]],
  },
  it: {
    character: ["Personaggio", "Personaggi", ["ruolo", "età", "aspetto", "aliases"]],
    place: ["Luogo", "Luoghi", ["regione", "aliases"]],
    object: ["Oggetto", "Oggetti", ["proprietario"]],
    event: ["Evento", "Eventi", ["data", "luogo"]],
    group: ["Gruppo", "Gruppi", ["membri"]],
    plotline: ["Plotline", "Plotline", ["stato"]],
  },
  es: {
    character: ["Personaje", "Personajes", ["papel", "edad", "aspecto", "aliases"]],
    place: ["Lugar", "Lugares", ["región", "aliases"]],
    object: ["Objeto", "Objetos", ["dueño"]],
    event: ["Evento", "Eventos", ["fecha", "lugar"]],
    group: ["Grupo", "Grupos", ["miembros"]],
    plotline: ["Trama", "Tramas", ["estado"]],
  },
  fr: {
    character: ["Personnage", "Personnages", ["rôle", "âge", "apparence", "aliases"]],
    place: ["Lieu", "Lieux", ["région", "aliases"]],
    object: ["Objet", "Objets", ["propriétaire"]],
    event: ["Événement", "Événements", ["date", "lieu"]],
    group: ["Groupe", "Groupes", ["membres"]],
    plotline: ["Intrigue", "Intrigues", ["statut"]],
  },
};
const ICONS: Record<keyof TypeNames, string> = {
  character: "👤",
  place: "📍",
  object: "🗝",
  event: "📅",
  group: "👥",
  plotline: "🧵",
};

export function defaultTypes(language: string): Record<string, NoteType> {
  const names = TYPES[language.slice(0, 2)] ?? TYPES.en;
  const types: Record<string, NoteType> = {};
  for (const [id, [name, folder, properties]] of Object.entries(names)) {
    types[id] = { name, folder, icon: ICONS[id as keyof TypeNames], properties: [...properties] };
  }
  return types;
}

/** Types as written in dante.yaml, each completed and checked; the defaults when missing. */
function parseTypes(value: unknown, language: string): Record<string, NoteType> {
  if (!isObject(value)) return defaultTypes(language);
  const types: Record<string, NoteType> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!isObject(raw)) continue;
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : id;
    types[id] = {
      name,
      folder: typeof raw.folder === "string" && raw.folder.trim() ? raw.folder.trim() : name,
      icon: typeof raw.icon === "string" ? raw.icon : "",
      properties: Array.isArray(raw.properties) ? raw.properties.filter((p): p is string => typeof p === "string") : [],
    };
  }
  return types;
}

/** Kinds for the default types' suggested properties: age, date, place, owner. */
const PROPERTY_NAMES: Record<string, [string, string, string, string]> = {
  en: ["age", "date", "place", "owner"],
  it: ["età", "data", "luogo", "proprietario"],
  es: ["edad", "fecha", "lugar", "dueño"],
  fr: ["âge", "date", "lieu", "propriétaire"],
};

export function defaultPropertyDefs(language: string): Record<string, PropertyDef> {
  const [age, date, place, owner] = PROPERTY_NAMES[language.slice(0, 2)] ?? PROPERTY_NAMES.en;
  return {
    [age]: { kind: "number", values: [], note_type: "" },
    [date]: { kind: "date", values: [], note_type: "" },
    [place]: { kind: "link", values: [], note_type: "place" },
    [owner]: { kind: "link", values: [], note_type: "character" },
  };
}

export function defaultFolders(language: string): NovelSettings["folders"] {
  return { ...(FOLDERS[language.slice(0, 2)] ?? FOLDERS.en) };
}

/**
 * Folder names a project may already use instead of its language's: the English ones, the
 * app's base language, and the names of earlier versions.
 */
export function knownFolders(key: keyof NovelSettings["folders"]): string[] {
  return key === "codex" ? [FOLDERS.en.codex, "Codex", "Códex"] : [FOLDERS.en[key]];
}

/** "Ada Rossi e Bruno Neri", joined as the novel's language joins a list. */
export function byline(authors: string[], language = "en"): string {
  const names = authors.map((a) => a.trim()).filter(Boolean);
  try {
    return new Intl.ListFormat(language, { type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** Surnames for a running header: "Rossi", or "Rossi, Neri". */
export function surnames(authors: string[]): string {
  return authors.map((a) => a.trim().split(/\s+/).pop() ?? "").filter(Boolean).join(", ");
}

export function defaultSettings(language = "en"): NovelSettings {
  const labels = LABELS[language.slice(0, 2)] ?? LABELS.en;
  return {
    title: "",
    subtitle: "",
    authors: [],
    language,
    folders: defaultFolders(language),
    types: defaultTypes(language),
    properties: defaultPropertyDefs(language),
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
    goals: { words: 0, deadline: "", daily: 0, days: [1, 2, 3, 4, 5, 6, 7] },
    cover: { template: "", palette: "" },
    pages: { unit: "characters", size: 1800 },
    export: {
      format: "docx",
      epubId: "",
      epubCss: "",
      cover: false,
      docx: {
        profile: "manuscript",
        pageSize: "a4",
        pageWidth: 21,
        pageHeight: 29.7,
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
        quotes: defaultQuotes(language),
        apostrophes: true,
        ellipsis: true,
        spaces: true,
        dialogueDash: "em",
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
      revisions: "accept",
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
  // Types are a free list: the user's replace the defaults instead of being merged into them.
  settings.types = parseTypes(isObject(raw) ? raw.types : undefined, language);
  settings.properties = parsePropertyDefs(isObject(raw) ? raw.properties : undefined);
  // Files written before several authors could be named had one "author" text.
  const authors = isObject(raw) ? raw.authors : undefined;
  settings.authors = Array.isArray(authors)
    ? authors.filter((a): a is string => typeof a === "string").map((a) => a.trim()).filter(Boolean)
    : isObject(raw) && typeof raw.author === "string"
      ? authorsOf(raw.author)
      : [];
  // Files written before chapterBreak existed said only whether chapters start a new page.
  const docx = isObject(raw) && isObject(raw.export) && isObject(raw.export.docx) ? raw.export.docx : {};
  if (docx.chapterBreak === undefined && docx.chapterNewPage === false) settings.export.docx.chapterBreak = "blankLine";
  if (!EXPORT_FORMATS.includes(settings.export.format)) settings.export.format = "docx";
  if (!(COVER_TEMPLATES as readonly string[]).includes(settings.cover.template)) settings.cover.template = "";
  if (!(settings.cover.palette in COVER_PALETTES)) settings.cover.palette = "";
  if (!(QUOTE_STYLES as readonly string[]).includes(settings.export.typography.quotes)) settings.export.typography.quotes = defaultQuotes(language);
  const days: unknown = settings.goals.days;
  settings.goals.days = Array.isArray(days)
    ? [...new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
    : [1, 2, 3, 4, 5, 6, 7];
  if (settings.pages.unit !== "words") settings.pages.unit = "characters";
  if (!(settings.pages.size > 0)) settings.pages.size = settings.pages.unit === "words" ? 250 : 1800;
  // Before the page size could be chosen, a typeset book was always A5.
  if (docx.pageSize === undefined && docx.profile === "typeset") settings.export.docx.pageSize = "a5";
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
    // Types are written whole, so a removed type disappears from the file too.
    if (path.length === 1 && path[0] === "types") {
      doc.setIn(path, doc.createNode(value));
      return;
    }
    if (path.length === 1 && path[0] === "properties") {
      const defs = serializePropertyDefs(value as Record<string, PropertyDef>);
      if (Object.keys(defs).length) doc.setIn(path, doc.createNode(defs));
      else doc.deleteIn(path);
      return;
    }
    if (isObject(value)) {
      for (const [k, v] of Object.entries(value)) write([...path, k], v);
    } else {
      doc.setIn(path, value);
    }
  };
  write([], settings);
  doc.deleteIn(["author"]);
  return doc.toString({ lineWidth: 0 });
}
