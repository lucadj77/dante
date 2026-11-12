// The keyboard shortcuts of the writing commands the user can change, with their usual keys.
// A combination is written as CodeMirror does ("Mod-Shift-x"): Mod is Cmd on the Mac and Ctrl elsewhere.

import { Prec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export const SHORTCUT_DEFAULTS = {
  newScene: "Mod-Enter",
  newChapter: "Mod-Shift-Enter",
  bold: "Mod-b",
  italic: "Mod-i",
  strike: "Mod-Shift-x",
  highlight: "Mod-Shift-h",
  comment: "Mod-Alt-m",
  link: "Mod-k",
  code: "Mod-e",
  ordered: "Mod-Shift-7",
  bullet: "Mod-Shift-8",
  task: "Mod-Shift-9",
  quote: "Mod-Shift-.",
  alignCenter: "Mod-Shift-e",
  alignRight: "Mod-Shift-r",
} as const;
export type ShortcutId = keyof typeof SHORTCUT_DEFAULTS;
export const SHORTCUT_IDS = Object.keys(SHORTCUT_DEFAULTS) as ShortcutId[];
export type CustomShortcuts = Partial<Record<ShortcutId, string>>;

const MODS = ["Mod", "Ctrl", "Alt", "Shift"] as const;

/**
 * Combinations Dante or the system already use for something else: undo, copy and paste,
 * select all, find, close, quit, the search in the project, the size of the text, Enter.
 */
const RESERVED = new Set(
  ["Mod-z", "Mod-Shift-z", "Mod-y", "Mod-c", "Mod-x", "Mod-v", "Mod-a", "Mod-f", "Mod-g", "Mod-Shift-g", "Mod-w", "Mod-Alt-w", "Mod-q", "Mod-Shift-f", "Mod-Alt-f", "Mod-0", "Alt-Enter", "Enter", "Shift-Enter"].map(normal),
);

const mac = () => typeof navigator === "undefined" || /Mac|iPhone|iPad/.test(navigator.userAgent);

/** The same combination with the modifiers in one order. */
function normal(combo: string): string {
  const parts = combo.split("-");
  const key = combo.endsWith("-") ? "-" : (parts.pop() ?? "");
  return [...MODS.filter((m) => parts.includes(m)), key].join("-");
}

/** The key of an event by its place on the keyboard, so Shift and Alt do not change it; "" for one that cannot be used. */
function keyName(e: Pick<KeyboardEvent, "key" | "code">): string {
  if (e.key === "Enter") return "Enter";
  if (/^F([1-9]|1[0-2])$/.test(e.key)) return e.key;
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^Digit(\d)$/.exec(e.code);
  if (digit) return digit[1];
  return { Period: ".", Comma: "," }[e.code] ?? "";
}

/** The combination a key press makes; "" while only modifiers are down or for a key that cannot be used. */
export function comboOf(e: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, onMac = mac()): string {
  const key = keyName(e);
  if (!key) return "";
  const mods: string[] = [];
  if (onMac ? e.metaKey : e.ctrlKey) mods.push("Mod");
  if (onMac && e.ctrlKey) mods.push("Ctrl");
  if (!onMac && e.metaKey) return "";
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  return [...mods, key].join("-");
}

/** Why a combination cannot be a shortcut: it has no Cmd/Ctrl or Alt (function keys aside), or it is taken. */
export function refusal(combo: string, id: ShortcutId, custom: CustomShortcuts): { kind: "weak" } | { kind: "reserved" } | { kind: "taken"; by: ShortcutId } | null {
  const c = normal(combo);
  const parts = c.split("-");
  const key = parts.at(-1) ?? "";
  if (!/^F\d+$/.test(key) && !parts.includes("Mod") && !parts.includes("Ctrl") && !parts.includes("Alt")) return { kind: "weak" };
  if (RESERVED.has(c)) return { kind: "reserved" };
  const by = SHORTCUT_IDS.find((other) => other !== id && normal(custom[other] ?? SHORTCUT_DEFAULTS[other]) === c);
  return by ? { kind: "taken", by } : null;
}

/** The combination as the Mac writes it ("⌘⇧X"); the interface turns it into "Ctrl+Shift+X" elsewhere. */
export function signOf(combo: string): string {
  const parts = normal(combo).split("-");
  const key = combo.endsWith("-") ? "-" : (parts.pop() ?? "");
  const signs = { Mod: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧" } as const;
  // The order the interface's texts use: ⌘ before ⇧ and ⌥, except ⌥ alone before the key.
  const mods = (["Ctrl", "Mod", "Shift", "Alt"] as const).filter((m) => parts.includes(m)).map((m) => signs[m]);
  return mods.join("") + (key === "Enter" ? "↩" : key.length === 1 ? key.toUpperCase() : key);
}

// The shortcuts in use: the app's settings set them, the editors read them when they are made and at each key.
let custom: CustomShortcuts = {};

/** Sets the user's own shortcuts; what is not a known command or a usable combination is left out. */
export function setShortcuts(map: unknown) {
  const next: CustomShortcuts = {};
  if (map && typeof map === "object") {
    for (const id of SHORTCUT_IDS) {
      const combo = (map as Record<string, unknown>)[id];
      if (typeof combo === "string" && combo && normal(combo) !== normal(SHORTCUT_DEFAULTS[id]) && !refusal(combo, id, next)) next[id] = normal(combo);
    }
  }
  custom = next;
}

export const customShortcuts = (): CustomShortcuts => ({ ...custom });
/** The combination of a command: the user's own, or the usual one. */
export const shortcutOf = (id: ShortcutId): string => normal(custom[id] ?? SHORTCUT_DEFAULTS[id]);
/** The command a key press asks for among `ids`; null when it is none of them. */
export function shortcutFor(e: KeyboardEvent, ids: readonly ShortcutId[] = SHORTCUT_IDS): ShortcutId | null {
  const combo = comboOf(e);
  if (!combo) return null;
  return ids.find((id) => shortcutOf(id) === combo) ?? null;
}

/**
 * Runs `run` when one of the shortcuts `ids` is pressed in the editor. The key is read by its
 * place on the keyboard, so Cmd+Shift+7 works on an Italian keyboard too, where it types "/".
 */
export function shortcutKeys(ids: readonly ShortcutId[], run: (id: ShortcutId, view: EditorView) => boolean, highest = false): Extension {
  const handler = EditorView.domEventHandlers({
    keydown(event, view) {
      const id = shortcutFor(event, ids);
      if (!id || !run(id, view)) return false;
      event.preventDefault();
      return true;
    },
  });
  return highest ? Prec.highest(handler) : Prec.high(handler);
}
