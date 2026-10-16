<script lang="ts">
  import { findNode, headings } from "$lib/core/manuscript";
  import { isWithin, basename, isMarkdown, stripExt } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import { noteTitle } from "$lib/core/notes";
  import { isView } from "$lib/core/views";
  import { t } from "$lib/state.svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import FileViewer from "./FileViewer.svelte";
  import PaneManuscript from "./PaneManuscript.svelte";
  import PaneNote from "./PaneNote.svelte";
  import SceneSheets from "./SceneSheets.svelte";
  import ViewsView from "./ViewsView.svelte";
  import { closePane, evenWidths, MIN_PANE, panes, SCENE_SHEETS, setPanePath, setPaneWidth, shownIn, togglePin, type Pane } from "./panes.svelte";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    onReload: () => Promise<void>;
    /** Opens an item in its section, in the middle of the window. */
    onOpenMain: (path: string) => void;
    /** Puts the pane's item in the middle and what was there in the pane. */
    onSwap: (pane: Pane) => void;
  }
  let p: Props = $props();

  type Kind = "sheets" | "manuscript" | "view" | "note" | "file";

  function kindOf(path: string): Kind {
    if (path === SCENE_SHEETS) return "sheets";
    void p.rev;
    if (isWithin(path, p.project.settings.folders.manuscript) && findNode(p.project.manuscript, path)) return "manuscript";
    if (isView(path, p.project.settings)) return "view";
    return isMarkdown(path) ? "note" : "file";
  }

  const headingMap = $derived.by(() => {
    void p.rev;
    return headings(p.project.manuscript, p.project.settings);
  });

  function titleOf(path: string, kind: Kind): string {
    if (kind === "sheets") return t("panes.sheets");
    if (kind === "manuscript") {
      const node = findNode(p.project.manuscript, path);
      return (node && node.kind !== "scene" ? headingMap.get(path)?.replace(/\n/g, " · ") : null) ?? node?.title ?? basename(path);
    }
    if (kind === "view" || kind === "file") return kind === "view" ? stripExt(basename(path)) : basename(path);
    return noteTitle(path);
  }

  function iconOf(path: string, kind: Kind): IconName {
    if (kind === "sheets") return "sheets";
    if (kind === "view") return "views";
    if (kind === "manuscript") {
      const node = findNode(p.project.manuscript, path);
      return node?.kind === "scene" ? "scene" : node?.kind === "part" ? "part" : "chapter";
    }
    const f = p.project.settings.folders;
    if (isWithin(path, f.research)) return "research";
    if (isWithin(path, f.laboratory)) return "laboratory";
    return "codex";
  }

  /** Dragging a pane's left edge makes it wider or narrower; a double click evens out the text and the panes. */
  let area: HTMLDivElement;
  let dragging: { id: number; x: number; width: number } | null = null;

  function down(e: PointerEvent, pane: Pane) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = { id: pane.id, x: e.clientX, width: pane.width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!dragging) return;
    // The text keeps room to be read.
    const middle = (area.previousElementSibling as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
    const most = dragging.width + Math.max(0, middle - 320);
    setPaneWidth(dragging.id, Math.min(most, dragging.width + dragging.x - e.clientX));
  }

  function up(e: PointerEvent) {
    dragging = null;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  function even() {
    const middle = (area.previousElementSibling as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
    evenWidths(middle + panes.list.reduce((n, pane) => n + pane.width, 0));
  }

  function key(e: KeyboardEvent, pane: Pane) {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft") setPaneWidth(pane.id, pane.width + step);
    else if (e.key === "ArrowRight") setPaneWidth(pane.id, pane.width - step);
    else if (e.key === "Enter") even();
    else return;
    e.preventDefault();
  }
</script>

<div class="pane-area" bind:this={area}>
  {#each panes.list as pane (pane.id)}
    {@const kind = kindOf(pane.path)}
    {@const shown = shownIn(pane)}
    <section
      class="pane"
      class:focused={panes.focus === pane.id}
      data-pane={pane.id}
      tabindex="-1"
      style:width="min({pane.width}px, 60vw)"
      style:min-width="{MIN_PANE}px"
      aria-label={titleOf(pane.path, kind)}
    >
      <!-- A focusable separator is how a resizable splitter is announced (WAI-ARIA "window splitter"). -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="edge"
        role="separator"
        aria-orientation="vertical"
        aria-label={t("panes.resize")}
        aria-valuenow={pane.width}
        tabindex="0"
        title={t("panes.resizeHint")}
        onpointerdown={(e) => down(e, pane)}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        ondblclick={even}
        onkeydown={(e) => key(e, pane)}
      ></div>
      <header>
        <span class="icon"><Icon name={iconOf(pane.path, kind)} /></span>
        <h2 title={pane.path === SCENE_SHEETS ? undefined : pane.path}>{titleOf(pane.path, kind)}</h2>
        <button class="tool" aria-pressed={pane.pinned} aria-label={t("panes.pin")} data-tip={t(pane.pinned ? "tip.panes.unpin" : "tip.panes.pin")} onclick={() => togglePin(pane.id)}><Icon name="pin" /></button>
        {#if shown}
          <button
            class="tool"
            aria-label={t("panes.toMain")}
            data-tip={t("tip.panes.toMain")}
            onclick={() => {
              p.onOpenMain(shown);
              if (pane.path !== SCENE_SHEETS) closePane(pane.id);
            }}><Icon name="toMain" /></button
          >
        {/if}
        {#if kind !== "sheets"}
          <button class="tool" aria-label={t("panes.swap")} data-tip={t("tip.panes.swap")} onclick={() => p.onSwap(pane)}><Icon name="swap" /></button>
        {/if}
        <button class="tool" aria-label={t("panes.close")} data-tip={t("tip.panes.close")} onclick={() => closePane(pane.id)}><Icon name="cross" /></button>
      </header>
      <div class="body" class:fill={kind === "view" || kind === "file"}>
        {#key pane.path}
          {#if kind === "sheets"}
            <SceneSheets project={p.project} {pane} rev={p.rev} diskRev={p.diskRev} onReload={p.onReload} />
          {:else if kind === "manuscript"}
            <PaneManuscript project={p.project} path={pane.path} rev={p.rev} diskRev={p.diskRev} onReload={p.onReload} onPath={(path) => setPanePath(pane.id, path)} />
          {:else if kind === "view"}
            <ViewsView project={p.project} rev={p.rev} diskRev={p.diskRev} open={pane.path} onShow={() => {}} onReload={p.onReload} embedded />
          {:else if kind === "note"}
            <PaneNote project={p.project} path={pane.path} rev={p.rev} diskRev={p.diskRev} onReload={p.onReload} />
          {:else}
            <FileViewer project={p.project} path={pane.path} compact />
          {/if}
        {/key}
      </div>
    </section>
  {/each}
</div>

<style>
  .pane-area {
    display: flex;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }
  .pane {
    position: relative;
    outline: none;
    display: flex;
    flex-direction: column;
    flex: none;
    min-height: 0;
    border-left: 1px solid var(--border);
    background: var(--editor-bg);
  }
  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 6px;
    z-index: 5;
    cursor: col-resize;
  }
  .edge:hover,
  .edge:focus-visible {
    background: var(--accent);
    opacity: 0.4;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 34px;
    padding: 2px 6px 2px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-panel);
    color: var(--text-muted);
  }
  .pane.focused header {
    color: var(--accent);
    box-shadow: inset 0 -2px 0 var(--accent);
  }
  header h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .icon {
    display: inline-flex;
  }
  .tool {
    display: inline-flex;
    align-items: center;
    padding: 3px;
    border: none;
    background: none;
    color: var(--text-muted);
  }
  .tool:hover {
    color: var(--text);
  }
  .tool[aria-pressed="true"] {
    color: var(--accent);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .body.fill {
    display: flex;
    flex-direction: column;
  }
  .body.fill > :global(*) {
    flex: 1;
    min-height: 0;
  }
</style>
