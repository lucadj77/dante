import { ACTIONS, type Action, type FormattingLabels } from "$lib/editor/formatting";
import type { TableLabels } from "$lib/editor/tables";
import { IS_MAC, pcShortcuts, type MessageKey } from "$lib/i18n";
import { SHORTCUT_DEFAULTS, shortcutOf, signOf, type ShortcutId } from "$lib/editor/shortcuts";
import { app, t } from "$lib/state.svelte";

/**
 * A label that names the usual shortcut of a command ("Bold (⌘B)") with the one the user chose
 * in its place; as it is when the command has none or the user kept the usual one.
 */
export function withShortcut(label: string, ...ids: string[]): string {
  // The longest usual sign first, so "⌘⇧↩" is not taken for "⌘↩".
  const changed = ids.filter((id) => id in SHORTCUT_DEFAULTS && id in app.settings.shortcuts) as ShortcutId[];
  const marks = changed.map((id, i) => ({ usual: shortcutText(SHORTCUT_DEFAULTS[id]), own: shortcutText(shortcutOf(id)), mark: `\u0000${i}\u0000` })).sort((x, y) => y.usual.length - x.usual.length);
  for (const m of marks) label = label.split(m.usual).join(m.mark);
  for (const m of marks) label = label.split(m.mark).join(m.own);
  return label;
}

/** A combination as this system writes it: "⌘⇧X" on the Mac, "Ctrl+Shift+X" elsewhere. */
export function shortcutText(combo: string): string {
  return IS_MAC ? signOf(combo) : pcShortcuts(signOf(combo), app.settings.language);
}

/** Names of the formatting buttons in the interface language. */
export function formatLabels(): FormattingLabels {
  const actions = ACTIONS.filter((a): a is Action => a !== null);
  return Object.fromEntries(actions.map((a) => [a, withShortcut(t(`format.${a}` as MessageKey), a)])) as FormattingLabels;
}

/** Names of the buttons over a table being edited, in the interface language. */
export function tableLabels(): TableLabels {
  const keys: (keyof TableLabels)[] = ["row", "column", "above", "below", "left", "right", "delete", "align", "alignLeft", "alignCenter", "alignRight", "caption", "captionPrefix"];
  return Object.fromEntries(keys.map((k) => [k, t(`table.${k}` as MessageKey)])) as unknown as TableLabels;
}

/** The words of CodeMirror's find panel, by its English phrase, in the interface language. */
export function searchPhrases(): Record<string, string> {
  const keys: [string, MessageKey][] = [
    ["Find", "find.find"],
    ["Replace", "find.replace"],
    ["next", "find.next"],
    ["previous", "find.previous"],
    ["all", "find.all"],
    ["match case", "find.matchCase"],
    ["regexp", "find.regexp"],
    ["by word", "find.byWord"],
    ["replace", "find.replaceOne"],
    ["replace all", "find.replaceAll"],
    ["close", "find.close"],
    ["current match", "find.current"],
    ["on line", "find.onLine"],
    ["replaced match on line $", "find.replacedOne"],
    ["replaced $ matches", "find.replacedMany"],
    ["Go to line", "find.goToLine"],
    ["go", "find.go"],
  ];
  return Object.fromEntries(keys.map(([phrase, key]) => [phrase, t(key)]));
}
