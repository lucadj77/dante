<script lang="ts" module>
  export type DropPosition = "before" | "after" | "inside";
</script>

<script lang="ts">
  import type { ManuscriptNode } from "$lib/core/manuscript";
  import type { PageUnit } from "$lib/core/settings";
  import type { TreeMark } from "$lib/core/statistics";
  import type { ParagraphMark } from "$lib/core/gamebook/marks";
  import { num, t, tu } from "$lib/state.svelte";
  import type { MessageKey } from "$lib/i18n";
  import TreeItem from "./TreeItem.svelte";
  import { mark, marked } from "./folding.svelte";
  import { navigator } from "./navigation";

  interface Props {
    node: ManuscriptNode;
    depth: number;
    selected: string | null;
    headings: Map<string, string>;
    dragging: string | null;
    /** `add` (Cmd/Ctrl+click on a scene) adds the scene to the scenes chosen together. */
    onSelect: (path: string, add?: boolean) => void;
    /** Scenes chosen together, for merging. */
    chosen: string[];
    onRename: (path: string, title: string) => void;
    onDragStart: (path: string) => void;
    onDrop: (target: string, position: DropPosition) => void;
    /** A scene outside any chapter, which the export does not put in one. */
    loose?: boolean;
    /** Right click: the menu of actions on this item. */
    onMenu: (path: string, x: number, y: number) => void;
    onDelete: (path: string) => void;
    onMoveBy: (path: string, delta: number) => void;
    /** The item whose name the menu asked to edit. */
    renaming: string | null;
    /** Where the tree keeps which chapters and parts are folded. */
    foldScope: string;
    /** Length, goal and stage of work of each item. */
    marks: Map<string, TreeMark>;
    /** What lengths and goals count. */
    unit: PageUnit;
    /** In a gamebook, what the tree shows of each paragraph; null for a novel. */
    game?: Map<string, ParagraphMark> | null;
    /** In a gamebook, a line under each paragraph with where it comes from and where it leads. */
    showLinks?: boolean;
  }
  let p: Props = $props();
  const nav = navigator();

  let editing = $state(false);
  let draft = $state("");
  let over = $state<DropPosition | null>(null);
  const collapsed = $derived(marked(p.foldScope).has(p.node.path));
  const isScene = $derived(p.node.kind === "scene");
  // Headings on two lines fit the tree on one.
  const label = $derived((p.headings.get(p.node.path) ?? p.node.title).replace(/\n/g, " · "));
  const info = $derived(p.marks.get(p.node.path));
  const share = $derived(info && info.goal ? Math.min(1, info.words / info.goal) : 0);
  const para = $derived(p.game?.get(p.node.path) ?? null);
  const warningText = $derived(para ? para.warnings.map((w) => t(`gamebook.warning.${w}` as MessageKey)).join("\n") : "");

  $effect(() => {
    if (p.renaming === p.node.path) startRename();
  });

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
    class:selected={p.selected === p.node.path || p.chosen.includes(p.node.path)}
    class:drop-before={over === "before"}
    class:drop-after={over === "after"}
    class:drop-inside={over === "inside"}
    style="padding-left: {8 + p.depth * 14}px"
    draggable={editing || p.game ? undefined : "true"}
    role="button"
    tabindex="0"
    title={`${t(`kind.${p.node.kind}` as MessageKey)} · ${t("tree.renameHint")}`}
    onclick={(e) => (e.altKey ? nav?.open(p.node.path, true) : p.onSelect(p.node.path, e.metaKey || e.ctrlKey))}
    ondblclick={startRename}
    oncontextmenu={(e) => {
      e.preventDefault();
      // On a chosen scene the menu acts on all of them, so the choice stays.
      if (!p.chosen.includes(p.node.path)) p.onSelect(p.node.path);
      p.onMenu(p.node.path, e.clientX, e.clientY);
    }}
    onkeydown={(e) => {
      if (e.key === "Enter") p.onSelect(p.node.path);
      if (!isScene && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.altKey && !e.metaKey) {
        e.preventDefault();
        mark(p.foldScope, [p.node.path], e.key === "ArrowLeft");
      }
      if (e.key === "F2") startRename();
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        p.onDelete(p.node.path);
      }
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.altKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        p.onMoveBy(p.node.path, e.key === "ArrowUp" ? -1 : 1);
      }
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
          mark(p.foldScope, [p.node.path], !collapsed);
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
      {#if isScene && info?.status}
        {@const tip = info.property ? t("tree.dot", { property: info.property.charAt(0).toLocaleUpperCase() + info.property.slice(1), value: info.status }) : t("tree.status", { status: info.status })}
        <span class="status" class:own={!!info.color} style:--own={info.color || null} data-tone={info.tone ?? ""} data-hue={info.hue ?? ""} title={tip} aria-label={tip}></span>
      {/if}
      {#if para}
        <span
          class="num"
          class:fixed={para.numberType === "fixed"}
          class:relative={para.numberType === "relative"}
          title={t(`gamebook.type.${para.numberType}` as MessageKey)}>{para.numberType === "fixed" ? "🔒" : para.numberType === "relative" ? "⚓" : ""}{para.number}</span
        >
      {:else if p.game && isScene}
        <span class="num page" title={t("gamebook.pageHint")}>📄</span>
      {/if}
      <span class="label" class:empty-paragraph={para?.empty} title={para?.empty ? t("gamebook.empty") : undefined}>{label}</span>
      {#if para && para.warnings.length}
        <span class="warning" title={warningText} aria-label={warningText}>⚠</span>
      {/if}
      {#if para}
        <span class="length {para.band}" title={tu("gamebook.length", p.unit, { n: num(para.length) })}>{num(para.length)}</span>
      {/if}
      {#if info && info.goal}
        <span
          class="goal"
          class:reached={share >= 1}
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax={info.goal}
          aria-valuenow={Math.min(info.words, info.goal)}
          title={tu("tree.goal", p.unit, { words: num(info.words), goal: num(info.goal) })}><span style:width="{share * 100}%"></span></span
        >
      {/if}
      {#if p.game && isScene && !para}
        <span class="loose" title={t("gamebook.pageHint")}>{t(p.node.position === "after" ? "gamebook.pageAfter" : "gamebook.pageBefore")}</span>
      {/if}
      {#if p.loose && !p.game}
        <span class="loose" title={t("tree.looseHint")}>{t("tree.loose")}</span>
      {/if}
    {/if}
  </div>
  {#if para && p.showLinks}
    <div class="links" style="padding-left: {30 + p.depth * 14}px">
      <span title={t("gamebook.incoming")}>←
        {#each para.incoming as from, i (from.path + i)}<button class="ref" class:hidden-ref={from.hidden} onclick={() => p.onSelect(from.path)}>{from.number}</button>{/each}
        {#if !para.incoming.length}–{/if}
      </span>
      <span title={t("gamebook.outgoing")}>→
        {#each para.outgoing as to, i (to.label + i)}<button
            class="ref"
            class:hidden-ref={to.hidden}
            class:broken={!to.path}
            class:empty-ref={to.empty}
            disabled={!to.path}
            onclick={() => p.onSelect(to.path)}>{to.path ? to.label : "?"}</button
          >{/each}
        {#if !para.outgoing.length}–{/if}
      </span>
    </div>
  {/if}
  {#if !isScene && !collapsed && p.node.children.length > 0}
    <ul role="group">
      {#each p.node.children as child (child.path)}
        <TreeItem {...p} node={child} depth={p.depth + 1} loose={child.kind === "scene" && p.node.kind === "part"} />
      {/each}
    </ul>
  {/if}
</li>

<style>
  li {
    list-style: none;
  }
  .loose {
    flex: none;
    margin-left: auto;
    padding: 0 5px;
    border-radius: 3px;
    background: rgba(214, 150, 40, 0.18);
    color: var(--text-muted);
    font-size: 11px;
  }
  ul {
    margin: 0;
    padding: 0;
  }
  .num {
    flex: none;
    min-width: 26px;
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--text);
    text-align: right;
  }
  .num.fixed,
  .num.relative {
    min-width: 40px;
  }
  .row.scene .num + .label {
    padding-left: 6px;
  }
  .label.empty-paragraph {
    font-style: italic;
    opacity: 0.7;
  }
  .warning {
    flex: none;
    color: var(--danger);
    font-size: 12px;
  }
  .length {
    flex: none;
    margin-left: auto;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }
  .length.short {
    color: var(--status-2);
  }
  .length.long {
    color: var(--danger);
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    padding-right: 8px;
    margin: -4px 0 2px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .links .ref {
    padding: 0 3px;
    border: none;
    background: none;
    color: var(--wikilink);
    font: inherit;
    cursor: pointer;
  }
  .links .ref:hover {
    text-decoration: underline;
  }
  .links .hidden-ref {
    font-style: italic;
    opacity: 0.8;
  }
  .links .hidden-ref::before {
    content: "⋯";
  }
  .links .empty-ref {
    color: var(--text-muted);
  }
  .links .broken {
    color: var(--danger);
    cursor: default;
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
  /* The dot takes the place of the indent, so labels with and without it line up. */
  .row.scene .status + .label {
    padding-left: 6px;
  }
  .status {
    position: relative;
    flex: none;
    width: 8px;
    height: 8px;
    margin-left: 4px;
    border-radius: 50%;
    border: 1.5px solid var(--text-muted);
    box-sizing: border-box;
  }
  /* A larger target than the dot, for its tooltip. */
  .status::after {
    content: "";
    position: absolute;
    inset: -6px;
  }
  .status[data-hue="0"] {
    --hue: #d9534f;
  }
  .status[data-hue="1"] {
    --hue: #e8913a;
  }
  .status[data-hue="2"] {
    --hue: #c7a923;
  }
  .status[data-hue="3"] {
    --hue: #4ea65a;
  }
  .status[data-hue="4"] {
    --hue: #2fa3a3;
  }
  .status[data-hue="5"] {
    --hue: #4a7fd6;
  }
  .status[data-hue="6"] {
    --hue: #8c63d6;
  }
  .status[data-hue="7"] {
    --hue: #d064a6;
  }
  .status[data-hue]:not([data-hue=""]) {
    background: var(--hue);
    border-color: var(--hue);
  }
  .status[data-tone="0"] {
    background: var(--status-0);
    border-color: var(--status-0);
  }
  .status[data-tone="1"] {
    background: var(--status-1);
    border-color: var(--status-1);
  }
  .status[data-tone="2"] {
    background: var(--status-2);
    border-color: var(--status-2);
  }
  .status[data-tone="3"] {
    background: var(--status-3);
    border-color: var(--status-3);
  }
  /* A colour the writer chose, in the dot's legend among the properties. */
  .status.own[data-hue] {
    background: var(--own);
    border-color: var(--own);
  }
  .goal {
    flex: none;
    margin-left: auto;
    width: 34px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }
  .goal span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .goal.reached span {
    background: var(--status-3);
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
