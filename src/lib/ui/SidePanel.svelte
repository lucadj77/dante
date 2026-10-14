<script lang="ts" module>
  type Tab = "properties" | "links" | "search";
  // The chosen tab stays the same across sections and notes.
  let remembered = $state<{ tab: Tab }>({ tab: "properties" });
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import LinksPanel from "./LinksPanel.svelte";
  import QuickSearch from "./QuickSearch.svelte";

  interface Props {
    project: Project;
    /** The open note or file. */
    path: string | null;
    /** Changes when the project reloads or a note is saved. */
    version: number;
    diskRev: number;
    properties: Snippet;
  }
  let p: Props = $props();

  const tabs: Tab[] = ["properties", "links", "search"];
</script>

<aside class="side">
  <div class="tabs" role="tablist">
    {#each tabs as tab (tab)}
      <button role="tab" aria-selected={remembered.tab === tab} onclick={() => (remembered.tab = tab)}>{t(`side.${tab}`)}</button>
    {/each}
  </div>
  <div class="body">
    {#if remembered.tab === "properties"}
      {@render p.properties()}
    {:else if remembered.tab === "links"}
      <LinksPanel project={p.project} path={p.path} version={p.version} />
    {:else}
      <QuickSearch project={p.project} version={p.version} diskRev={p.diskRev} />
    {/if}
  </div>
</aside>

<style>
  .side {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--border);
    background: var(--bg-panel);
  }
  .tabs {
    display: flex;
    gap: 2px;
    padding: 6px 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    flex: 1;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    font-size: 12px;
    padding: 6px 4px;
    color: var(--text-muted);
  }
  .tabs button[aria-selected="true"] {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }
</style>
