<script lang="ts">
  import { app, saveAppSettings, t, zoom } from "$lib/state.svelte";
  import Icon from "./Icon.svelte";
  import { panes, SCENE_SHEETS, toggleSceneSheets } from "./panes.svelte";

  // The bar above the manuscript: how much of it to show, the writing modes, the text size
  // and the Altro menu with what is used less often.

  type Level = "scene" | "chapter" | "part" | "novel";

  interface Props {
    level: Level;
    focusMode: boolean;
    typewriter: boolean;
    /** The Altro menu is open. */
    moreOpen: boolean;
    /** The novel has parts, so they can be shown one at a time. */
    parts: boolean;
    fullscreen: boolean;
    /** The text is shown as Markdown. */
    raw: boolean;
    onToggleFullscreen: () => void;
    onToggleRaw: () => void;
  }
  let { level = $bindable(), focusMode = $bindable(), typewriter = $bindable(), moreOpen = $bindable(), parts, fullscreen, raw, onToggleFullscreen, onToggleRaw }: Props = $props();
</script>

<div class="toolbar" role="toolbar">
  <div class="segmented" role="group" aria-label={t("toolbar.show")}>
    {#each ["scene", "chapter", "part", "novel"] as const as l (l)}
      {#if l !== "part" || parts}
        <button aria-pressed={level === l} title={t(`tip.level.${l}`)} onclick={() => (level = l)}><Icon name={l} /><span class="label">{t(`level.${l}`)}</span></button>
      {/if}
    {/each}
  </div>
  <!-- The modes leave the cursor in the text, so writing goes on at once. -->
  <div class="modes" role="group" aria-label={t("toolbar.modes")}>
    <button aria-pressed={focusMode} title={t("tip.focus")} onmousedown={(e) => e.preventDefault()} onclick={() => (focusMode = !focusMode)}><Icon name="focus" /><span class="label">{t("mode.focus")}</span></button>
    <button aria-pressed={typewriter} title={t("tip.typewriter")} onmousedown={(e) => e.preventDefault()} onclick={() => (typewriter = !typewriter)}><Icon name="typewriter" /><span class="label">{t("mode.typewriter")}</span></button>
    <button
      aria-pressed={app.settings.lineHighlight}
      title={t("tip.lineHighlight")}
      onmousedown={(e) => e.preventDefault()}
      onclick={() => saveAppSettings({ ...app.settings, lineHighlight: !app.settings.lineHighlight })}><Icon name="lineHighlight" /><span class="label">{t("mode.lineHighlight")}</span></button
    >
    <button
      aria-pressed={app.settings.namedNotes}
      title={t("tip.namedNotes")}
      onmousedown={(e) => e.preventDefault()}
      onclick={() => saveAppSettings({ ...app.settings, namedNotes: !app.settings.namedNotes })}><Icon name="named" /><span class="label">{t("mode.namedNotes")}</span></button
    >
    <button aria-pressed={fullscreen} title={t("tip.fullscreen")} onmousedown={(e) => e.preventDefault()} onclick={onToggleFullscreen}><Icon name="fullscreen" /><span class="label">{t("mode.fullscreen")}</span></button>
  </div>
  <span class="grow"></span>
  <!-- What changes how the text is written stays in sight while it is on. -->
  {#if app.settings.revisions && app.settings.userName.trim()}
    <button class="chip tracking" title={t("tip.revisionsOn")} onclick={() => saveAppSettings({ ...app.settings, revisions: false })}><Icon name="revisions" /><span class="label">{t("mode.revisionsOn")}</span></button>
  {/if}
  {#if raw}
    <button class="chip" aria-pressed="true" title={t("tip.rawOn")} onclick={onToggleRaw}><Icon name="raw" /><span class="label">{t("mode.rawOn")}</span></button>
  {/if}
  <div class="zoom" role="group" aria-label={t("toolbar.size")}>
    <button class="icon-only" title={t("zoom.out")} aria-label={t("zoom.out")} onclick={() => zoom(-1)}><Icon name="zoomOut" /></button>
    <button class="size" title={t("zoom.reset")} onclick={() => zoom(0)}>{app.settings.fontSize}</button>
    <button class="icon-only" title={t("zoom.in")} aria-label={t("zoom.in")} onclick={() => zoom(1)}><Icon name="zoomIn" /></button>
  </div>
  <div class="more">
    <button aria-expanded={moreOpen} aria-haspopup="menu" title={t("tip.more")} onclick={() => (moreOpen = !moreOpen)}><Icon name="more" /><span class="label">{t("toolbar.more")}</span></button>
    {#if moreOpen}
      <div class="menu-backdrop" role="presentation" onmousedown={() => (moreOpen = false)}></div>
      <div class="more-menu" role="menu" aria-label={t("toolbar.more")}>
        <button role="menuitemcheckbox" aria-checked={app.settings.formatBar} title={t("tip.formatBar")} onclick={() => saveAppSettings({ ...app.settings, formatBar: !app.settings.formatBar })}
          ><span class="tick">{app.settings.formatBar ? "✓" : ""}</span><Icon name="format" />{t("more.formatBar")}</button
        >
        <button role="menuitemcheckbox" aria-checked={panes.list.some((p) => p.path === SCENE_SHEETS)} title={t("tip.panes.sheets")} onclick={() => { moreOpen = false; toggleSceneSheets(); }}
          ><span class="tick">{panes.list.some((p) => p.path === SCENE_SHEETS) ? "✓" : ""}</span><Icon name="sheets" />{t("more.sheets")}</button
        >
        <button role="menuitemcheckbox" aria-checked={app.settings.statusBar} title={t("tip.statusBar")} onclick={() => saveAppSettings({ ...app.settings, statusBar: !app.settings.statusBar })}
          ><span class="tick">{app.settings.statusBar ? "✓" : ""}</span><Icon name="status" />{t("more.statusBar")}</button
        >
        <hr />
        <button
          role="menuitemcheckbox"
          aria-checked={app.settings.revisions && !!app.settings.userName.trim()}
          title={app.settings.userName.trim() ? t("tip.revisions") : t("tip.revisionsNoName")}
          disabled={!app.settings.userName.trim()}
          onclick={() => saveAppSettings({ ...app.settings, revisions: !app.settings.revisions })}
          ><span class="tick">{app.settings.revisions && app.settings.userName.trim() ? "✓" : ""}</span><Icon name="revisions" />{app.settings.userName.trim() ? t("more.revisions") : t("more.revisionsNoName")}</button
        >
        <button role="menuitemcheckbox" aria-checked={raw} title={t("tip.raw")} onclick={() => { moreOpen = false; onToggleRaw(); }}
          ><span class="tick">{raw ? "✓" : ""}</span><Icon name="raw" />{t("more.raw")}</button
        >
      </div>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    container-type: inline-size;
  }
  .toolbar > * {
    flex: none;
  }
  .toolbar button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
  }
  .modes,
  .zoom {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .grow {
    flex: 1;
  }
  .segmented {
    display: flex;
  }
  .segmented button {
    border-radius: 0;
  }
  .segmented button + button {
    margin-left: -1px;
  }
  .segmented button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .segmented button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .zoom button.size {
    min-width: 32px;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }
  .chip.tracking {
    color: var(--critic-add, #1a7f37);
    border-color: currentColor;
  }
  .more {
    position: relative;
  }
  .more-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 21;
    display: grid;
    min-width: 260px;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  }
  .more-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: none;
    background: none;
    text-align: left;
    font-size: 13px;
  }
  .more-menu button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  .more-menu button:disabled {
    opacity: 0.55;
  }
  .more-menu .tick {
    width: 12px;
    color: var(--accent);
  }
  .more-menu hr {
    width: 100%;
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--border);
  }
  /* A narrow window keeps the icons; the names stay in the tooltips. */
  /* A narrower bar keeps one row: first the modes, then every button, show only their icons;
     the names stay in the tooltips. */
  @container (max-width: 900px) {
    .modes .label,
    .chip .label {
      display: none;
    }
  }
  @container (max-width: 560px) {
    .label {
      display: none;
    }
  }
  /* WebKit without container queries (macOS 10.15): the window width stands in for the bar's. */
  @supports not (container-type: inline-size) {
    @media (max-width: 1500px) {
      .modes .label,
      .chip .label {
        display: none;
      }
    }
    @media (max-width: 1000px) {
      .label {
        display: none;
      }
    }
  }
  .icon-only {
    display: inline-flex;
    align-items: center;
    padding: 3px 5px;
  }
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
  }
</style>
