<script lang="ts">
  import { filterHistory, historyPeople, readHistory, type HistoryEntry } from "$lib/core/history";
  import { noteTitle } from "$lib/core/notes";
  import type { Project } from "$lib/core/project";
  import type { MessageKey } from "$lib/i18n";
  import { app, t } from "$lib/state.svelte";
  import { historyChanged } from "./history.svelte";
  import { navigator } from "./navigation";

  // What happened to the comments and revisions of the scene shown, or of the whole novel:
  // who accepted, rejected or closed what, and when.
  interface Props {
    project: Project;
    /** The scenes shown: the open scene, or those of the chapter. */
    paths: string[];
    version: number;
  }
  let p: Props = $props();
  const nav = navigator();

  let entries = $state<HistoryEntry[]>([]);
  let whole = $state(false);
  let person = $state("");
  let from = $state("");
  let to = $state("");

  $effect(() => {
    void p.version;
    void historyChanged.rev;
    void readHistory(p.project.fs).then((all) => (entries = all), () => (entries = []));
  });

  const people = $derived(historyPeople(entries));
  const shown = $derived(filterHistory(entries, { person, from, to }).filter((e) => whole || p.paths.includes(e.path)));

  const dateTime = $derived(new Intl.DateTimeFormat(app.settings.language, { dateStyle: "medium", timeStyle: "short" }));
  const title = (path: string) => noteTitle(path, p.project.settings.folders.manuscript);
  const short = (text: string) => (text.length > 160 ? text.slice(0, 160) + "…" : text);
</script>

<div class="history">
  <div class="scope" role="radiogroup" aria-label={t("history.scope")}>
    <label><input type="radio" bind:group={whole} value={false} /> {p.paths.length > 1 ? t("history.chapter") : t("history.scene")}</label>
    <label><input type="radio" bind:group={whole} value={true} /> {t("history.novel")}</label>
  </div>
  <div class="filters">
    <label
      >{t("history.person")}
      <select bind:value={person}>
        <option value="">{t("history.anyone")}</option>
        {#each people as name (name)}<option value={name}>{name}</option>{/each}
      </select></label
    >
    <label>{t("history.from")} <input type="date" bind:value={from} /></label>
    <label>{t("history.to")} <input type="date" bind:value={to} /></label>
  </div>

  {#if shown.length === 0}
    <p class="muted">{entries.length ? t("history.noneFiltered") : t("history.none")}</p>
  {/if}
  <ul>
    {#each shown as entry, i (i + entry.when + entry.by)}
      <li>
        <div class="head">
          <span class="action {entry.action}">{t(`history.action.${entry.action}` as MessageKey)}</span>
          <span class="who">{entry.by} · {dateTime.format(new Date(entry.when))}</span>
        </div>
        {#if whole || p.paths.length > 1}
          <button class="where" onclick={(e) => nav?.open(entry.path, e.altKey)}>{title(entry.path)}</button>
        {/if}
        {#if entry.before || entry.after}
          <p class="text">
            {#if entry.before === entry.after}<mark>{short(entry.before)}</mark>
            {:else}
              {#if entry.before}<del>{short(entry.before)}</del>{/if}
              {#if entry.after}<ins>{short(entry.after)}</ins>{/if}
            {/if}
          </p>
        {/if}
        {#if entry.author}<p class="by">{t(entry.kind === "comment" || entry.kind === "highlight" ? "history.opened" : "history.proposed", { name: entry.author, date: entry.date ?? "" })}</p>{/if}
        {#each entry.discussion as c, j (j)}
          <p class="said"><b>{c.author ?? "?"}</b> {c.text}</p>
        {/each}
      </li>
    {/each}
  </ul>
</div>

<style>
  .history {
    display: grid;
    gap: 10px;
    font-size: 13px;
  }
  .scope {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .scope label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .filters label {
    display: grid;
    gap: 2px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .filters label:first-child {
    grid-column: 1 / -1;
  }
  .filters input,
  .filters select {
    font-size: 12px;
    min-width: 0;
  }
  .muted {
    color: var(--text-muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  li {
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    display: grid;
    gap: 4px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
  }
  .action {
    font-weight: 600;
  }
  .action.accept {
    color: var(--critic-add, #1a7f37);
  }
  .action.reject {
    color: var(--critic-del, #c62828);
  }
  .who,
  .by {
    color: var(--text-muted);
    font-size: 11px;
  }
  .where {
    justify-self: start;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font-size: 12px;
  }
  p {
    margin: 0;
  }
  ins {
    color: var(--critic-add, #1a7f37);
    text-decoration: underline;
  }
  del {
    color: var(--critic-del, #c62828);
    margin-right: 4px;
  }
  mark {
    background: var(--critic-hl, rgba(255, 196, 0, 0.28));
    color: inherit;
  }
  .said {
    font-size: 12px;
  }
</style>
