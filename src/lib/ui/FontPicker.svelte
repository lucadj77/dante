<script lang="ts">
  import { onMount } from "svelte";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";

  let { value = $bindable() }: { value: string } = $props();

  /** Fonts suited to books and manuscripts, with what each is good for. */
  const FONTS: { name: string; use: string }[] = [
    { name: "Times New Roman", use: "manuscript" },
    { name: "Courier New", use: "typewriter" },
    { name: "Garamond", use: "classic" },
    { name: "EB Garamond", use: "classic" },
    { name: "Adobe Garamond Pro", use: "classic" },
    { name: "Palatino", use: "elegant" },
    { name: "Palatino Linotype", use: "elegant" },
    { name: "Book Antiqua", use: "elegant" },
    { name: "Baskerville", use: "contrast" },
    { name: "Libre Baskerville", use: "contrast" },
    { name: "Minion Pro", use: "publishing" },
    { name: "Sabon", use: "publishing" },
    { name: "Hoefler Text", use: "classic" },
    { name: "Iowan Old Style", use: "readable" },
    { name: "Charter", use: "readable" },
    { name: "Georgia", use: "screen" },
    { name: "Cambria", use: "screen" },
    { name: "Constantia", use: "screen" },
  ];

  let installed = $state<Set<string> | null>(null);
  let open = $state(false);
  let custom = $state(false);
  let root: HTMLDivElement;

  /** A font is installed when text set in it measures differently from the fallbacks. */
  function detect(): Set<string> {
    const canvas = document.createElement("canvas").getContext("2d");
    const found = new Set<string>();
    if (!canvas) return found;
    const sample = "mmmmmmmmmmlli WQ@#ffi 0123456789";
    const width = (font: string) => {
      canvas.font = `72px ${font}`;
      return canvas.measureText(sample).width;
    };
    const bases = ["monospace", "serif", "sans-serif"].map((b) => [b, width(b)] as const);
    for (const f of FONTS) {
      if (bases.some(([b, w]) => width(`"${f.name}", ${b}`) !== w)) found.add(f.name);
    }
    return found;
  }

  onMount(() => {
    installed = detect();
    custom = !FONTS.some((f) => f.name === value);
    const close = (e: MouseEvent) => {
      if (!root.contains(e.target as Node)) open = false;
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  });

  const shown = $derived(FONTS.filter((f) => !installed || installed.has(f.name) || f.name === value));

  function pick(name: string | null) {
    open = false;
    custom = name === null;
    if (name) value = name;
  }
</script>

<div class="picker" bind:this={root}>
  <button type="button" class="current" aria-haspopup="listbox" aria-expanded={open} onclick={() => (open = !open)}>
    <span style="font-family: '{value}', serif">{custom ? t("font.other") : value}</span>
    <span aria-hidden="true">▾</span>
  </button>
  {#if open}
    <ul role="listbox" aria-label={t("export.font")}>
      {#each shown as f (f.name)}
        <li>
          <button type="button" role="option" aria-selected={!custom && value === f.name} onclick={() => pick(f.name)}>
            <span class="name" style="font-family: '{f.name}', serif">{f.name}</span>
            <span class="use">{t(`font.use.${f.use}` as MessageKey)}</span>
          </button>
        </li>
      {/each}
      <li>
        <button type="button" role="option" aria-selected={custom} onclick={() => pick(null)}>
          <span class="name">{t("font.other")}</span>
          <span class="use">{t("font.otherHint")}</span>
        </button>
      </li>
    </ul>
  {/if}
  {#if custom}
    <input aria-label={t("font.other")} bind:value placeholder="Garamond" />
  {/if}
  <p class="sample" style="font-family: '{value}', serif">{t("font.sample")}</p>
  <p class="hint">{t("font.hint")}</p>
</div>

<style>
  .picker {
    position: relative;
    display: grid;
    gap: 6px;
  }
  .current {
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
    font-size: 15px;
  }
  ul {
    position: absolute;
    top: 36px;
    left: 0;
    right: 0;
    z-index: 10;
    max-height: 340px;
    overflow: auto;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  ul button {
    display: grid;
    width: 100%;
    gap: 2px;
    padding: 6px 8px;
    border: none;
    background: none;
    text-align: left;
  }
  ul button:hover,
  ul button[aria-selected="true"] {
    background: var(--bg-hover);
  }
  .name {
    font-size: 17px;
    color: var(--text);
  }
  .use,
  .hint {
    font-size: 12px;
    color: var(--text-muted);
  }
  .sample {
    margin: 0;
    font-size: 17px;
    color: var(--text);
  }
  .hint {
    margin: 0;
  }
</style>
