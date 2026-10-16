<script lang="ts">
  import { COVER_PALETTES, COVER_TEMPLATES, coverSvg, resolveCover, svgUrl, type CoverPalette, type CoverSettings, type CoverText } from "$lib/core/cover";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";

  let { cover = $bindable(), text }: { cover: CoverSettings; text: CoverText } = $props();

  const chosen = $derived(resolveCover(cover, text.title));
  const preview = $derived(svgUrl(coverSvg(text, cover)));
  const palettes = Object.keys(COVER_PALETTES) as CoverPalette[];
</script>

<div class="cover-picker">
  <img class="preview" src={preview} alt={t("cover.preview")} />
  <div class="choices">
    <span class="label">{t("cover.template")}</span>
    <div class="templates">
      {#each COVER_TEMPLATES as template (template)}
        <button
          type="button"
          class:chosen={chosen.template === template}
          aria-pressed={chosen.template === template}
          title={t(`cover.template.${template}` as MessageKey)}
          onclick={() => (cover = { template, palette: chosen.palette })}
        >
          <img src={svgUrl(coverSvg({ title: "", authors: [] }, { template, palette: chosen.palette }))} alt={t(`cover.template.${template}` as MessageKey)} />
        </button>
      {/each}
    </div>
    <span class="label">{t("cover.palette")}</span>
    <div class="palettes">
      {#each palettes as palette (palette)}
        {@const p = COVER_PALETTES[palette]}
        <button
          type="button"
          class="swatch"
          class:chosen={chosen.palette === palette}
          aria-pressed={chosen.palette === palette}
          title={t(`cover.palette.${palette}` as MessageKey)}
          aria-label={t(`cover.palette.${palette}` as MessageKey)}
          style:background={`linear-gradient(135deg, ${p.background} 0 50%, ${p.first} 50% 75%, ${p.second} 75%)`}
          onclick={() => (cover = { template: chosen.template, palette })}
        ></button>
      {/each}
    </div>
  </div>
</div>

<style>
  .cover-picker {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .preview {
    width: 120px;
    aspect-ratio: 2 / 3;
    border-radius: 3px;
    box-shadow: 0 1px 4px rgb(0 0 0 / 25%);
    flex: none;
  }
  .choices {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .label {
    color: var(--text-muted);
    font-size: 13px;
  }
  .templates,
  .palettes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }
  .templates button {
    padding: 2px;
    border: 2px solid transparent;
    border-radius: 4px;
    background: none;
    line-height: 0;
  }
  .templates img {
    width: 36px;
    aspect-ratio: 2 / 3;
    border-radius: 2px;
  }
  .swatch {
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid var(--border);
  }
  button.chosen {
    border-color: var(--accent);
  }
  .swatch.chosen {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
