import { translate, type MessageKey } from "./i18n";

export interface AppSettings {
  language: string;
  theme: "system" | "light" | "dark";
  fontFamily: string;
  fontSize: number;
  /** Maximum line length in the editor, in characters. */
  lineWidth: number;
  userName: string;
}

const STORAGE_KEY = "dante.app-settings";

function defaults(): AppSettings {
  const browser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
  return {
    language: browser === "it" ? "it" : "en",
    theme: "system",
    fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
    fontSize: 18,
    lineWidth: 68,
    userName: "",
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

export function t(key: MessageKey, values?: Record<string, string | number>): string {
  return translate(app.settings.language, key, values);
}
