<script lang="ts">
  import { levelHeading } from "$lib/core/numbering";
  import type { LevelSettings, NumberStyle } from "$lib/core/settings";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";

  interface Props {
    level: LevelSettings;
    language: string;
    /** Sample title for the preview. */
    sample: string;
    feminine?: boolean;
  }
  let { level = $bindable(), language, sample, feminine = false }: Props = $props();

  const styles: NumberStyle[] = ["none", "arabic", "roman", "words", "ordinal"];
  const separators: { value: string; key: MessageKey }[] = [
    { value: ": ", key: "heading.sepColon" },
    { value: ". ", key: "heading.sepDot" },
    { value: " – ", key: "heading.sepDash" },
    { value: " — ", key: "heading.sepEmDash" },
    { value: " ", key: "heading.sepSpace" },
    { value: "\n", key: "heading.sepLine" },
  ];
  let custom = $state(false);
  const choice = $derived(custom || !separators.some((s) => s.value === level.separator) ? "custom" : level.separator);

  function pick(value: string) {
    custom = value === "custom";
    if (!custom) level.separator = value;
  }

  const preview = $derived(levelHeading(level, 1, sample, language, feminine).text);
</script>

<div class="level">
  <label
    >{t("settings.numbering")}
    <select bind:value={level.numbering}>
      {#each styles as style (style)}
        <option value={style}>{t(`numbering.${style}` as MessageKey)}</option>
      {/each}
    </select>
  </label>
  {#if level.numbering !== "none"}
    <div class="inline">
      <label class="check"><input type="checkbox" bind:checked={level.showLabel} /> {t("heading.showLabel")}</label>
      {#if level.showLabel}<input aria-label={t("settings.label")} bind:value={level.label} />{/if}
    </div>
  {/if}
  <label class="check"><input type="checkbox" bind:checked={level.showTitle} /> {t("heading.showTitle")}</label>
  {#if level.numbering !== "none" && level.showTitle}
    <div class="inline">
      <label
        >{t("heading.separator")}
        <select value={choice} onchange={(e) => pick((e.currentTarget as HTMLSelectElement).value)}>
          {#each separators as s (s.value)}
            <option value={s.value}>{t(s.key)}</option>
          {/each}
          <option value="custom">{t("heading.sepCustom")}</option>
        </select>
      </label>
      {#if choice === "custom"}<input aria-label={t("heading.sepCustom")} bind:value={level.separator} />{/if}
    </div>
  {/if}
  <div class="preview">
    <span>{t("settings.preview")}</span>
    <strong>{preview || "—"}</strong>
  </div>
</div>

<style>
  .level {
    display: grid;
    gap: 8px;
  }
  label {
    display: grid;
    gap: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
  }
  .inline {
    display: flex;
    align-items: end;
    gap: 12px;
  }
  select,
  input:not([type="checkbox"]) {
    color: var(--text);
    font-size: 14px;
  }
  .preview {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .preview strong {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--font-text, serif);
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    white-space: pre-line;
  }
</style>
