<script lang="ts">
  import { onMount, tick } from "svelte";
  import { guideToHtml, type GuidePage } from "$lib/core/guide";
  import { app, t } from "$lib/state.svelte";
  import { inTauri } from "$lib/tauriFs";
  import { help, type HelpPage } from "./help.svelte";
  import Icon from "./Icon.svelte";

  // The pages travel with Dante, so they open without a connection.
  const sources: Record<string, () => Promise<{ default: string }>> = {
    "primi-passi.md": () => import("../../../docs/primi-passi.md?raw"),
    "first-steps.md": () => import("../../../docs/first-steps.md?raw"),
    "guida.md": () => import("../../../docs/guida.md?raw"),
    "novita.md": () => import("../../../docs/novita.md?raw"),
    "whats-new.md": () => import("../../../docs/whats-new.md?raw"),
  };
  const images = import.meta.glob("../../../docs/img/*", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
  const imageUrl = (src: string) => images[`../../../docs/${src.replace(/^\.\//, "")}`] ?? null;
  /** Pages of the docs folder that are not in the app, read on GitHub. */
  const ONLINE = "https://github.com/lucadj77/dante/blob/main/docs/";

  const english = $derived(!app.settings.language.startsWith("it"));
  const files = $derived<Record<HelpPage, string>>({
    first: english ? "first-steps.md" : "primi-passi.md",
    guide: "guida.md",
    news: english ? "whats-new.md" : "novita.md",
  });
  const pageOf = (file: string): HelpPage | null => (Object.entries(files).find(([, f]) => f === file)?.[0] as HelpPage) ?? (file === "guida.md" ? "guide" : null);

  let page = $state.raw<GuidePage | null>(null);
  let content = $state<HTMLElement>();
  let dialog = $state<HTMLElement>();
  /** Where to go once the page is shown, such as a chapter of the guide. */
  let pending = "";

  $effect(() => {
    const file = files[help.page];
    page = null;
    void sources[file]().then(async (m) => {
      if (files[help.page] !== file) return;
      page = guideToHtml(m.default, { image: imageUrl });
      await tick();
      if (pending) go(pending);
      else content?.scrollTo({ top: 0 });
      pending = "";
    });
  });

  const chapters = $derived(page && help.page === "guide" ? page.headings.filter((h) => h.level === 2 && /^\d/.test(h.text)) : []);

  function go(id: string) {
    const target = content?.querySelector<HTMLElement>(`[id="${CSS.escape(decodeURIComponent(id))}"]`);
    target?.scrollIntoView({ block: "start" });
  }

  async function openOutside(url: string) {
    if (inTauri()) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } else window.open(url, "_blank", "noopener");
  }

  /** Links inside a page: to a heading, to another page, or out to the web. */
  function click(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    e.preventDefault();
    if (href.startsWith("#")) return go(href.slice(1));
    if (/^(https?:|mailto:)/i.test(href)) return void openOutside(href);
    const [file, anchor = ""] = href.replace(/^\.\//, "").split("#");
    const target = pageOf(file);
    if (!target) return void openOutside(ONLINE + href);
    if (target === help.page) return anchor ? go(anchor) : content?.scrollTo({ top: 0 });
    pending = anchor;
    help.page = target;
  }

  onMount(() => {
    dialog?.focus();
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      help.open = false;
    }
  }}
/>

