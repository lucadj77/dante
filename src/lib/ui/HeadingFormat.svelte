<script lang="ts">
  // How the headings of a level look in the exported book: font, size, alignment, weight,
  // capitals, space around and line spacing. Closed, it says the choices in one line.
  import { LINE_SPACING, type HeadingStyle } from "$lib/core/settings";
  import type { MessageKey } from "$lib/i18n";
  import { num, t } from "$lib/state.svelte";
  import FontPicker from "./FontPicker.svelte";

  interface Props {
    style: HeadingStyle;
    /** The look this level has when nothing was changed, to go back to. */
    usual: HeadingStyle;
    /** The font of the text, which the heading takes when it has none of its own. */
    textFont: string;
    /** Whether headings of this level can open a page: only then the distance from the top matters. */
    opens?: boolean;
  }
  let { style = $bindable(), usual, textFont, opens = false }: Props = $props();

  const changed = $derived(JSON.stringify(style) !== JSON.stringify(usual));
  const summary = $derived(
    [
      `${style.font || textFont} ${num(style.size, 1)} pt`,
      style.bold ? t("heading.bold") : "",
      style.italic ? t("heading.italic") : "",
      style.uppercase ? t("heading.uppercase") : "",
      t(`heading.align.${style.align}` as MessageKey),
    ]
      .filter(Boolean)
      .join(", ")
      .toLowerCase(),
  );
</script>

<details class="format">
  <summary><span class="name">{t("heading.format")}</span> <span class="now">{summary}</span></summary>
  <label class="font"
    >{t("heading.font")}
    <select value={style.font ? "own" : "same"} onchange={(e) => (style.font = e.currentTarget.value === "own" ? textFont : "")}>
      <option value="same">{t("heading.fontSame", { font: textFont })}</option>
      <option value="own">{t("heading.fontOwn")}</option>
    </select>
  </label>
  {#if style.font}<FontPicker bind:value={style.font} hint="" />{/if}
  <div class="row">
    <label>{t("export.fontSize")} <input type="number" min="6" max="96" step="0.1" bind:value={style.size} /></label>
    <label
      >{t("heading.alignment")}
      <select bind:value={style.align}>
        <option value="left">{t("heading.align.left")}</option>
        <option value="center">{t("heading.align.center")}</option>
        <option value="right">{t("heading.align.right")}</option>
      </select>
    </label>
    <label>{t("export.lineSpacing")} <input type="number" min={LINE_SPACING.min} max={LINE_SPACING.max} step="0.01" bind:value={style.lineSpacing} /></label>
  </div>
  <div class="checks">
    <label class="check"><input type="checkbox" bind:checked={style.bold} /> {t("heading.bold")}</label>
    <label class="check"><input type="checkbox" bind:checked={style.italic} /> {t("heading.italic")}</label>
    <label class="check"><input type="checkbox" bind:checked={style.uppercase} /> {t("heading.uppercase")}</label>
  </div>
  <div class="row">
    <label>{t("heading.before")} <input type="number" min="0" max="300" step="0.5" bind:value={style.before} /></label>
    <label>{t("heading.after")} <input type="number" min="0" max="300" step="0.5" bind:value={style.after} /></label>
    {#if opens}<label>{t("heading.top")} <input type="number" min="0" max="20" step="0.1" bind:value={style.top} /></label>{/if}
  </div>
  {#if opens}<p class="hint">{t("heading.topHint")}</p>{/if}
  {#if changed}<button type="button" class="link" onclick={() => (style = { ...usual })}>{t("heading.reset")}</button>{/if}
</details>

<style>
  .format {
    margin-top: 10px;
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }
  summary {
    cursor: pointer;
    font-size: 13px;
  }
  .name {
    font-weight: 600;
  }
  .now {
    color: var(--text-muted);
  }
  .font {
    display: grid;
    gap: 4px;
    margin: 10px 0 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    align-items: end;
    margin-top: 10px;
  }
  .row label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    margin-top: 10px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .link {
    margin-top: 8px;
    font-size: 13px;
  }
  @media (max-width: 700px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
