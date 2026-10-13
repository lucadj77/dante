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

export interface DocxSettings {
  font: string;
  /** Points. */
  fontSize: number;
  /** 1, 1.5 or 2. */
  lineSpacing: number;
  /** First-line indent of paragraphs, in centimetres. */
  indent: number;
  /** Line between scenes, such as "* * *" or "#". */
  sceneSeparator: string;
  titlePage: boolean;
  /** Page header with author, title and page number. */
  header: boolean;
  /** Each chapter starts on a new page. */
  chapterNewPage: boolean;
}

export interface NovelSettings {
  title: string;
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
    /** Standard manuscript format, for publishers and agents. */
    docx: DocxSettings;
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
        font: "Times New Roman",
        fontSize: 12,
        lineSpacing: 2,
        indent: 1.27,
        sceneSeparator: "#",
        titlePage: true,
        header: true,
        chapterNewPage: true,
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
  return merge(defaultSettings(language), raw);
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
