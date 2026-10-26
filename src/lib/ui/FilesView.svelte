<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import { onDisk, projectKey } from "$lib/platform";
  import type { Snippet } from "svelte";
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
  import { columns, layout, width } from "./layout.svelte";
  import Resizer from "./Resizer.svelte";
  import { hasMarks, mark, markOnly } from "./folding.svelte";
  import { navigator } from "./navigation";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    /** The folder shown, such as the Research folder. */
    root: string;
    /**
     * Several folders shown together, each at the top of the tree, such as Research and
     * Laboratory in Notes; `root` is then ignored. New notes go in the last one, files added
     * from the computer in the first.
     */
    roots?: string[];
    title: string;
    /** The note or file to show. */
    open: string | null;
    onShow: (path: string | null) => void;
    onReload: () => Promise<void>;
    /** The panes beside the note, if any are open. */
    beside?: Snippet | null;
  }
  let p: Props = $props();
  const nav = navigator();

  let error = $state("");
  let renaming = $state<string | null>(null);
  let menu = $state<{ path: string; dir: boolean; x: number; y: number } | null>(null);
  let saves = $state(0);
  let editor = $state<NoteEditor | null>(null);

  const roots = $derived(p.roots ?? [p.root]);
  const several = $derived(!!p.roots);
  /** The folder the tree is drawn from: the project's own when it shows several. */
  const treeRoot = $derived(several ? "" : p.root);
  const nodes = $derived.by(() => {
    void p.rev;
    if (!several) return buildTree(p.root, p.project.files, p.project.folders);
    return roots.map((r) => ({ path: r, name: basename(r), dir: true, children: buildTree(r, p.project.files, p.project.folders) }));
  });
  const isRoot = (path: string) => roots.includes(path);
  const inRoots = (path: string) => roots.some((r) => isWithin(path, r));
  const current = $derived.by(() => {
    void p.rev;
    return p.open && p.project.files.includes(p.open) ? p.open : null;
  });
  const types = $derived(p.project.settings.types);
  const canImport = $derived(onDisk(p.project.fs));
  const desktop = $derived(p.project.fs instanceof TauriFs);
  /** In a browser, files are imported through the page's own file picker. */
  let picker = $state<HTMLInputElement>();
  let pickerDir = "";
  const foldScope = $derived(`${projectKey(p.project.fs)}|${roots.join("|")}`);
  /** Each folder, or group of folders, keeps its own panel widths. */
  const widthKey = $derived(`files|${roots.join("|")}`);
  const folders = $derived(p.project.folders.filter((f) => inRoots(f) && (several || f !== p.root)));
  // The folders at the top start open, the first time the tree is seen.
  $effect(() => {
    if (several && !hasMarks(foldScope)) mark(foldScope, roots, true);
  });

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
      error = failure(e);
      return undefined;
    }
  }

  /** The folder new things go in: the one asked for, or the open file's, or the root. */
  function targetDir(dir?: string, first = false): string {
    if (dir !== undefined) return dir;
    if (current && inRoots(current)) return dirname(current);
    return first ? roots[0] : roots[roots.length - 1];
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
    if (!(p.project.fs instanceof TauriFs)) {
      pickerDir = targetDir(dir, true);
      picker?.click();
      return;
    }
    const fs = p.project.fs;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const chosen = await open({ multiple: true, directory: false, title: t("files.import") });
    if (!chosen || chosen.length === 0) return;
    const sources = Array.isArray(chosen) ? chosen : [chosen];
    const imported = await run(() => fs.importFiles(targetDir(dir, true), sources));
    if (imported?.length) p.onShow(imported[0]);
  }

  async function importPicked(files: File[]) {
    const dir = pickerDir;
    const imported = await run(async () => {
      const paths: string[] = [];
      for (const file of files) paths.push(await p.project.importFile(dir, file.name, new Uint8Array(await file.arrayBuffer())));
      return paths;
    });
    if (imported?.length) p.onShow(imported[0]);
  }

  async function rename(path: string, name: string) {
    renaming = null;
    if (isRoot(path)) return;
    const to = await run(() => p.project.renamePath(path, name));
    if (to && p.open && isWithin(p.open, path)) p.onShow(rebase(p.open, path, to));
  }

  async function move(path: string, dir: string) {
    // The folders at the top stay where they are, and nothing leaves them.
    if (isRoot(path) || !inRoots(dir)) return;
    const to = await run(() => p.project.movePath(path, dir));
    if (to && p.open && isWithin(p.open, path)) p.onShow(rebase(p.open, path, to));
  }

  async function remove(path: string) {
    menu = null;
    if (isRoot(path)) return;
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
      error = failure(e);
    }
  }
