<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { SearchResult } from "$lib/core/notes";
  import { dirname, isWithin } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import FileViewer, { fileIcon, fileKind } from "./FileViewer.svelte";
  import { navigator } from "./navigation";
  import NoteEditor from "./NoteEditor.svelte";

  interface Props {
    project: Project;
    version: number;
    diskRev: number;
    /** After a result is opened where it belongs. */
    onOpened?: () => void;
    /** Opened to choose what a new pane shows: a result opens beside the section. */
    beside?: boolean;
    /** What Dante can do from the keyboard: listed when the search starts with ">". */
    commands?: { label: string; run: () => void }[];
  }
  let p: Props = $props();
  const nav = navigator();

  type Scope = "all" | "codex" | "research" | "laboratory" | "manuscript";
  // Kept between openings of the panel, as the last search usually matters again.
  let query = $state(lastQuery);
  let scope = $state<Scope>(lastScope);
  let results = $state<SearchResult[]>([]);
  let preview = $state<string | null>(null);

  $effect(() => {
    void p.version;
    const q = query;
    const s = scope;
    lastQuery = q;
    lastScope = s;
    const folder = s === "all" ? null : p.project.settings.folders[s];
    void p.project.index().then((index) => {
      if (query !== q || scope !== s) return;
      results = index.search(q, 60, folder === null ? undefined : (path) => isWithin(path, folder));
    });
  });

  /** With ">" in front the search lists Dante's commands in place of notes and files. */
  const commandMode = $derived(!p.beside && query.trimStart().startsWith(">"));
  const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matching = $derived.by(() => {
    if (!commandMode) return [];
    const words = fold(query.trimStart().slice(1)).split(/\s+/).filter(Boolean);
    return (p.commands ?? []).filter((c) => words.every((w) => fold(c.label).includes(w)));
  });

  function runCommand(command: { run: () => void }) {
    query = "";
    p.onOpened?.();
    command.run();
  }

  function focusOnMount(el: HTMLInputElement) {
    el.focus();
  }

  /** Opens a result in its section, or beside it in a pane. */
  function openResult(path: string, beside: boolean) {
    nav?.open(path, beside);
    p.onOpened?.();
  }

  /** Enter opens the first result; with Alt (Option) beside the section. */
  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && commandMode) {
      e.preventDefault();
      if (matching.length) runCommand(matching[0]);
      return;
    }
    if (e.key !== "Enter" || !results.length) return;
    e.preventDefault();
    openResult(results[0].path, p.beside || e.altKey);
  }
</script>

<script lang="ts" module>
  let lastQuery = "";
  let lastScope: "all" | "codex" | "research" | "laboratory" | "manuscript" = "all";
</script>

<section class="search">
  {#if preview}
    <div class="preview-bar">
      <button onclick={() => (preview = null)}>‹ {t("search.results")}</button>
      <button onclick={(e) => openResult(preview!, !!p.beside || e.altKey)}>{t(p.beside ? "search.openBeside" : "search.open")}</button>
      {#if !p.beside}<button title={t("tip.search.openBeside")} onclick={() => openResult(preview!, true)}>{t("search.openBeside")}</button>{/if}
    </div>
    <div class="preview">
      {#key preview}
        {#if fileKind(preview) === "note"}
          <NoteEditor project={p.project} path={preview} diskRev={p.diskRev} compact preview />
        {:else}
          <FileViewer project={p.project} path={preview} compact />
        {/if}
      {/key}
    </div>
  {:else}
    <input
      type="search"
      bind:value={query}
      placeholder={t("search.placeholder")}
      aria-label={t("search.placeholder")}
      use:focusOnMount
      onkeydown={onKey}
    />
    {#if p.beside}<p class="muted">{t("search.besideHint")}</p>{/if}
    {#if commandMode}
      {#if matching.length === 0}<p class="muted">{t("search.noCommand")}</p>{/if}
      <ul aria-label={t("search.commands")}>
        {#each matching as c, i (c.label)}
          <li><button class="command" class:first={i === 0} onclick={() => runCommand(c)}>{c.label}</button></li>
        {/each}
      </ul>
    {:else}
    {#if p.commands && !query.trim()}<p class="muted">{t("search.commandHint")}</p>{/if}
    <select bind:value={scope} aria-label={t("search.scope")}>
      <option value="all">{t("search.everywhere")}</option>
      <option value="codex">{t("section.codex")}</option>
      <option value="research">{t("section.research")}</option>
      <option value="laboratory">{t("section.laboratory")}</option>
      <option value="manuscript">{t("section.manuscript")}</option>
    </select>
    {#if query.trim() && results.length === 0}
      <p class="muted">{t("search.none")}</p>
    {/if}
    <ul>
      {#each results as r (r.path)}
        <li>
          <button onclick={(e) => (p.beside || e.altKey ? openResult(r.path, true) : (preview = r.path))} title={r.path}>
            <span class="title"><Icon name={fileIcon(r.path)} size={14} /> {r.title}</span>
            <span class="where">{dirname(r.path)}</span>
            {#if r.snippet}<span class="snippet">{r.snippet}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
    {/if}
  {/if}
</section>

<style>
  .search {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }
  input,
  select {
    width: 100%;
  }
  ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }
  li button {
    display: grid;
    gap: 1px;
    width: 100%;
    padding: 6px;
    border: none;
    border-radius: 4px;
    text-align: left;
  }
  .title {
    font-weight: 500;
  }
  .where {
    font-size: 11px;
    color: var(--text-muted);
  }
  .snippet {
    font-size: 12px;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  li button.command {
    display: block;
  }
  li button.command.first {
    background: var(--bg-active);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .preview-bar {
    display: flex;
    justify-content: space-between;
    gap: 4px;
  }
  .preview-bar button {
    font-size: 12px;
  }
  .preview {
    border-top: 1px solid var(--border);
    padding-top: 6px;
  }
</style>
