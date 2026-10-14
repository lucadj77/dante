<script lang="ts">
  import { tick } from "svelte";
  import { enclosing, headings as computeHeadings, parentOf, scenesOf, type ManuscriptNode } from "$lib/core/manuscript";
  import { splitNote } from "$lib/core/frontmatter";
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import { app } from "$lib/state.svelte";
  import { rebase } from "$lib/core/path";
  import PropertiesPanel from "./PropertiesPanel.svelte";
  import SceneBlock, { type SceneHandle } from "./SceneBlock.svelte";
  import TreeItem, { type DropPosition } from "./TreeItem.svelte";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    fullscreen: boolean;
    onReload: () => Promise<void>;
    /** Tells open scenes to reload from disk. */
    onDiskChange: () => void;
  }
  let { project, rev, diskRev, fullscreen = $bindable(), onReload, onDiskChange }: Props = $props();

  type Level = "scene" | "chapter" | "part" | "novel";
  let level = $state<Level>("chapter");
  let selected = $state<string | null>(null);
  let active = $state<string | null>(null);
  let raw = $state(false);
  let typewriter = $state(false);
  let focusMode = $state(false);
  let dragging = $state<string | null>(null);
  let error = $state("");
  let texts = $state<Record<string, string>>({});
  let localRev = $state(0);
  let pendingFocus: { path: string; at: "start" | "end" } | null = null;

  const editors = new Map<string, SceneHandle>();

  // `rev` and `localRev` change when the project reloads; the tree object is new then.
  const tree = $derived.by(() => {
    void rev;
    void localRev;
    return project.manuscript;
  });
  const headingMap = $derived.by(() => {
    void rev;
    void localRev;
    return computeHeadings(tree, project.settings);
  });

  // Start on the first scene, and fall back to it when the selection disappears.
  $effect(() => {
    const scenes = scenesOf(tree);
    if (selected === null || !scenes.length || !findIn(tree, selected)) selected = scenes[0]?.path ?? null;
    if (active !== null && !findIn(tree, active)) active = null;
  });

  function findIn(node: ManuscriptNode, path: string): boolean {
    return node.path === path || node.children.some((c) => findIn(c, path));
  }

  /** What the editor shows: the selection widened to the chosen level. */
  const shownRoot = $derived.by((): ManuscriptNode | null => {
    if (!selected) return null;
    const node = findNode(selected);
    if (!node) return null;
    if (level === "novel") return tree;
    if (level === "scene") return node.kind === "scene" ? node : (scenesOf(node)[0] ?? node);
    const kinds: ManuscriptNode["kind"][] = level === "chapter" ? ["chapter", "prologue", "epilogue"] : ["part", "prologue", "epilogue"];
    return enclosing(tree, node.path, kinds) ?? (level === "part" ? enclosing(tree, node.path, ["chapter"]) : null) ?? node;
  });

  function findNode(path: string): ManuscriptNode | null {
    const walk = (n: ManuscriptNode): ManuscriptNode | null =>
      n.path === path ? n : n.children.reduce<ManuscriptNode | null>((found, c) => found ?? walk(c), null);
    return walk(tree);
  }

  type Item = { type: "heading"; path: string; text: string; kind: string } | { type: "scene"; node: ManuscriptNode };
  const items = $derived.by((): Item[] => {
    const root = shownRoot;
    if (!root) return [];
    if (root.kind === "scene") return [{ type: "scene", node: root }];
    const out: Item[] = [];
    const visit = (node: ManuscriptNode) => {
      if (node.kind !== "manuscript" && node.kind !== "scene") {
        out.push({ type: "heading", path: node.path, text: headingMap.get(node.path) ?? node.title, kind: node.kind });
      }
      for (const child of node.children) {
        if (child.kind === "scene") out.push({ type: "scene", node: child });
        else visit(child);
      }
    };
    visit(root);
    return out;
  });
  const shownScenes = $derived(items.filter((i) => i.type === "scene").map((i) => (i as { node: ManuscriptNode }).node.path));

  async function run(operation: () => Promise<string | void>, focus?: "start" | "end") {
    error = "";
    try {
      await Promise.all([...editors.values()].map((e) => e.flush()));
      const result = await operation();
      localRev++;
      await onReload();
      if (typeof result === "string") {
        selected = result;
        if (focus) pendingFocus = { path: result, at: focus };
      }
      await tick();
      applyPendingFocus();
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  function register(path: string, handle: SceneHandle | null) {
    if (handle) {
      editors.set(path, handle);
      applyPendingFocus();
    } else {
      editors.delete(path);
    }
  }

  function applyPendingFocus() {
    if (pendingFocus && editors.has(pendingFocus.path)) {
      editors.get(pendingFocus.path)!.focus(pendingFocus.at);
      pendingFocus = null;
    }
  }

  function splitScene(path: string, before: string, after: string) {
    editors.get(path)?.cancel();
    void run(() => project.splitScene(path, before, after, t("untitled")), "start");
  }

  function splitChapter(path: string, before: string, after: string) {
    editors.get(path)?.cancel();
    void run(() => project.splitChapter(path, before, after, t("untitled"), t("untitled")), "start");
  }

  function leave(path: string, direction: "up" | "down"): boolean {
    const index = shownScenes.indexOf(path);
    const next = shownScenes[direction === "up" ? index - 1 : index + 1];
    if (!next || !editors.has(next)) return false;
    editors.get(next)!.focus(direction === "up" ? "end" : "start");
    return true;
  }

  function addAfter(path: string) {
    const parent = parentOf(tree, path);
    if (!parent) return;
    const index = parent.children.findIndex((c) => c.path === path);
    void run(() => project.createScene(parent.path, index + 1, t("untitled")), "start");
  }

  /** New scene in the selected chapter, or right after the selected scene. */
  function newScene() {
    const node = selected ? findNode(selected) : null;
    if (node && node.kind === "scene") return addAfter(node.path);
    const holder = node && node.kind !== "part" ? node : (node?.children.find((c) => c.kind !== "scene") ?? node ?? tree);
    void run(() => project.createScene(holder.path, holder.children.length, t("untitled")), "start");
  }

  function newContainer(kind: "chapter" | "part") {
    const node = selected ? findNode(selected) : null;
    // A chapter goes after the selected one, inside the same part; a part at the top level.
    const anchor = node ? (kind === "part" ? enclosing(tree, node.path, ["part", "prologue", "epilogue", "chapter"]) : enclosing(tree, node.path, ["chapter", "prologue", "epilogue"])) : null;
    let holder = anchor ? parentOf(tree, anchor.path)! : tree;
    if (kind === "part") holder = tree;
    const topAnchor = anchor && kind === "part" ? (holder.children.find((c) => findIn(c, anchor.path)) ?? null) : anchor;
    const index = topAnchor ? holder.children.findIndex((c) => c.path === topAnchor.path) + 1 : holder.children.length;
    void run(async () => {
      const created = await project.createContainer(holder.path, index, t("untitled"), kind === "part" ? "part" : undefined);
      return project.createScene(created, 0, t("untitled"));
    }, "start");
  }

  /** Renames without moving the selection: paths inside a renamed chapter follow it. */
  async function rename(path: string, title: string) {
    let renamed = path;
    const before = { selected, active };
    await run(async () => {
      renamed = await project.rename(path, title);
    });
    if (before.selected) selected = rebase(before.selected, path, renamed);
    if (before.active) active = rebase(before.active, path, renamed);
  }

  let renamingHeading = $state<string | null>(null);
  let headingDraft = $state("");

  function startHeading(path: string) {
    headingDraft = findNode(path)?.title ?? "";
    renamingHeading = path;
  }

  function commitHeading(path: string) {
    if (renamingHeading !== path) return;
    renamingHeading = null;
    if (headingDraft.trim()) void rename(path, headingDraft);
  }

  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  function drop(target: string, position: DropPosition) {
    const source = dragging;
    dragging = null;
    if (!source || source === target) return;
    const targetNode = findNode(target);
    if (!targetNode) return;
    if (position === "inside" && targetNode.kind !== "scene") {
      void run(() => project.move(source, target, targetNode.children.length));
      return;
    }
    const parent = parentOf(tree, target);
    if (!parent) return;
    const siblings = parent.children.filter((c) => c.path !== source);
    const index = siblings.findIndex((c) => c.path === target) + (position === "after" ? 1 : 0);
    void run(() => project.move(source, parent.path, index));
  }

  async function toggleFullscreen() {
    fullscreen = !fullscreen;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setFullscreen(fullscreen);
    } catch {
      // In a browser, panels are hidden but the window stays as it is.
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape" && fullscreen) void toggleFullscreen();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="manuscript" class:fullscreen>
  {#if !fullscreen}
    <aside class="tree" aria-label={t("section.manuscript")}>
      <div class="tree-actions">
        <button onclick={newScene}>{t("tree.newScene")}</button>
        <button onclick={() => newContainer("chapter")}>{t("tree.newChapter")}</button>
        {#if project.settings.structure.parts}
          <button onclick={() => newContainer("part")}>{t("tree.newPart")}</button>
        {/if}
      </div>
      {#if tree.children.length === 0}
        <p class="empty">{t("tree.empty")}</p>
      {/if}
      <ul role="tree" ondragend={() => (dragging = null)}>
        {#each tree.children as node (node.path)}
          <TreeItem
            {node}
            depth={0}
            {selected}
            headings={headingMap}
            {dragging}
            onSelect={(path) => {
              selected = path;
              active = path;
            }}
            onRename={rename}
            onDragStart={(path) => (dragging = path)}
            onDrop={drop}
          />
        {/each}
      </ul>
    </aside>
  {/if}

  <main class="center">
    <div class="toolbar" role="toolbar">
      <div class="group" role="group">
        {#each ["scene", "chapter", "part", "novel"] as const as l (l)}
          {#if l !== "part" || project.settings.structure.parts}
            <button aria-pressed={level === l} onclick={() => (level = l)}>{t(`level.${l}`)}</button>
          {/if}
        {/each}
      </div>
      <div class="group" role="group">
        <button aria-pressed={typewriter} onclick={() => (typewriter = !typewriter)}>{t("mode.typewriter")}</button>
        <button aria-pressed={focusMode} onclick={() => (focusMode = !focusMode)}>{t("mode.focus")}</button>
        <button aria-pressed={fullscreen} onclick={toggleFullscreen}>{t("mode.fullscreen")}</button>
        <button aria-pressed={raw} title={t("editor.rawHint")} onclick={() => (raw = !raw)}>{t("editor.raw")}</button>
      </div>
    </div>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <div class="page" class:typewriter>
      <div class="column" style="max-width: {app.settings.lineWidth}ch">
        {#if items.length === 0}
          <p class="empty">{t("editor.empty")}</p>
        {/if}
        {#each items as item (item.type === "scene" ? `${item.node.path}|${raw}` : `h|${item.path}`)}
          {#if item.type === "heading"}
            <h2 class="heading {item.kind}">
              {#if renamingHeading === item.path}
                <input
                  bind:value={headingDraft}
                  use:focusOnMount
                  aria-label={t("tree.rename")}
                  onblur={() => commitHeading(item.path)}
                  onkeydown={(e) => {
                    if (e.key === "Enter") commitHeading(item.path);
                    if (e.key === "Escape") renamingHeading = null;
                  }}
                />
              {:else}
                <button title={t("tree.renameHint")} onclick={() => startHeading(item.path)}>{item.text}</button>
              {/if}
            </h2>
          {:else}
            <SceneBlock
              {project}
              node={item.node}
              {raw}
              {typewriter}
              {focusMode}
              {diskRev}
              {register}
              onSplitScene={splitScene}
              onSplitChapter={splitChapter}
              onLeave={leave}
              onFocus={(path) => (active = path)}
              onText={(path, text) => (texts[path] = raw ? splitNote(text).body : text)}
              onAddAfter={addAfter}
              onRename={rename}
            />
          {/if}
        {/each}
      </div>
    </div>
  </main>

  {#if !fullscreen}
    <PropertiesPanel
      {project}
      path={active ?? selected}
      {rev}
      {localRev}
      sceneTexts={shownScenes.map((p) => texts[p] ?? "")}
      activeText={(active ?? selected) ? (texts[(active ?? selected)!] ?? null) : null}
      onChanged={async () => {
        localRev++;
        await onReload();
      }}
      beforeRead={async (path) => {
        await editors.get(path)?.flush();
      }}
      onRestored={onDiskChange}
      onRename={rename}
    />
  {/if}
</div>

<style>
  .manuscript {
    display: grid;
    grid-template-columns: 260px 1fr 280px;
    height: 100vh;
  }
  .manuscript.fullscreen {
    grid-template-columns: 1fr;
  }
  .tree {
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
  .tree-actions button {
    font-size: 12px;
    padding: 2px 8px;
  }
  .tree ul {
    margin: 0;
    padding: 0;
  }
  .center {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--editor-bg);
  }
  .toolbar {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }
  .group {
    display: flex;
    gap: 4px;
  }
  .group button {
    font-size: 12px;
  }
  .page {
    flex: 1;
    overflow: auto;
    padding: 16px 32px 30vh;
  }
  .page.typewriter {
    padding-bottom: 50vh;
  }
  .column {
    margin: 0 auto;
  }
  .heading {
    font-family: var(--editor-font);
    font-weight: 400;
    text-align: center;
    margin: 48px 0 8px;
    font-size: 1.6em;
  }
  .heading {
    white-space: pre-line;
  }
  .heading button {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: text;
  }
  .heading input {
    font: inherit;
    text-align: center;
    width: 100%;
  }
  .heading.part {
    font-size: 2em;
    margin-top: 72px;
  }
  .empty {
    color: var(--text-muted);
    padding: 8px;
  }
  .error {
    color: var(--danger);
    padding: 0 12px;
  }
</style>
