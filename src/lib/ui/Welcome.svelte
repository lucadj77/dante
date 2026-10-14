<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { sanitizeTitle } from "$lib/core/naming";
  import { Project } from "$lib/core/project";
  import { SETTINGS_FILE } from "$lib/core/settings";
  import { sampleProject } from "$lib/sample";
  import { app, exportPreferences, forgetProject, recent, rememberProject, saveAppSettings, t } from "$lib/state.svelte";
  import { inTauri, TauriFs } from "$lib/tauriFs";

  let { onOpen }: { onOpen: (project: Project) => void } = $props();
  let error = $state("");
  let notice = $state("");
  const desktop = inTauri();

  // New project form.
  let creating = $state(false);
  let title = $state("");
  let author = $state(app.settings.userName);
  let language = $state(app.settings.language);
  let parent = $state("");
  let busy = $state(false);
  const folderName = $derived(sanitizeTitle(title));
  const novelLanguages = [
    { code: "en", name: "English" },
    { code: "it", name: "Italiano" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
  ];

  function folderOf(path: string): string {
    return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  }

  async function openPath(path: string) {
    const project = await Project.open(new TauriFs(path), app.settings.language);
    // A new project records its language and folder names, so they no longer follow the interface.
    if (!(await project.fs.exists(SETTINGS_FILE))) {
      await project.saveSettings({ ...project.settings, title: project.settings.title || folderOf(path) });
    }
    rememberProject(path, project.settings.title || folderOf(path));
    onOpen(project);
  }

  async function openFolder() {
    error = "";
    try {
      const folder = await open({ directory: true, multiple: false });
      if (typeof folder === "string") await openPath(folder);
    } catch (e) {
      error = t("error.generic", { message: String(e) });
    }
  }

  async function openRecent(path: string) {
    error = "";
    notice = "";
    try {
      if (!(await new TauriFs(path).exists(""))) {
        forgetProject(path);
        notice = t("welcome.missing", { path });
        return;
      }
      await openPath(path);
    } catch (e) {
      error = t("error.generic", { message: String(e) });
    }
  }

  async function chooseParent() {
    const folder = await open({ directory: true, multiple: false });
    if (typeof folder === "string") parent = folder;
  }

  async function create() {
    error = "";
    if (!folderName || !parent) return;
    busy = true;
    try {
      const path = `${parent.replace(/[\\/]+$/, "")}/${folderName}`;
      const fs = new TauriFs(path);
      if ((await fs.exists("")) && (await fs.list("")).length > 0) {
        error = t("welcome.notEmpty", { path });
        return;
      }
      const { project } = await Project.create(
        fs,
        { title: title.trim(), author: author.trim(), language },
        { chapter: t("untitled"), scene: t("untitledScene") },
        exportPreferences(),
      );
      // The author's name is offered again next time.
      if (author.trim() && !app.settings.userName) saveAppSettings({ ...app.settings, userName: author.trim() });
      rememberProject(path, project.settings.title);
      onOpen(project);
    } catch (e) {
      error = t("error.generic", { message: String(e) });
    } finally {
      busy = false;
    }
  }

  async function openSample() {
    onOpen(await Project.open(sampleProject()));
  }

  const dateFormat = $derived(new Intl.DateTimeFormat(app.settings.language, { dateStyle: "medium" }));
</script>

<main>
  <h1>{t("app.name")}</h1>

  {#if creating}
    <h2>{t("welcome.new")}</h2>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <label>{t("settings.title")} <input bind:value={title} required /></label>
      <label>{t("settings.author")} <input bind:value={author} /></label>
      <label
        >{t("settings.language")}
        <select bind:value={language}>
          {#each novelLanguages as l (l.code)}
            <option value={l.code}>{l.name}</option>
          {/each}
        </select>
      </label>
      <div class="where">
        <span class="label">{t("welcome.where")}</span>
        <button type="button" onclick={chooseParent}>{t("welcome.choose")}</button>
        {#if parent && folderName}
          <span class="path">{parent.replace(/[\\/]+$/, "")}/{folderName}</span>
        {/if}
      </div>
      <div class="actions">
        <button class="primary" type="submit" disabled={busy || !folderName || !parent}>{t("welcome.create")}</button>
        <button type="button" onclick={() => (creating = false)}>{t("welcome.cancel")}</button>
      </div>
    </form>
  {:else}
    <p>{t("welcome.body")}</p>
    <div class="actions">
      {#if desktop}
        <button class="primary" onclick={() => (creating = true)}>{t("welcome.new")}</button>
        <button onclick={openFolder}>{t("welcome.open")}</button>
      {/if}
      <button onclick={openSample}>{t("welcome.sample")}</button>
    </div>
    {#if !desktop}
      <p class="note">{t("welcome.browser")}</p>
    {/if}

    {#if desktop && recent.projects.length > 0}
      <h2>{t("welcome.recent")}</h2>
      <ul class="recent">
        {#each recent.projects as r (r.path)}
          <li>
            <button class="item" onclick={() => openRecent(r.path)}>
              <span class="name">{r.title}</span>
              <span class="path">{r.path}</span>
            </button>
            <span class="date">{dateFormat.format(new Date(r.opened))}</span>
            <button class="remove" aria-label={t("welcome.forget", { name: r.title })} title={t("welcome.forget", { name: r.title })} onclick={() => forgetProject(r.path)}>×</button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#if notice}
    <p class="note">{notice}</p>
  {/if}
  {#if error}
    <p class="error">{error}</p>
  {/if}
</main>

<style>
  main {
    max-width: 560px;
    margin: 14vh auto 0;
    padding: 0 16px 48px;
  }
  h1 {
    font-family: Georgia, serif;
    font-weight: 400;
    font-size: 40px;
    margin: 0 0 24px;
  }
  h2 {
    font-size: 16px;
    margin: 32px 0 8px;
  }
  p {
    color: var(--text-muted);
    line-height: 1.5;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  form {
    display: grid;
    gap: 12px;
  }
  label {
    display: grid;
    gap: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }
  label input,
  label select {
    color: var(--text);
    font-size: 14px;
  }
  .where {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 13px;
  }
  .where .label {
    color: var(--text-muted);
    width: 100%;
  }
  .recent {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .recent li {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 6px;
  }
  .recent li:hover {
    background: var(--bg-hover);
  }
  .item {
    flex: 1;
    min-width: 0;
    display: grid;
    text-align: left;
    border: none;
    background: none;
    padding: 6px 8px;
  }
  .name {
    font-size: 14px;
  }
  .path {
    color: var(--text-muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .date {
    color: var(--text-muted);
    font-size: 12px;
  }
  .remove {
    border: none;
    background: none;
    opacity: 0;
    padding: 0 8px;
  }
  .recent li:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }
  .note {
    font-size: 13px;
  }
  .error {
    color: var(--danger);
  }
</style>
