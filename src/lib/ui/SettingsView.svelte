<script lang="ts">
  import type { Project } from "$lib/core/project";
  import type { NovelSettings } from "$lib/core/settings";
  import HeadingLevel from "./HeadingLevel.svelte";
  import { cleanSnapshots } from "$lib/core/snapshots";
  import { LANGUAGES } from "$lib/i18n";
  import { app, saveAppSettings, t } from "$lib/state.svelte";

  let { project, onSaved }: { project: Project; onSaved: () => Promise<void> } = $props();

  // The form edits copies; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let novel = $state<NovelSettings>(structuredClone($state.snapshot(project.settings)));
  let appSettings = $state(structuredClone($state.snapshot(app.settings)));
  let saved = $state(false);
  let error = $state("");

  const levels = $derived<("part" | "chapter")[]>(novel.structure.parts ? ["part", "chapter"] : ["chapter"]);
  const fonts = [
    { name: "Georgia", value: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif" },
    { name: "Palatino", value: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
    { name: "Garamond", value: "'EB Garamond', Garamond, 'Times New Roman', serif" },
    { name: "Sans serif", value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
    { name: "Monospace", value: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  ];

  let cleanBefore = $state(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  let cleaned = $state("");

  async function clean() {
    error = "";
    try {
      const n = await cleanSnapshots(project.fs, new Date(cleanBefore + "T00:00:00"));
      cleaned = t("snap.cleaned", { n });
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function save() {
    error = "";
    try {
      saveAppSettings($state.snapshot(appSettings));
      const settings = $state.snapshot(novel);
      settings.pages.size = Math.max(1, Math.round(Number(settings.pages.size) || 0)) || (settings.pages.unit === "words" ? 250 : 1800);
      await project.saveSettings(settings);
      await onSaved();
      saved = true;
      setTimeout(() => (saved = false), 2000);
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }
</script>

<div class="settings">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    <h2>{t("settings.novel")}</h2>
    <label>{t("settings.title")} <input bind:value={novel.title} /></label>
    <label>{t("settings.subtitle")} <input bind:value={novel.subtitle} /></label>
    <label>{t("settings.author")} <input bind:value={novel.author} /></label>
    <label>{t("settings.language")} <input bind:value={novel.language} size="6" /></label>

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

    <h2>{t("settings.app")}</h2>
    <label
      >{t("settings.interfaceLanguage")}
      <select bind:value={appSettings.language}>
        {#each Object.entries(LANGUAGES) as [code, lang] (code)}
          <option value={code}>{lang.name}</option>
        {/each}
      </select>
    </label>
    <label
      >{t("settings.theme")}
      <select bind:value={appSettings.theme}>
        <option value="system">{t("settings.themeSystem")}</option>
        <option value="light">{t("settings.themeLight")}</option>
        <option value="dark">{t("settings.themeDark")}</option>
      </select>
    </label>
    <label
      >{t("settings.font")}
      <select bind:value={appSettings.fontFamily}>
        {#each fonts as font (font.value)}
          <option value={font.value}>{font.name}</option>
        {/each}
      </select>
    </label>
    <label>{t("settings.fontSize")} <input type="number" min="12" max="32" bind:value={appSettings.fontSize} /></label>
    <label>{t("settings.lineWidth")} <input type="number" min="40" max="120" bind:value={appSettings.lineWidth} /></label>
    <label
      >{t("settings.userName")} <input bind:value={appSettings.userName} />
      <small>{t("settings.userNameHint")}</small>
    </label>
    <label class="check" title={t("tip.revisions")}
      ><input type="checkbox" bind:checked={appSettings.revisions} disabled={!appSettings.userName.trim()} /> {t("comments.revisionMode")}</label
    >

    <h3>{t("snap.cleanTitle")}</h3>
    <label
      >{t("snap.cleanHint")}
      <input type="date" bind:value={cleanBefore} />
    </label>
    <div class="clean">
      <button type="button" onclick={clean}>{t("snap.clean")}</button>
      {#if cleaned}<span>{cleaned}</span>{/if}
    </div>

    <div class="actions">
      <button class="primary" type="submit">{t("settings.save")}</button>
      {#if saved}<span class="saved">{t("settings.saved")}</span>{/if}
      {#if error}<span class="error">{error}</span>{/if}
    </div>
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
  h2 {
    font-size: 20px;
    margin: 24px 0 12px;
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
  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
  }
  .clean {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .saved {
    color: var(--text-muted);
  }
  .error {
    color: var(--danger);
  }
</style>
