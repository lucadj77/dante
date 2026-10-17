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
  import { addLauncher, openProjectAt } from "$lib/opening";
  import { MemoryFs } from "$lib/core/fs";
  import { readDocx, type DocxContent } from "$lib/core/import/docx";
  import { counts, defaultBlankLines, defaultRoles, headingLevels, structure, type BlankLines, type HeadingRole } from "$lib/core/import/structure";

  let { onOpen }: { onOpen: (project: Project) => void } = $props();
  let error = $state("");
  let notice = $state("");
  const desktop = inTauri();

  // New project form.
  let creating = $state(false);
  let title = $state("");
  let authors = $state<string[]>(app.settings.userName ? [app.settings.userName] : []);
  let language = $state(app.settings.language);
  let parent = $state("");
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
      if (!desktop) continue;
      void new TauriFs(r.path)
        .readText(SETTINGS_FILE)
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
  const levels = $derived(content ? headingLevels(content.blocks) : []);
  /** How many empty paragraphs in a row start a new scene; 0 when they never do. */
  let blanks = $state<BlankLines>(0);
  const hasBlanks = $derived(!!content?.blocks.some((b) => b.kind === "paragraph" && b.text === ""));
  const imported = $derived(
    content ? structure(content.blocks, { start: t("untitled"), scene: (n) => t("import.scene", { n }) }, content.title, roles, blanks) : null,
  );
  const ROLES: HeadingRole[] = ["part", "chapter", "scene", "text"];
  let importedFrom = $state("");
  const importedCounts = $derived(imported ? counts(imported) : null);
  let filePicker = $state<HTMLInputElement>();
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

  /** Reads a Word file and opens the form of a new project made from it. */
  async function importWord(bytes: Uint8Array, fileName: string) {
    error = "";
    try {
      const read = await readDocx(bytes, { note: t("import.note") });
      roles = defaultRoles(read.blocks);
      blanks = defaultBlankLines(read.blocks);
      content = read;
      importedFrom = fileName;
      title = imported?.title || fileName.replace(/\.docx$/i, "");
      if (read.author) authors = authorsOf(read.author);
      creating = true;
    } catch (e) {
      error = t("import.failed", { name: fileName, message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function chooseWord() {
    if (!desktop) {
      filePicker?.click();
      return;
    }
    const file = await open({ multiple: false, filters: [{ name: "Word", extensions: ["docx"] }] });
    if (typeof file !== "string") return;
    const name = file.split(/[\\/]/).pop() ?? file;
    const dir = file.slice(0, file.length - name.length).replace(/[\\/]+$/, "") || "/";
    await importWord(await new TauriFs(dir).readBytes(name), name);
  }

  function cancel() {
    creating = false;
    content = null;
  }

  async function create() {
    error = "";
    if (!folderName || (desktop && !parent)) return;
    busy = true;
    try {
      if (!desktop) {
        // In a browser an imported book can be tried, kept only while the page is open.
        const { project } = await Project.create(new MemoryFs({}), { title: title.trim(), authors, language, cover: resolveCover(cover, title) }, null, exportPreferences());
        if (imported) await project.importBook(imported);
        onOpen(project);
        return;
      }
      const path = `${parent.replace(/[\\/]+$/, "")}/${folderName}`;
      const fs = new TauriFs(path);
      if ((await fs.exists("")) && (await fs.list("")).length > 0) {
        error = t("welcome.notEmpty", { path });
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
      rememberProject(path, project.settings.title);
      onOpen(project);
    } catch (e) {
      error = t("error.generic", { message: String(e) });
    } finally {
      busy = false;
    }
  }

  async function openSample() {
    onOpen(await Project.open(sampleProject(app.settings.language), app.settings.language));
  }

  const dateFormat = $derived(new Intl.DateTimeFormat(app.settings.language, { dateStyle: "medium" }));
</script>

<main>
  <h1>{t("app.name")}</h1>

  {#if creating}
    <h2>{imported ? t("import.title") : t("welcome.new")}</h2>
    {#if imported && importedCounts}
      <p class="summary">
        {t("import.found", { file: importedFrom })}
        {#if importedCounts.parts}{t("import.parts", { n: importedCounts.parts })},{/if}
        {t("import.counts", { chapters: importedCounts.chapters, scenes: importedCounts.scenes, words: num(importedCounts.words) })}
      </p>
      <p class="note">{t("import.how")}</p>
      {#if levels.length}
        <div class="levels">
          <span class="label">{t("import.levels")}</span>
          {#each levels as level (level.level)}
            <label class="level">
              <span class="examples" title={level.examples.join(" · ")}>
                {t("import.level", { n: level.level, count: level.count })}: {level.examples.join(" · ")}
              </span>
              <select bind:value={roles[level.level]}>
                {#each ROLES as role (role)}
                  <option value={role}>{t(`import.role.${role}`)}</option>
                {/each}
              </select>
            </label>
          {/each}
        </div>
      {/if}
      {#if hasBlanks}
        <label class="level blanks">
          <span class="examples">{t("import.blanks")}</span>
          <select bind:value={blanks}>
            <option value={1}>{t("import.blanks.one")}</option>
            <option value={2}>{t("import.blanks.two")}</option>
            <option value={0}>{t("import.blanks.none")}</option>
          </select>
        </label>
      {/if}
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
      {#if desktop}
      <div class="where">
        <span class="label">{t("welcome.where")}</span>
        <button type="button" onclick={chooseParent}>{t("welcome.choose")}</button>
        {#if parent && folderName}
          <span class="path">{parent.replace(/[\\/]+$/, "")}/{folderName}</span>
        {/if}
      </div>
      {/if}
      <div class="actions">
        <button class="primary" type="submit" disabled={busy || !folderName || (desktop && !parent)}>{imported ? t("import.create") : t("welcome.create")}</button>
        <button type="button" onclick={cancel}>{t("welcome.cancel")}</button>
      </div>
    </form>
  {:else}
    <div class="actions">
      {#if desktop}
        <button class="primary" onclick={() => (creating = true)}>{t("welcome.new")}</button>
        <button onclick={openFolder}>{t("welcome.open")}</button>
      {/if}
      <button onclick={chooseWord}>{t("import.word")}</button>
      <input
        bind:this={filePicker}
        type="file"
        accept=".docx"
        hidden
        onchange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = "";
          if (file) await importWord(new Uint8Array(await file.arrayBuffer()), file.name);
        }}
      />
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
            <button class="item" title={r.path} onclick={() => openRecent(r.path)}>
              <img class="cover" src={covers[r.path]} alt="" />
              <span class="name">{r.title}</span>
              <span class="date">{dateFormat.format(new Date(r.opened))}</span>
            </button>
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
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .summary {
    color: var(--text);
  }
  .levels {
    display: grid;
    gap: 6px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .levels .label {
    color: var(--text-muted);
  }
  .blanks {
    margin-bottom: 16px;
    font-size: 13px;
  }
  .level {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .examples {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