<div class="backdrop" role="presentation" onmousedown={() => (help.open = false)}></div>
<div class="help" role="dialog" aria-modal="true" aria-label={t("help.title")} tabindex="-1" bind:this={dialog}>
  <aside>
    <h2>{t("help.title")}</h2>
    <div class="pages" role="tablist">
      {#each [["first", "help.first"], ["guide", "help.guide"], ["news", "help.news"]] as const as [id, label] (id)}
        <button role="tab" aria-selected={help.page === id} onclick={() => (help.page = id)}>{t(label)}</button>
      {/each}
    </div>
    {#if chapters.length}
      <span class="caption">{t("help.chapters")}</span>
      <ol class="chapters">
        {#each chapters as c (c.id)}
          <li><button onclick={() => go(c.id)}>{c.text.replace(/^\d+\.\s*/, "")}</button></li>
        {/each}
      </ol>
    {/if}
  </aside>
  <div class="main">
    <button class="close" aria-label={t("help.close")} title={t("help.close")} onclick={() => (help.open = false)}><Icon name="cross" /></button>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article bind:this={content} onclick={click}>
      {#if help.page === "guide" && english}<p class="note">{t("help.italianOnly")}</p>{/if}
      {#if page}
        <!-- Made by guideToHtml from Dante's own pages, with everything else escaped. -->
        {@html page.html}
      {:else}
        <p class="note">{t("help.loading")}</p>
      {/if}
    </article>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgb(0 0 0 / 0.3);
  }
  .help {
    position: fixed;
    inset: 24px;
    z-index: 71;
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    max-width: 1100px;
    margin: 0 auto;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.25);
    overflow: hidden;
    outline: none;
  }
  aside {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 12px;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    overflow: auto;
  }
  aside h2 {
    margin: 0 0 4px;
    font-size: 16px;
  }
  .pages {
    display: grid;
    gap: 2px;
  }
  .pages button,
  .chapters button {
    border: none;
    background: none;
    text-align: left;
    padding: 5px 8px;
    border-radius: 6px;
  }
  .pages button[aria-selected="true"] {
    background: var(--bg-active);
    font-weight: 500;
  }
  .pages button:hover,
  .chapters button:hover {
    background: var(--bg-hover);
  }
  .caption {
    margin-top: 8px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .chapters {
    margin: 0;
    padding-left: 22px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .chapters button {
    padding: 3px 6px;
    font-size: 13px;
    color: var(--text);
  }
  .main {
    position: relative;
    min-height: 0;
    display: flex;
  }
  .close {
    position: absolute;
    top: 10px;
    right: 14px;
    z-index: 1;
    display: inline-flex;
    padding: 4px;
    border: none;
    background: var(--bg);
  }
  article {
    flex: 1;
    overflow: auto;
    padding: 24px 48px 64px;
    line-height: 1.55;
    font-size: 15px;
  }
  article > :global(*) {
    max-width: 720px;
  }
  .note {
    color: var(--text-muted);
  }
  article :global(h1) {
    font-family: Georgia, serif;
    font-weight: 400;
    font-size: 30px;
    margin: 0 0 16px;
  }
  article :global(h2) {
    font-size: 21px;
    margin: 36px 0 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  article :global(h3) {
    font-size: 16px;
    margin: 22px 0 8px;
  }
  article :global(p),
  article :global(ul),
  article :global(ol) {
    margin: 0 0 10px;
  }
  article :global(li) {
    margin: 4px 0;
  }
  article :global(li > p) {
    margin: 6px 0;
  }
  article :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 8px 0;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  article :global(code) {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.88em;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--bg-panel);
  }
  article :global(pre) {
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--bg-panel);
    overflow: auto;
    font-size: 13px;
    line-height: 1.4;
  }
  article :global(pre code) {
    padding: 0;
    background: none;
  }
  article :global(table) {
    border-collapse: collapse;
    margin: 8px 0 14px;
    font-size: 14px;
  }
  article :global(th),
  article :global(td) {
    border: 1px solid var(--border);
    padding: 4px 8px;
    vertical-align: top;
    text-align: left;
  }
  article :global(th) {
    background: var(--bg-panel);
  }
  article :global(blockquote) {
    margin: 0 0 10px;
    padding-left: 12px;
    border-left: 3px solid var(--border);
    color: var(--text-muted);
  }
  article :global(a) {
    color: var(--accent);
  }
  @media (max-width: 700px) {
    .help {
      inset: 0;
      border-radius: 0;
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr);
    }
    aside {
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
    .chapters,
    .caption {
      display: none;
    }
    article {
      padding: 16px 20px 48px;
    }
  }
</style>
