<script lang="ts">
  import { onMount } from "svelte";
  import type { Project } from "$lib/core/project";
  import { t, zoom } from "$lib/state.svelte";
  import { TauriFs } from "$lib/tauriFs";
  import type { MessageKey } from "$lib/i18n";
  import ManuscriptView from "./ManuscriptView.svelte";
  import ExportView from "./ExportView.svelte";
  import SettingsView from "./SettingsView.svelte";
  import CodexView from "./CodexView.svelte";
  import FilesView from "./FilesView.svelte";
  import { provideNavigator } from "./navigation";
  import { layout, toggle } from "./layout.svelte";
  import type { NoteIndex } from "$lib/core/notes";
  import { noteType } from "$lib/core/notes";
  import { basename, dirname, isMarkdown, isWithin } from "$lib/core/path";
  import { linkTarget, resolveLink } from "$lib/core/wikilinks";
  import type { LinkSuggestion } from "$lib/editor/links";
  import { folderNotePath } from "$lib/core/manuscript";

  let { project, onClose }: { project: Project; onClose: () => void } = $props();

  /** "files" shows any other folder, such as Templates, when a link leads there. */
  type Section = "manuscript" | "codex" | "research" | "laboratory" | "views" | "export" | "settings" | "files";
  const sections: { id: Section; icon: string }[] = [
    { id: "manuscript", icon: "¶" },
    { id: "codex", icon: "◆" },
    { id: "research", icon: "❖" },
    { id: "laboratory", icon: "⚗" },
    { id: "views", icon: "▦" },
    { id: "export", icon: "⇪" },
  ];
  let section = $state<Section>("manuscript");
  /** Sections with panels on the sides, which can be hidden. */
  const panels = $derived(section !== "export" && section !== "settings" && section !== "views");
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
    const note = index?.notes.get(path);
    if (note && noteType(path, note.properties, project.settings) !== null && !isWithin(path, f.templates)) return { section: "codex" };
    return { section: "files", root: path.includes("/") ? path.slice(0, path.indexOf("/")) : "" };
  }

  /** Opens a note or file where it belongs, remembering where we were. */
  function open(path: string) {
    const target = sectionOf(path);
    // A chapter's folder note stands for the chapter.
    let shown = path;
    if (target.section === "manuscript" && isMarkdown(path) && folderNotePath(dirname(path)) === path) shown = dirname(path);
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
      out.push({ target, detail });
      for (const alias of index?.notes.get(path)?.aliases ?? []) out.push({ target, alias });
    }
    suggestionCache.set(from, out);
    return out;
  }

  provideNavigator({
    open,
    links: (from) => ({
      open(target) {
        const path = resolveLink(target, from, project.files);
        if (path) open(path);
      },
      resolves: (target) => resolveLink(target, from, project.files) !== null,
      suggestions: () => suggestions(from),
    }),
  });

  /** Cmd/Ctrl with + or - changes the size of the text, with 0 restores it. */
  function onKey(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const step = e.key === "+" || e.key === "=" ? 1 : e.key === "-" || e.key === "_" ? -1 : e.key === "0" ? 0 : null;
    if (step === null) return;
    e.preventDefault();
    zoom(step);
  }
  let fullscreen = $state(false);
  /** Bumped whenever files change on disk, so open scenes can reload. */
  let diskRev = $state(0);
  /** Bumped after the project reloads, so views read the new tree. */
  let rev = $state(0);

  async function reload() {
    await project.reload();
    rev++;
  }

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
          (p) => !p.startsWith(".dante/") && !p.includes(".dante-tmp") && !p.includes(".dante-move-"),
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

<svelte:window onkeydown={onKey} />

<div class="workspace" class:fullscreen>
  {#if !fullscreen}
    <nav aria-label="Sections" class:wide={layout.wideNav}>
      {#snippet item(id: string, icon: string, label: string, pressed: boolean | undefined, onclick: () => void)}
        <button
          class="section"
          aria-pressed={pressed}
          aria-label={label}
          data-tip={layout.wideNav ? undefined : label}
          data-tip-side="right"
          data-section={id}
          {onclick}
        >
          <span class="icon" aria-hidden="true">{icon}</span>
          {#if layout.wideNav}<span class="label">{label}</span>{/if}
        </button>
      {/snippet}
      {#each sections as s (s.id)}
        {@render item(s.id, s.icon, t(`section.${s.id}` as MessageKey), section === s.id, () => go(s.id))}
      {/each}
      <div class="spacer"></div>
      {@render item("settings", "⚙", t("section.settings"), section === "settings", () => go("settings"))}
      {@render item("close", "⏏", t("app.close"), undefined, onClose)}
      {@render item("names", layout.wideNav ? "«" : "»", t(layout.wideNav ? "nav.hideNames" : "nav.showNames"), undefined, () => toggle("wideNav"))}
    </nav>
  {/if}
  <div class="content" class:with-back={!fullscreen}>
    {#if !fullscreen}
      <div class="back-bar">
        {#if panels}
          <button
            class="panel-toggle"
            aria-pressed={!layout.left}
            aria-label={t(layout.left ? "nav.hideLeft" : "nav.showLeft")}
            data-tip={t(layout.left ? "nav.hideLeft" : "nav.showLeft")}
            onclick={() => toggle("left")}>◧</button
          >
        {/if}
        {#if section !== "manuscript" || byLink}
          <button onclick={back}>‹ {t("nav.back")}</button>
        {/if}
        <h1 class="section-name">{section === "files" ? filesRoot || project.settings.title : t(`section.${section}`)}</h1>
        {#if project.settings.title}<span class="project-name">{project.settings.title}</span>{/if}
        {#if panels}
          <button
            class="panel-toggle"
            class:alone={!project.settings.title}
            aria-pressed={!layout.right}
            aria-label={t(layout.right ? "nav.hideRight" : "nav.showRight")}
            data-tip={t(layout.right ? "nav.hideRight" : "nav.showRight")}
            data-tip-side="end"
            onclick={() => toggle("right")}>◨</button
          >
        {/if}
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
      />
    {:else if section === "codex"}
      <CodexView {project} {rev} {diskRev} open={opened.codex ?? null} onShow={(path) => (opened.codex = path)} onReload={reload} />
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
        />
      {/key}
    {:else if section === "export"}
      <ExportView {project} onSaved={reload} />
    {:else if section === "settings"}
      <SettingsView {project} onSaved={reload} />
    {:else}
      <div class="later">
        <h2>{t(`section.${section}` as MessageKey)}</h2>
        <p>{t("section.later")}</p>
      </div>
    {/if}
  </div>
</div>

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
    width: 38px;
    flex: none;
    font-size: 18px;
    text-align: center;
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
    min-width: 0;
    min-height: 0;
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
  .later {
    padding: 48px;
    color: var(--text-muted);
  }
  .later h2 {
    color: var(--text);
  }
</style>
