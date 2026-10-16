<script lang="ts">
  import type { Backlink } from "$lib/core/notes";
  import { noteTitle } from "$lib/core/notes";
  import { dirname } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import { navigator } from "./navigation";

  interface Props {
    project: Project;
    path: string | null;
    /** Changes when the project reloads or a note is saved. */
    version: number;
  }
  let p: Props = $props();
  const nav = navigator();

  let backlinks = $state<Backlink[]>([]);
  let outgoing = $state<string[]>([]);
  let unresolved = $state<string[]>([]);

  $effect(() => {
    void p.version;
    const path = p.path;
    if (!path) {
      backlinks = [];
      outgoing = [];
      unresolved = [];
      return;
    }
    void p.project.index().then((index) => {
      if (p.path !== path) return;
      backlinks = index.backlinks(path);
      outgoing = index.notes.get(path)?.links ?? [];
      unresolved = index.unresolved(path);
    });
  });

  const title = (path: string) => noteTitle(path, p.project.settings.folders.manuscript);

  /** A line of the linking note, with [[target|alias]] shown as its alias. */
  function readable(line: string): string {
    return line.replace(/!?\[\[([^\[\]|\n]+)(?:\|([^\[\]\n]*))?\]\]/g, (_m, target: string, alias?: string) => alias ?? target.split("#")[0]);
  }
</script>

<section>
  <h3>{t("links.backlinks")} <span class="count">{backlinks.length}</span></h3>
  {#if backlinks.length === 0}
    <p class="muted">{t("links.noBacklinks")}</p>
  {/if}
  <ul>
    {#each backlinks as link (link.from)}
      <li>
        <button class="beside" title={t("tip.openBeside")} aria-label={t("panes.openBeside")} onclick={() => nav?.open(link.from, true)}>⧉</button>
        <button class="link" onclick={(e) => nav?.open(link.from, e.altKey)}>
          <span class="title">{title(link.from)}</span>
          <span class="where">{dirname(link.from)}</span>
        </button>
        {#each link.lines.slice(0, 3) as line, i (i)}
          <p class="line">{readable(line)}</p>
        {/each}
      </li>
    {/each}
  </ul>
</section>

{#if p.path?.toLowerCase().endsWith(".md")}
<section>
  <h3>{t("links.outgoing")} <span class="count">{outgoing.length}</span></h3>
  {#if outgoing.length === 0 && unresolved.length === 0}
    <p class="muted">{t("links.noOutgoing")}</p>
  {/if}
  <ul>
    {#each outgoing as target (target)}
      <li>
        <button class="beside" title={t("tip.openBeside")} aria-label={t("panes.openBeside")} onclick={() => nav?.open(target, true)}>⧉</button>
        <button class="link" onclick={(e) => nav?.open(target, e.altKey)}>
          <span class="title">{title(target)}</span>
          <span class="where">{dirname(target)}</span>
        </button>
      </li>
    {/each}
    {#each unresolved as target (target)}
      <li>
        <span class="link missing" title={t("links.missing")}>
          <span class="title">{target}</span>
          <span class="where">{t("links.missing")}</span>
        </span>
      </li>
    {/each}
  </ul>
</section>
{/if}

<style>
  section + section {
    margin-top: 24px;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .count {
    font-weight: 400;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    position: relative;
    margin-bottom: 10px;
  }
  /* Opens the note beside the section, shown on the row under the pointer. */
  .beside {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 0 5px;
    border: none;
    background: none;
    color: var(--text-muted);
    opacity: 0;
  }
  li:hover .beside,
  .beside:focus-visible {
    opacity: 1;
  }
  .link {
    display: grid;
    width: 100%;
    gap: 1px;
    padding: 4px 6px;
    border: none;
    border-radius: 4px;
    text-align: left;
  }
  .title {
    color: var(--wikilink);
  }
  .missing .title {
    color: var(--text-muted);
    text-decoration: underline dotted;
  }
  .where {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .line {
    margin: 2px 6px 0 12px;
    font-size: 12px;
    color: var(--text-muted);
    border-left: 2px solid var(--border);
    padding-left: 6px;
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
