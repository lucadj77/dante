<script lang="ts">
  import { onMount } from "svelte";
  import type { Project } from "$lib/core/project";
  import { t, zoom } from "$lib/state.svelte";
  import { TauriFs } from "$lib/tauriFs";
  import type { MessageKey } from "$lib/i18n";
  import ManuscriptView from "./ManuscriptView.svelte";
  import ExportView from "./ExportView.svelte";
  import { EXPORT_FOLDER } from "$lib/core/export/files";
  import SettingsView from "./SettingsView.svelte";
  import CodexView from "./CodexView.svelte";
  import FilesView from "./FilesView.svelte";
  import ViewsView from "./ViewsView.svelte";
  import StatsView from "./StatsView.svelte";
  import { startSessions } from "./sessions.svelte";
  import { isView } from "$lib/core/views";
  import QuickSearch from "./QuickSearch.svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import { provideNavigator } from "./navigation";
  import { layout, toggle } from "./layout.svelte";
  import type { NoteIndex } from "$lib/core/notes";
  import { noteType } from "$lib/core/notes";
  import { basename, dirname, isMarkdown, isWithin } from "$lib/core/path";
  import { linkTarget, resolveLink } from "$lib/core/wikilinks";
  import { imageMime, resolveImagePath } from "$lib/core/images";
  import type { LinkSuggestion } from "$lib/editor/links";
  import { folderNotePath } from "$lib/core/manuscript";
  import ConflictsDialog from "./ConflictsDialog.svelte";
  import { startPresence } from "./presence.svelte";
  import PaneArea from "./PaneArea.svelte";
  import { flushAll } from "./documents.svelte";
  import {
    closePane,
    dropMissing,
    focusedPane,
    followMoves,
    loadPanes,
    openBeside,
    panes,
    setPanePath,
    type Pane,
  } from "./panes.svelte";

  let { project, onClose }: { project: Project; onClose: () => void } = $props();

  /** "files" shows any other folder, such as Templates, when a link leads there. */
  type Section = "manuscript" | "codex" | "research" | "laboratory" | "views" | "stats" | "export" | "settings" | "files";
  const sections: { id: Section & IconName }[] = [
    { id: "manuscript" },
    { id: "codex" },
    { id: "research" },
    { id: "laboratory" },
    { id: "views" },
    { id: "stats" },
    { id: "export" },
  ];
  let section = $state<Section>("manuscript");
  /** Sections with panels on the sides, which can be hidden. */
  const panels = $derived(section !== "export" && section !== "settings" && section !== "views" && section !== "stats");
  /** What each section shows, so coming back to it finds the same note. */
  let opened = $state<Partial<Record<Section, string | null>>>({});
  /** Root of the "files" section. */
  let filesRoot = $state("");
  interface Place {
    section: Section;
    path: string | null;
    filesRoot: string;
  }
  /** Places visited before the current one, for the Back button. */
  let previous = $state<Place[]>([]);
  const here = (): Place => ({ section, path: opened[section] ?? null, filesRoot });

  /** The manuscript shows the Back button only when a link led there. */
  let byLink = $state(false);

  function go(next: Section) {
    if (next === section) return;
    previous = [...previous, here()];
    section = next;
    byLink = false;
  }

  function back() {
    const place = previous.at(-1);
    previous = previous.slice(0, -1);
    if (!place) {
      section = "manuscript";
      return;
    }
    filesRoot = place.filesRoot;
    opened[place.section] = place.path;
    section = place.section;
    byLink = false;
  }

  /** The section a project path belongs to. */
  function sectionOf(path: string): { section: Section; root?: string } {
    const f = project.settings.folders;
    if (isWithin(path, f.manuscript)) return { section: "manuscript" };
    if (isWithin(path, f.codex)) return { section: "codex" };
    if (isWithin(path, f.research)) return { section: "research" };
    if (isWithin(path, f.laboratory)) return { section: "laboratory" };
    if (isView(path, project.settings)) return { section: "views" };
    const note = index?.notes.get(path);
    if (note && noteType(path, note.properties, project.settings) !== null && !isWithin(path, f.templates)) return { section: "codex" };
    return { section: "files", root: path.includes("/") ? path.slice(0, path.indexOf("/")) : "" };
  }

  /** Opens a note or file where it belongs, remembering where we were; `beside` opens it in a pane. */
  function open(path: string, beside = false) {
    const target = sectionOf(path);
    // A chapter's folder note stands for the chapter.
    let shown = path;
    if (target.section === "manuscript" && isMarkdown(path) && folderNotePath(dirname(path)) === path) shown = dirname(path);
    if (beside) {
      openBeside(shown);
      return;
    }
    if (target.section === section && opened[section] === shown && (target.root ?? filesRoot) === filesRoot) return;
    previous = [...previous, here()];
    if (target.root !== undefined) filesRoot = target.root;
    opened[target.section] = shown;
    section = target.section;
    byLink = true;
  }

  /** Kept for link suggestions and for telling typed notes apart; refreshed after reloads. */
  let index: NoteIndex | null = null;
  $effect(() => {
    void rev;
    void project.index().then((i) => (index = i));
  });

  const suggestionCache = new Map<string, LinkSuggestion[]>();
  let suggestionRev = -1;

  function suggestions(from: string): LinkSuggestion[] {
    if (suggestionRev !== rev) {
      suggestionCache.clear();
      suggestionRev = rev;
    }
    const cached = suggestionCache.get(from);
    if (cached) return cached;
    const files = project.files;
    const out: LinkSuggestion[] = [];
    for (const path of files) {
      if (path === from || path.startsWith(project.settings.folders.templates + "/")) continue;
      const target = linkTarget(path, from, files);
      const type = index?.notes.get(path) ? noteType(path, index.notes.get(path)!.properties, project.settings) : null;
      const detail = type && project.settings.types[type] ? `${project.settings.types[type].icon} ${project.settings.types[type].name}` : dirname(path) || basename(path);
      out.push({ target, detail, type: type ?? undefined });
      for (const alias of index?.notes.get(path)?.aliases ?? []) out.push({ target, alias, type: type ?? undefined });
    }
    suggestionCache.set(from, out);
    return out;
  }

  // Images shown in the editors, read once per file; a file changed on disk shows after a reload.
  const imageUrls = new Map<string, Promise<string | null>>();
  function imageUrl(target: string, wiki: boolean, from: string): Promise<string | null> {
    const path = wiki ? resolveLink(target.split("#")[0], from, project.files) : resolveImagePath(target, from, project.files);
    if (!path) return Promise.resolve(!wiki && /^https?:\/\//i.test(target) ? target : null);
    let url = imageUrls.get(path);
    if (!url) {
      url = project.fs
        .readBytes(path)
        .then((bytes) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: imageMime(path) })))
        .catch(() => null);
      imageUrls.set(path, url);
    }
    return url;
  }

  provideNavigator({
    open,
    reload,
    links: (from) => ({
      open(target, beside) {
        const path = resolveLink(target, from, project.files);
        if (path) open(path, beside);
      },
      resolves: (target) => resolveLink(target, from, project.files) !== null,
      suggestions: () => suggestions(from),
      images: {
        url: (target, wiki) => imageUrl(target, wiki, from),
        async add(data, name) {
          const path = await project.addAttachment(from, name, data);
          suggestionCache.clear();
          return linkTarget(path, from, project.files);
        },
        labels: {
          small: t("image.small"),
          medium: t("image.medium"),
          large: t("image.large"),
          original: t("image.original"),
          left: t("image.left"),
          center: t("image.center"),
          right: t("image.right"),
          missing: t("image.missing"),
          pasted: t("image.pasted"),
        },
      },
    }),
  });

  /** The search opened from the section bar, over the section. */
  let searching = $state(false);
  /** The search was opened to choose what a new pane shows. */
  let searchingBeside = $state(false);

  /** Sections that can have panes beside them; the others use the whole width. */
  const withPanes = $derived(["manuscript", "codex", "research", "laboratory", "files", "views"].includes(section));
  const showPanes = $derived(withPanes && panes.list.length > 0);

  /** The item the section shows, for swapping it with a pane. */
  function mainItem(): string | null {
    if (!withPanes) return null;
    const path = opened[section] ?? null;
    if (path && section === "views" && !project.views.includes(path)) return null;
    return path;
  }

  function swap(pane: Pane) {
    const main = mainItem();
    const item = pane.path;
    if (main) setPanePath(pane.id, main);
    else closePane(pane.id);
    open(item);
    panes.focus = null;
  }

  /** The cursor moves into a pane, or back to the section, as with Alt+Cmd+arrows. */
  function focusPane(id: number | null) {
    let el: HTMLElement | null;
    if (id === null) el = lastMain?.isConnected ? lastMain : document.querySelector<HTMLElement>(".content .cm-content:not(.pane .cm-content)");
    // A pane without text, such as a view, takes the cursor itself.
    else el = document.querySelector<HTMLElement>(`.pane[data-pane="${id}"] .cm-content`) ?? document.querySelector<HTMLElement>(`.pane[data-pane="${id}"]`);
    panes.focus = id;
    el?.focus();
  }

  /** The last element of the section that had the cursor, to go back to it from a pane. */
  let lastMain: HTMLElement | null = null;

  /** A click or the cursor in a pane makes it the focused one; in the section, none is. */
  function track(e: Event) {
    const el = e.target as HTMLElement | null;
    if (!el?.closest) return;
    const pane = el.closest<HTMLElement>(".pane[data-pane]");
    if (pane) {
      panes.focus = Number(pane.dataset.pane);
      return;
    }
    // The side panel shows the focused item, and the dialogs float over everything.
    if (el.closest("aside.side, .search-drawer, nav, .menu, [role=dialog]")) return;
    panes.focus = null;
    if (e.type === "focusin") lastMain = el;
  }

  /** Cmd/Ctrl with + or - changes the size of the text, with 0 restores it. */
  function onKey(e: KeyboardEvent) {
    if (searching && e.key === "Escape") {
      searching = false;
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    if (withPanes && paneKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.altKey) return;
    // Cmd/Ctrl+Shift+F opens the search, as in Obsidian.
    if (e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      searchingBeside = false;
      searching = !searching;
      return;
    }
    const step = e.key === "+" || e.key === "=" ? 1 : e.key === "-" || e.key === "_" ? -1 : e.key === "0" ? 0 : null;
    if (step === null) return;
    e.preventDefault();
    zoom(step);
  }
  /** The pane shortcuts; true when `e` was one. */
  function paneKey(e: KeyboardEvent): boolean {
    // Cmd+\ opens a new pane, choosing what it shows with the search; with Alt it swaps.
    if (e.code === "Backslash" || e.key === "\\") {
      const pane = focusedPane() ?? panes.list.at(-1);
      if (e.altKey) {
        if (pane) swap(pane);
      } else {
        searchingBeside = true;
        searching = true;
      }
      return true;
    }
    // Alt+Cmd+arrows move the cursor among the section and the panes.
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight") && panes.list.length) {
      const order = [null, ...panes.list.map((p) => p.id)];
      const at = Math.max(0, order.indexOf(panes.focus));
      const next = order[Math.min(order.length - 1, Math.max(0, at + (e.key === "ArrowLeft" ? -1 : 1)))];
      focusPane(next);
      return true;
    }
    // Cmd+W closes the pane with the cursor (on the Mac it comes from the menu, see onMount).
    if (!e.altKey && !e.shiftKey && e.key.toLowerCase() === "w") {
      closeFocused();
      return true;
    }
    return false;
  }

  function closeFocused() {
    const pane = focusedPane();
    if (pane) {
      closePane(pane.id);
      focusPane(null);
    }
  }

  /** Something is being dragged: the right edge takes it to open it beside. */
  let dragActive = $state(false);
  let dropOver = $state(false);

  function dropBeside(e: DragEvent) {
    e.preventDefault();
    const path = e.dataTransfer?.getData("text/plain") ?? "";
    dragActive = dropOver = false;
    if (project.files.includes(path) || project.folders.includes(path)) open(path, true);
  }

  let fullscreen = $state(false);
  /** Bumped whenever files change on disk, so open scenes can reload. */
  let diskRev = $state(0);
  /** Bumped after the project reloads, so views read the new tree. */
  let rev = $state(0);

  async function reload() {
    await project.reload();
    for (const url of imageUrls.values()) void url.then((u) => u?.startsWith("blob:") && URL.revokeObjectURL(u));
    imageUrls.clear();
    rev++;
  }

  onMount(() => startPresence(project));

  // The panes of this project, as they were left; they follow renamed items and close with
  // deleted ones, and what is typed in them is written before files move.
  onMount(() => {
    loadPanes(project.fs instanceof TauriFs ? project.fs.root : "sample");
    project.beforeMove = () => flushAll(project);
    project.onMoved = followMoves;
    return () => {
      project.beforeMove = null;
      project.onMoved = null;
    };
  });
  $effect(() => {
    void rev;
    const files = new Set(project.files);
    const folders = new Set(project.folders);
    dropMissing((path) => files.has(path) || folders.has(path));
  });

  // On the Mac the menu takes Cmd+W before the page sees it, and sends it here.
  onMount(() => {
    let unlisten: (() => void) | undefined;
    let stopped = false;
    if (project.fs instanceof TauriFs) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen("close-pane", () => closeFocused()).then((u) => {
          if (stopped) u();
          else unlisten = u;
        }),
      );
    }
    return () => {
      stopped = true;
      unlisten?.();
    };
  });
  onMount(() => startSessions(project));

  /** Copies made by a sync service, shown above the sections until settled. */
  const conflicts = $derived.by(() => {
    void rev;
    return project.conflicts;
  });
  let showConflicts = $state(false);

  onMount(() => {
    if (!(project.fs instanceof TauriFs)) return;
    const fs = project.fs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");
      await invoke("watch_project", { root: fs.root });
      unlisten = await listen<string[]>("project-changed", (event) => {
        const relevant = event.payload.some(
          (p) => !p.startsWith(".dante/") && p !== EXPORT_FOLDER && !p.startsWith(`${EXPORT_FOLDER}/`) && !p.includes(".dante-tmp") && !p.includes(".dante-move-"),
        );
        if (!relevant) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          await reload();
          diskRev++;
        }, 300);
      });
    })();
    return () => {
      clearTimeout(timer);
      unlisten?.();
    };
  });
