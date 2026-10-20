<script lang="ts">
  import { onMount } from "svelte";
  import { projectFolder } from "$lib/core/launcher";
  import type { Project } from "$lib/core/project";
  import { openProjectAt } from "$lib/opening";
  import { app, t } from "$lib/state.svelte";
  import { inTauri, TauriFs } from "$lib/tauriFs";
  import { flushAll } from "$lib/ui/documents.svelte";
  import { flushSessions } from "$lib/ui/sessions.svelte";
  import UpdateBanner from "$lib/ui/UpdateBanner.svelte";
  import Welcome from "$lib/ui/Welcome.svelte";
  import Workspace from "$lib/ui/Workspace.svelte";
  import { checkForUpdates, loadUpdateInfo } from "$lib/updates.svelte";

  let project = $state.raw<Project | null>(null);

  /** Opens what the system asked for (a double-clicked launcher file), in place of the open project. */
  async function openRequested() {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string | null>("opened_project");
    if (!path) return;
    const folder = projectFolder(path);
    if (project?.fs instanceof TauriFs && project.fs.root === folder) return;
    try {
      if (project) await flushAll(project);
      project = await openProjectAt(folder);
    } catch (e) {
      const { message } = await import("@tauri-apps/plugin-dialog");
      await message(t("error.generic", { message: String(e) }), { title: t("app.name"), kind: "error" });
    }
  }

  /** The window is closing: what was typed in the last moment is written first. */
  async function quit() {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("quit_answered");
    try {
      if (project) await flushAll(project);
      await flushSessions();
    } catch (e) {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      const anyway = await ask(t("quit.unsaved", { message: String(e) }), { title: t("app.name"), kind: "warning", okLabel: t("quit.anyway"), cancelLabel: t("quit.stay") });
      if (!anyway) return;
    }
    await invoke("quit");
  }

  onMount(() => {
    // The first screen is on: static/startup-check.js no longer shows its report by itself.
    (window as { danteStarted?: () => void }).danteStarted?.();
    if (!inTauri()) return;
    let stopped = false;
    const unlistens: (() => void)[] = [];
    void import("@tauri-apps/api/event").then(({ listen }) => {
      for (const listening of [listen("open-project", () => void openRequested()), listen("quit-requested", () => void quit())])
        void listening.then((u) => {
          if (stopped) u();
          else unlistens.push(u);
        });
    });
    void openRequested();
    if (app.settings.checkUpdates) void checkForUpdates(true);
    else void loadUpdateInfo();
    return () => {
      stopped = true;
      for (const u of unlistens) u();
    };
  });
</script>

{#if project}
  <!-- A project opened from the system replaces the one on screen, with a workspace of its own. -->
  {#key project}
    <Workspace {project} onClose={() => (project = null)} />
  {/key}
{:else}
  <Welcome onOpen={(p) => (project = p)} />
{/if}
<UpdateBanner
  beforeInstall={async () => {
    if (project) await flushAll(project);
  }}
/>
