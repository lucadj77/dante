<script lang="ts">
  import { failure } from "$lib/ui/errors";
  import { onMount } from "svelte";
  import { projectFolder } from "$lib/core/launcher";
  import type { Project } from "$lib/core/project";
  import { letGo, openProjectAt, openProjectIn } from "$lib/opening";
  import { BrowserFs } from "$lib/browserFs";
  import { startWeb } from "$lib/web";
  import { allow, chooseFolder, folderHolding, rememberFolder, webFs } from "$lib/webFolders";
  import { app, t } from "$lib/state.svelte";
  import { inTauri, TauriFs } from "$lib/tauriFs";
  import { flushAll, unsaved } from "$lib/ui/documents.svelte";
  import { flushSessions } from "$lib/ui/sessions.svelte";
  import { backupOnClose } from "$lib/backups";
  import UpdateBanner from "$lib/ui/UpdateBanner.svelte";
  import HelpDialog from "$lib/ui/HelpDialog.svelte";
  import { help, openHelp } from "$lib/ui/help.svelte";
  import Welcome from "$lib/ui/Welcome.svelte";
  import Workspace from "$lib/ui/Workspace.svelte";
  import { checkAtStart, checkForUpdates, loadUpdateInfo } from "$lib/updates.svelte";

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
      await message(failure(e), { title: t("app.name"), kind: "error" });
    }
  }

  /** A launcher double-clicked in a browser, whose folder needs a click to be allowed. */
  let launcher = $state.raw<{ file: FileSystemFileHandle; path: string | null } | null>(null);
  let launcherError = $state("");

  async function show(next: Project) {
    if (project) await flushAll(project);
    project = next;
  }

  /** Opens the project of a launcher file; asks for a click when the browser wants one. */
  async function openLauncher(file: FileSystemFileHandle) {
    const path = await folderHolding(file).catch(() => null);
    if (project?.fs instanceof BrowserFs && project.fs.key === path) return;
    const fs = path ? await webFs(path, false).catch(() => null) : null;
    if (fs) await show(await openProjectIn(fs, fs.key));
    else launcher = { file, path };
  }

  /** The click that lets the browser open the launcher's folder. */
  async function allowLauncher() {
    if (!launcher) return;
    const { file, path } = launcher;
    launcherError = "";
    try {
      let fs = path ? await webFs(path) : null;
      if (!fs) {
        // A folder not known yet: the writer chooses it, starting from the launcher's.
        const handle = await chooseFolder(file);
        if (!handle) return;
        if (!(await allow(handle))) throw new Error(t("welcome.denied"));
        fs = new BrowserFs(handle, await rememberFolder(handle));
      }
      launcher = null;
      await show(await openProjectIn(fs, fs.key));
    } catch (e) {
      launcherError = e instanceof Error ? e.message : String(e);
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
    if (project) await backupOnClose(project);
    await invoke("quit");
  }

  onMount(() => {
    // The first screen is on: static/startup-check.js no longer shows its report by itself.
    (window as { danteStarted?: () => void }).danteStarted?.();
    startWeb((file) => void openLauncher(file));
    if (!inTauri()) {
      let stopChecks = () => {};
      if (app.settings.checkUpdates) stopChecks = checkAtStart();
      else void loadUpdateInfo();
      // A tab closed a moment after typing: the browser asks to stay while the text is written.
      const leaving = (event: BeforeUnloadEvent) => {
        if (!project || !unsaved(project)) return;
        void flushAll(project).catch(() => {});
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", leaving);
      return () => {
        stopChecks();
        window.removeEventListener("beforeunload", leaving);
      };
    }
    let stopped = false;
    const unlistens: (() => void)[] = [];
    void import("@tauri-apps/api/event").then(({ listen }) => {
      const listenings = [
        listen("open-project", () => void openRequested()),
        listen("quit-requested", () => void quit()),
        // Dante > Check for Updates… in the Mac menu bar.
        listen("check-updates", () => void checkForUpdates(false, true)),
        // Help > Dante Help in the Mac menu bar.
        listen("open-help", () => openHelp()),
      ];
      for (const listening of listenings)
        void listening.then((u) => {
          if (stopped) u();
          else unlistens.push(u);
        });
    });
    void openRequested();
    let stopChecks = () => {};
    if (app.settings.checkUpdates) stopChecks = checkAtStart();
    else void loadUpdateInfo();
    return () => {
      stopped = true;
      stopChecks();
      for (const u of unlistens) u();
    };
  });
</script>

{#if project}
  <!-- A project opened from the system replaces the one on screen, with a workspace of its own. -->
  {#key project}
    <Workspace
      {project}
      onClose={() => {
        project = null;
        letGo();
      }}
    />
  {/key}
{:else}
  <Welcome onOpen={(p) => (project = p)} />
{/if}
{#if launcher}
  <div class="launcher" role="dialog" aria-label={launcher.file.name}>
    <span>{t("launcher.allow", { name: launcher.file.name })}</span>
    {#if launcherError}<span class="error">{launcherError}</span>{/if}
    <button class="primary" onclick={() => void allowLauncher()}>{t("launcher.open")}</button>
    <button onclick={() => (launcher = null)}>{t("welcome.cancel")}</button>
  </div>
{/if}
{#if help.open}<HelpDialog />{/if}
<UpdateBanner
  beforeInstall={async () => {
    if (project) await flushAll(project);
  }}
/>

<style>
  .launcher {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    max-width: min(560px, calc(100vw - 32px));
    padding: 10px 12px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
  }
  .launcher > span:first-child {
    flex: 1;
  }
  .error {
    width: 100%;
    color: var(--danger);
    font-size: 12px;
  }
</style>
