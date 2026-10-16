<script lang="ts" module>
  type Tab = "properties" | "links" | "comments";
  // The chosen tab stays the same across sections and notes.
  let remembered = $state<{ tab: Tab }>({ tab: "properties" });
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import LinksPanel from "./LinksPanel.svelte";
  import CommentsPanel from "./CommentsPanel.svelte";
  import { editorFor, editors } from "./editors.svelte";
  import { parseCritic } from "$lib/core/critic";
  import { findNode, scenesOf } from "$lib/core/manuscript";
  import { focusedPane, shownIn } from "./panes.svelte";
  import PaneProperties from "./PaneProperties.svelte";

  interface Props {
    project: Project;
    /** The open note or file. */
    path: string | null;
    /** Changes when the project reloads or a note is saved. */
    version: number;
    diskRev: number;
    properties: Snippet;
    /** Whose comments the comments tab lists; the open note when absent. */
    commentPaths?: string[];
  }
  let p: Props = $props();

  const tabs: Tab[] = ["properties", "links", "comments"];
  // While a pane beside the section has the cursor, the panel shows what the pane shows.
  const pane = $derived(focusedPane());
  const path = $derived(pane ? shownIn(pane) : p.path);
  const commentPaths = $derived.by(() => {
    if (!pane) return p.commentPaths ?? (p.path ? [p.path] : []);
    if (!path) return [];
    const node = findNode(p.project.manuscript, path);
    return node && node.kind !== "scene" ? scenesOf(node).map((s) => s.path) : [path];
  });
  const commentCount = $derived.by(() => {
    void editors.rev;
    return commentPaths.reduce((n, path) => n + parseCritic(editorFor(path)?.state.doc.toString() ?? "").length, 0);
  });

  // An editor asked for the comments: starting one, or clicking a bubble.
  $effect(() => {
    if (editors.tab) {
      remembered.tab = editors.tab;
      editors.tab = null;
    }
  });
</script>

<aside class="side">
  <div class="tabs" role="tablist">
    {#each tabs as tab (tab)}
      <button role="tab" aria-selected={remembered.tab === tab} title={t(`tip.side.${tab}`)} onclick={() => (remembered.tab = tab)}
        >{t(`side.${tab}`)}{#if tab === "comments" && commentCount}<span class="badge">{commentCount}</span>{/if}</button
      >
    {/each}
  </div>
  <div class="body">
    {#if remembered.tab === "properties"}
      {#if !pane}
        {@render p.properties()}
      {:else if path}
        {#key path}<PaneProperties project={p.project} {path} version={p.version} />{/key}
      {/if}
    {:else if remembered.tab === "links"}
      <LinksPanel project={p.project} {path} version={p.version} />
    {:else}
      <CommentsPanel project={p.project} paths={commentPaths} />
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
  .badge {
    margin-left: 4px;
    padding: 0 5px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--bg);
    font-size: 10px;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }
</style>
