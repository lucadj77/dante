import { ACTIONS, type Action, type FormattingLabels } from "$lib/editor/formatting";
import type { TableLabels } from "$lib/editor/tables";
import type { MessageKey } from "$lib/i18n";
import { t } from "$lib/state.svelte";

/** Names of the formatting buttons in the interface language. */
export function formatLabels(): FormattingLabels {
  const actions = ACTIONS.filter((a): a is Action => a !== null);
  return Object.fromEntries(actions.map((a) => [a, t(`format.${a}` as MessageKey)])) as FormattingLabels;
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
