<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import type { Project } from "$lib/core/project";
  import { NOVEL_LANGUAGES, projectStatus, type NovelSettings } from "$lib/core/settings";
  import HeadingLevel from "./HeadingLevel.svelte";
  import PropertyDefEditor from "./PropertyDefEditor.svelte";
  import CoverPicker from "./CoverPicker.svelte";
  import AppearanceSettings from "./AppearanceSettings.svelte";
  import AuthorsInput from "./AuthorsInput.svelte";
  import { propertyDef, withDef } from "$lib/core/properties";
  import { cleanSnapshots } from "$lib/core/snapshots";
  import { LANGUAGES } from "$lib/i18n";
  import { app, saveAppSettings, t, type AppSettings } from "$lib/state.svelte";
  import { inTauri } from "$lib/tauriFs";
  import { WEB_BUILD } from "$lib/build";
  import { checkForUpdates, updateChannel, updates } from "$lib/updates.svelte";
  import { backupFolder, backupInfo, backupNow, defaultBackupFolder, downloadBackup, type BackupInfo } from "$lib/backups";
  import { onDisk } from "$lib/platform";
  import { navigator as dante } from "./navigation";

  let { project, onSaved }: { project: Project; onSaved: () => Promise<void> } = $props();
  const nav = dante();

  /** Opens the template of new scenes, made first if there is none. */
  async function editSceneTemplate() {
    error = "";
    try {
      const path = await project.ensureSceneTemplate();
      await onSaved();
      nav?.open(path);
    } catch (e) {
      error = failure(e);
    }
  }

  // The novel's settings are edited in a copy, written to the project a moment after each change.
  // svelte-ignore state_referenced_locally
  let novel = $state<NovelSettings>(structuredClone($state.snapshot(project.settings)));
  let saving = $state(false);
  /** Properties the tree's dots can show besides the stage of work. */
  const dotChoices = $derived.by(() => {
    const status = projectStatus(novel).name.toLowerCase();
    const names = Object.keys(novel.properties).filter((n) => n.toLowerCase() !== status);
    if (novel.tree.dot && !names.includes(novel.tree.dot) && novel.tree.dot.toLowerCase() !== status) names.push(novel.tree.dot);
    return names;
  });
  let newProperty = $state("");
  let error = $state("");
  let tab = $state<"novel" | "app">(lastTab.tab);
  $effect(() => {
    lastTab.tab = tab;
  });

  /** The app's settings change at once, field by field, so nothing else changed meanwhile is lost. */
  function setApp(patch: Partial<AppSettings>) {
    saveAppSettings({ ...app.settings, ...patch });
  }
  const clamp = (value: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && value.trim() ? Math.min(max, Math.max(min, n)) : fallback;
  };

  // svelte-ignore state_referenced_locally
  let written = JSON.stringify($state.snapshot(novel));
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const text = JSON.stringify($state.snapshot(novel));
    if (text === written) return;
    clearTimeout(timer);
    timer = setTimeout(() => void save(text), 700);
  });
  // Leaving the page writes what is still waiting.
  $effect(() => () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    const text = JSON.stringify($state.snapshot(novel));
    if (text !== written) void save(text);
  });

  const languages = $derived(
    NOVEL_LANGUAGES.some((l) => l.code === novel.language) ? NOVEL_LANGUAGES : [...NOVEL_LANGUAGES, { code: novel.language, name: t("settings.otherLanguage", { code: novel.language }) }],
  );

  const levels = $derived<("part" | "chapter")[]>(novel.structure.parts ? ["part", "chapter"] : ["chapter"]);
  let cleanBefore = $state(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  let cleaned = $state("");
  let reportCopied = $state("");

  /** Copies the report of static/startup-check.js: the engine's features and the errors so far. */
  async function copyReport() {
    const make = (window as { danteReport?: () => string }).danteReport;
    try {
      await navigator.clipboard.writeText(make ? make() : navigator.userAgent);
      reportCopied = t("support.copied");
    } catch (e) {
      reportCopied = failure(e);
    }
  }

  // Backups: the buttons act at once, with the folder and number shown in the form.
  let backupDefault = $state("");
  let backup = $state.raw<BackupInfo | null>(null);
  let backupMessage = $state("");
  let backingUp = $state(false);
  const dateTime = $derived(new Intl.DateTimeFormat(app.settings.language, { dateStyle: "medium", timeStyle: "short" }));
  if (inTauri()) void defaultBackupFolder().then((f) => (backupDefault = f), () => {});

  async function loadBackups() {
    try {
      backup = await backupInfo(project, app.settings);
    } catch {
      backup = null;
    }
  }
  $effect(() => {
    void app.settings.backupFolder;
    void loadBackups();
  });

  /** "Il mio romanzo 2026-10-26 10-15-30.zip" says when: the date and time shown are read from it. */
  function backupDate(path: string): string {
    const m = /(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})\.zip$/.exec(path);
    return m ? dateTime.format(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : path;
  }

  async function makeBackup() {
    backingUp = true;
    backupMessage = "";
    try {
      if (inTauri()) {
        const path = await backupNow(project, false, app.settings);
        if (path) backupMessage = t("backup.done", { name: path.split(/[\\/]/).pop() ?? path });
        await loadBackups();
      } else {
        await downloadBackup(project);
      }
    } catch (e) {
      backupMessage = t("backup.failed", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      backingUp = false;
    }
  }

  async function chooseBackupFolder() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const folder = await open({ directory: true, multiple: false, defaultPath: await backupFolder(app.settings).catch(() => undefined) });
    if (typeof folder === "string") setApp({ backupFolder: folder });
  }

  async function showBackups() {
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      if (backup?.latest) await revealItemInDir(backup.latest);
    } catch (e) {
      backupMessage = failure(e);
    }
  }

  async function clean() {
    error = "";
    try {
      const n = await cleanSnapshots(project.fs, new Date(cleanBefore + "T00:00:00"));
      cleaned = t("snap.cleaned", { n });
    } catch (e) {
      error = failure(e);
    }
  }

  /** Writes the novel's settings as `text` has them. */
  async function save(text: string) {
    timer = undefined;
    error = "";
    saving = true;
    try {
      const settings = JSON.parse(text) as NovelSettings;
      settings.authors = settings.authors.map((a) => a.trim()).filter(Boolean);
      settings.pages.size = Math.max(1, Math.round(Number(settings.pages.size) || 0)) || (settings.pages.unit === "words" ? 250 : 1800);
      settings.language = settings.language.trim() || "en";
      written = text;
      await project.saveSettings(settings);
      await onSaved();
    } catch (e) {
      error = failure(e);
    } finally {
      saving = false;
    }
  }
