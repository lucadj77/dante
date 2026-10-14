<script lang="ts">
  import { onMount } from "svelte";
  import type { Project } from "$lib/core/project";
  import { t, zoom } from "$lib/state.svelte";
  import { TauriFs } from "$lib/tauriFs";
  import type { MessageKey } from "$lib/i18n";
  import ManuscriptView from "./ManuscriptView.svelte";
  import ExportView from "./ExportView.svelte";
  import SettingsView from "./SettingsView.svelte";

  let { project, onClose }: { project: Project; onClose: () => void } = $props();

  type Section = "manuscript" | "codex" | "research" | "laboratory" | "views" | "export" | "settings";
  const sections: { id: Section; icon: string }[] = [
    { id: "manuscript", icon: "¶" },
    { id: "codex", icon: "◆" },
    { id: "research", icon: "❖" },
    { id: "laboratory", icon: "⚗" },
    { id: "views", icon: "▦" },
    { id: "export", icon: "⇪" },
  ];
  let section = $state<Section>("manuscript");
  /** Sections visited before the current one, for the Back button. */
  let previous = $state<Section[]>([]);

  function go(next: Section) {
    if (next === section) return;
    previous = [...previous, section];
    section = next;
  }

  function back() {
    section = previous.at(-1) ?? "manuscript";
    previous = previous.slice(0, -1);
  }

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
    <nav aria-label="Sections">
      {#each sections as s (s.id)}
        <button
          class="section"
          aria-pressed={section === s.id}
          title={t(`section.${s.id}` as MessageKey)}
          onclick={() => go(s.id)}
        >
          <span aria-hidden="true">{s.icon}</span>
        </button>
      {/each}
      <div class="spacer"></div>
      <button
        class="section"
        aria-pressed={section === "settings"}
        title={t("section.settings")}
        onclick={() => go("settings")}><span aria-hidden="true">⚙</span></button
      >
      <button class="section" title={t("app.close")} onclick={onClose}><span aria-hidden="true">⏏</span></button>
    </nav>
  {/if}
  <div class="content" class:with-back={section !== "manuscript"}>
    {#if section !== "manuscript"}
      <div class="back-bar">
        <button onclick={back}>‹ {t("nav.back")}</button>
      </div>
    {/if}
    {#if section === "manuscript"}
      <ManuscriptView {project} {rev} {diskRev} onReload={reload} onDiskChange={() => diskRev++} bind:fullscreen />
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
    grid-template-columns: 52px 1fr;
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
  .section {
    width: 40px;
    height: 40px;
    border: 1px solid transparent;
    font-size: 18px;
    padding: 0;
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
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }
  .back-bar button {
    border: none;
    background: none;
    padding: 4px 8px;
    color: var(--accent);
  }
  .later {
    padding: 48px;
    color: var(--text-muted);
  }
  .later h2 {
    color: var(--text);
  }
</style>
