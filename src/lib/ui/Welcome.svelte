<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { sanitizeTitle } from "$lib/core/naming";
  import { Project } from "$lib/core/project";
  import { parseSettings, SETTINGS_FILE } from "$lib/core/settings";
  import { coverSvg, resolveCover, svgUrl, type CoverSettings } from "$lib/core/cover";
  import CoverPicker from "./CoverPicker.svelte";
  import AuthorsInput from "./AuthorsInput.svelte";
  import { authorsOf } from "$lib/core/export/files";
  import { sampleProject } from "$lib/sample";
  import { app, exportPreferences, forgetProject, num, recent, rememberProject, saveAppSettings, t } from "$lib/state.svelte";
  import { inTauri, TauriFs } from "$lib/tauriFs";
  import { BrowserFs } from "$lib/browserFs";
  import { addLauncher, folderFs, OpenElsewhere, openProjectAt, openProjectIn } from "$lib/opening";
  import { allow, chooseFolder, forgetFolder, isWebPath, rememberFolder, webFolders, webFs } from "$lib/webFolders";
  import { MemoryFs } from "$lib/core/fs";
  import { readDocx, type DocxContent } from "$lib/core/import/docx";
  import { counts, defaultBlankLines, defaultRoles, type BlankLines, type HeadingRole, type ImportedBook, type Mark } from "$lib/core/import/structure";
  import WordImport from "./WordImport.svelte";
  import { pickWordFile } from "./wordFile";

  let { onOpen }: { onOpen: (project: Project) => void } = $props();
  let error = $state("");
  let notice = $state("");
  const desktop = inTauri();
  /** A Chromium browser, which can work on a folder of the computer. */
  const web = webFolders();
  /** Projects are folders of the computer, in the app or in such a browser. */
  const folders = desktop || web;

  // New project form.
  let creating = $state(false);
  let title = $state("");
  let authors = $state<string[]>(app.settings.userName ? [app.settings.userName] : []);
  let language = $state(app.settings.language);
  let parent = $state("");
  /** In a browser, the folder chosen as `parent`. */
  let parentHandle: FileSystemDirectoryHandle | null = null;
  let busy = $state(false);
  /** Follows the title until the writer picks shapes or colours. */
  let cover = $state<CoverSettings>({ template: "", palette: "" });

  /** Covers of the recent projects, drawn from each project's settings. */
  let covers = $state<Record<string, string>>({});
  $effect(() => {
    for (const r of recent.projects) {
      if (covers[r.path]) continue;
      const fallback = svgUrl(coverSvg({ title: r.title, authors: [] }, { template: "", palette: "" }));
      covers[r.path] = fallback;
      if (!folders) continue;
      // A browser shows the real cover only of folders it may read without asking.
      void (isWebPath(r.path) ? webFs(r.path, false) : folderFs(r.path))
        .then((fs) => fs?.readText(SETTINGS_FILE) ?? Promise.reject())
        .then((text) => {
          const settings = parseSettings(text);
          covers[r.path] = svgUrl(coverSvg({ ...settings, title: settings.title || r.title }, settings.cover));
        })
        .catch(() => {
          // A project without settings, or out of reach: the title alone makes its cover.
        });
    }
  });
  const folderName = $derived(sanitizeTitle(title));
  /** A book read from a Word file, made into the new project instead of an empty one. */
  let content = $state<DocxContent | null>(null);
  /** What each heading level of the Word file becomes; the writer can change it. */
  let roles = $state<Record<number, HeadingRole>>({});
  /** How many empty paragraphs in a row start a new scene; 0 when they never do. */
  let blanks = $state<BlankLines>(0);
  /** What the writer said single lines of the Word file are, in the preview. */
  let marks = $state<Record<number, Mark>>({});
  /** The preview of the Word file is open. */
  let previewing = $state(false);
  /** The book as the preview left it. */
  let imported = $state<ImportedBook | null>(null);
  let importedFrom = $state("");
  const importedCounts = $derived(imported ? counts(imported) : null);
  const novelLanguages = [
    { code: "en", name: "English" },
    { code: "it", name: "Italiano" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
  ];

  async function openPath(path: string) {
    onOpen(await openProjectAt(path));
  }

  async function openFolder() {
    error = "";
    try {
      if (web) {
        const handle = await chooseFolder();
        if (!handle) return;
        if (!(await allow(handle))) {
          error = t("welcome.denied");
          return;
        }
        const path = await rememberFolder(handle);
        onOpen(await openProjectIn(new BrowserFs(handle, path), path));
        return;
      }
      const folder = await open({ directory: true, multiple: false });
      if (typeof folder === "string") await openPath(folder);
    } catch (e) {
      error = e instanceof OpenElsewhere ? e.message : t("error.generic", { message: String(e) });
    }
  }

  async function openRecent(path: string) {
    error = "";
    notice = "";
    try {
      if (isWebPath(path)) {
        const fs = await webFs(path).catch(() => null);
        const name = recent.projects.find((r) => r.path === path)?.folder ?? "";
        if (!fs) {
          error = t("welcome.denied");
          return;
        }
        if (!(await fs.list("").then(() => true, () => false))) {
          forget(path);
          notice = t("welcome.missing", { path: name });
          return;
        }
        onOpen(await openProjectIn(fs, path));
        return;
      }
      if (!(await new TauriFs(path).exists(""))) {
        forgetProject(path);
        notice = t("welcome.missing", { path });
        return;
      }
      await openPath(path);
    } catch (e) {
      error = e instanceof OpenElsewhere ? e.message : t("error.generic", { message: String(e) });
    }
  }

  function forget(path: string) {
    forgetProject(path);
    if (isWebPath(path)) void forgetFolder(path).catch(() => {});
  }

  async function chooseParent() {
    if (web) {
      const handle = await chooseFolder().catch(() => null);
      if (handle && (await allow(handle))) {
        parentHandle = handle;
        parent = handle.name;
      }
      return;
    }
    const folder = await open({ directory: true, multiple: false });
    if (typeof folder === "string") parent = folder;
  }

  /** Reads a Word file and opens the form of a new project made from it. */
  async function importWord(bytes: Uint8Array, fileName: string) {
    error = "";
    try {
      const read = await readDocx(bytes, { note: t("import.note") });
      roles = defaultRoles(read.blocks);
      blanks = defaultBlankLines(read.blocks);
      marks = {};
      content = read;
      importedFrom = fileName;
      imported = null;
      title = "";
      if (read.author) authors = authorsOf(read.author);
      previewing = true;
    } catch (e) {
      error = t("import.failed", { name: fileName, message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function chooseWord() {
    error = "";
    try {
      const file = await pickWordFile();
      if (file) await importWord(file.bytes, file.name);
    } catch (e) {
      error = t("error.generic", { message: String(e) });
    }
  }

  /** Goes on from the preview to the new project's form. */
  function previewed(book: ImportedBook) {
    imported = book;
    previewing = false;
    if (!title.trim()) title = book.title || importedFrom.replace(/\.docx$/i, "");
    creating = true;
  }

  function cancel() {
    creating = false;
    previewing = false;
    content = null;
    imported = null;
  }

  async function create() {
    error = "";
    if (!folderName || (folders && !parent)) return;
    busy = true;
    try {
      if (web && parentHandle) {
        const dir = await parentHandle.getDirectoryHandle(folderName, { create: true });
        const path = await rememberFolder(dir);
        await made(new BrowserFs(dir, path), path, `${parent}/${folderName}`);
        return;
      }
      if (!desktop) {
        // In a browser an imported book can be tried, kept only while the page is open.
        const { project } = await Project.create(new MemoryFs({}), { title: title.trim(), authors, language, cover: resolveCover(cover, title) }, null, exportPreferences());
        if (imported) await project.importBook(imported);
        onOpen(project);
        return;
      }
      const path = `${parent.replace(/[\\/]+$/, "")}/${folderName}`;
      await made(new TauriFs(path), path, path);
    } catch (e) {
      error = t("error.generic", { message: String(e) });
    } finally {
      busy = false;
    }
  }

  /** Makes the new project in `fs`, an empty folder, and opens it. */
  async function made(fs: TauriFs | BrowserFs, path: string, shown: string) {
    if ((await fs.exists("")) && (await fs.list("")).length > 0) {
      error = t("welcome.notEmpty", { path: shown });
      return;
    }
    const { project } = await Project.create(
      fs,
      { title: title.trim(), authors, language, cover: resolveCover(cover, title) },
      imported ? null : { chapter: t("untitled"), scene: t("untitledScene") },
      exportPreferences(),
    );
    if (imported) await project.importBook(imported);
    await addLauncher(project);
    // The first author's name is offered again next time.
    const first = authors.find((a) => a.trim())?.trim();
    if (first && !app.settings.userName) saveAppSettings({ ...app.settings, userName: first });
    rememberProject(path, project.settings.title, fs instanceof BrowserFs ? fs.name : undefined);
    onOpen(project);
  }

  async function openSample() {
    onOpen(await Project.open(sampleProject(app.settings.language), app.settings.language));
  }

  const dateFormat = $derived(new Intl.DateTimeFormat(app.settings.language, { dateStyle: "medium" }));
</script>

{#if previewing && content}
  <WordImport
    {content}
    fileName={importedFrom}
    bind:roles
    bind:blanks
    bind:marks
    action={t("import.continue")}
    onDone={previewed}
    onCancel={cancel}
  />
{/if}

<main>
  <h1>{t("app.name")}</h1>

  {#if creating}
    <h2>{imported ? t("import.title") : t("welcome.new")}</h2>
    {#if imported && importedCounts}
      <p class="summary">
        {t("import.found", { file: importedFrom })}
        {#if importedCounts.parts}{t("import.parts", { n: importedCounts.parts })},{/if}
        {t("import.counts", { chapters: importedCounts.chapters, scenes: importedCounts.scenes, words: num(importedCounts.words) })}
        <button type="button" class="link" onclick={() => { creating = false; previewing = true; }}>{t("import.review")}</button>
      </p>
    {/if}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <label>{t("settings.title")} <input bind:value={title} required /></label>
      <AuthorsInput bind:authors />
      <label
        >{t("settings.language")}
        <select bind:value={language}>
          {#each novelLanguages as l (l.code)}
            <option value={l.code}>{l.name}</option>
          {/each}
        </select>
      </label>
      <div class="field">
        <span class="label">{t("cover.title")}</span>
        <CoverPicker bind:cover text={{ title, authors }} />
      </div>
      {#if folders}
      <div class="where">
        <span class="label">{t("welcome.where")}</span>
        <button type="button" onclick={chooseParent}>{t("welcome.choose")}</button>
        {#if parent && folderName}
          <span class="path">{parent.replace(/[\\/]+$/, "")}/{folderName}</span>
        {/if}
      </div>
      {/if}
      <div class="actions">
        <button class="primary" type="submit" disabled={busy || !folderName || (folders && !parent)}>{imported ? t("import.create") : t("welcome.create")}</button>
        <button type="button" onclick={cancel}>{t("welcome.cancel")}</button>
      </div>
    </form>
  {:else}
    <div class="actions">
      {#if folders}
        <button class="primary" onclick={() => (creating = true)}>{t("welcome.new")}</button>
        <button onclick={openFolder}>{t("welcome.open")}</button>
      {/if}
      <button onclick={chooseWord}>{t("import.word")}</button>
      <button onclick={openSample}>{t("welcome.sample")}</button>
    </div>
    {#if !folders}
      <p class="note">{t("welcome.browser")}</p>
    {/if}

    {#if folders && recent.projects.length > 0}
      <h2>{t("welcome.recent")}</h2>
      <ul class="recent">
        {#each recent.projects as r (r.path)}
          <li>
            <button class="item" title={r.folder ?? r.path} onclick={() => openRecent(r.path)}>
              <img class="cover" src={covers[r.path]} alt="" />
              <span class="name">{r.title}</span>
              <span class="date">{dateFormat.format(new Date(r.opened))}</span>
            </button>
            <button class="remove" aria-label={t("welcome.forget", { name: r.title })} title={t("welcome.forget", { name: r.title })} onclick={() => forget(r.path)}>×</button>
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
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .summary {
    color: var(--text);
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
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
  .field {
    display: grid;
    gap: 4px;
  }
  .field .label {
    color: var(--text-muted);
    font-size: 13px;
  }
  .recent {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
    gap: 16px 12px;
  }
  .recent li {
    position: relative;
    min-width: 0;
  }
  .item {
    width: 100%;
    display: grid;
    gap: 2px;
    text-align: left;
    border: none;
    background: none;
    padding: 6px;
    border-radius: 6px;
  }
  .item:hover {
    background: var(--bg-hover);
  }
  .cover {
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: 3px;
    box-shadow: 0 1px 4px rgb(0 0 0 / 25%);
    margin-bottom: 6px;
  }
  .name {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .date {
    color: var(--text-muted);
    font-size: 12px;
  }
  .remove {
    position: absolute;
    top: 0;
    right: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-panel);
    opacity: 0;
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
