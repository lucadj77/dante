<script lang="ts" module>
  export interface FileNode {
    path: string;
    name: string;
    dir: boolean;
    children: FileNode[];
  }

  /** The files and folders inside `root`, folders first, names in natural order. */
  export function buildTree(root: string, files: string[], folders: string[]): FileNode[] {
    const nodes = new Map<string, FileNode>();
    const top: FileNode[] = [];
    const inRoot = (p: string) => root === "" || p.startsWith(root + "/");
    const parentOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf("/")));
    const add = (path: string, dir: boolean) => {
      const node: FileNode = { path, name: path.slice(path.lastIndexOf("/") + 1), dir, children: [] };
      nodes.set(path, node);
      return node;
    };
    for (const folder of [...folders].sort()) if (inRoot(folder)) add(folder, true);
    for (const file of files) if (inRoot(file)) add(file, false);
    for (const node of nodes.values()) {
      const parent = parentOf(node.path);
      if (parent === root) top.push(node);
      else nodes.get(parent)?.children.push(node);
    }
    const order = (list: FileNode[]) => {
      list.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
      for (const n of list) order(n.children);
    };
    order(top);
    return top;
  }
</script>

<script lang="ts">
  import { tick } from "svelte";
  import { t } from "$lib/state.svelte";
  import { fileIcon } from "./FileViewer.svelte";
  import { mark, marked } from "./folding.svelte";
  import { navigator } from "./navigation";

  interface Props {
    nodes: FileNode[];
    /** The folder the tree shows; dropping on the empty space moves things there. */
    root: string;
    selected: string | null;
    /** Path whose name is being edited. */
    renaming: string | null;
    /** Shown before a note's name, such as its type's icon. */
    icon?: (path: string) => string | null;
    onOpen: (path: string) => void;
    onMenu: (path: string, dir: boolean, x: number, y: number) => void;
    onMove: (path: string, dir: string) => void;
    onRename: (path: string, name: string) => void;
    onStartRename: (path: string) => void;
    onCancelRename: () => void;
    onDelete: (path: string) => void;
    /** Where the tree keeps which folders are open. */
    foldScope: string;
  }
  let p: Props = $props();
  const nav = navigator();

  const expanded = $derived(marked(p.foldScope));
  let dragging = $state<string | null>(null);
  let over = $state<string | null>(null);
  let draft = $state("");

  // Folders holding the selected item open by themselves.
  $effect(() => {
    const selected = p.selected;
    if (!selected) return;
    const open: string[] = [];
    let dir = selected.slice(0, Math.max(0, selected.lastIndexOf("/")));
    while (dir.length > p.root.length) {
      if (!expanded.has(dir)) open.push(dir);
      dir = dir.slice(0, Math.max(0, dir.lastIndexOf("/")));
    }
    if (open.length) mark(p.foldScope, open, true);
  });

  $effect(() => {
    const path = p.renaming;
    if (!path) return;
    const name = path.slice(path.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    // The extension stays as it is, so only the name is edited.
    draft = dot > 0 && !isFolder(p.nodes, path) ? name.slice(0, dot) : name;
    void tick().then(() => {
      const input = document.querySelector<HTMLInputElement>(".file-tree input.rename");
      input?.focus();
      input?.select();
    });
  });

  function isFolder(list: FileNode[], path: string): boolean {
    return list.some((n) => (n.path === path && n.dir) || (path.startsWith(n.path + "/") && isFolder(n.children, path)));
  }

  function toggle(path: string) {
    mark(p.foldScope, [path], !expanded.has(path));
  }

  function label(node: FileNode): string {
    return !node.dir && node.name.toLowerCase().endsWith(".md") ? node.name.slice(0, -3) : node.name;
  }

  function drop(target: string) {
    const source = dragging;
    dragging = null;
    over = null;
    if (!source || source === target || target.startsWith(source + "/")) return;
    p.onMove(source, target);
  }

  function commit(path: string) {
    if (p.renaming !== path) return;
    const name = draft.trim();
    if (name) p.onRename(path, name);
    else p.onCancelRename();
  }

  function key(event: KeyboardEvent, node: FileNode) {
    if (event.key === "Enter") {
      if (node.dir) toggle(node.path);
      else p.onOpen(node.path);
    } else if ((event.key === "Delete" || event.key === "Backspace") && (event.metaKey || event.key === "Delete")) {
      event.preventDefault();
      p.onDelete(node.path);
    } else if (node.dir && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      mark(p.foldScope, [node.path], event.key === "ArrowRight");
    } else if (event.key === "F2") {
      p.onStartRename(node.path);
    }
  }
</script>

{#snippet items(list: FileNode[], depth: number)}
  {#each list as node (node.path)}
    <li role="treeitem" aria-selected={p.selected === node.path} aria-expanded={node.dir ? expanded.has(node.path) : undefined}>
      <div
        class="row"
        class:selected={p.selected === node.path}
        class:over={over === node.path}
        class:dragging={dragging === node.path}
        style="padding-left: {8 + depth * 14}px"
        draggable={p.renaming !== node.path}
        role="button"
        tabindex="0"
        onclick={(e) => (node.dir ? toggle(node.path) : e.altKey ? nav?.open(node.path, true) : p.onOpen(node.path))}
        onkeydown={(e) => key(e, node)}
        oncontextmenu={(e) => {
          e.preventDefault();
          p.onMenu(node.path, node.dir, e.clientX, e.clientY);
        }}
        ondragstart={(e) => {
          dragging = node.path;
          e.dataTransfer?.setData("text/plain", node.path);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        }}
        ondragend={() => {
          dragging = null;
          over = null;
        }}
        ondragover={(e) => {
          if (!dragging) return;
          e.preventDefault();
          over = node.dir ? node.path : null;
        }}
        ondragleave={() => {
          if (over === node.path) over = null;
        }}
        ondrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // On a file, the item goes next to it, in the same folder.
          drop(node.dir ? node.path : node.path.slice(0, Math.max(0, node.path.lastIndexOf("/"))));
        }}
      >
        <span class="twisty" aria-hidden="true">{node.dir ? (expanded.has(node.path) ? "▾" : "▸") : ""}</span>
        <span class="icon" aria-hidden="true">{node.dir ? "📁" : (p.icon?.(node.path) ?? fileIcon(node.path))}</span>
        {#if p.renaming === node.path}
          <input
            class="rename"
            bind:value={draft}
            aria-label={t("tree.rename")}
            onclick={(e) => e.stopPropagation()}
            onblur={() => commit(node.path)}
            onkeydown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commit(node.path);
              if (e.key === "Escape") p.onCancelRename();
            }}
          />
        {:else}
          <span class="name">{label(node)}</span>
        {/if}
      </div>
      {#if node.dir && expanded.has(node.path)}
        <ul role="group">
          {@render items(node.children, depth + 1)}
        </ul>
      {/if}
    </li>
  {/each}
{/snippet}

<ul
  class="file-tree"
  role="tree"
  class:over-root={over === p.root}
  ondragover={(e) => {
    if (!dragging) return;
    e.preventDefault();
    if (over === null) over = p.root;
  }}
  ondrop={(e) => {
    e.preventDefault();
    drop(p.root);
  }}
>
  {@render items(p.nodes, 0)}
</ul>

<style>
  .file-tree {
    list-style: none;
    margin: 0;
    padding: 0 0 48px;
    min-height: 100%;
  }
  .file-tree :global(ul) {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }
  .row:hover {
    background: var(--bg-hover);
  }
  .row.selected {
    background: var(--bg-active);
  }
  .row.over {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .row.dragging {
    opacity: 0.5;
  }
  .over-root {
    outline: 2px dashed var(--accent);
    outline-offset: -2px;
  }
  .twisty {
    width: 12px;
    font-size: 10px;
    color: var(--text-muted);
  }
  .icon {
    width: 18px;
    font-size: 13px;
    text-align: center;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rename {
    flex: 1;
    min-width: 0;
    font: inherit;
    padding: 0 4px;
  }
</style>
