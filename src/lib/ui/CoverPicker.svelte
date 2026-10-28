<script lang="ts">
  import { COVER_PALETTES, COVER_TEMPLATES, coverSvg, hexColor, resolveCover, svgUrl, type CoverPalette, type CoverSettings, type CoverText } from "$lib/core/cover";
  import { extname } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import { base64, coverPicture, imageToPng } from "./coverImage";
  import { imageMime } from "$lib/core/images";
  import { failure } from "./errors";
  import ErrorText from "./ErrorText.svelte";

  // A project keeps the picture among its files at once; a novel not yet created holds it in
  // `pending`, which the new project's form saves once the project exists.
  let {
    cover = $bindable(),
    text,
    project,
    pending = $bindable(null),
  }: { cover: CoverSettings; text: CoverText; project?: Project; pending?: { name: string; data: Uint8Array } | null } = $props();

  const chosen = $derived(resolveCover(cover, text.title));
  const show = $derived({ title: true, subtitle: true, authors: true, ...cover.show });
  const palette = $derived(COVER_PALETTES[chosen.palette]);
  const palettes = Object.keys(COVER_PALETTES) as CoverPalette[];

  /** The picture, read from the project, as a data: URL; "" without one. */
  let picture = $state("");
  $effect(() => {
    if (!project) {
      picture = pending ? `data:${imageMime(pending.name)};base64,${base64(pending.data)}` : "";
      return;
    }
    const path = cover.image ?? "";
    if (!project || !path) {
      picture = "";
      return;
    }
    void coverPicture(project.fs, { ...cover, image: path }).then((url) => {
      if ((cover.image ?? "") === path) picture = url;
    });
  });
  const hasImage = $derived(!!cover.image || !!pending);
  const preview = $derived(svgUrl(coverSvg(text, cover, picture ? { url: picture } : undefined)));

  let input = $state<HTMLInputElement | null>(null);
  let busy = $state(false);
  let error = $state("");

  /** Formats every export can use as they are; the others become PNG. */
  const KEPT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

  async function choose(file: File) {
    error = "";
    busy = true;
    try {
      let data: Uint8Array = new Uint8Array(await file.arrayBuffer());
      let name = file.name || "cover.png";
      if (!KEPT.includes(extname(name).toLowerCase())) {
        const png = await imageToPng(data, file.type || "image/*");
        if (!png) throw new Error(t("cover.imageUnreadable"));
        data = png.data;
        name = name.replace(/\.[^.]*$/, "") + ".png";
      }
      if (!project) {
        pending = { name, data };
        cover = { ...cover, template: chosen.template, palette: chosen.palette };
        return;
      }
      const path = await project.addAttachment(name, data);
      cover = { ...cover, template: chosen.template, palette: chosen.palette, image: path };
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }

  const setShow = (key: "title" | "subtitle" | "authors", on: boolean) => (cover = { ...cover, show: { ...show, [key]: on } });
</script>

<div class="cover-picker">
  <img class="preview" src={preview} alt={t("cover.preview")} />
  <div class="choices">
    <span class="label">{t("cover.image")}</span>
    <div class="row">
      <button type="button" disabled={busy} onclick={() => input?.click()}>{hasImage ? t("cover.imageChange") : t("cover.imageChoose")}</button>
      {#if hasImage}
        <button
          type="button"
          onclick={() => {
            cover = { ...cover, image: "" };
            pending = null;
          }}>{t("cover.imageRemove")}</button
        >
        <span class="path" title={cover.image || pending?.name}>{(cover.image || pending?.name || "").split("/").pop()}</span>
      {/if}
      <input
        bind:this={input}
        type="file"
        accept="image/*"
        hidden
        onchange={(e) => {
          const el = e.currentTarget;
          const file = el.files?.[0];
          el.value = "";
          if (file) void choose(file);
        }}
      />
    </div>
    {#if error}<p class="error" role="alert"><ErrorText text={error} /></p>{/if}
    {#if !hasImage}
      <span class="label">{t("cover.template")}</span>
      <div class="templates">
        {#each COVER_TEMPLATES as template (template)}
          <button
            type="button"
            class:chosen={chosen.template === template}
            aria-pressed={chosen.template === template}
            title={t(`cover.template.${template}` as MessageKey)}
            onclick={() => (cover = { ...cover, template, palette: chosen.palette })}
          >
            <img src={svgUrl(coverSvg({ title: "", authors: [] }, { template, palette: chosen.palette }))} alt={t(`cover.template.${template}` as MessageKey)} />
          </button>
        {/each}
      </div>
    {/if}
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
          onclick={() => (cover = { ...cover, template: chosen.template, palette })}
        ></button>
      {/each}
    </div>
    <span class="label">{t("cover.texts")}</span>
    <div class="row">
      <label class="check"><input type="checkbox" checked={show.title} onchange={(e) => setShow("title", e.currentTarget.checked)} /> {t("cover.showTitle")}</label>
      <label class="check"><input type="checkbox" checked={show.subtitle} onchange={(e) => setShow("subtitle", e.currentTarget.checked)} /> {t("cover.showSubtitle")}</label>
      <label class="check"><input type="checkbox" checked={show.authors} onchange={(e) => setShow("authors", e.currentTarget.checked)} /> {t("cover.showAuthors")}</label>
    </div>
    <div class="row">
      <label class="color"
        >{t("cover.textColor")}
        <input type="color" value={hexColor(cover.textColor) || palette.text} oninput={(e) => (cover = { ...cover, textColor: e.currentTarget.value })} /></label
      >
      {#if hexColor(cover.textColor)}
        <button type="button" class="reset" onclick={() => (cover = { ...cover, textColor: "" })}>{t("cover.colorReset")}</button>
      {/if}
      <label class="check"
        ><input
          type="checkbox"
          checked={!!hexColor(cover.outlineColor)}
          onchange={(e) => (cover = { ...cover, outlineColor: e.currentTarget.checked ? palette.background : "" })}
        />
        {t("cover.outline")}</label
      >
      {#if hexColor(cover.outlineColor)}
        <input type="color" aria-label={t("cover.outlineColor")} value={hexColor(cover.outlineColor)} oninput={(e) => (cover = { ...cover, outlineColor: e.currentTarget.value })} />
      {/if}
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
  .palettes,
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .row {
    gap: 6px 14px;
  }
  .row label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }
  .path {
    color: var(--text-muted);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }
  .color input,
  .row input[type="color"] {
    width: 34px;
    height: 24px;
    padding: 0 2px;
  }
  .reset {
    font-size: 12px;
  }
  .error {
    color: var(--danger, #b3261e);
    font-size: 13px;
    margin: 0;
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
