import { ACTIONS, type Action, type FormattingLabels } from "$lib/editor/formatting";
import type { MessageKey } from "$lib/i18n";
import { t } from "$lib/state.svelte";

/** Names of the formatting buttons in the interface language. */
export function formatLabels(): FormattingLabels {
  const actions = ACTIONS.filter((a): a is Action => a !== null);
  return Object.fromEntries(actions.map((a) => [a, t(`format.${a}` as MessageKey)])) as FormattingLabels;
}
