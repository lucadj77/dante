<script lang="ts" module>
  export type DropPosition = "before" | "after" | "inside";
</script>

<script lang="ts">
  import type { ManuscriptNode } from "$lib/core/manuscript";
  import { t } from "$lib/state.svelte";
  import type { MessageKey } from "$lib/i18n";
  import TreeItem from "./TreeItem.svelte";

  interface Props {
    node: ManuscriptNode;
    depth: number;
    selected: string | null;
    headings: Map<string, string>;
    dragging: string | null;
    onSelect: (path: string) => void;
    onRename: (path: string, title: string) => void;
    onDragStart: (path: string) => void;
    onDrop: (target: string, position: DropPosition) => void;
  }
  let p: Props = $props();

  let editing = $state(false);
  let draft = $state("");
  let over = $state<DropPosition | null>(null);
  let collapsed = $state(false);
  const isScene = $derived(p.node.kind === "scene");
  const label = $derived(p.headings.get(p.node.path) ?? p.node.title);

  function startRename() {
    draft = p.node.title;
    editing = true;
  }

  function commit() {
    if (!editing) return;
    editing = false;
    if (draft.trim() && draft !== p.node.title) p.onRename(p.node.path, draft);
  }

  function position(event: DragEvent): DropPosition {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (event.clientY - rect.top) / rect.height;
    if (isScene) return y < 0.5 ? "before" : "after";
    return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
  }

  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
</script>

<li role="treeitem" aria-selected={p.selected === p.node.path} aria-expanded={isScene ? undefined : !collapsed}>
  <div
    class="row {p.node.kind}"
    class:selected={p.selected === p.node.path}
    class:drop-before={over === "before"}
    class:drop-after={over === "after"}
    class:drop-inside={over === "inside"}
    style="padding-left: {8 + p.depth * 14}px"
    draggable={editing ? undefined : "true"}
    role="button"
    tabindex="0"
    title={`${t(`kind.${p.node.kind}` as MessageKey)} · ${t("tree.renameHint")}`}
    onclick={() => p.onSelect(p.node.path)}
    ondblclick={startRename}
    onkeydown={(e) => {
      if (e.key === "Enter") p.onSelect(p.node.path);
      if (e.key === "F2") startRename();
    }}
    ondragstart={(e) => {
      e.dataTransfer?.setData("text/plain", p.node.path);
      p.onDragStart(p.node.path);
    }}
    ondragover={(e) => {
      if (!p.dragging || p.dragging === p.node.path || p.node.path.startsWith(p.dragging + "/")) return;
      e.preventDefault();
      over = position(e);
    }}
    ondragleave={() => (over = null)}
    ondrop={(e) => {
      e.preventDefault();
      const where = over ?? position(e);
      over = null;
      p.onDrop(p.node.path, where);
    }}
  >
    {#if !isScene}
      <button
        class="twisty"
        aria-label={collapsed ? "+" : "−"}
        onclick={(e) => {
          e.stopPropagation();
          collapsed = !collapsed;
        }}>{collapsed ? "▸" : "▾"}</button
      >
    {/if}
    {#if editing}
      <input
        bind:value={draft}
        use:focusOnMount
        onblur={commit}
        onclick={(e) => e.stopPropagation()}
        ondblclick={(e) => e.stopPropagation()}
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") editing = false;
        }}
      />
    {:else}
      <span class="label">{label}</span>
    {/if}
  </div>
  {#if !isScene && !collapsed && p.node.children.length > 0}
    <ul role="group">
      {#each p.node.children as child (child.path)}
        <TreeItem {...p} node={child} depth={p.depth + 1} />
      {/each}
    </ul>
  {/if}
</li>

<style>
  li {
    list-style: none;
  }
  ul {
    margin: 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
    padding-right: 8px;
    border-radius: 6px;
    cursor: pointer;
    border-top: 2px solid transparent;
    border-bottom: 2px solid transparent;
  }
  .row:hover {
    background: var(--bg-hover);
  }
  .row.selected {
    background: var(--bg-active);
  }
  .row.part .label,
  .row.prologue .label,
  .row.epilogue .label {
    font-weight: 600;
  }
  .row.chapter .label {
    font-weight: 500;
  }
  .row.scene .label {
    color: var(--text-muted);
    padding-left: 18px;
  }
  .row.drop-before {
    border-top-color: var(--accent);
  }
  .row.drop-after {
    border-bottom-color: var(--accent);
  }
  .row.drop-inside {
    outline: 2px solid var(--accent);
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .twisty {
    border: none;
    padding: 0;
    width: 14px;
    font-size: 11px;
    color: var(--text-muted);
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 2px 6px;
  }
</style>
