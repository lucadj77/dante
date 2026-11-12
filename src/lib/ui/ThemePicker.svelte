<script lang="ts">
  import { t, type AppSettings, type Look } from "$lib/state.svelte";
  import { ACCENTS } from "$lib/themes";
  import type { MessageKey } from "$lib/i18n";

  // Theme and accent colour, chosen from small drawings of the window rather than from a
  // menu: each drawing uses the colours of its theme, whatever theme Dante is showing now.

  interface Props {
    value: Pick<Look, "theme" | "accent">;
    set: (patch: Partial<Look>) => void;
  }
  let { value, set }: Props = $props();

  type Theme = AppSettings["theme"];
  /** The colours of each theme, as app.css gives them: page, panel, text, border, accent. */
  const COLOURS: Record<Exclude<Theme, "system">, [string, string, string, string, string]> = {
    light: ["#fffefb", "#f3f1ec", "#22201c", "#dedad2", "#2f5f9e"],
    sepia: ["#f8f0dd", "#ebe0c8", "#3a2e1f", "#d6c6a4", "#8a5a2b"],
    dark: ["#1f1e1c", "#242320", "#e8e4dc", "#393631", "#7ea6dd"],
    night: ["#0b0b0d", "#141417", "#c8c2b6", "#29292e", "#8aa6c9"],
  };
  const THEMES: Theme[] = ["system", "light", "sepia", "dark", "night"];
  const themeName: Record<Theme, MessageKey> = {
    system: "settings.themeSystem",
    light: "settings.themeLight",
    sepia: "settings.themeSepia",
    dark: "settings.themeDark",
    night: "settings.themeNight",
  };
  const vars = (theme: Exclude<Theme, "system">) => {
    const [page, panel, text, border, accent] = COLOURS[theme];
    return `--p:${page};--s:${panel};--t:${text};--b:${border};--a:${accent}`;
  };
</script>

<div class="field">
  <span class="label">{t("settings.theme")}</span>
  <div class="themes" role="radiogroup" aria-label={t("settings.theme")}>
    {#each THEMES as theme (theme)}
      <button type="button" role="radio" class="theme" data-theme-choice={theme} aria-checked={value.theme === theme} onclick={() => set({ theme })}>
        <span class="window" aria-hidden="true">
          {#each theme === "system" ? (["light", "dark"] as const) : [theme] as half (half)}
            <span class="half" style={vars(half)}>
              <span class="side"></span>
              <span class="text"><i></i><i></i><i class="short"></i><i class="mark"></i></span>
            </span>
          {/each}
        </span>
        <span class="name">{t(themeName[theme])}</span>
      </button>
    {/each}
  </div>
</div>
<div class="field">
  <span class="label">{t("appearance.accent")}</span>
  <div class="swatches" role="radiogroup" aria-label={t("appearance.accent")}>
    <button type="button" role="radio" class="swatch own" aria-checked={!value.accent} title={t("appearance.accentTheme")} aria-label={t("appearance.accentTheme")} onclick={() => set({ accent: "" })}></button>
    {#each Object.entries(ACCENTS) as [id, colour] (id)}
      <button
        type="button"
        role="radio"
        class="swatch"
        style:background={colour.light}
        aria-checked={value.accent === id}
        title={t(`appearance.accent.${id}` as MessageKey)}
        aria-label={t(`appearance.accent.${id}` as MessageKey)}
        onclick={() => set({ accent: id })}
      ></button>
    {/each}
  </div>
</div>

<style>
  .field {
    display: grid;
    gap: 6px;
    margin-bottom: 16px;
    color: var(--text-muted);
    font-size: 13px;
  }
  .themes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .theme {
    display: grid;
    gap: 6px;
    width: 102px;
    padding: 5px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: none;
    color: var(--text);
    font-size: 12px;
    text-align: center;
  }
  .theme:hover {
    background: var(--bg-hover);
  }
  .theme[aria-checked="true"] {
    border-color: var(--accent);
    background: var(--bg-active);
  }
  .window {
    display: flex;
    height: 60px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .half {
    flex: 1;
    display: flex;
    min-width: 0;
    background: var(--p);
  }
  .side {
    flex: none;
    width: 26%;
    background: var(--s);
    border-right: 1px solid var(--b);
  }
  .text {
    flex: 1;
    display: grid;
    align-content: center;
    gap: 6px;
    padding: 0 12%;
  }
  .text i {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: var(--t);
    opacity: 0.75;
  }
  .text i.short {
    width: 60%;
  }
  .text i.mark {
    width: 40%;
    background: var(--a);
    opacity: 1;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    width: 28px;
    height: 28px;
    min-width: 0;
    padding: 0;
    border-radius: 50%;
    border: 2px solid var(--bg);
    box-shadow: 0 0 0 1px var(--border);
  }
  .swatch.own {
    background: linear-gradient(135deg, var(--bg-panel) 50%, var(--text-muted) 50%);
  }
  .swatch[aria-checked="true"] {
    box-shadow: 0 0 0 2px var(--text);
  }
</style>
