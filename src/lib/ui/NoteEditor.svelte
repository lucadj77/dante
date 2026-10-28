<script lang="ts">
  import { onMount } from "svelte";
  import type { Project } from "$lib/core/project";
  import { createSceneEditor, type SceneEditor } from "$lib/editor/sceneEditor";
  import { ACTIONS, ICONS, applyFormat } from "$lib/editor/formatting";
  import { app, t } from "$lib/state.svelte";
  import { formatLabels, searchPhrases, tableLabels } from "./formatLabels";
  import { pendingFind, takeFind } from "./find.svelte";
  import Icon from "./Icon.svelte";
  import { navigator } from "./navigation";
  import { collaboration } from "./collaboration.svelte";
  import { criticHandlerFor } from "./editors.svelte";
  import { documents, sharing } from "./documents.svelte";

  interface Props {
    project: Project;
    /** The note; the editor is created again when it changes. */
    path: string;
    /** Bumped when files change on disk. */
    diskRev: number;
    /** Shows the formatting buttons above the text. */
    toolbar?: boolean;
    /** Narrow, for the side panel or a pane. */
    compact?: boolean;
    /** A preview, as in the search, not where the note is edited. */
    preview?: boolean;
    /** Called after each save, with the saved body. */
    onSaved?: (body: string) => void;
    /** Called when the text gets the cursor. */
    onFocus?: () => void;
  }
  let props: Props = $props();
  // The parent keys this component by path.
  // svelte-ignore state_referenced_locally
  const path = props.path;
  const links = navigator()?.links(path);
  // svelte-ignore state_referenced_locally
  const collab = props.preview ? null : collaboration(path);

  // The same note can be open in a pane too: both editors write through one document.
  // svelte-ignore state_referenced_locally
  const doc = documents(props.project).get(path);
  const shared = sharing(doc);

  let host: HTMLDivElement;
  let editor: SceneEditor | null = null;
  let conflict = $state(doc.conflict);
  let failed = $state(doc.failed);
  let ready = $state(false);
  // svelte-ignore state_referenced_locally
  let seenDiskRev = props.diskRev;

  /** Writes pending changes now; the parent calls it before renaming or moving the note. */
  export function flush(): Promise<void> {
    return doc.flush();
  }

  onMount(() => {
    let destroyed = false;
    const unwatch = doc.watch(() => {
      conflict = doc.conflict;
      failed = doc.failed;
    });
    const unsaved = doc.onSaved((text) => props.onSaved?.(text));
    doc.text().then((text) => {
      if (destroyed) return;
      editor = createSceneEditor({
        parent: host,
        text,
        preview: true,
        typography: props.project.settings.export.typography,
        placeholder: "…",
        onChange() {
          collab?.changed();
        },
        formatLabels: formatLabels(),
        tableLabels: tableLabels(),
        phrases: searchPhrases(),
        links,
        critic: collab ? criticHandlerFor(path) : undefined,
        onFocus: () => {
          collab?.focused();
          props.onFocus?.();
        },
        language: props.project.settings.language,
        extensions: [shared.extension],
      });
      shared.attach(editor.view);
      editor.setSpelling(app.settings.spellcheck);
      editor.setParagraphs(app.settings.paragraphs);
      collab?.ready(editor);
      ready = true;
    }, () => {
      // Moved or deleted meanwhile: the parent shows something else.
    });
    return () => {
      destroyed = true;
      unwatch();
      unsaved();
      collab?.destroy();
      shared.detach();
      editor?.destroy();
    };
  });

  $effect(() => {
    const on = app.settings.spellcheck;
    editor?.setSpelling(on);
  });

  $effect(() => {
    const on = app.settings.paragraphs;
    editor?.setParagraphs(on);
  });

  // A match chosen in the project's find and replace.
  $effect(() => {
    if (!ready || props.preview || pendingFind.request?.path !== path) return;
    const request = takeFind(path);
    if (request) editor?.find(request);
  });

  $effect(() => {
    if (props.diskRev === seenDiskRev) return;
    seenDiskRev = props.diskRev;
    void doc.refresh();
  });

  function refresh(force = false) {
    void doc.refresh(force);
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
            onclick={() => editor && applyFormat(editor.view, action)}>{#if ICONS[action].icon}<Icon name={ICONS[action].icon} />{:else}<span style={ICONS[action].style}>{ICONS[action].text}</span>{/if}</button
          >
        {/if}
      {/each}
    </div>
  {/if}
  {#if collab?.holder}
    <div class="presence" role="status">
      {t("presence.editingNote", { user: collab.holder.user })}
      <button onclick={() => collab?.force()}>{t("presence.editAnyway")}</button>
    </div>
  {/if}
  {#if failed}
    <div class="conflict" role="alert">{t("editor.saveFailed")}</div>
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
  .presence {
    margin: 8px 12px;
    background: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
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
