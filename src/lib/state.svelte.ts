import { LANGUAGES, translate, type MessageKey } from "./i18n";
import { formatNumber } from "./core/numbers";

export interface AppSettings {
  language: string;
  /** Light or dark as the system is, or one of the themes. */
  theme: "system" | "light" | "sepia" | "dark" | "night";
  /** The colour of buttons, links and selections: one of ACCENTS, or "" for the theme's own. */
  accent: string;
  fontFamily: string;
  fontSize: number;
  /** Maximum line length in the editor, in characters. */
  lineWidth: number;
  /** Space between the lines of a paragraph, as a multiple of the font size. */
  lineHeight: number;
  /** Height of the empty line between paragraphs, as a share of a line: 1 is a whole line. */
  paragraphGap: number;
  /** Indent of the first line of each paragraph, in em; 0 for none. */
  indent: number;
  /** Paragraphs justified, as in a book, instead of ragged on the right. */
  justify: boolean;
  /** The system's spelling checker in the editor. */
  spellcheck: boolean;
  userName: string;
  /** The formatting bar under the manuscript toolbar. */
  formatBar: boolean;
  /** Revision mode: changes are written as CriticMarkup signed with the user name. */
  revisions: boolean;
  /** Length analysis in the statistics: what to measure ("" for the project's unit) and at which level. */
  statsUnit: "words" | "characters" | "";
  statsLevel: "scene" | "chapter" | "part";
  /** A light shade on the row the cursor is on. */
  lineHighlight: boolean;
  /** Look for a newer version on the preview release at every start. */
  checkUpdates: boolean;
  /** Where backups go, a folder of this computer; empty for Documents/Dante backup. */
  backupFolder: string;
  /** A backup when a project closes (or Dante quits), if something changed since the last. */
  backupOnClose: boolean;
  /** How many backups of each project are kept. */
  backupKeep: number;
  /** The bar under the text with the words of the scene and of today. */
  statusBar: boolean;
  /** The last writing session chosen: its minutes and the words to reach (0 for none). */
  sprintMinutes: number;
  sprintWords: number;
  /** The same, for projects that count characters. */
  sprintCharacters: number;
}

const STORAGE_KEY = "dante.app-settings";

function defaults(): AppSettings {
  const browser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
  return {
    language: browser === "it" ? "it" : "en",
    theme: "system",
    accent: "",
    fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
    fontSize: 18,
    lineWidth: 68,
    lineHeight: 1.7,
    paragraphGap: 1,
    indent: 0,
    justify: false,
    spellcheck: true,
    userName: "",
    formatBar: true,
    revisions: false,
    statsUnit: "",
    statsLevel: "chapter",
    lineHighlight: false,
    checkUpdates: true,
    backupFolder: "",
    backupOnClose: true,
    backupKeep: 10,
    statusBar: true,
    sprintMinutes: 25,
    sprintWords: 0,
    sprintCharacters: 0,
  };
}

// Application settings belong to this computer, not to the project, so they are kept
// in the app's own storage rather than in the project folder.
function load(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults(), ...JSON.parse(stored) };
  } catch {
    // Storage unavailable: defaults are fine.
  }
  return defaults();
}

export const app = $state<{ settings: AppSettings }>({ settings: load() });

export function saveAppSettings(settings: AppSettings) {
  app.settings = settings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not persisted; the settings still apply to this session.
  }
}

const FONT_MIN = 12;
const FONT_MAX = 32;

/** Makes the text larger or smaller by `step` points, or back to the default with 0. */
export function zoom(step: number) {
  const size = step === 0 ? defaults().fontSize : Math.min(FONT_MAX, Math.max(FONT_MIN, app.settings.fontSize + step));
  if (size !== app.settings.fontSize) saveAppSettings({ ...app.settings, fontSize: size });
}

/** A number in the interface language, thousands always grouped. */
export function num(n: number, digits = 0): string {
  return formatNumber(n, app.settings.language, digits);
}

export function t(key: MessageKey, values?: Record<string, string | number>): string {
  return translate(app.settings.language, key, values);
}

/** A text that speaks of words, or its version for characters (key + "Chars") when the project counts those. */
export function tu(key: MessageKey, unit: "words" | "characters", values?: Record<string, string | number>): string {
  const chars = `${key}Chars`;
  return t(unit === "characters" && chars in LANGUAGES.en.messages ? (chars as MessageKey) : key, values);
}

const EXPORT_KEY = "dante.last-export-settings";
type ExportPreferences = Parameters<typeof import("./core/project").Project.create>[3];

/** The headings and export choices used last, as the starting point of new projects. */
export function rememberExportPreferences(preferences: NonNullable<ExportPreferences>) {
  try {
    localStorage.setItem(EXPORT_KEY, JSON.stringify(preferences));
  } catch {
    // Not remembered: new projects start from the defaults.
  }
}

export function exportPreferences(): ExportPreferences {
  try {
    const stored = localStorage.getItem(EXPORT_KEY);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

export interface RecentProject {
  path: string;
  title: string;
  /** ISO date of the last opening. */
  opened: string;
  /** In a browser, the folder's name: the browser does not tell where it is. */
  folder?: string;
}

const RECENT_KEY = "dante.recent-projects";
const RECENT_MAX = 10;

function loadRecent(): RecentProject[] {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((r) => typeof r?.path === "string") : [];
  } catch {
    return [];
  }
}

/** Projects opened on this computer, most recent first. Kept with the app settings. */
export const recent = $state<{ projects: RecentProject[] }>({ projects: loadRecent() });

function saveRecent(projects: RecentProject[]) {
  recent.projects = projects;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(projects));
  } catch {
    // Not persisted; the list still applies to this session.
  }
}

export function rememberProject(path: string, title: string, folder?: string) {
  const others = recent.projects.filter((r) => r.path !== path);
  saveRecent([{ path, title, opened: new Date().toISOString(), ...(folder ? { folder } : {}) }, ...others].slice(0, RECENT_MAX));
}

export function forgetProject(path: string) {
  saveRecent(recent.projects.filter((r) => r.path !== path));
}
