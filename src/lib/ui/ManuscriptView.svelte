<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import { enclosing, headings as computeHeadings, parentOf, scenesOf, type ManuscriptNode } from "$lib/core/manuscript";
  import { splitNote } from "$lib/core/frontmatter";
  import type { Project } from "$lib/core/project";
  import { saveAppSettings, t, zoom } from "$lib/state.svelte";
  import Icon from "./Icon.svelte";
  import { ACTIONS, ICONS } from "$lib/editor/formatting";
  import { formatLabels } from "./formatLabels";
  import { app } from "$lib/state.svelte";
  import { rebase } from "$lib/core/path";
  import PropertiesPanel from "./PropertiesPanel.svelte";
  import SidePanel from "./SidePanel.svelte";
  import { columns, layout, width } from "./layout.svelte";
  import Resizer from "./Resizer.svelte";
  import { markOnly } from "./folding.svelte";
  import { TauriFs } from "$lib/tauriFs";
  import SceneBlock, { type SceneHandle } from "./SceneBlock.svelte";
  import TreeItem, { type DropPosition } from "./TreeItem.svelte";
  import { flushAll } from "./documents.svelte";
  import { panes, SCENE_SHEETS, toggleSceneSheets } from "./panes.svelte";
  import { navigator } from "./navigation";

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
    /** The panes beside the text, if any are open. */
    beside?: Snippet | null;
  }
  let { project, rev, diskRev, fullscreen = $bindable(), onReload, onDiskChange, reveal, onShow, beside = null }: Props = $props();

  type Level = "scene" | "chapter" | "part" | "novel";
  let level = $state<Level>("chapter");
  let selected = $state<string | null>(null);
  /** Scenes chosen together with Cmd/Ctrl+click, to merge them. */
  let chosen = $state<string[]>([]);
  let active = $state<string | null>(null);
  /** A chapter or part picked in the tree: the side panel shows it until a scene gets the cursor. */
  let picked = $state<string | null>(null);
  let raw = $state(false);
  let typewriter = $state(false);
  let focusMode = $state(false);
  let dragging = $state<string | null>(null);
  let error = $state("");
  let texts = $state<Record<string, string>>({});
  let localRev = $state(0);
  let pendingFocus: { path: string; at: "start" | "end" } | null = null;

  const editors = new Map<string, SceneHandle>();
  let page = $state<HTMLDivElement | null>(null);
  const nav = navigator();

  // Shows what the workspace asks for, once each time it asks.
  let revealed: string | null = null;
  $effect(() => {
    const target = reveal;
    if (!target || target === revealed) return;
    revealed = target;
    if (findIn(tree, target)) {
      selected = target;
      active = target;
      picked = target;
      void bringIntoView(target);
    }
  });

  /**
   * Scrolls the text to an item picked in the tree and marks its scene, so the tree and the
   * text show the same place when a whole chapter, part or novel is on screen. The focus stays
   * in the tree, which the arrow keys keep moving through.
   */
  async function bringIntoView(path: string) {
    await tick();
    const node = findNode(path);
    const scene = node?.kind === "scene" ? node : node ? scenesOf(node)[0] : null;
    if (!scene) return;
    active = scene.path;
    await scrollToScene(scene.path);
  }

  /**
   * The editors only lay out the lines on screen and estimate the height of the others, so
   * the place of a scene far away changes while the text scrolls towards it. Jumping again
   * until it stays put lands on the scene even in a long novel.
   */
  async function scrollToScene(path: string) {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let last = NaN;
    for (let i = 0; i < 20; i++) {
      // A pane beside the text can show the same scene: the one in the middle is the one wanted.
      const el = page?.querySelector(`[data-scene="${CSS.escape(path)}"]`);
      if (!el || active !== path) return;
      el.scrollIntoView({ block: "start" });
      await frame();
      await frame();
      const top = el.getBoundingClientRect().top;
      if (Math.abs(top - last) < 1) return;
      last = top;
    }
  }
  $effect(() => {
    if (selected) onShow(selected);
  });
  // The scene sheets and the views beside follow the scene picked or written.
  $effect(() => {
    if (active && findNode(active)?.kind === "scene") panes.writing = active;
  });

  const foldScope = $derived(`${project.fs instanceof TauriFs ? project.fs.root : "sample"}|manuscript`);

  function containers(node: ManuscriptNode): string[] {
    return node.children.filter((c) => c.kind !== "scene").flatMap((c) => [c.path, ...containers(c)]);
  }

  const inspected = $derived(picked ?? active ?? selected);

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
    if (picked !== null && !findIn(tree, picked)) picked = null;
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
  /** Whether more than one scene is on screen, so the one being written is marked. */
  const manyScenes = $derived(items.filter((i) => i.type === "scene").length > 1);
  const shownScenes = $derived(items.filter((i) => i.type === "scene").map((i) => (i as { node: ManuscriptNode }).node.path));

  async function run(operation: () => Promise<string | void>, focus?: "start" | "end") {
    error = "";
    try {
      await flushAll(project);
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
    let holder: ManuscriptNode = tree;
    let index = tree.children.length;
    if (kind === "part") {
      // A part goes after the top-level item holding the selection.
      const top = node ? tree.children.findIndex((c) => findIn(c, node.path)) : -1;
      if (top >= 0) index = top + 1;
    } else if (node) {
      // A chapter goes after the selected one, in the same part; with a part (or a scene loose
      // in it) selected, at the end of that part.
      const chapter = enclosing(tree, node.path, ["chapter", "prologue", "epilogue"]);
      const part = enclosing(tree, node.path, ["part"]);
      if (chapter) {
        holder = parentOf(tree, chapter.path)!;
        index = holder.children.findIndex((c) => c.path === chapter.path) + 1;
      } else if (part) {
        holder = part;
        index = part.children.length;
      }
    }
    void run(async () => {
      if (kind === "part") {
        // A new part starts with a chapter, so its first scene is not loose in it.
        const part = await project.createContainer(holder.path, index, t("untitled"), "part");
        const chapter = await project.createContainer(part, 0, t("untitled"));
        return project.createScene(chapter, 0, t("untitledScene"));
      }
      const created = await project.createContainer(holder.path, index, t("untitled"));
      return project.createScene(created, 0, t("untitledScene"));
    }, "start");
  }

  /**
   * Renames without moving the selection: paths inside a renamed chapter follow it.
   * `file` renames the file even when the item has a title of its own.
   */
  async function rename(path: string, title: string, file = false) {
    let renamed = path;
    const before = { selected, active, picked };
    // A scene or chapter with its own title keeps its file name: the title changes.
    const node = findNode(path);
    await run(async () => {
      if (!file && node && node.title !== node.fileTitle) await project.retitle(path, title);
      else renamed = await project.rename(path, title);
    });
    if (before.selected) selected = rebase(before.selected, path, renamed);
    if (before.active) active = rebase(before.active, path, renamed);
    if (before.picked) picked = rebase(before.picked, path, renamed);
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

  /** Cmd/Ctrl+click adds a scene to the chosen ones, or takes it away; a plain click starts over. */
  function choose(path: string, add: boolean) {
    if (!add || findNode(path)?.kind !== "scene") {
      chosen = [];
      return;
    }
    const start = chosen.length ? chosen : selected && findNode(selected)?.kind === "scene" ? [selected] : [];
    chosen = start.includes(path) ? start.filter((p) => p !== path) : [...start, path];
  }

  /** Joins the chosen scenes into the first of them; the others go to the trash. */
  async function merge() {
    menu = null;
    const paths = chosen;
    if (paths.length < 2) return;
    const conflicted = project.conflicts.find((c) => paths.includes(c.original));
    if (conflicted) {
      error = t("tree.mergeConflict", { title: findNode(conflicted.original)?.title ?? conflicted.original });
      return;
    }
    for (const p of paths) editors.get(p)?.cancel();
    chosen = [];
    await run(() => project.mergeScenes(paths));
    // The first scene's editor may be open: it takes the joined text.
    onDiskChange();
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

  /** The other view reads the files again, so what was just typed is written first. */
  async function toggleRaw() {
    await Promise.all([...editors.values()].map((e) => e.flush()));
    raw = !raw;
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

<div class="manuscript" class:fullscreen style:grid-template-columns={columns("manuscript", fullscreen ? 0 : 260, fullscreen ? 0 : 280, !!beside)}>
  {#if !fullscreen && layout.left}<Resizer section="manuscript" side="left" usual={260} other={layout.right ? width("manuscript", "right", 280) : 0} />{/if}
  {#if !fullscreen && layout.right}<Resizer section="manuscript" side="right" usual={280} other={layout.left ? width("manuscript", "left", 260) : 0} />{/if}
  {#if !fullscreen && layout.left}
    <aside class="tree" aria-label={t("section.manuscript")}>
      <div class="tree-actions">
        <div class="tree-group" role="group" aria-labelledby="tree-add">
          <span class="caption" id="tree-add">{t("tree.add")}</span>
          <div class="add">
            <button title={t("tip.newScene")} aria-label={t("tree.newScene")} onclick={newScene}><Icon name="scene" /><span>{t("level.scene")}</span></button>
            <button title={t("tip.newChapter")} aria-label={t("tree.newChapter")} onclick={() => newContainer("chapter")}><Icon name="chapter" /><span>{t("level.chapter")}</span></button>
            {#if project.settings.structure.parts}
              <button title={t("tip.newPart")} aria-label={t("tree.newPart")} onclick={() => newContainer("part")}><Icon name="part" /><span>{t("level.part")}</span></button>
            {/if}
          </div>
        </div>
        <div class="tree-group" role="group" aria-labelledby="tree-fold">
          <span class="caption" id="tree-fold">{t("tree.outline")}</span>
          <div class="fold">
            <button title={t("tip.foldAll")} onclick={() => markOnly(foldScope, containers(tree))}><Icon name="collapse" /><span>{t("tree.foldAll")}</span></button>
            <button title={t("tip.unfoldAll")} onclick={() => markOnly(foldScope, [])}><Icon name="expand" /><span>{t("tree.unfoldAll")}</span></button>
          </div>
        </div>
      </div>
      {#if tree.children.length === 0}
        <p class="empty">{t("tree.empty")}</p>
      {/if}
      {#if chosen.length > 1}
        <div class="chosen" role="group">
          <span>{t("tree.chosen", { n: chosen.length })}</span>
          <button class="primary" title={t("tip.merge")} onclick={merge}>{t("tree.merge")}</button>
          <button onclick={() => (chosen = [])}>{t("tree.cancel")}</button>
        </div>
      {/if}
      <ul role="tree" ondragend={() => (dragging = null)}>
        {#each tree.children as node (node.path)}
          <TreeItem
            {node}
            depth={0}
            loose={node.kind === "scene"}
            {selected}
            {chosen}
            headings={headingMap}
            {dragging}
            onSelect={(path, add) => {
              choose(path, !!add);
              selected = path;
              active = path;
              picked = path;
              void bringIntoView(path);
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
      {#if chosen.length > 1 && chosen.includes(menu.path)}
        <button role="menuitem" onclick={merge}>{t("tree.mergeChosen", { n: chosen.length })}</button>
        <hr />
      {/if}
      <button role="menuitem" title={t("tip.openBeside")} onclick={() => { const path = menu!.path; menu = null; nav?.open(path, true); }}>{t("panes.openBeside")}</button>
      <hr />
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
      <div class="group" role="group" aria-label={t("toolbar.show")}>
        <span class="caption">{t("toolbar.show")}</span>
        <div class="buttons">
        <div class="segmented">
          {#each ["scene", "chapter", "part", "novel"] as const as l (l)}
            {#if l !== "part" || project.settings.structure.parts}
              <button aria-pressed={level === l} title={t(`tip.level.${l}`)} onclick={() => (level = l)}><Icon name={l} /><span class="label">{t(`level.${l}`)}</span></button>
            {/if}
          {/each}
        </div>
        <button aria-pressed={panes.list.some((p) => p.path === SCENE_SHEETS)} title={t("tip.panes.sheets")} onclick={toggleSceneSheets}><Icon name="sheets" /><span class="label">{t("panes.sheetsButton")}</span></button>
        </div>
      </div>
      <div class="group" role="group" aria-label={t("toolbar.writing")}>
        <span class="caption">{t("toolbar.writing")}</span>
        <div class="buttons">
        <button aria-pressed={app.settings.formatBar} title={t("tip.formatBar")} onclick={() => saveAppSettings({ ...app.settings, formatBar: !app.settings.formatBar })}
          ><Icon name="format" /><span class="label">{t("format.bar")}</span></button
        >
        <button aria-pressed={raw} title={t("tip.raw")} onclick={toggleRaw}><Icon name="raw" /><span class="label">{t("editor.raw")}</span></button>
        <button
          aria-pressed={app.settings.revisions}
          class:tracking={app.settings.revisions}
          title={app.settings.userName.trim() ? t("tip.revisions") : t("tip.revisionsNoName")}
          disabled={!app.settings.userName.trim()}
          onclick={() => saveAppSettings({ ...app.settings, revisions: !app.settings.revisions })}><Icon name="revisions" /><span class="label">{t("mode.revisions")}</span></button
        >
        </div>
      </div>
      <div class="group" role="group" aria-label={t("toolbar.modes")}>
        <span class="caption">{t("toolbar.modes")}</span>
        <div class="buttons">
        <button aria-pressed={focusMode} title={t("tip.focus")} onclick={() => (focusMode = !focusMode)}><Icon name="focus" /><span class="label">{t("mode.focus")}</span></button>
        <button aria-pressed={typewriter} title={t("tip.typewriter")} onclick={() => (typewriter = !typewriter)}><Icon name="typewriter" /><span class="label">{t("mode.typewriter")}</span></button>
        <button aria-pressed={fullscreen} title={t("tip.fullscreen")} onclick={toggleFullscreen}><Icon name="fullscreen" /><span class="label">{t("mode.fullscreen")}</span></button>
        </div>
      </div>
      <div class="group" role="group" aria-label={t("toolbar.size")}>
        <span class="caption">{t("toolbar.size")}</span>
        <div class="buttons">
        <button class="icon-only" title={t("zoom.out")} aria-label={t("zoom.out")} onclick={() => zoom(-1)}><Icon name="zoomOut" /></button>
        <button class="size" title={t("zoom.reset")} onclick={() => zoom(0)}>{app.settings.fontSize}</button>
        <button class="icon-only" title={t("zoom.in")} aria-label={t("zoom.in")} onclick={() => zoom(1)}><Icon name="zoomIn" /></button>
        </div>
      </div>
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
        <span class="cm-format-gap"></span>
        <button class="split" title={t("tip.splitScene")} disabled={!active} onmousedown={(e) => e.preventDefault()} onclick={() => active && editors.get(active)?.split("scene")}
          ><Icon name="scene" /><span>{t("split.scene")}</span></button
        >
        <button class="split" title={t("tip.splitChapter")} disabled={!active} onmousedown={(e) => e.preventDefault()} onclick={() => active && editors.get(active)?.split("chapter")}
          ><Icon name="chapter" /><span>{t("split.chapter")}</span></button
        >
      </div>
    {/if}
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <div class="page" class:typewriter bind:this={page}>
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
              current={manyScenes && active === item.node.path}
              onFocus={(path) => {
                // The tree follows the cursor: the scene being written is the one selected.
                panes.writing = path;
                active = path;
                selected = path;
                picked = null;
              }}
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

  {#if beside}{@render beside()}{/if}

  {#if !fullscreen && layout.right}
    <SidePanel {project} path={inspected} version={rev * 100000 + localRev * 1000 + edits} {diskRev} commentPaths={shownScenes}>
      {#snippet properties()}
    <PropertiesPanel
      {project}
      path={inspected}
      {rev}
      {localRev}
      sceneTexts={shownScenes.map((p) => texts[p] ?? "")}
      activeText={inspected ? (texts[inspected] ?? null) : null}
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
    position: relative;
    display: grid;
    height: 100%;
  }
  .tree {
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
    overflow: auto;
    padding: 8px;
  }
  .tree-actions {
    display: grid;
    gap: 10px;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .tree-group {
    display: grid;
    gap: 4px;
  }
  .caption {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .tree-actions .add {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
    gap: 4px;
  }
  .tree-actions .add button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px;
    font-size: 12px;
  }
  .tree-actions .fold {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .tree-actions .fold button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 3px 4px;
    font-size: 11px;
  }
  .icon-only {
    display: inline-flex;
    align-items: center;
    padding: 3px 5px;
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
  .chosen {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 8px 6px;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--bg-hover);
    font-size: 12px;
  }
  .chosen span {
    flex: 1;
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
  .format-row .split {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }
  .format-row button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 0;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    container-type: inline-size;
  }
  /* Each group of buttons under its name, set apart from the next by a line. */
  .group {
    display: grid;
    gap: 3px;
    padding: 0 12px;
    border-left: 1px solid var(--border);
  }
  .group .buttons {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .group:first-child {
    padding-left: 0;
    border-left: none;
  }
  .group:last-child {
    margin-left: auto;
  }
  .group button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
  }
  .segmented {
    display: flex;
  }
  .segmented button {
    border-radius: 0;
  }
  .segmented button + button {
    margin-left: -1px;
  }
  .segmented button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .segmented button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .group button.size {
    min-width: 32px;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }
  .group button.tracking {
    color: var(--critic-add, #1a7f37);
    border-color: currentColor;
  }
  /* A narrow window keeps the icons; the names stay in the tooltips. */
  @container (max-width: 640px) {
    .label {
      display: none;
    }
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
