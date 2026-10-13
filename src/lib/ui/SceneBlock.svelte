<script lang="ts" module>
  export interface SceneHandle {
    /** Writes pending changes now. */
    flush(): Promise<void>;
    /** Drops pending changes, for operations that rewrite the scene themselves. */
    cancel(): void;
    focus(at: "start" | "end"): void;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ManuscriptNode } from "$lib/core/manuscript";
  import type { Project } from "$lib/core/project";
  import { createSceneEditor, type SceneEditor } from "$lib/editor/sceneEditor";
  import { t } from "$lib/state.svelte";

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
  }
  let props: Props = $props();
  // Each block is keyed by its path in the list, so the path never changes.
  // svelte-ignore state_referenced_locally
  const path = props.node.path;

  let host: HTMLDivElement;
  let editor: SceneEditor | null = null;
  let lastSaved = "";
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let applyingRemote = false;
  let conflict = $state(false);
  // svelte-ignore state_referenced_locally
  let seenDiskRev = props.diskRev;

  const read = () => (props.raw ? props.project.fs.readText(path) : props.project.readBody(path));

  async function save() {
    clearTimeout(timer);
    if (pending === null) return;
    const text = pending;
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
        placeholder: "…",
        onChange(next) {
          props.onText(path, next);
          if (applyingRemote) return;
          pending = next;
          clearTimeout(timer);
          timer = setTimeout(save, 600);
        },
        onSplitScene: (before, after) => props.onSplitScene(path, before, after),
        onSplitChapter: (before, after) => props.onSplitChapter(path, before, after),
        onLeave: (direction) => props.onLeave(path, direction),
        onFocus: () => props.onFocus(path),
      });
      editor.setModes({ typewriter: props.typewriter, focus: props.focusMode });
      props.register(path, handle);
    });
    return () => {
      destroyed = true;
      // Saving after the file was moved away would recreate it under its old name.
      if (pending !== null) void props.project.fs.exists(path).then((exists) => (exists ? save() : undefined));
      props.register(path, null);
      editor?.destroy();
    };
  });

  $effect(() => {
    editor?.setModes({ typewriter: props.typewriter, focus: props.focusMode });
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

<section class="scene" class:raw={props.raw}>
  <header>
    <span class="title">{props.node.title}</span>
    <button class="add" title={t("editor.addScene")} onclick={() => props.onAddAfter(path)}>+</button>
  </header>
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
    margin: 0 0 8px;
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
  }
  header::after {
    order: 2;
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
