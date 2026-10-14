<script lang="ts">
  import { tick } from "svelte";
  import { enclosing, headings as computeHeadings, parentOf, scenesOf, type ManuscriptNode } from "$lib/core/manuscript";
  import { splitNote } from "$lib/core/frontmatter";
  import type { Project } from "$lib/core/project";
  import { saveAppSettings, t, zoom } from "$lib/state.svelte";
  import { ACTIONS, ICONS } from "$lib/editor/formatting";
  import { formatLabels } from "./formatLabels";
  import { app } from "$lib/state.svelte";
  import { rebase } from "$lib/core/path";
  import PropertiesPanel from "./PropertiesPanel.svelte";
  import SidePanel from "./SidePanel.svelte";
  import { markOnly } from "./folding.svelte";
  import { TauriFs } from "$lib/tauriFs";
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
    /** A scene or container to show, such as one a wikilink pointed to. */
    reveal: string | null;
    /** Called with the selected item, so the workspace can come back to it. */
    onShow: (path: string) => void;
  }
  let { project, rev, diskRev, fullscreen = $bindable(), onReload, onDiskChange, reveal, onShow }: Props = $props();

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

  // Shows what the workspace asks for, once each time it asks.
  let revealed: string | null = null;
  $effect(() => {
    const target = reveal;
    if (!target || target === revealed) return;
    revealed = target;
    if (findIn(tree, target)) {
      selected = target;
      active = target;
    }
  });
  $effect(() => {
    if (selected) onShow(selected);
  });

  const foldScope = $derived(`${project.fs instanceof TauriFs ? project.fs.root : "sample"}|manuscript`);

  function containers(node: ManuscriptNode): string[] {
    return node.children.filter((c) => c.kind !== "scene").flatMap((c) => [c.path, ...containers(c)]);
  }

  /** Bumped a moment after typing stops, so the links panel catches up with saved text. */
  let edits = $state(0);
  let editsTimer: ReturnType<typeof setTimeout> | undefined;
  function edited() {
    clearTimeout(editsTimer);
    editsTimer = setTimeout(() => edits++, 1500);
  }

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
    void run(() => project.splitScene(path, before, after, t("untitledScene")), "start");
  }

  function splitChapter(path: string, before: string, after: string) {
    editors.get(path)?.cancel();
    void run(() => project.splitChapter(path, before, after, t("untitled"), t("untitledScene")), "start");
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
    void run(() => project.createScene(parent.path, index + 1, t("untitledScene")), "start");
  }

  /** New scene in the selected chapter, or right after the selected scene. */
  function newScene() {
    const node = selected ? findNode(selected) : null;
    if (node && node.kind === "scene") return addAfter(node.path);
    const holder = node && node.kind !== "part" ? node : (node?.children.find((c) => c.kind !== "scene") ?? node ?? tree);
    void run(() => project.createScene(holder.path, holder.children.length, t("untitledScene")), "start");
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
      return project.createScene(created, 0, t("untitledScene"));
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

  /** The tree's right-click menu, and the item whose name it asked to edit. */
  let menu = $state<{ path: string; x: number; y: number } | null>(null);
  let renaming = $state<string | null>(null);

  function scenesIn(node: ManuscriptNode): number {
    return node.kind === "scene" ? 1 : node.children.reduce((n, c) => n + scenesIn(c), 0);
  }

  async function confirm(message: string): Promise<boolean> {
    try {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      return await ask(message, { title: "Dante", kind: "warning", okLabel: t("tree.delete"), cancelLabel: t("tree.cancel") });
    } catch {
      return window.confirm(message);
    }
  }

  /** Moves the item to the project's .trash folder, after asking. */
  async function remove(path: string) {
    menu = null;
    const node = findNode(path);
    if (!node || node.kind === "manuscript") return;
    const label = (headingMap.get(path) ?? node.title).replace(/\n/g, " · ");
    const count = scenesIn(node);
    const message = node.kind === "scene"
      ? t("tree.deleteScene", { title: label })
      : count === 0 ? t("tree.deleteEmpty", { title: label })
      : count === 1 ? t("tree.deleteContainerOne", { title: label })
      : t("tree.deleteContainer", { title: label, count });
    if (!(await confirm(message))) return;
    for (const [p, e] of editors) if (p === path || p.startsWith(path + "/")) e.cancel();
    await run(async () => {
      await project.trash(path);
    });
  }

  function moveBy(path: string, delta: number) {
    menu = null;
    const parent = parentOf(tree, path);
    if (!parent) return;
    const index = parent.children.findIndex((c) => c.path === path) + delta;
    if (index < 0 || index >= parent.children.length) return;
    void run(() => project.move(path, parent.path, index));
  }

  function menuNewScene(path: string) {
    menu = null;
    const node = findNode(path);
    if (!node) return;
    if (node.kind === "scene") return addAfter(path);
    void run(() => project.createScene(node.path, node.children.length, t("untitledScene")), "start");
  }

  function menuRename(path: string) {
    menu = null;
    renaming = null;
    // Set on the next tick, so asking twice for the same item still opens the field.
    void tick()
      .then(() => {
        renaming = path;
        return tick();
      })
      .then(() => (renaming = null));
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
        <span class="fold">
          <button title={t("tree.foldAll")} aria-label={t("tree.foldAll")} onclick={() => markOnly(foldScope, containers(tree))}>⊟</button>
          <button title={t("tree.unfoldAll")} aria-label={t("tree.unfoldAll")} onclick={() => markOnly(foldScope, [])}>⊞</button>
        </span>
      </div>
      {#if tree.children.length === 0}
        <p class="empty">{t("tree.empty")}</p>
      {/if}
      <ul role="tree" ondragend={() => (dragging = null)}>
        {#each tree.children as node (node.path)}
          <TreeItem
            {node}
            depth={0}
            loose={node.kind === "scene"}
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
            onMenu={(path, x, y) => (menu = { path, x, y })}
            onDelete={remove}
            onMoveBy={moveBy}
            {renaming}
            {foldScope}
          />
        {/each}
      </ul>
    </aside>
  {/if}

  {#if menu}
    {@const node = findNode(menu.path)}
    <div class="menu-backdrop" role="presentation" onmousedown={() => (menu = null)} oncontextmenu={(e) => { e.preventDefault(); menu = null; }}></div>
    <div class="menu" role="menu" style="left: {menu.x}px; top: {menu.y}px">
      <button role="menuitem" onclick={() => menuNewScene(menu!.path)}>{node?.kind === "scene" ? t("tree.newSceneAfter") : t("tree.newSceneInside")}</button>
      <button role="menuitem" onclick={() => menuRename(menu!.path)}>{t("tree.rename")}</button>
      <button role="menuitem" onclick={() => moveBy(menu!.path, -1)}>{t("tree.moveUp")}</button>
      <button role="menuitem" onclick={() => moveBy(menu!.path, 1)}>{t("tree.moveDown")}</button>
      <hr />
      <button role="menuitem" class="danger" onclick={() => remove(menu!.path)}>{t("tree.deleteItem")}</button>
    </div>
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
        <button
          aria-pressed={app.settings.formatBar}
          title={t("format.bar")}
          aria-label={t("format.bar")}
          onclick={() => saveAppSettings({ ...app.settings, formatBar: !app.settings.formatBar })}><b>B</b><i>I</i></button
        >
      </div>
      {#if !app.settings.formatBar}
        <div class="group" role="group">
          <button title={t("zoom.out")} aria-label={t("zoom.out")} onclick={() => zoom(-1)}>A−</button>
          <button title={t("zoom.in")} aria-label={t("zoom.in")} onclick={() => zoom(1)}>A+</button>
        </div>
      {/if}
    </div>
    {#if app.settings.formatBar}
      {@const labels = formatLabels()}
      <div class="format-row" role="toolbar" aria-label={t("format.bar")}>
        {#each ACTIONS as action, i (i)}
          {#if action === null}
            <span class="cm-format-gap"></span>
          {:else}
            <button
              title={labels[action]}
              aria-label={labels[action]}
              disabled={!active}
              onmousedown={(e) => e.preventDefault()}
              onclick={() => active && editors.get(active)?.format(action)}><span style={ICONS[action].style}>{ICONS[action].text}</span></button
            >
          {/if}
        {/each}
        <span class="zoom">
          <button title={t("zoom.out")} aria-label={t("zoom.out")} onclick={() => zoom(-1)}>A−</button>
          <button title={t("zoom.in")} aria-label={t("zoom.in")} onclick={() => zoom(1)}>A+</button>
        </span>
      </div>
    {/if}
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
              onText={(path, text) => {
                texts[path] = raw ? splitNote(text).body : text;
                edited();
              }}
              onAddAfter={addAfter}
              onRename={rename}
            />
          {/if}
        {/each}
      </div>
    </div>
  </main>

  {#if !fullscreen}
    <SidePanel {project} path={active ?? selected} version={rev * 100000 + localRev * 1000 + edits} {diskRev}>
      {#snippet properties()}
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
      {/snippet}
    </SidePanel>
  {/if}
</div>

<style>
  .manuscript {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr) 280px;
    height: 100%;
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
  .format-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--border);
  }
  .format-row .zoom {
    margin-left: auto;
  }
  .format-row button:disabled {
    opacity: 0.4;
    cursor: default;
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
    /* Follows the text size, so zooming scales headings and line length too. */
    font-family: var(--editor-font);
    font-size: var(--editor-size);
  }
  .heading {
    font-family: var(--editor-font);
    font-weight: 400;
    text-align: center;
    margin: 48px 0 8px;
    font-size: 1.3em;
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
    font-size: 1.7em;
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
