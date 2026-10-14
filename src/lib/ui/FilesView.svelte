<script lang="ts">
  import { noteTitle, noteType } from "$lib/core/notes";
  import { basename, dirname, isWithin, rebase } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import { TauriFs } from "$lib/tauriFs";
  import { confirmDelete } from "./dialogs";
  import FileTree, { buildTree } from "./FileTree.svelte";
  import FileViewer, { fileKind } from "./FileViewer.svelte";
  import NoteEditor from "./NoteEditor.svelte";
  import NoteProperties from "./NoteProperties.svelte";
  import SidePanel from "./SidePanel.svelte";
  import { markOnly } from "./folding.svelte";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    /** The folder shown, such as the Research folder. */
    root: string;
    title: string;
    /** The note or file to show. */
    open: string | null;
    onShow: (path: string | null) => void;
    onReload: () => Promise<void>;
  }
  let p: Props = $props();

  let error = $state("");
  let renaming = $state<string | null>(null);
  let menu = $state<{ path: string; dir: boolean; x: number; y: number } | null>(null);
  let saves = $state(0);
  let editor = $state<NoteEditor | null>(null);

  const nodes = $derived.by(() => {
    void p.rev;
    return buildTree(p.root, p.project.files, p.project.folders);
  });
  const current = $derived.by(() => {
    void p.rev;
    return p.open && p.project.files.includes(p.open) ? p.open : null;
  });
  const types = $derived(p.project.settings.types);
  const canImport = $derived(p.project.fs instanceof TauriFs);
  const foldScope = $derived(`${p.project.fs instanceof TauriFs ? p.project.fs.root : "sample"}|${p.root}`);
  const folders = $derived(p.project.folders.filter((f) => isWithin(f, p.root) && f !== p.root));

  /** A note with a type shows the type's icon in the tree. */
  function icon(path: string): string | null {
    if (fileKind(path) !== "note") return null;
    // Only the folder decides here; reading every note's type would slow the tree down.
    const type = noteType(path, {}, p.project.settings);
    return type ? (types[type]?.icon ?? null) : null;
  }

  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    error = "";
    menu = null;
    try {
      await editor?.flush();
      const result = await operation();
      await p.onReload();
      return result;
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
      return undefined;
    }
  }

  /** The folder new things go in: the one asked for, or the open file's, or the root. */
  function targetDir(dir?: string): string {
    if (dir !== undefined) return dir;
    return current && isWithin(current, p.root) ? dirname(current) : p.root;
  }

  async function newNote(dir?: string) {
    const path = await run(() => p.project.createNote(targetDir(dir), t("untitled")));
    if (path) {
      p.onShow(path);
      renaming = path;
    }
  }

  async function newFolder(dir?: string) {
    const path = await run(() => p.project.createFolder(targetDir(dir), t("files.newFolderName")));
    if (path) renaming = path;
  }

  async function importFiles(dir?: string) {
    menu = null;
    if (!(p.project.fs instanceof TauriFs)) return;
    const fs = p.project.fs;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const chosen = await open({ multiple: true, directory: false, title: t("files.import") });
    if (!chosen || chosen.length === 0) return;
    const sources = Array.isArray(chosen) ? chosen : [chosen];
    const imported = await run(() => fs.importFiles(targetDir(dir), sources));
    if (imported?.length) p.onShow(imported[0]);
  }

  async function rename(path: string, name: string) {
    renaming = null;
    const to = await run(() => p.project.renamePath(path, name));
    if (to && p.open && isWithin(p.open, path)) p.onShow(rebase(p.open, path, to));
  }

  async function move(path: string, dir: string) {
    const to = await run(() => p.project.movePath(path, dir));
    if (to && p.open && isWithin(p.open, path)) p.onShow(rebase(p.open, path, to));
  }

  async function remove(path: string) {
    menu = null;
    const isDir = p.project.folders.includes(path);
    const count = p.project.files.filter((f) => isWithin(f, path)).length;
    const name = isDir ? basename(path) : noteTitle(path);
    const message = !isDir ? t("files.deleteFile", { name }) : count === 0 ? t("files.deleteEmptyFolder", { name }) : t("files.deleteFolder", { name, count });
    if (!(await confirmDelete(message))) return;
    const wasOpen = p.open !== null && isWithin(p.open, path);
    await run(() => p.project.trash(path));
    if (wasOpen) p.onShow(null);
  }

  async function openWithSystem(path: string) {
    menu = null;
    try {
      await (p.project.fs as TauriFs).openWithSystem(path);
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }
</script>

<div class="files">
  <aside class="tree" aria-label={p.title}>
    <div class="tree-actions">
      <button onclick={() => newNote()}>{t("files.newNote")}</button>
      <button onclick={() => newFolder()}>{t("files.newFolder")}</button>
      {#if canImport}
        <button onclick={() => importFiles()}>{t("files.import")}</button>
      {/if}
      <span class="fold">
        <button title={t("tree.foldAll")} aria-label={t("tree.foldAll")} onclick={() => markOnly(foldScope, [])}>⊟</button>
        <button title={t("tree.unfoldAll")} aria-label={t("tree.unfoldAll")} onclick={() => markOnly(foldScope, folders)}>⊞</button>
      </span>
    </div>
    {#if nodes.length === 0}
      <p class="empty">{t("files.empty")}</p>
    {/if}
    <FileTree
      {nodes}
      root={p.root}
      selected={current}
      {renaming}
      {icon}
      onOpen={(path) => p.onShow(path)}
      onMenu={(path, dir, x, y) => (menu = { path, dir, x, y })}
      onMove={move}
      onRename={rename}
      onStartRename={(path) => (renaming = path)}
      onCancelRename={() => (renaming = null)}
      onDelete={remove}
      {foldScope}
    />
  </aside>

  {#if menu}
    {@const m = menu}
    <div class="menu-backdrop" role="presentation" onmousedown={() => (menu = null)} oncontextmenu={(e) => { e.preventDefault(); menu = null; }}></div>
    <div class="menu" role="menu" style="left: {m.x}px; top: {m.y}px">
      {#if m.dir}
        <button role="menuitem" onclick={() => newNote(m.path)}>{t("files.newNoteHere")}</button>
        <button role="menuitem" onclick={() => newFolder(m.path)}>{t("files.newFolderHere")}</button>
        {#if canImport}<button role="menuitem" onclick={() => importFiles(m.path)}>{t("files.importHere")}</button>{/if}
      {:else}
        <button role="menuitem" onclick={() => { const path = m.path; menu = null; p.onShow(path); }}>{t("files.open")}</button>
        {#if canImport}<button role="menuitem" onclick={() => openWithSystem(m.path)}>{t("files.openWithSystem")}</button>{/if}
      {/if}
      <button role="menuitem" onclick={() => { const path = m.path; menu = null; renaming = path; }}>{t("tree.rename")}</button>
      <hr />
      <button role="menuitem" class="danger" onclick={() => remove(m.path)}>{t("tree.deleteItem")}</button>
    </div>
  {/if}

  <main class="center">
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    {#if current && fileKind(current) === "note"}
      {#key current}
        <header class="note-title">{noteTitle(current)}</header>
        <NoteEditor bind:this={editor} project={p.project} path={current} diskRev={p.diskRev} toolbar onSaved={() => saves++} />
      {/key}
    {:else if current}
      {#key current}
        <FileViewer project={p.project} path={current} />
      {/key}
    {:else}
      <p class="empty center-empty">{t("files.nothingOpen")}</p>
    {/if}
  </main>

  <SidePanel project={p.project} path={current} version={p.rev * 10000 + saves} diskRev={p.diskRev}>
    {#snippet properties()}
      {#if current}
        <NoteProperties project={p.project} path={current} rev={p.rev} onChanged={p.onReload} onRename={rename} />
      {:else}
        <p class="empty">{t("files.nothingOpen")}</p>
      {/if}
    {/snippet}
  </SidePanel>
</div>

<style>
  .files {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr) 280px;
    height: 100%;
    min-height: 0;
  }
  .tree {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
    overflow: auto;
    padding: 8px;
  }
  .tree-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }
  .fold {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }
  .tree-actions .fold button {
    padding: 0 6px;
    font-size: 14px;
  }
  .tree-actions button {
    font-size: 12px;
    padding: 2px 8px;
  }
  .center {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--editor-bg);
  }
  .note-title {
    padding: 10px 16px 0;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: center;
  }
  .empty {
    color: var(--text-muted);
    padding: 8px;
  }
  .center-empty {
    padding: 48px;
    text-align: center;
  }
  .error {
    color: var(--danger);
    padding: 0 12px;
  }
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
  }
  .menu {
    position: fixed;
    z-index: 21;
    display: grid;
    min-width: 200px;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  }
  .menu button {
    padding: 6px 10px;
    border: none;
    background: none;
    text-align: left;
  }
  .menu button:hover {
    background: var(--bg-hover);
  }
  .menu hr {
    width: 100%;
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--border);
  }
  .menu .danger {
    color: var(--danger);
  }
</style>
