<script lang="ts">
  import { app, t, type Look } from "$lib/state.svelte";
  import type { MessageKey } from "$lib/i18n";
  import FontPicker from "./FontPicker.svelte";

  // The page of the editor: font, size, line width, spacing, indent and justification. The
  // same fields serve the computer's look and a novel's own.

  interface Props {
    value: Look;
    set: (patch: Partial<Look>) => void;
  }
  let { value, set }: Props = $props();

  const clamp = (text: string, min: number, max: number, fallback: number) => {
    const n = Number(text);
    return Number.isFinite(n) && text.trim() ? Math.min(max, Math.max(min, n)) : fallback;
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
  // svelte-ignore state_referenced_locally
  let other = $state(!PRESETS.some((f) => f.value === value.fontFamily));
  // svelte-ignore state_referenced_locally
  let fontName = $state(installedName(value.fontFamily) ?? "");
  $effect(() => {
    // The picker's choice becomes the editor's font as soon as there is one.
    const name = fontName.trim();
    if (other && name && value.fontFamily !== `"${name}", serif`) set({ fontFamily: `"${name}", serif` });
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

<label
  >{t("settings.font")}
  <select
    value={other ? OTHER : value.fontFamily}
    onchange={(e) => {
      const choice = e.currentTarget.value;
      other = choice === OTHER;
      if (!other) set({ fontFamily: choice });
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
    <input type="number" min="12" max="32" value={value.fontSize} onchange={(e) => set({ fontSize: Math.round(clamp(e.currentTarget.value, 12, 32, value.fontSize)) })} />
  </label>
  <label
    >{t("settings.lineWidth")}
    <input type="number" min="40" max="120" value={value.lineWidth} onchange={(e) => set({ lineWidth: Math.round(clamp(e.currentTarget.value, 40, 120, value.lineWidth)) })} />
  </label>
</div>
<div class="row">
  <label
    >{t("appearance.lineHeight")}
    <select value={value.lineHeight} onchange={(e) => set({ lineHeight: Number(e.currentTarget.value) })}>
      {#each LINE_HEIGHTS as h (h)}<option value={h}>{num(h)}{h === 1.7 ? ` (${t("appearance.usual")})` : ""}</option>{/each}
      {#if !LINE_HEIGHTS.includes(value.lineHeight)}<option value={value.lineHeight}>{num(value.lineHeight)}</option>{/if}
    </select>
  </label>
  <label
    >{t("appearance.gap")}
    <select value={value.paragraphGap} onchange={(e) => set({ paragraphGap: Number(e.currentTarget.value) })}>
      {#each GAPS as [gap, key] (gap)}<option value={gap}>{t(key)}</option>{/each}
    </select>
  </label>
  <label
    >{t("appearance.indent")}
    <select value={value.indent} onchange={(e) => set({ indent: Number(e.currentTarget.value) })}>
      {#each INDENTS as [indent, key] (indent)}<option value={indent}>{t(key)}</option>{/each}
    </select>
  </label>
</div>
<label class="check"><input type="checkbox" checked={value.justify} onchange={(e) => set({ justify: e.currentTarget.checked })} /> {t("appearance.justify")}</label>

<style>
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
</style>
