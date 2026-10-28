<script lang="ts">
  import { app, saveAppSettings, t, type AppSettings } from "$lib/state.svelte";
  import { ACCENTS } from "$lib/themes";
  import type { MessageKey } from "$lib/i18n";
  import FontPicker from "./FontPicker.svelte";

  // How Dante looks on this computer: theme, accent colour and the page of the editor
  // (font, size, line width, spacing, indent, justification), with a sample of the text.

  function set(patch: Partial<AppSettings>) {
    saveAppSettings({ ...app.settings, ...patch });
  }
  const clamp = (value: string, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && value.trim() ? Math.min(max, Math.max(min, n)) : fallback;
  };

  const THEMES: AppSettings["theme"][] = ["system", "light", "sepia", "dark", "night"];
  const themeName: Record<AppSettings["theme"], MessageKey> = {
    system: "settings.themeSystem",
    light: "settings.themeLight",
    sepia: "settings.themeSepia",
    dark: "settings.themeDark",
    night: "settings.themeNight",
  };

  const PRESETS = [
    { name: "Georgia", value: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif" },
    { name: "Palatino", value: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
    { name: "Garamond", value: "'EB Garamond', Garamond, 'Times New Roman', serif" },
    { name: "Sans serif", value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
    { name: "Monospace", value: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  ];
  /** A font chosen by name, among those installed: "Name", then serif in case it is missing. */
  const OTHER = "other";
  const installedName = (family: string) => /^"([^"]+)", serif$/.exec(family)?.[1] ?? null;
  let other = $state(!PRESETS.some((f) => f.value === app.settings.fontFamily));
  let fontName = $state(installedName(app.settings.fontFamily) ?? "");
  $effect(() => {
    // The picker's choice becomes the editor's font as soon as there is one.
    const name = fontName.trim();
    if (other && name && app.settings.fontFamily !== `"${name}", serif`) set({ fontFamily: `"${name}", serif` });
  });

  const LINE_HEIGHTS = [1.4, 1.5, 1.7, 2, 2.4];
  const GAPS: [number, MessageKey][] = [
    [1, "appearance.gapLine"],
    [0.5, "appearance.gapHalf"],
    [0.25, "appearance.gapSmall"],
  ];
  const INDENTS: [number, MessageKey][] = [
    [0, "appearance.indentNone"],
    [1, "appearance.indentSmall"],
    [1.5, "appearance.indentMedium"],
    [2.5, "appearance.indentLarge"],
  ];
  const num = (n: number) => n.toLocaleString(app.settings.language);
</script>

<h3>{t("appearance.title")}</h3>
<label
  >{t("settings.theme")}
  <select value={app.settings.theme} onchange={(e) => set({ theme: e.currentTarget.value as AppSettings["theme"] })}>
    {#each THEMES as theme (theme)}<option value={theme}>{t(themeName[theme])}</option>{/each}
  </select>
</label>
<div class="field">
  <span class="label">{t("appearance.accent")}</span>
  <div class="swatches" role="radiogroup" aria-label={t("appearance.accent")}>
    <button type="button" role="radio" class="swatch theme" aria-checked={!app.settings.accent} title={t("appearance.accentTheme")} aria-label={t("appearance.accentTheme")} onclick={() => set({ accent: "" })}></button>
    {#each Object.entries(ACCENTS) as [id, colour] (id)}
      <button
        type="button"
        role="radio"
        class="swatch"
        style:background={colour.light}
        aria-checked={app.settings.accent === id}
        title={t(`appearance.accent.${id}` as MessageKey)}
        aria-label={t(`appearance.accent.${id}` as MessageKey)}
        onclick={() => set({ accent: id })}
      ></button>
    {/each}
  </div>
</div>

<h3>{t("appearance.page")}</h3>
<label
  >{t("settings.font")}
  <select
    value={other ? OTHER : app.settings.fontFamily}
    onchange={(e) => {
      const value = e.currentTarget.value;
      other = value === OTHER;
      if (!other) set({ fontFamily: value });
    }}
  >
    {#each PRESETS as font (font.value)}<option value={font.value}>{font.name}</option>{/each}
    <option value={OTHER}>{t("appearance.otherFont")}</option>
  </select>
</label>
{#if other}
  <div class="field">
    <FontPicker bind:value={fontName} hint={t("appearance.otherFontHint")} />
  </div>
{/if}
<div class="row">
  <label
    >{t("settings.fontSize")}
    <input type="number" min="12" max="32" value={app.settings.fontSize} onchange={(e) => set({ fontSize: Math.round(clamp(e.currentTarget.value, 12, 32, app.settings.fontSize)) })} />
  </label>
  <label
    >{t("settings.lineWidth")}
    <input type="number" min="40" max="120" value={app.settings.lineWidth} onchange={(e) => set({ lineWidth: Math.round(clamp(e.currentTarget.value, 40, 120, app.settings.lineWidth)) })} />
  </label>
</div>
<div class="row">
  <label
    >{t("appearance.lineHeight")}
    <select value={app.settings.lineHeight} onchange={(e) => set({ lineHeight: Number(e.currentTarget.value) })}>
      {#each LINE_HEIGHTS as h (h)}<option value={h}>{num(h)}{h === 1.7 ? ` (${t("appearance.usual")})` : ""}</option>{/each}
      {#if !LINE_HEIGHTS.includes(app.settings.lineHeight)}<option value={app.settings.lineHeight}>{num(app.settings.lineHeight)}</option>{/if}
    </select>
  </label>
  <label
    >{t("appearance.gap")}
    <select value={app.settings.paragraphGap} onchange={(e) => set({ paragraphGap: Number(e.currentTarget.value) })}>
      {#each GAPS as [value, key] (value)}<option {value}>{t(key)}</option>{/each}
    </select>
  </label>
  <label
    >{t("appearance.indent")}
    <select value={app.settings.indent} onchange={(e) => set({ indent: Number(e.currentTarget.value) })}>
      {#each INDENTS as [value, key] (value)}<option {value}>{t(key)}</option>{/each}
    </select>
  </label>
</div>
<label class="check"><input type="checkbox" checked={app.settings.justify} onchange={(e) => set({ justify: e.currentTarget.checked })} /> {t("appearance.justify")}</label>

<!-- The editor's own classes, so the sample follows the same rules as the text. -->
<div class="sample cm-content" aria-label={t("appearance.sample")} style:max-width="{app.settings.lineWidth}ch">
  <div class="cm-line md-para">{t("appearance.sample1")}</div>
  <div class="cm-line md-gap"><br /></div>
  <div class="cm-line md-para">{t("appearance.sample2")}</div>
</div>

<h3>{t("appearance.spelling")}</h3>
<label class="check"><input type="checkbox" checked={app.settings.spellcheck} onchange={(e) => set({ spellcheck: e.currentTarget.checked })} /> {t("appearance.spellcheck")}</label>
<p class="hint">{t("appearance.spellcheckHint")}</p>
<label class="check"><input type="checkbox" checked={app.settings.paragraphs} onchange={(e) => set({ paragraphs: e.currentTarget.checked })} /> {t("appearance.paragraphs")}</label>
<p class="hint">{t("appearance.paragraphsHint")}</p>
{#if !app.settings.paragraphs}
  <label class="check"><input type="checkbox" checked={app.settings.askBlankLines} onchange={(e) => set({ askBlankLines: e.currentTarget.checked })} /> {t("appearance.askBlankLines")}</label>
  <p class="hint">{t("appearance.askBlankLinesHint")}</p>
{/if}

<style>
  h3 {
    font-size: 15px;
    margin: 20px 0 8px;
  }
  label,
  .field {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    color: var(--text-muted);
    font-size: 13px;
  }
  label input:not([type="checkbox"]),
  label select {
    color: var(--text);
    font-size: 14px;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0 12px;
  }
  .row label {
    flex: 1;
    min-width: 140px;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid var(--bg);
    box-shadow: 0 0 0 1px var(--border);
  }
  .swatch.theme {
    background: linear-gradient(135deg, var(--bg-panel) 50%, var(--text-muted) 50%);
  }
  .swatch[aria-checked="true"] {
    box-shadow: 0 0 0 2px var(--text);
  }
  .sample {
    margin: 4px 0 16px;
    padding: 16px 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--editor-bg);
    color: var(--text);
  }
  .hint {
    color: var(--text-muted);
    font-size: 12px;
    margin: 0 0 12px;
  }
</style>
