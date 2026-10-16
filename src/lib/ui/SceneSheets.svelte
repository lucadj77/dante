<script lang="ts">
  import type { NoteIndex } from "$lib/core/notes";
  import { noteTitle } from "$lib/core/notes";
  import type { Project } from "$lib/core/project";
  import { sceneSheets } from "$lib/core/statistics";
  import { t } from "$lib/state.svelte";
  import { editorFor, editors } from "./editors.svelte";
  import { panes, setPaneSheet, type Pane } from "./panes.svelte";
  import PaneNote from "./PaneNote.svelte";

  interface Props {
    project: Project;
    pane: Pane;
    rev: number;
    diskRev: number;
    onReload: () => Promise<void>;
  }
  let p: Props = $props();

  let index = $state.raw<NoteIndex | null>(null);
  $effect(() => {
    void p.rev;
    void p.diskRev;
    void p.project.index().then((i) => (index = i));
  });

  const scene = $derived(panes.writing);
  /** The Codex sheets the scene names or links to, following its text as it is typed. */
  const sheets = $derived.by(() => {
    void editors.rev;
    if (!scene || !index) return [];
    const text = editorFor(scene)?.state.doc.toString() ?? index.notes.get(scene)?.body ?? "";
    return sceneSheets(text, index.notes.get(scene)?.links ?? [], index, p.project.settings);
  });
  // The sheet chosen stays while the next scene names it too.
  const shown = $derived(sheets.find((s) => s.path === p.pane.sheet)?.path ?? sheets[0]?.path ?? null);
  // Remembered, so the side panel and the next start show the same sheet.
  $effect(() => {
    if (shown && shown !== p.pane.sheet) setPaneSheet(p.pane.id, shown);
  });
</script>

<div class="sheets">
  {#if !scene}
    <p class="hint">{t("panes.sheetsNoScene")}</p>
  {:else}
    <p class="scene">{t("panes.sheetsOf", { scene: noteTitle(scene, p.project.settings.folders.manuscript) })}</p>
    {#if sheets.length === 0}
      <p class="hint">{t("panes.sheetsNone")}</p>
    {:else}
      <div class="tabs" role="tablist">
        {#each sheets as sheet (sheet.path)}
          <button role="tab" aria-selected={sheet.path === shown} title={sheet.path} onclick={() => setPaneSheet(p.pane.id, sheet.path)}
            >{p.project.settings.types[sheet.type]?.icon ?? ""} {sheet.title}</button
          >
        {/each}
      </div>
    {/if}
  {/if}
  {#if shown}
    {#key shown}
      <PaneNote project={p.project} path={shown} rev={p.rev} diskRev={p.diskRev} onReload={p.onReload} />
    {/key}
  {/if}
</div>

<style>
  .scene {
    margin: 8px 16px 4px;
    color: var(--text-muted);
    font-size: 12px;
  }
  .hint {
    margin: 12px 16px;
    color: var(--text-muted);
    font-size: 13px;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 16px 8px;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 12px;
  }
  .tabs button[aria-selected="true"] {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