</script>

<script lang="ts" module>
  /** The tab shown, kept while the app is open. */
  const lastTab = { tab: "novel" as "novel" | "app" };
</script>

<div class="settings">
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected={tab === "novel"} onclick={() => (tab = "novel")}>{t("settings.tabNovel")}</button>
    <button role="tab" aria-selected={tab === "app"} onclick={() => (tab = "app")}>{t("settings.tabApp")}</button>
    <span class="status" role="status">{#if error}<span class="error"><ErrorText text={error} /></span>{:else}{saving ? t("settings.saving") : t("settings.autosave")}{/if}</span>
  </div>
  <form onsubmit={(e) => e.preventDefault()}>
    {#if tab === "novel"}
    <p class="hint">{t("settings.tabNovelHint")}</p>
    <label>{t("settings.title")} <input bind:value={novel.title} /></label>
    <label>{t("settings.subtitle")} <input bind:value={novel.subtitle} /></label>
    <AuthorsInput bind:authors={novel.authors} />
    <label
      >{t("settings.language")}
      <select bind:value={novel.language}>
        {#each languages as l (l.code)}
          <option value={l.code}>{l.name}</option>
        {/each}
      </select>
    </label>

    <h3>{t("cover.title")}</h3>
    <p class="hint">{t("cover.hint")}</p>
    <CoverPicker bind:cover={novel.cover} text={novel} {project} />

    <h3>{t("settings.structure")}</h3>
    <label class="check"><input type="checkbox" bind:checked={novel.structure.parts} /> {t("settings.parts")}</label>
    {#each levels as kind (kind)}
      <fieldset>
        <legend>{t(`kind.${kind}`)}</legend>
        <HeadingLevel
          bind:level={novel.structure[kind]}
          language={novel.language}
          sample={kind === "part" ? t("sample.partTitle") : t("sample.chapterTitle")}
          feminine={kind === "part"}
        />
      </fieldset>
    {/each}
    {#if novel.structure.parts}
      <label class="check"
        ><input type="checkbox" bind:checked={novel.structure.chapter.restartEachPart} /> {t("settings.restart")}</label
      >
    {/if}

    <h3>{t("settings.tree")}</h3>
    <label
      >{t("settings.treeDot")}
      <select bind:value={novel.tree.dot}>
        <option value="">{t("settings.treeDotStatus", { name: projectStatus(novel).name })}</option>
        {#each dotChoices as name (name)}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>
    <p class="hint">{t("settings.treeDotHint")}</p>

    <h3>{t("settings.sceneTemplate")}</h3>
    <p class="hint">{t("settings.sceneTemplateHint")}</p>
    <div class="define"><button type="button" onclick={editSceneTemplate}>{t("settings.sceneTemplateEdit")}</button></div>

    <h3>{t("property.defined")}</h3>
    <p class="hint">{t("property.definedHint")}</p>
    {#each Object.keys(novel.properties) as name (name)}
      <fieldset class="property">
        <legend>{name}</legend>
        <PropertyDefEditor
          {name}
          def={novel.properties[name]}
          types={novel.types}
          hint={false}
          onSave={(def) => (novel.properties = withDef(novel.properties, name, def))}
        />
      </fieldset>
    {:else}
      <p class="hint">{t("property.none")}</p>
    {/each}
    <div class="define">
      <input bind:value={newProperty} placeholder={t("property.name")} aria-label={t("property.name")} />
      <button
        type="button"
        disabled={!newProperty.trim()}
        onclick={() => {
          const name = newProperty.trim();
          if (!propertyDef(novel.properties, name)) novel.properties = withDef(novel.properties, name, { kind: "text", values: [], note_type: "" });
          newProperty = "";
        }}>{t("property.add")}</button
      >
    </div>

    <h3>{t("settings.pages")}</h3>
    <label
      >{t("settings.pageUnit")}
      <select
        bind:value={novel.pages.unit}
        onchange={() => {
          // Switching unit keeps a custom size, but not the other unit's usual one.
          if (novel.pages.unit === "words" && novel.pages.size === 1800) novel.pages.size = 250;
          if (novel.pages.unit === "characters" && novel.pages.size === 250) novel.pages.size = 1800;
        }}
      >
        <option value="characters">{t("settings.pageCharacters")}</option>
        <option value="words">{t("settings.pageWords")}</option>
      </select>
    </label>
    <label
      >{t(novel.pages.unit === "words" ? "settings.pageSizeWords" : "settings.pageSizeCharacters")}
      <input type="number" min="1" step="1" bind:value={novel.pages.size} />
      <small>{t("settings.pagesHint")}</small>
    </label>

    <h3>{t("snap.cleanTitle")}</h3>
    <label
      >{t("snap.cleanHint")}
      <input type="date" bind:value={cleanBefore} />
    </label>
    <div class="clean">
      <button type="button" onclick={clean}>{t("snap.clean")}</button>
      {#if cleaned}<span>{cleaned}</span>{/if}
    </div>
    {:else}
    <p class="hint">{t("settings.tabAppHint")}</p>
    <label
      >{t("settings.userName")} <input value={app.settings.userName} oninput={(e) => setApp({ userName: e.currentTarget.value })} />
      <small>{t("settings.userNameHint")}</small>
    </label>
    <label class="check" title={t("tip.revisions")}
      ><input type="checkbox" checked={app.settings.revisions} disabled={!app.settings.userName.trim()} onchange={(e) => setApp({ revisions: e.currentTarget.checked })} /> {t("comments.revisionMode")}</label
    >
    <label
      >{t("settings.interfaceLanguage")}
      <select value={app.settings.language} onchange={(e) => setApp({ language: e.currentTarget.value })}>
        {#each Object.entries(LANGUAGES) as [code, lang] (code)}
          <option value={code}>{lang.name}</option>
        {/each}
      </select>
    </label>
    <AppearanceSettings />

    {#if onDisk(project.fs)}
      <h3>{t("backup.title")}</h3>
      {#if inTauri()}
        <p class="hint">{t("backup.hint")}</p>
        <div class="field">
          <span class="label">{t("backup.folder")}</span>
          <span class="path">{app.settings.backupFolder || backupDefault}</span>
          <div class="clean">
            <button type="button" onclick={chooseBackupFolder}>{t("backup.choose")}</button>
            {#if app.settings.backupFolder}<button type="button" onclick={() => setApp({ backupFolder: "" })}>{t("backup.useDefault")}</button>{/if}
          </div>
        </div>
        <label class="check"><input type="checkbox" checked={app.settings.backupOnClose} onchange={(e) => setApp({ backupOnClose: e.currentTarget.checked })} /> {t("backup.onClose")}</label>
        <label
          >{t("backup.keep")}
          <input type="number" min="1" max="100" value={app.settings.backupKeep} onchange={(e) => setApp({ backupKeep: clamp(e.currentTarget.value, 1, 100, app.settings.backupKeep) })} />
        </label>
        <p class="hint">{backup?.latest ? t("backup.last", { date: backupDate(backup.latest), count: backup.count }) : t("backup.none")}</p>
        <div class="clean">
          <button type="button" disabled={backingUp} onclick={makeBackup}>{backingUp ? t("backup.running") : t("backup.now")}</button>
          {#if backup?.latest}<button type="button" onclick={showBackups}>{t("backup.show")}</button>{/if}
          {#if backupMessage}<span>{backupMessage}</span>{/if}
        </div>
      {:else}
        <p class="hint">{t("backup.browserHint")}</p>
        <div class="clean">
          <button type="button" disabled={backingUp} onclick={makeBackup}>{t("backup.download")}</button>
          {#if backupMessage}<span>{backupMessage}</span>{/if}
        </div>
      {/if}
    {/if}

    {#if inTauri() || WEB_BUILD}
      <h3>{t("update.title")}</h3>
      {#if updates.version}<p class="hint">{t("update.version", { version: updates.version })}</p>{/if}
      {#if updates.supported}
        <label class="check"><input type="checkbox" checked={app.settings.checkUpdates} onchange={(e) => setApp({ checkUpdates: e.currentTarget.checked })} /> {t("update.atStart")}</label>
        {#if inTauri()}
          <label
            >{t("update.channel")}
            <select
              value={updateChannel()}
              onchange={(e) => {
                setApp({ updateChannel: e.currentTarget.value as "stable" | "beta" });
                void checkForUpdates();
              }}
            >
              <option value="stable">{t("update.channelStable")}</option>
              <option value="beta">{t("update.channelBeta")}</option>
            </select>
          </label>
          <p class="hint">{t(updateChannel() === "beta" ? "update.channelBetaHint" : "update.channelStableHint")}</p>
        {/if}
        <div class="clean">
          <button type="button" disabled={updates.state === "checking" || updates.state === "downloading"} onclick={() => void checkForUpdates()}
            >{t("update.check")}</button
          >
          {#if updates.state === "checking"}<span>{t("update.checking")}</span>
          {:else if updates.state === "current"}<span>{t("update.current")}</span>
          {:else if updates.available}<span>{t("update.available", { version: updates.available.version })}</span>
          {:else if updates.state === "error"}<span class="error">{t("update.failed", { message: updates.error })}</span>{/if}
        </div>
      {:else if updates.version}
        <p class="hint">{t("update.unsupported")}</p>
      {/if}
    {/if}

    <h3>{t("support.title")}</h3>
    <p class="hint">{t("support.hint")}</p>
    <div class="clean">
      <button type="button" onclick={copyReport}>{t("support.copy")}</button>
      {#if reportCopied}<span>{reportCopied}</span>{/if}
    </div>
    {/if}
  </form>
</div>

<style>
  .settings {
    height: 100%;
    overflow: auto;
    padding: 24px 32px 64px;
  }
  form {
    max-width: 560px;
  }
  h3 {
    font-size: 15px;
    margin: 20px 0 8px;
  }
  label {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    color: var(--text-muted);
    font-size: 13px;
  }
  label input:not([type="checkbox"]),
  label select {
    color: var(--text);
    font-size: 14px;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px 4px;
    margin: 0 0 12px;
  }
  legend {
    padding: 0 4px;
    font-weight: 500;
  }
  small {
    font-size: 12px;
  }
  .tabs {
    position: sticky;
    top: -24px;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    gap: 4px;
    max-width: 560px;
    margin: -24px 0 16px;
    padding-top: 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .tabs button {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    padding: 6px 12px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .tabs button[aria-selected="true"] {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .status {
    margin-left: auto;
    padding: 6px 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .hint {
    color: var(--text-muted);
    font-size: 12px;
    margin: 0 0 12px;
  }
  fieldset.property {
    padding: 4px 12px 0;
  }
  fieldset.property :global(.def) {
    border: none;
    background: none;
    padding: 0;
  }
  .define {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .clean {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .field {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
  }
  .field .label {
    color: var(--text-muted);
    font-size: 13px;
  }
  .path {
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .error {
    color: var(--danger);
  }
</style>
