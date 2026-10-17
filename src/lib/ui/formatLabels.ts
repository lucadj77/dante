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
