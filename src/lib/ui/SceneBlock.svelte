<script lang="ts" module>
  import type { Action } from "$lib/editor/formatting";

  export interface SceneHandle {
    /** Writes pending changes now. */
    flush(): Promise<void>;
    /** Drops pending changes, for operations that rewrite the scene themselves. */
    cancel(): void;
    focus(at: "start" | "end"): void;
    /** Applies a formatting action to the selection. */
    format(action: Action): void;
    /** Splits the scene at the cursor into a new scene or chapter. */
    split(kind: "scene" | "chapter"): void;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ManuscriptNode } from "$lib/core/manuscript";
  import type { Project } from "$lib/core/project";
  import { createSceneEditor, type SceneEditor } from "$lib/editor/sceneEditor";
  import { app, t } from "$lib/state.svelte";
  import { applyFormat } from "$lib/editor/formatting";
  import { formatLabels, searchPhrases, tableLabels } from "./formatLabels";
  import { pendingFind, takeFind } from "./find.svelte";
  import { navigator } from "./navigation";
  import { collaboration } from "./collaboration.svelte";
  import { criticHandlerFor } from "./editors.svelte";
  import { documents, sharing } from "./documents.svelte";
  import { blankLineAskFor } from "./blankHabit";

  interface Props {
    project: Project;
    node: ManuscriptNode;
    raw: boolean;
    typewriter: boolean;
    focusMode: boolean;
    diskRev: number;
    register: (path: string, handle: SceneHandle | null) => void;
    onSplitScene: (path: string, before: string, after: string) => void;
    onSplitChapter: (path: string, before: string, after: string) => void;
    onLeave: (path: string, direction: "up" | "down") => boolean;
    onFocus: (path: string) => void;
    /** The text selected in the scene, "" when none. */
    onSelection?: (path: string, text: string) => void;
    onText: (path: string, text: string) => void;
    onAddAfter: (path: string) => void;
    onRename: (path: string, title: string) => void;
    /** The scene being written, marked when others are on screen too. */
    current?: boolean;
  }
  let props: Props = $props();
  // Each block is keyed by its path in the list, so the path never changes.
  // svelte-ignore state_referenced_locally
  const path = props.node.path;

  const links = navigator()?.links(path);
  const collab = collaboration(path, { raw: () => props.raw });
  // The same scene can be open in a pane too: both editors write through one document.
  // svelte-ignore state_referenced_locally
  const doc = documents(props.project).get(path, props.raw);
  doc.snapshots = true;
  const shared = sharing(doc);
  let host: HTMLDivElement;
  let editor: SceneEditor | null = null;
  let ready = $state(false);
  let conflict = $state(doc.conflict);
  let failed = $state(doc.failed);
  let renaming = $state(false);
  let draft = $state("");

  function startRename() {
    draft = props.node.title;
    renaming = true;
  }

  function commitRename() {
    if (!renaming) return;
    renaming = false;
    if (draft.trim() && draft !== props.node.title) props.onRename(path, draft);
  }

  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
  // svelte-ignore state_referenced_locally
  let seenDiskRev = props.diskRev;

  const handle: SceneHandle = {
    flush: () => doc.flush(),
    cancel() {
      doc.cancel();
    },
    focus(at) {
      editor?.focus(at);
    },
    format(action) {
      if (editor) applyFormat(editor.view, action);
    },
    split(kind) {
      editor?.split(kind);
    },
  };

  /** What an empty scene says: where to write, how to go on, where the scene's details are. */
  function emptyHint(): HTMLElement {
    const box = document.createElement("span");
    box.className = "empty-hint";
    for (const key of ["editor.emptyScene1", "editor.emptyScene2", "editor.emptyScene3"] as const) {
      const line = document.createElement("span");
      line.textContent = t(key);
      box.append(line);
    }
    return box;
  }

  onMount(() => {
    let destroyed = false;
    const unwatch = doc.watch(() => {
      conflict = doc.conflict;
      failed = doc.failed;
    });
    doc.text().then((text) => {
      if (destroyed) return;
      props.onText(path, text);
      editor = createSceneEditor({
        parent: host,
        text,
        preview: !props.raw,
        // The raw view shows properties too, where quotes are YAML syntax.
        typography: props.raw ? undefined : props.project.settings.export.typography,
        placeholder: props.raw ? "…" : emptyHint(),
        onChange(next) {
          props.onText(path, next);
          collab.changed();
        },
        onSplitScene: (before, after) => props.onSplitScene(path, before, after),
        onSplitChapter: (before, after) => props.onSplitChapter(path, before, after),
        onLeave: (direction) => props.onLeave(path, direction),
        onSelection: (text) => props.onSelection?.(path, text),
        onFocus: () => {
          props.onFocus(path);
          collab.focused();
        },
        formatLabels: formatLabels(),
        tableLabels: tableLabels(),
        phrases: searchPhrases(),
        links,
        critic: criticHandlerFor(path),
        language: props.project.settings.language,
        blankLines: blankLineAskFor(props.project),
        extensions: [shared.extension],
      });
      shared.attach(editor.view);
      editor.setSpelling(app.settings.spellcheck);
      editor.setParagraphs(app.settings.paragraphs);
      editor.setModes({ typewriter: props.typewriter, focus: props.focusMode, line: app.settings.lineHighlight });
      collab.ready(editor);
      props.register(path, handle);
      ready = true;
    }, () => {
      // Moved or renamed meanwhile: the reloaded tree mounts the scene under its new path.
    });
    return () => {
      destroyed = true;
      unwatch();
      props.register(path, null);
      collab.destroy();
      shared.detach();
      editor?.destroy();
    };
  });

  // The props are read before the editor exists too, so the effect follows them.
  $effect(() => {
    const modes = { typewriter: props.typewriter, focus: props.focusMode, line: app.settings.lineHighlight };
    editor?.setModes(modes);
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
    if (!ready || pendingFind.request?.path !== path) return;
    const request = takeFind(path);
    if (request) editor?.find(request);
  });

  // Files changed on disk: take the new text unless there are unsaved edits.
  $effect(() => {
    if (props.diskRev === seenDiskRev) return;
    seenDiskRev = props.diskRev;
    void doc.refresh();
  });

  function refresh(force = false) {
    void doc.refresh(force);
  }
