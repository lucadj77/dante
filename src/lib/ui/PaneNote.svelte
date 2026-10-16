<script lang="ts">
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import NoteEditor from "./NoteEditor.svelte";
  import NoteProperties from "./NoteProperties.svelte";

  interface Props {
    project: Project;
    path: string;
    rev: number;
    diskRev: number;
    onReload: () => Promise<void>;
  }
  let p: Props = $props();

  // The properties are what a sheet beside the text is mostly for, so they start open.
  let open = $state(true);

  async function rename(path: string, name: string) {
    // The pane follows the renamed note on its own (see followMoves).
    await p.project.renamePath(path, name);
    await p.onReload();
  }
</script>

<div class="pane-note">
  <details class="properties" bind:open>
    <summary>{t("panel.properties")}</summary>
    <NoteProperties project={p.project} path={p.path} rev={p.rev} onChanged={p.onReload} onRename={rename} />
  </details>
  {#key p.path}
    <NoteEditor project={p.project} path={p.path} diskRev={p.diskRev} compact />
  {/key}
</div>

<style>
  .pane-note {
    padding: 0 16px 30vh;
  }
  .properties {
    margin: 8px 0 4px;
    padding: 4px 8px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-panel);
    font-size: 13px;
  }
  .properties summary {
    margin-bottom: 4px;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 12px;
  }
  .properties :global(h3) {
    display: none;
  }
</style>
