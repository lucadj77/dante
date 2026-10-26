<script lang="ts">
  import { ACTIONS, ICONS, type Action } from "$lib/editor/formatting";
  import { t } from "$lib/state.svelte";
  import { formatLabels } from "./formatLabels";
  import Icon from "./Icon.svelte";

  // The formatting buttons over the manuscript, and the two that split the scene at the
  // cursor. Pressing them leaves the cursor in the text.

  interface Props {
    /** No scene has the cursor. */
    disabled: boolean;
    onFormat: (action: Action) => void;
    onSplit: (kind: "scene" | "chapter") => void;
  }
  let { disabled, onFormat, onSplit }: Props = $props();
  const labels = $derived(formatLabels());
</script>

<div class="format-row" role="toolbar" aria-label={t("format.bar")}>
  {#each ACTIONS as action, i (i)}
    {#if action === null}
      <span class="cm-format-gap"></span>
    {:else}
      <button
        title={labels[action]}
        aria-label={labels[action]}
        {disabled}
        onmousedown={(e) => e.preventDefault()}
        onclick={() => onFormat(action)}>{#if ICONS[action].icon}<Icon name={ICONS[action].icon} />{:else}<span style={ICONS[action].style}>{ICONS[action].text}</span>{/if}</button
      >
    {/if}
  {/each}
  <span class="cm-format-gap"></span>
  <button class="split" title={t("tip.splitScene")} {disabled} onmousedown={(e) => e.preventDefault()} onclick={() => onSplit("scene")}
    ><Icon name="scene" /><span>{t("split.scene")}</span></button
  >
  <button class="split" title={t("tip.splitChapter")} {disabled} onmousedown={(e) => e.preventDefault()} onclick={() => onSplit("chapter")}
    ><Icon name="chapter" /><span>{t("split.chapter")}</span></button
  >
</div>

<style>
  .format-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--border);
  }
  .format-row .split {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }
  .format-row button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