</script>

<section class="scene" class:raw={props.raw} class:current={props.current} data-scene={path}>
  <header>
    {#if renaming}
      <input
        class="title"
        bind:value={draft}
        use:focusOnMount
        aria-label={t("tree.rename")}
        onblur={commitRename}
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commitRename();
          if (e.key === "Escape") renaming = false;
        }}
      />
    {:else}
      <button class="title" title={t("tree.renameHint")} onclick={startRename}>{props.node.title}</button>
    {/if}
    <button class="add" title={t("editor.addScene")} onclick={() => props.onAddAfter(path)}>+</button>
  </header>
  {#if collab.holder}
    <div class="presence" role="status">
      {t("presence.editing", { user: collab.holder.user })}
      <button onclick={() => collab.force()}>{t("presence.editAnyway")}</button>
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
  <div class="editor" bind:this={host}></div>
</section>

<style>
  .scene {
    position: relative;
    margin: 0 0 8px;
    scroll-margin-top: 12px;
  }
  /* The scene with the cursor: a bar beside the text and its title in the accent colour. */
  .scene.current::before {
    content: "";
    position: absolute;
    left: -18px;
    top: 36px;
    bottom: 0;
    width: 3px;
    border-radius: 2px;
    background: var(--accent);
  }
  .scene.current header {
    color: var(--accent);
    font-weight: 600;
  }
  .scene.current header::before,
  .scene.current header::after {
    border-top-color: var(--accent);
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 24px 0 8px;
    color: var(--text-muted);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  header::before,
  header::after {
    content: "";
    flex: 1;
    border-top: 1px solid var(--border);
  }
  .add {
    order: 3;
    border: none;
    padding: 0 6px;
    opacity: 0;
    font-size: 16px;
    line-height: 1;
  }
  header:hover .add,
  .add:focus-visible {
    opacity: 1;
  }
  .title {
    order: 1;
    border: none;
    background: none;
    padding: 0 4px;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    cursor: text;
  }
  input.title {
    text-transform: none;
    letter-spacing: normal;
    font-size: 13px;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
    min-width: 16ch;
  }
  header::after {
    order: 2;
  }
  .presence {
    background: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .conflict {
    background: var(--bg-panel);
    border: 1px solid var(--danger);
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 8px;
    font-size: 13px;
  }
</style>
