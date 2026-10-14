<script lang="ts">
  import { onMount } from "svelte";
  import type { Project } from "$lib/core/project";
  import { createSceneEditor, type SceneEditor } from "$lib/editor/sceneEditor";
  import { ACTIONS, ICONS, applyFormat } from "$lib/editor/formatting";
  import { app, t } from "$lib/state.svelte";
  import { formatLabels } from "./formatLabels";
  import { navigator } from "./navigation";

  interface Props {
    project: Project;
    /** The note; the editor is created again when it changes. */
    path: string;
    /** Bumped when files change on disk. */
    diskRev: number;
    /** Shows the formatting buttons above the text. */
    toolbar?: boolean;
    /** Narrow, for the side panel. */
    compact?: boolean;
    /** Called after each save, with the saved body. */
    onSaved?: (body: string) => void;
  }
  let props: Props = $props();
  // The parent keys this component by path.
  // svelte-ignore state_referenced_locally
  const path = props.path;
  const links = navigator()?.links(path);

  let host: HTMLDivElement;
  let editor: SceneEditor | null = null;
  let lastSaved = "";
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let applyingRemote = false;
  let conflict = $state(false);
  let ready = $state(false);
  // svelte-ignore state_referenced_locally
  let seenDiskRev = props.diskRev;

  async function save() {
    clearTimeout(timer);
    if (pending === null) return;
    const text = pending;
    pending = null;
    await props.project.writeBody(path, text);
    lastSaved = text;
    props.onSaved?.(text);
  }

  /** Writes pending changes now; the parent calls it before renaming or moving the note. */
  export function flush(): Promise<void> {
    return save();
  }

  onMount(() => {
    let destroyed = false;
    props.project.readBody(path).then((text) => {
      if (destroyed) return;
      lastSaved = text;
      editor = createSceneEditor({
        parent: host,
        text,
        preview: true,
        typography: props.project.settings.export.typography,
        placeholder: "…",
        onChange(next) {
          if (applyingRemote) return;
          pending = next;
          clearTimeout(timer);
          timer = setTimeout(save, 600);
        },
        formatLabels: formatLabels(),
        links,
      });
      ready = true;
    }, () => {
      // Moved or deleted meanwhile: the parent shows something else.
    });
    return () => {
      destroyed = true;
      // Saving after the file was moved away would recreate it under its old name.
      if (pending !== null) void props.project.fs.exists(path).then((exists) => (exists ? save() : undefined));
      editor?.destroy();
    };
  });

  $effect(() => {
    if (props.diskRev === seenDiskRev) return;
    seenDiskRev = props.diskRev;
    void refresh();
  });

  async function refresh(force = false) {
    if (!editor) return;
    let disk: string;
    try {
      disk = await props.project.readBody(path);
    } catch {
      return;
    }
    if (disk === lastSaved && !force) return;
    if (pending !== null && !force) {
      conflict = true;
      return;
    }
    clearTimeout(timer);
    pending = null;
    applyingRemote = true;
    editor.setText(disk);
    applyingRemote = false;
    lastSaved = disk;
    conflict = false;
  }
</script>

<div class="note" class:compact={props.compact}>
  {#if props.toolbar && app.settings.formatBar}
    {@const labels = formatLabels()}
    <div class="format-row" role="toolbar" aria-label={t("format.bar")}>
      {#each ACTIONS as action, i (i)}
        {#if action === null}
          <span class="cm-format-gap"></span>
        {:else}
          <button
            title={labels[action]}
            aria-label={labels[action]}
            disabled={!ready}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => editor && applyFormat(editor.view, action)}><span style={ICONS[action].style}>{ICONS[action].text}</span></button
          >
        {/if}
      {/each}
    </div>
  {/if}
  {#if conflict}
    <div class="conflict" role="alert">
      {t("editor.changedOnDisk")}
      <button onclick={() => refresh(true)}>{t("editor.reload")}</button>
    </div>
  {/if}
  <div class="page">
    <div class="column" style={props.compact ? "" : `max-width: ${app.settings.lineWidth}ch`}>
      <div class="editor" bind:this={host}></div>
    </div>
  </div>
</div>

<style>
  .note {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .format-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--border);
  }
  .format-row button:disabled {
    opacity: 0.4;
  }
  .page {
    flex: 1;
    overflow: auto;
    padding: 16px 32px 30vh;
  }
  .column {
    margin: 0 auto;
    font-family: var(--editor-font);
    font-size: var(--editor-size);
  }
  .compact .page {
    padding: 4px 0 24px;
    overflow: visible;
  }
  .compact .column {
    font-size: calc(var(--editor-size) * 0.85);
  }
  .conflict {
    margin: 8px 12px;
    background: var(--bg-panel);
    border: 1px solid var(--danger);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
  }
</style>