</script>

<svelte:window
  onkeydown={onKey}
  ondragstart={() => (dragActive = true)}
  ondragend={() => (dragActive = dropOver = false)}
  ondrop={() => (dragActive = dropOver = false)}
/>

{#if showConflicts && conflicts.length}
  <ConflictsDialog
    {project}
    {conflicts}
    onClose={() => (showConflicts = false)}
    onResolved={async () => {
      await reload();
      diskRev++;
    }}
  />
{/if}

<div class="workspace" class:fullscreen>
  {#if !fullscreen}
    <nav aria-label="Sections" class:wide={layout.wideNav}>
      {#snippet item(id: string, icon: IconName, label: string, pressed: boolean | undefined, onclick: () => void, tip = label)}
        <button
          class="section"
          aria-pressed={pressed}
          aria-label={label}
          data-tip={tip}
          data-tip-side="right"
          data-section={id}
          {onclick}
        >
          <span class="icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
          {#if layout.wideNav}<span class="label">{label}</span>{/if}
        </button>
      {/snippet}
      {@render item("search", "search", t("side.search"), searching, () => (searching = !searching), t("tip.search"))}
      <hr />
      {#each sections as s (s.id)}
        {@render item(s.id, s.id, t(`section.${s.id}` as MessageKey), section === s.id && !searching, () => { searching = false; go(s.id); }, t(`tip.section.${s.id}` as MessageKey))}
      {/each}
      <div class="spacer"></div>
      {@render item("settings", "settings", t("section.settings"), section === "settings", () => go("settings"), t("tip.section.settings"))}
      {@render item("close", "close", t("app.close"), undefined, onClose, t("tip.close"))}
      {@render item("names", layout.wideNav ? "hideNames" : "showNames", t(layout.wideNav ? "nav.hideNames" : "nav.showNames"), undefined, () => toggle("wideNav"))}
    </nav>
  {/if}
  {#if searching && !fullscreen}
    <div class="search-backdrop" role="presentation" onmousedown={() => (searching = false)}></div>
    <div class="search-drawer" class:wide={layout.wideNav} role="dialog" aria-label={t("side.search")}>
      {#key searchingBeside}
        <QuickSearch {project} version={rev} {diskRev} beside={searchingBeside} onOpened={() => (searching = false)} />
      {/key}
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="content" class:with-back={!fullscreen} onfocusin={track} onpointerdowncapture={track}>
    {#if !fullscreen}
      <div class="back-bar">
        {#if panels}
          <button
            class="panel-toggle"
            aria-pressed={!layout.left}
            aria-label={t(layout.left ? "nav.hideLeft" : "nav.showLeft")}
            data-tip={t(layout.left ? "tip.hideLeft" : "tip.showLeft")}
            onclick={() => toggle("left")}>◧</button
          >
        {/if}
        {#if section !== "manuscript" || byLink}
          <button onclick={back}>‹ {t("nav.back")}</button>
        {/if}
        <h1 class="section-name">{section === "files" ? filesRoot || project.settings.title : t(`section.${section}`)}</h1>
        {#if conflicts.length}
          <button class="conflicts" title={t("tip.conflicts")} onclick={() => (showConflicts = true)}
            >⚠ {conflicts.length === 1 ? t("conflicts.one") : t("conflicts.many", { count: conflicts.length })}</button
          >
        {/if}
        {#if project.settings.title}<span class="project-name">{project.settings.title}</span>{/if}
        {#if panels}
          <button
            class="panel-toggle"
            class:alone={!project.settings.title}
            aria-pressed={!layout.right}
            aria-label={t(layout.right ? "nav.hideRight" : "nav.showRight")}
            data-tip={t(layout.right ? "tip.hideRight" : "tip.showRight")}
            onclick={() => toggle("right")}>◨</button
          >
        {/if}
      </div>
    {/if}
    {#if dragActive && withPanes}
      <div
        class="drop-beside"
        class:over={dropOver}
        role="region"
        aria-label={t("panes.dropHere")}
        ondragover={(e) => {
          e.preventDefault();
          dropOver = true;
        }}
        ondragleave={() => (dropOver = false)}
        ondrop={dropBeside}
      >
        <span>{t("panes.dropHere")}</span>
      </div>
    {/if}
    {#if section === "manuscript"}
      <ManuscriptView
        {project}
        {rev}
        {diskRev}
        onReload={reload}
        onDiskChange={() => diskRev++}
        bind:fullscreen
        reveal={opened.manuscript ?? null}
        onShow={(path) => (opened.manuscript = path)}
        beside={showPanes ? besidePanes : null}
      />
    {:else if section === "codex"}
      <CodexView {project} {rev} {diskRev} open={opened.codex ?? null} onShow={(path) => (opened.codex = path)} onReload={reload} beside={showPanes ? besidePanes : null} />
    {:else if section === "research" || section === "laboratory"}
      {#key section}
        <FilesView
          {project}
          {rev}
          {diskRev}
          root={project.settings.folders[section]}
          title={t(`section.${section}`)}
          open={opened[section] ?? null}
          onShow={(path) => (opened[section] = path)}
          onReload={reload}
          beside={showPanes ? besidePanes : null}
        />
      {/key}
    {:else if section === "files"}
      {#key filesRoot}
        <FilesView
          {project}
          {rev}
          {diskRev}
          root={filesRoot}
          title={filesRoot || project.settings.title}
          open={opened.files ?? null}
          onShow={(path) => (opened.files = path)}
          onReload={reload}
          beside={showPanes ? besidePanes : null}
        />
      {/key}
    {:else if section === "export"}
      <ExportView {project} onSaved={reload} />
    {:else if section === "settings"}
      <SettingsView {project} onSaved={reload} />
    {:else if section === "stats"}
      <StatsView {project} {rev} {diskRev} onSaved={reload} />
    {:else if section === "views"}
      <div class="with-panes" class:on={showPanes}>
        <ViewsView {project} {rev} {diskRev} open={opened.views ?? null} onShow={(path) => (opened.views = path)} onReload={reload} />
        {#if showPanes}{@render besidePanes()}{/if}
      </div>
    {/if}
  </div>
</div>

{#snippet besidePanes()}
  <PaneArea {project} {rev} {diskRev} onReload={reload} onOpenMain={(path) => open(path)} onSwap={swap} />
{/snippet}

<style>
  .workspace {
    display: grid;
    grid-template-columns: auto 1fr;
    height: 100vh;
  }
  .workspace.fullscreen {
    grid-template-columns: 1fr;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 6px;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
  }
  nav.wide {
    width: 180px;
  }
  nav hr {
    width: 100%;
    margin: 2px 0;
    border: none;
    border-top: 1px solid var(--border);
  }
  .search-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
  }
  .search-drawer {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 53px;
    z-index: 31;
    width: min(460px, calc(100vw - 80px));
    overflow: auto;
    padding: 12px;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
  }
  .search-drawer.wide {
    left: 180px;
  }
  .section {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 40px;
    height: 40px;
    border: 1px solid transparent;
    padding: 0;
  }
  nav.wide .section {
    width: 100%;
    padding-right: 10px;
  }
  .section .icon {
    display: flex;
    justify-content: center;
    width: 38px;
    flex: none;
  }
  .section .label {
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .spacer {
    flex: 1;
  }
  .content {
    position: relative;
    min-width: 0;
    min-height: 0;
  }
  .drop-beside {
    position: absolute;
    top: 48px;
    right: 8px;
    bottom: 8px;
    z-index: 25;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    border: 2px dashed var(--accent);
    border-radius: 8px;
    background: var(--bg-panel);
    opacity: 0.85;
    color: var(--accent);
    font-size: 12px;
  }
  .drop-beside span {
    writing-mode: vertical-rl;
    pointer-events: none;
  }
  .drop-beside.over {
    width: 120px;
    opacity: 1;
  }
  .with-panes {
    height: 100%;
    min-height: 0;
  }
  .with-panes.on {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .content.with-back {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .back-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 4px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-panel);
  }
  .section-name {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .project-name {
    margin-left: auto;
    color: var(--text-muted);
    font-size: 13px;
  }
  .back-bar button {
    border: none;
    background: none;
    padding: 4px 8px;
    color: var(--accent);
  }
  .back-bar .conflicts {
    color: var(--danger);
    font-size: 13px;
  }
  .back-bar .panel-toggle {
    padding: 2px 6px;
    font-size: 16px;
    color: var(--text-muted);
  }
  .back-bar .panel-toggle[aria-pressed="true"] {
    color: var(--accent);
  }
  .panel-toggle.alone {
    margin-left: auto;
  }
</style>
