<script lang="ts">
  import { findNode, scenesOf } from "$lib/core/manuscript";
  import type { Project } from "$lib/core/project";
  import { isView } from "$lib/core/views";
  import { t } from "$lib/state.svelte";
  import { documents, flushAll } from "./documents.svelte";
  import { editorFor, editors } from "./editors.svelte";
  import { navigator } from "./navigation";
  import NoteProperties from "./NoteProperties.svelte";
  import PropertiesPanel from "./PropertiesPanel.svelte";

  /** The properties of what a pane shows, in the side panel while the pane has the cursor. */
  let p: { project: Project; path: string; version: number } = $props();
  const nav = navigator();
  const reload = async () => {
    await nav?.reload();
  };

  const node = $derived.by(() => {
    void p.version;
    return findNode(p.project.manuscript, p.path);
  });
  const text = (path: string) => editorFor(path)?.state.doc.toString() ?? "";
  const sceneTexts = $derived.by(() => {
    void editors.rev;
    return node ? scenesOf(node).map((s) => text(s.path)) : [];
  });
  const activeText = $derived.by(() => {
    void editors.rev;
    return node?.kind === "scene" ? text(node.path) : null;
  });

  async function renameNode(path: string, title: string, file = false) {
    const target = findNode(p.project.manuscript, path);
    // The pane follows the renamed item on its own (see followMoves).
    if (!file && target && target.title !== target.fileTitle) await p.project.retitle(path, title);
    else await p.project.rename(path, title);
    await reload();
  }
</script>

{#if node && node.kind !== "manuscript"}
  <PropertiesPanel
    project={p.project}
    path={p.path}
    rev={p.version}
    localRev={0}
    {sceneTexts}
    {activeText}
    onChanged={reload}
    beforeRead={() => flushAll(p.project)}
    onRestored={() => void documents(p.project).refreshAll()}
    onRename={renameNode}
  />
{:else if isView(p.path, p.project.settings)}
  <p class="muted">{t("panes.noProperties")}</p>
{:else}
  <NoteProperties
    project={p.project}
    path={p.path}
    rev={p.version}
    onChanged={reload}
    onRename={async (path, name) => {
      await p.project.renamePath(path, name);
      await reload();
    }}
  />
{/if}

<style>
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
