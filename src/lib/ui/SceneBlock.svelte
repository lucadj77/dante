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
  import { t } from "$lib/state.svelte";
  import { applyFormat } from "$lib/editor/formatting";
  import { formatLabels } from "./formatLabels";
  import { navigator } from "./navigation";
  import { collaboration } from "./collaboration.svelte";
  import { criticHandlerFor } from "./editors.svelte";

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
  let host: HTMLDivElement;
  let editor: SceneEditor | null = null;
  let lastSaved = "";
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let applyingRemote = false;
  let snapshotting: Promise<void> | null = null;
  let conflict = $state(false);
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

  const read = () => (props.raw ? props.project.fs.readText(path) : props.project.readBody(path));

  async function save() {
    clearTimeout(timer);
    if (pending === null) return;
    // The session's first snapshot must hold the text from before this change.
    await snapshotting;
    const text = pending;
    if (text === null) return;
    pending = null;
    if (props.raw) await props.project.fs.writeText(path, text);
    else await props.project.writeBody(path, text);
    lastSaved = text;
  }

  const handle: SceneHandle = {
    flush: save,
    cancel() {
      clearTimeout(timer);
      pending = null;
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

  onMount(() => {
    let destroyed = false;
    read().then((text) => {
      if (destroyed) return;
      lastSaved = text;
      props.onText(path, text);
      editor = createSceneEditor({
        parent: host,
        text,
        preview: !props.raw,
        // The raw view shows properties too, where quotes are YAML syntax.
        typography: props.raw ? undefined : props.project.settings.export.typography,
        placeholder: "…",
        onChange(next) {
          props.onText(path, next);
          collab.changed();
          if (applyingRemote) return;
          snapshotting ??= props.project.autoSnapshot(path).catch(() => {});
          pending = next;
          clearTimeout(timer);
          timer = setTimeout(save, 600);
        },
        onSplitScene: (before, after) => props.onSplitScene(path, before, after),
        onSplitChapter: (before, after) => props.onSplitChapter(path, before, after),
        onLeave: (direction) => props.onLeave(path, direction),
        onFocus: () => {
          props.onFocus(path);
          collab.focused();
        },
        formatLabels: formatLabels(),
        links,
        critic: criticHandlerFor(path),
      });
      editor.setModes({ typewriter: props.typewriter, focus: props.focusMode });
      collab.ready(editor);
      props.register(path, handle);
    }, () => {
      // Moved or renamed meanwhile: the reloaded tree mounts the scene under its new path.
    });
    return () => {
      destroyed = true;
      // Saving after the file was moved away would recreate it under its old name.
      if (pending !== null) void props.project.fs.exists(path).then((exists) => (exists ? save() : undefined));
      props.register(path, null);
      collab.destroy();
      editor?.destroy();
    };
  });

  // The props are read before the editor exists too, so the effect follows them.
  $effect(() => {
    const modes = { typewriter: props.typewriter, focus: props.focusMode };
    editor?.setModes(modes);
  });

  // Files changed on disk: take the new text unless there are unsaved edits.
  $effect(() => {
    if (props.diskRev === seenDiskRev) return;
    seenDiskRev = props.diskRev;
    void refresh();
  });

  async function refresh(force = false) {
    if (!editor) return;
    let disk: string;
    try {
      disk = await read();
    } catch {
      return; // Renamed or deleted: the tree reload takes care of it.
    }
    if (disk === lastSaved && !force) return;
    if (pending !== null && !force) {
      conflict = true;
      return;
    }
    handle.cancel();
    applyingRemote = true;
    editor.setText(disk);
    applyingRemote = false;
    lastSaved = disk;
    conflict = false;
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
