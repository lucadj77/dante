<script lang="ts">
  import { ACTIONS, ICONS, type Action } from "$lib/editor/formatting";
  import { t } from "$lib/state.svelte";
  import { formatLabels } from "./formatLabels";
  import Icon from "./Icon.svelte";
  import type { BoxType } from "$lib/core/gamebook/boxes";

  // The formatting buttons over the manuscript, and the two that split the scene at the
  // cursor. Pressing them leaves the cursor in the text.

  interface Props {
    /** No scene has the cursor. */
    disabled: boolean;
    onFormat: (action: Action) => void;
    onSplit: (kind: "scene" | "chapter") => void;
    /** Without the split buttons, as in a gamebook, whose paragraphs are not split. */
    noSplit?: boolean;
    /** In a gamebook: its box types, the values already used for a property, and what inserts a box. */
    boxes?: BoxType[];
    boxValues?: (property: string) => string[];
    onBox?: (type: BoxType, value: string) => void;
  }
  let { disabled, onFormat, onSplit, noSplit = false, boxes = [], boxValues = () => [], onBox }: Props = $props();

  let boxMenu = $state(false);
  /** A type tied to a property waits here for its value. */
  let asking = $state<BoxType | null>(null);
  let value = $state("");

  function choose(type: BoxType) {
    boxMenu = false;
    if (type.property) {
      asking = type;
      value = "";
    } else onBox?.(type, "");
  }

  function submitBox() {
    const type = asking;
    asking = null;
    if (type) onBox?.(type, value);
  }

  function focusInput(el: HTMLInputElement) {
    el.focus();
  }
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
  {#if boxes.length && onBox}
    <span class="cm-format-gap"></span>
    <span class="box-anchor">
      <button class="split" title={t("gamebook.boxTip")} aria-haspopup="menu" aria-expanded={boxMenu} {disabled} onmousedown={(e) => e.preventDefault()} onclick={() => (boxMenu = !boxMenu)}
        >▣ <span>{t("gamebook.box")}</span></button
      >
      {#if boxMenu}
        <div class="box-menu" role="menu">
          {#each boxes as type (type.id)}
            <button role="menuitem" onmousedown={(e) => e.preventDefault()} onclick={() => choose(type)}>
              <span class="swatch" style:background={type.color}></span>{type.emoji} {type.name}
            </button>
          {/each}
        </div>
      {/if}
      {#if asking}
        <form
          class="box-menu box-value"
          onsubmit={(e) => {
            e.preventDefault();
            submitBox();
          }}
        >
          <label>
            {asking?.emoji} {t("gamebook.boxValue", { property: asking?.property ?? "" })}
            <input list="box-values" bind:value use:focusInput onkeydown={(e) => e.key === "Escape" && (asking = null)} />
          </label>
          <datalist id="box-values">
            {#each boxValues(asking?.property ?? "") as v (v)}<option value={v}></option>{/each}
          </datalist>
          <div class="box-actions">
            <button type="button" onclick={() => (asking = null)}>{t("tree.cancel")}</button>
            <button type="submit">{t("gamebook.boxInsert")}</button>
          </div>
        </form>
      {/if}
    </span>
  {/if}
  {#if !noSplit}
  <span class="cm-format-gap"></span>
  <button class="split" title={t("tip.splitScene")} {disabled} onmousedown={(e) => e.preventDefault()} onclick={() => onSplit("scene")}
    ><Icon name="scene" /><span>{t("split.scene")}</span></button
  >
  <button class="split" title={t("tip.splitChapter")} {disabled} onmousedown={(e) => e.preventDefault()} onclick={() => onSplit("chapter")}
    ><Icon name="chapter" /><span>{t("split.chapter")}</span></button
  >
  {/if}
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
  .box-anchor {
    position: relative;
  }
  .box-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  .box-menu [role="menuitem"] {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-start;
    text-align: left;
  }
  .swatch {
    width: 4px;
    height: 16px;
    border-radius: 2px;
  }
  .box-value {
    gap: 6px;
    padding: 8px;
    min-width: 280px;
    font-size: 12px;
  }
  .box-value label {
    display: grid;
    gap: 4px;
  }
  .box-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .format-row button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