</script>

<div class="files" style:grid-template-columns={columns(widthKey, 260, 280, !!p.beside)}>
  {#if layout.left}<Resizer section={widthKey} side="left" usual={260} other={layout.right ? width(widthKey, "right", 280) : 0} />{/if}
  {#if layout.right}<Resizer section={widthKey} side="right" usual={280} other={layout.left ? width(widthKey, "left", 260) : 0} />{/if}
  {#if layout.left}
  <aside class="tree" aria-label={p.title}>
    <div class="tree-actions">
      <button title={t("tip.newNote")} onclick={() => newNote()}>{t("files.newNote")}</button>
      <button title={t("tip.newFolder")} onclick={() => newFolder()}>{t("files.newFolder")}</button>
      {#if canImport}
        <button title={t("tip.import")} onclick={() => importFiles()}>{t("files.import")}</button>
        <input
          bind:this={picker}
          type="file"
          multiple
          hidden
          onchange={(e) => {
            const input = e.currentTarget;
            const files = [...(input.files ?? [])];
            input.value = "";
            if (files.length) void importPicked(files);
          }}
        />
      {/if}
      <span class="fold">
        <button title={t("tip.foldAll")} aria-label={t("tree.foldAll")} onclick={() => markOnly(foldScope, [])}>⊟</button>
        <button title={t("tip.unfoldAll")} aria-label={t("tree.unfoldAll")} onclick={() => markOnly(foldScope, folders)}>⊞</button>
      </span>
    </div>
    {#if nodes.length === 0}
      <p class="empty">{t("files.empty")}</p>
    {/if}
    <FileTree
      {nodes}
      root={treeRoot}
      selected={current}
      {renaming}
      {icon}
      onOpen={(path) => p.onShow(path)}
      onMenu={(path, dir, x, y) => (menu = { path, dir, x, y })}
      onMove={move}
      onRename={rename}
      onStartRename={(path) => (renaming = isRoot(path) ? null : path)}
      onCancelRename={() => (renaming = null)}
      onDelete={remove}
      {foldScope}
    />
  </aside>
  {/if}

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
        <button role="menuitem" title={t("tip.openBeside")} onclick={() => { const path = m.path; menu = null; nav?.open(path, true); }}>{t("panes.openBeside")}</button>
        {#if desktop}<button role="menuitem" onclick={() => openWithSystem(m.path)}>{t("files.openWithSystem")}</button>{/if}
      {/if}
      {#if !isRoot(m.path)}
        <button role="menuitem" onclick={() => { const path = m.path; menu = null; renaming = path; }}>{t("tree.rename")}</button>
        <hr />
        <button role="menuitem" class="danger" onclick={() => remove(m.path)}>{t("tree.deleteItem")}</button>
      {/if}
    </div>
  {/if}

  <main class="center">
    {#if error}
      <p class="error" role="alert"><ErrorText text={error} /></p>
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

  {#if p.beside}{@render p.beside()}{/if}

  {#if layout.right}
  <SidePanel project={p.project} path={current} version={p.rev * 10000 + saves} diskRev={p.diskRev}>
    {#snippet properties()}
      {#if current}
        <NoteProperties project={p.project} path={current} rev={p.rev} onChanged={p.onReload} onRename={rename} />
      {:else}
        <p class="empty">{t("files.nothingOpen")}</p>
      {/if}
    {/snippet}
  </SidePanel>
  {/if}
</div>

<style>
  .files {
    position: relative;
    display: grid;
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
