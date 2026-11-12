<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import type { Project } from "$lib/core/project";
  import { defaultQuotes, NOVEL_LANGUAGES, projectStatus, QUOTE_STYLES, type NovelSettings } from "$lib/core/settings";
  import TypographyPreview from "./TypographyPreview.svelte";
  import HelpLink from "./HelpLink.svelte";
  import { comboOf, refusal, SHORTCUT_DEFAULTS, SHORTCUT_IDS, shortcutOf, type ShortcutId } from "$lib/editor/shortcuts";
  import { shortcutText } from "./formatLabels";
  import HeadingLevel from "./HeadingLevel.svelte";
  import PropertyDefEditor from "./PropertyDefEditor.svelte";
  import CoverPicker from "./CoverPicker.svelte";
  import ThemePicker from "./ThemePicker.svelte";
  import EditorTextSettings from "./EditorTextSettings.svelte";
  import TextSample from "./TextSample.svelte";
  import AuthorsInput from "./AuthorsInput.svelte";
  import { propertyDef, withDef } from "$lib/core/properties";
  import { cleanSnapshots, deleteWholeSnapshot, listWholeSnapshots, restoreWholeSnapshot, takeWholeSnapshot, type WholeSnapshot } from "$lib/core/snapshots";
  import { scenesOf } from "$lib/core/manuscript";
  import { confirmDelete } from "./dialogs";
  import { today } from "$lib/core/critic";
  import { LANGUAGES, type MessageKey } from "$lib/i18n";
  import { levelHeading } from "$lib/core/numbering";
  import { chosenColor, DOT_HUES, statusTone } from "$lib/core/statistics";
  import { UI_ZOOMS, uiZoom } from "$lib/uiZoom.svelte";
  import { app, appearance, look, lookOf, num, saveAppSettings, saveLook, t, type AppSettings, type Look } from "$lib/state.svelte";
  import { inTauri } from "$lib/tauriFs";
  import { WEB_BUILD } from "$lib/build";
  import { checkForUpdates, updateChannel, updates } from "$lib/updates.svelte";
  import { backupFolder, backupInfo, backupNames, backupNow, defaultBackupFolder, downloadBackup, extractBackup, type BackupInfo } from "$lib/backups";
  import { onDisk } from "$lib/platform";
  import { navigator as dante } from "./navigation";

  interface Props {
    project: Project;
    onSaved: () => Promise<void>;
    /** Opens another section of the workspace, for the choices kept there. */
    onGo?: (section: "stats" | "export") => void;
    /** Opens the project in another folder of the computer, in place of this one. */
    onOpenProject?: (path: string) => Promise<void>;
  }
  let { project, onSaved, onGo, onOpenProject }: Props = $props();
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

  // The sections: those of the novel, saved in the project, and those of this computer. Each
  // is a short page; `keys` are the texts it holds, which the search field looks through.
  type SectionId = "book" | "cover" | "structure" | "scenes" | "measures" | "typography" | "look" | "gamebook" | "upkeep" | "you" | "appearance" | "text" | "writing" | "shortcuts" | "backup" | "updates";
  interface SectionDef {
    id: SectionId;
    group: "novel" | "app";
    title: MessageKey;
    keys: MessageKey[];
  }
  const SECTIONS: SectionDef[] = [
    { id: "book", group: "novel", title: "settings.sec.book", keys: ["settings.title", "settings.subtitle", "settings.authors", "settings.language"] },
    { id: "cover", group: "novel", title: "cover.title", keys: ["cover.hint", "cover.imageChoose", "cover.template", "cover.palette", "cover.texts", "cover.textColor", "cover.outline"] },
    { id: "structure", group: "novel", title: "settings.structure", keys: ["settings.parts", "settings.numbering", "settings.label", "heading.separator", "settings.restart", "kind.part", "kind.chapter"] },
    { id: "scenes", group: "novel", title: "settings.sec.scenes", keys: ["settings.sceneTemplate", "settings.sceneTemplateEdit", "property.defined", "property.definedHint", "settings.tree", "settings.treeDot"] },
    { id: "measures", group: "novel", title: "settings.sec.measures", keys: ["settings.pages", "settings.pageUnit", "settings.pageCharacters", "settings.pageWords", "settings.style", "settings.longSentence", "settings.repetitionWindow", "settings.readingSpeed", "statsView.goals", "statsView.goalWords", "statsView.deadline", "statsView.daily", "statsView.writingDays"] },
    { id: "typography", group: "novel", title: "export.typography", keys: ["export.typographyHint", "export.quotes", "export.dialogueDash", "export.apostrophes", "export.ellipsis", "export.spaces", "export.whileTyping"] },
    { id: "look", group: "novel", title: "settings.sec.look", keys: ["look.own", "look.ownHint", "settings.theme", "appearance.accent", "settings.font"] },
    { id: "gamebook", group: "novel", title: "gamebook.title", keys: ["gamebook.enable", "gamebook.enableHint", "gamebook.folder", "gamebook.boxes", "gamebook.onePerPage", "gamebook.showLinks"] },
    { id: "upkeep", group: "novel", title: "settings.sec.upkeep", keys: ["whole.title", "whole.hint", "whole.take", "snap.cleanTitle", "snap.cleanHint", "snap.clean"] },
    { id: "you", group: "app", title: "settings.sec.you", keys: ["settings.userName", "settings.userNameHint", "comments.revisionMode", "settings.interfaceLanguage"] },
    { id: "appearance", group: "app", title: "appearance.title", keys: ["settings.theme", "settings.themeLight", "settings.themeSepia", "settings.themeDark", "settings.themeNight", "appearance.accent", "appearance.uiZoom"] },
    { id: "text", group: "app", title: "appearance.page", keys: ["settings.font", "settings.fontSize", "settings.lineWidth", "appearance.lineHeight", "appearance.gap", "appearance.indent", "appearance.justify"] },
    { id: "writing", group: "app", title: "toolbar.writing", keys: ["appearance.paragraphs", "appearance.paragraphsHint", "appearance.askBlankLines", "appearance.spelling", "appearance.spellcheck", "dictionary.title", "dictionary.hint"] },
    { id: "shortcuts", group: "app", title: "settings.sec.shortcuts", keys: ["shortcuts.hint", ...SHORTCUT_IDS.map((id) => `shortcut.${id}` as MessageKey)] },
    { id: "backup", group: "app", title: "backup.title", keys: ["backup.hint", "backup.folder", "backup.onClose", "backup.keep", "backup.now", "backup.download"] },
    { id: "updates", group: "app", title: "settings.sec.updates", keys: ["update.title", "update.atStart", "update.channel", "update.check", "support.title", "support.hint", "support.copy"] },
  ];
  const available = $derived(
    SECTIONS.filter((s) => s.id !== "backup" || onDisk(project.fs)),
  );
  let query = $state("");
  const listed = $derived.by(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return available;
    return available.filter((s) => {
      const text = [s.title, ...s.keys].map((k) => t(k)).join(" ").toLowerCase();
      return words.every((w) => text.includes(w));
    });
  });
  let chosen = $state<SectionId>(lastSection.id);
  /** The page shown: the one chosen, or the first that the search leaves in the list. */
  const section = $derived(listed.some((s) => s.id === chosen) ? chosen : (listed[0]?.id ?? null));
  const current = $derived(SECTIONS.find((s) => s.id === section) ?? null);
  $effect(() => {
    lastSection.id = chosen;
  });
  function show(id: SectionId) {
    query = "";
    chosen = id;
  }

  // The look of this novel alone, kept on this computer under the project's id.
  const sampleLook = "sample";
  async function setOwnLook(on: boolean) {
    error = "";
    try {
      const id = onDisk(project.fs) ? await project.ensureId() : sampleLook;
      saveLook(id, on ? lookOf(appearance()) : null);
    } catch (e) {
      error = failure(e);
    }
  }
  function setLook(patch: Partial<Look>) {
    if (look.own) saveLook(look.id, { ...look.own, ...patch });
  }
  const ownLook = $derived(look.own ? ({ ...lookOf(app.settings), ...look.own } as Look) : null);

  // What the previews draw.
  const headings = $derived.by(() => {
    const st = novel.structure;
    const chapter = (n: number, title: string) => levelHeading(st.chapter, n, title, novel.language).text;
    return {
      part: st.parts ? levelHeading(st.part, 1, t("sample.partTitle"), novel.language, true).text : null,
      chapters: [chapter(1, t("sample.chapterTitle")), chapter(2, t("sample.chapterTitle2"))],
    };
  });
  const HUES = ["#d9534f", "#e8913a", "#c7a923", "#4ea65a", "#2fa3a3", "#4a7fd6", "#8c63d6", "#d064a6"];
  /** The values of the dot's property that have a colour of their own, as the tree will show them. */
  const dots = $derived.by(() => {
    const status = projectStatus(novel);
    const name = novel.tree.dot.trim() || status.name;
    const isStatus = name.toLowerCase() === status.name.toLowerCase();
    const values = isStatus ? status.values : (propertyDef(novel.properties, name)?.values ?? []);
    return values.slice(0, 8).map((value, i) => {
      const tone = isStatus ? statusTone(value, status.values) : null;
      return { value, colour: chosenColor(novel, name, value) || (tone !== null ? `var(--status-${tone})` : HUES[i % DOT_HUES]) };
    });
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
  let cleanBefore = $state(today(new Date(Date.now() - 30 * 864e5)));
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

  /** The zips kept for this project, the most recent first. */
  let backupList = $state.raw<string[]>([]);
  let opening = $state("");

  async function loadBackups() {
    try {
      backup = await backupInfo(project, app.settings);
      backupList = await backupNames(project, app.settings);
    } catch {
      backup = null;
      backupList = [];
    }
  }

  /** Takes a backup out into a new folder beside the novel's and opens it; this novel is not touched. */
  async function openBackup(name: string) {
    opening = name;
    backupMessage = "";
    try {
      const title = name.replace(/ \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}\.zip$/, "");
      const stamp = /(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})-\d{2}\.zip$/.exec(name);
      const path = await extractBackup(project, name, t("backup.copyName", { name: title, date: stamp ? `${stamp[1]} ${stamp[2]}.${stamp[3]}` : "" }), app.settings);
      if (onOpenProject) await onOpenProject(path);
      else backupMessage = t("backup.extracted", { path });
    } catch (e) {
      backupMessage = failure(e);
    } finally {
      opening = "";
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

  /** The snapshots of the whole manuscript, and the name of the one being taken. */
  let wholes = $state<WholeSnapshot[]>([]);
  let wholeName = $state("");
  let wholeBusy = $state(false);
  let wholeMessage = $state("");
  const scenePaths = () => scenesOf(project.manuscript).map((n) => n.path);
  $effect(() => {
    if (section === "upkeep") void listWholeSnapshots(project.fs).then((list) => (wholes = list));
  });
  async function whole(work: () => Promise<string>) {
    wholeBusy = true;
    wholeMessage = "";
    try {
      // What is being written goes to the files first.
      await project.beforeMove?.();
      wholeMessage = await work();
      wholes = await listWholeSnapshots(project.fs);
    } catch (e) {
      wholeMessage = failure(e);
    } finally {
      wholeBusy = false;
    }
  }
  const takeWhole = () =>
    whole(async () => {
      const taken = await takeWholeSnapshot(project.fs, scenePaths(), wholeName);
      wholeName = "";
      return t("whole.taken", { name: taken.name, n: taken.scenes });
    });
  const restoreWhole = (snap: WholeSnapshot) =>
    whole(async () => {
      if (!(await confirmDelete(t("whole.confirmRestore", { name: snap.name }), t("snap.restore")))) return "";
      const n = await restoreWholeSnapshot(project.fs, scenePaths(), snap.id);
      await onSaved();
      return t("whole.restored", { n });
    });
  const removeWhole = (snap: WholeSnapshot) =>
    whole(async () => {
      if (!(await confirmDelete(t("whole.confirmDelete", { name: snap.name })))) return "";
      await deleteWholeSnapshot(project.fs, scenePaths(), snap.id);
      return "";
    });

  /** A word being added to the novel's dictionary. */
  let newWord = $state("");
  function addWords() {
    const words = newWord.split(/[\s,;]+/).filter((w) => w && !novel.dictionary.includes(w));
    if (words.length) novel.dictionary = [...novel.dictionary, ...new Set(words)];
    newWord = "";
  }

  // The writing shortcuts: the one being changed waits for the next keys.
  let capturing = $state<ShortcutId | null>(null);
  let shortcutError = $state("");
  const ownShortcuts = $derived(app.settings.shortcuts);
  const comboNow = (id: ShortcutId) => (void ownShortcuts, shortcutOf(id));
  function setShortcut(id: ShortcutId, combo: string | null) {
    const next = { ...app.settings.shortcuts };
    if (combo === null || combo === SHORTCUT_DEFAULTS[id]) delete next[id];
    else next[id] = combo;
    setApp({ shortcuts: next });
  }
  function captureKey(e: KeyboardEvent) {
    const id = capturing;
    if (!id) return;
    if (["Meta", "Control", "Alt", "Shift", "CapsLock", "Dead"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      capturing = null;
      shortcutError = "";
      return;
    }
    const combo = comboOf(e);
    if (!combo) {
      shortcutError = t("shortcuts.unusable");
      return;
    }
    const no = refusal(combo, id, app.settings.shortcuts);
    if (no) {
      const keys = shortcutText(combo);
      shortcutError = no.kind === "weak" ? t("shortcuts.weak") : no.kind === "reserved" ? t("shortcuts.reserved", { keys }) : t("shortcuts.taken", { keys, name: t(`shortcut.${no.by}` as MessageKey) });
      return;
    }
    setShortcut(id, combo);
    capturing = null;
    shortcutError = "";
  }
  $effect(() => {
    if (!capturing) return;
    window.addEventListener("keydown", captureKey, true);
    return () => window.removeEventListener("keydown", captureKey, true);
  });

  /** What the goals count: characters with spaces, or words. */
  const byChars = $derived(novel.goals.unit === "characters");
  /** Monday to Sunday, 1 to 7, with their short names in the interface language. */
  const weekdays = $derived([1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: d, name: new Date(2024, 0, d).toLocaleDateString(app.settings.language, { weekday: "short" }) })));
  function toggleDay(day: number) {
    const days = novel.goals.days;
    novel.goals.days = (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]).sort();
  }

  /** Writes the novel's settings as `text` has them. */
  async function save(text: string) {
    timer = undefined;
    error = "";
    saving = true;
    try {
      const settings = JSON.parse(text) as NovelSettings;
      settings.authors = settings.authors.map((a) => a.trim()).filter(Boolean);
      for (const key of ["longSentence", "repetitionWindow", "readingSpeed"] as const) settings.style[key] = Math.max(1, Math.round(Number(settings.style[key]) || 0)) || { longSentence: 40, repetitionWindow: 30, readingSpeed: 230 }[key];
      settings.pages.size = Math.max(1, Math.round(Number(settings.pages.size) || 0)) || (settings.pages.unit === "words" ? 250 : 1800);
      for (const key of ["words", "daily"] as const) settings.goals[key] = Math.max(0, Math.round(Number(settings.goals[key]) || 0));
      settings.goals.deadline ||= "";
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
  /** The page shown, kept while the app is open. */
  const lastSection = { id: "book" as "book" | "cover" | "structure" | "scenes" | "measures" | "typography" | "look" | "gamebook" | "upkeep" | "you" | "appearance" | "text" | "writing" | "shortcuts" | "backup" | "updates" };
</script>

{#snippet group(id: "novel" | "app", title: MessageKey, hint: MessageKey)}
  {@const items = listed.filter((s) => s.group === id)}
  {#if items.length}
    <div class="group">
      <span class="caption" title={t(hint)}>{t(title)}</span>
      {#each items as s (s.id)}
        <button type="button" class="item" data-settings={s.id} aria-current={section === s.id ? "page" : undefined} onclick={() => (chosen = s.id)}>{t(s.title)}</button>
      {/each}
    </div>
  {/if}
{/snippet}

<div class="settings">
  <nav class="sections" aria-label={t("section.settings")}>
    <input type="search" class="search" bind:value={query} placeholder={t("settings.search")} aria-label={t("settings.search")} />
    {@render group("novel", "settings.tabNovel", "settings.tabNovelHint")}
    {@render group("app", "settings.tabApp", "settings.tabAppHint")}
    {#if !listed.length}<p class="hint">{t("settings.noMatch")}</p>{/if}
  </nav>
  <div class="page">
    {#if current}
    <header>
      <h2>{t(current.title)}</h2>
      <span class="scope">{t(current.group === "novel" ? "settings.tabNovel" : "settings.tabApp")} · {t(current.id === "look" ? "look.scope" : current.group === "novel" ? "settings.tabNovelHint" : "settings.tabAppHint")}</span>
      <span class="status" role="status">{#if error}<span class="error"><ErrorText text={error} /></span>{:else}{saving ? t("settings.saving") : t("settings.autosave")}{/if}</span>
    </header>
    <form onsubmit={(e) => e.preventDefault()} data-page={section}>
    {#if section === "book"}
      <div class="fields">
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
      </div>
    {:else if section === "cover"}
      <div class="fields wide">
        <p class="hint">{t("cover.hint")}</p>
        <CoverPicker bind:cover={novel.cover} text={novel} {project} />
      </div>
    {:else if section === "structure"}
      <div class="fields">
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
      </div>
      <aside class="preview" aria-label={t("settings.previewStructure")}>
        <span class="caption">{t("settings.previewStructure")}</span>
        <div class="outline">
          {#if headings.part}<div class="part">{headings.part}</div>{/if}
          {#each headings.chapters as chapter, i (i)}
            <div class="chapter" class:nested={!!headings.part}>{chapter}</div>
            <div class="scene" class:nested={!!headings.part}>{t(i === 0 ? "sample.sceneTitle" : "sample.sceneTitle2")}</div>
          {/each}
        </div>
      </aside>
    {:else if section === "scenes"}
      <div class="fields">
        <h3>{t("settings.sceneTemplate")}</h3>
        <p class="hint">{t("settings.sceneTemplateHint")}</p>
        <div class="define"><button type="button" onclick={editSceneTemplate}>{t("settings.sceneTemplateEdit")}</button></div>

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
      </div>
      <aside class="preview" aria-label={t("settings.previewDot")}>
        <span class="caption">{t("settings.previewDot")}</span>
        <div class="outline">
          {#each dots as dot (dot.value)}
            <div class="scene"><i class="dot" style:background={dot.colour}></i>{dot.value}</div>
          {:else}
            <p class="hint">{t("settings.dotNoValues")}</p>
          {/each}
        </div>
      </aside>
    {:else if section === "measures"}
      <div class="fields">
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

        <h3>{t("settings.style")}</h3>
        <p class="hint">{t("settings.styleHint")}</p>
        <label>{t("settings.longSentence")} <input type="number" min="5" step="1" bind:value={novel.style.longSentence} /></label>
        <label>{t("settings.repetitionWindow")} <input type="number" min="2" step="1" bind:value={novel.style.repetitionWindow} /></label>
        <label>{t("settings.readingSpeed")} <input type="number" min="50" step="10" bind:value={novel.style.readingSpeed} /></label>

        <h3>{t("statsView.goals")}</h3>
        <label>{t(byChars ? "statsView.goalWordsChars" : "statsView.goalWords")} <input type="number" min="0" step="1" bind:value={novel.goals.words} /></label>
        <label class="narrow">{t("statsView.deadline")} <input type="date" bind:value={novel.goals.deadline} /></label>
        <label>{t(byChars ? "statsView.dailyChars" : "statsView.daily")} <input type="number" min="0" step="1" bind:value={novel.goals.daily} /></label>
        <fieldset class="weekdays">
          <legend>{t("statsView.writingDays")}</legend>
          {#each weekdays as w (w.day)}
            <label class="check day"><input type="checkbox" checked={novel.goals.days.includes(w.day)} onchange={() => toggleDay(w.day)} /> {w.name}</label>
          {/each}
        </fieldset>
        <div class="elsewhere">
          <p>{t("settings.goalUnitNote", { unit: t(byChars ? "stats.characters" : "stats.words").toLowerCase() })}</p>
          <button type="button" onclick={() => onGo?.("stats")}>{t("settings.openStats")}</button>
        </div>
      </div>
      <aside class="preview" aria-label={t("settings.previewPage")}>
        <span class="caption">{t("settings.previewPage")}</span>
        <div class="sheet" aria-hidden="true">
          {#each Array(14) as _, i (i)}<i class:short={i % 5 === 4}></i>{/each}
        </div>
        <span class="holds">{t(novel.pages.unit === "words" ? "settings.pageHoldsWords" : "settings.pageHoldsChars", { n: num(Number(novel.pages.size) || 0) })}</span>
      </aside>
    {:else if section === "typography"}
      {@const typo = novel.export.typography}
      <div class="fields">
        <p class="hint">{t("export.typographyHint")}</p>
        <label
          >{t("export.quotes")}
          <select bind:value={typo.quotes}>
            {#each QUOTE_STYLES as style (style)}
              <option value={style}>{t(`export.quotes.${style}` as MessageKey)}{style === defaultQuotes(novel.language) ? ` · ${t("export.quotesUsual")}` : ""}</option>
            {/each}
          </select>
        </label>
        {#if typo.quotes !== "keep" && typo.quotes !== "dash" && typo.quotes !== "dashAttached"}
          <p class="hint">{t("export.quotesMarksHint")}</p>
        {/if}
        {#if typo.quotes === "dash" || typo.quotes === "dashAttached"}
          <p class="hint">{t(typo.quotes === "dash" ? "export.quotesDashHint" : "export.quotesDashAttachedHint")}</p>
          <label class="narrow"
            >{t("export.dialogueDash")}
            <select bind:value={typo.dialogueDash}>
              <option value="em">{t("export.dialogueEm")}</option>
              <option value="en">{t("export.dialogueEn")}</option>
            </select>
          </label>
        {/if}
        <label class="check"><input type="checkbox" bind:checked={typo.apostrophes} /> {t("export.apostrophes")}</label>
        <label class="check"><input type="checkbox" bind:checked={typo.ellipsis} /> {t("export.ellipsis")}</label>
        <label class="check"><input type="checkbox" bind:checked={typo.spaces} /> {t("export.spaces")}</label>
        <label class="check"><input type="checkbox" bind:checked={typo.whileTyping} /> {t("export.whileTyping")}</label>
      </div>
      <aside class="preview" aria-label={t("export.typography")}>
        <TypographyPreview {project} typography={typo} />
      </aside>
    {:else if section === "look"}
      <div class="fields">
        <label class="check"><input type="checkbox" checked={!!look.own} onchange={(e) => void setOwnLook(e.currentTarget.checked)} /> {t("look.own")}</label>
        <p class="hint">{t("look.ownHint")}</p>
        {#if ownLook}
          <ThemePicker value={ownLook} set={setLook} />
          <h3>{t("appearance.page")}</h3>
          <EditorTextSettings value={ownLook} set={setLook} />
        {/if}
      </div>
      {#if ownLook}
        <aside class="preview" aria-label={t("appearance.sample")}>
          <span class="caption">{t("appearance.sample")}</span>
          <TextSample value={ownLook} />
        </aside>
      {/if}
    {:else if section === "gamebook"}
      <div class="fields">
        <label class="check"><input type="checkbox" bind:checked={novel.gamebook.enabled} /> {t("gamebook.enable")}</label>
        <p class="hint">{t("gamebook.enableHint")}</p>
        {#if novel.gamebook.enabled}
          <label
            >{t("gamebook.folder")}
            <input bind:value={novel.folders.manuscript} />
            <small>{t("gamebook.folderHint")}</small>
          </label>
          <div class="row">
            <label>{t("gamebook.start")} <input type="number" min="1" step="1" bind:value={novel.gamebook.start} /></label>
            <label
              >{t(novel.pages.unit === "words" ? "gamebook.shortWords" : "gamebook.shortCharacters")}
              <input type="number" min="0" step="50" bind:value={novel.gamebook.short} />
            </label>
          </div>
          <p class="hint">{t("gamebook.shortHint")}</p>
          <label class="check"><input
              type="checkbox"
              bind:checked={novel.gamebook.onePerPage}
              onchange={() => {
                // The export lays the paragraphs out the same way.
                const gx = novel.gamebook.export;
                if (novel.gamebook.onePerPage) gx.separator = "pageBreak";
                else if (gx.separator === "pageBreak") gx.separator = "blankLine";
              }}
            /> {t("gamebook.onePerPage")}</label>
          <label class="check"><input type="checkbox" bind:checked={novel.gamebook.showLinks} /> {t("gamebook.showLinks")}</label>
        {/if}
      </div>
      {#if novel.gamebook.enabled}
        <div class="fields second">
          <h3>{t("gamebook.boxes")}</h3>
          <p class="hint">{t("gamebook.boxesHint")}</p>
          {#each novel.gamebook.boxes as box, i (i)}
            <fieldset class="box-type">
              <legend><span class="chip" style:background={box.color}></span>{box.emoji} {box.name}</legend>
              <div class="box-row">
                <label>{t("gamebook.boxEmoji")} <input class="emoji" bind:value={box.emoji} /></label>
                <label>{t("gamebook.boxName")} <input bind:value={box.name} /></label>
                <label>{t("gamebook.boxColor")} <input type="color" bind:value={box.color} /></label>
              </div>
              <label>{t("gamebook.boxText")} <input bind:value={box.text} /></label>
              <label>{t("gamebook.boxProperty")} <input bind:value={box.property} placeholder={t("gamebook.boxPropertyNone")} /></label>
              <label class="check"><input type="checkbox" bind:checked={box.ending} /> {t("gamebook.boxEnding")}</label>
              <div class="define">
                <button type="button" class="danger" disabled={novel.gamebook.boxes.length <= 1} onclick={() => (novel.gamebook.boxes = novel.gamebook.boxes.filter((_, j) => j !== i))}>{t("gamebook.boxRemove")}</button>
              </div>
            </fieldset>
          {/each}
          <div class="define">
            <button
              type="button"
              onclick={() => {
                const n = novel.gamebook.boxes.length + 1;
                novel.gamebook.boxes = [...novel.gamebook.boxes, { id: `box${Date.now().toString(36)}`, emoji: "⭐", name: t("gamebook.boxNew", { n }), color: "#888888", text: "", property: "", ending: false }];
              }}>{t("gamebook.boxAdd")}</button
            >
          </div>
        </div>
      {/if}
    {:else if section === "upkeep"}
      <div class="fields">
        <h3>{t("whole.title")}</h3>
        <p class="hint">{t("whole.hint")}</p>
        <div class="define">
          <input bind:value={wholeName} aria-label={t("whole.name")} placeholder={t("whole.name")} />
          <button type="button" disabled={!wholeName.trim() || wholeBusy} onclick={takeWhole}>{t("whole.take")}</button>
        </div>
        {#if wholeMessage}<p class="hint" role="status">{wholeMessage}</p>{/if}
        {#if wholes.length}
          <ul class="wholes" aria-label={t("whole.title")}>
            {#each wholes as snap (snap.id)}
              <li>
                <span class="what"><strong>{snap.name}</strong> <small>{snap.date.toLocaleString(app.settings.language, { dateStyle: "medium", timeStyle: "short" })} · {t("whole.scenes", { n: snap.scenes })}</small></span>
                <button type="button" disabled={wholeBusy} onclick={() => restoreWhole(snap)}>{t("snap.restore")}</button>
                <button type="button" disabled={wholeBusy} onclick={() => removeWhole(snap)}>{t("snap.delete")}</button>
              </li>
            {/each}
          </ul>
        {/if}

        <h3>{t("snap.cleanTitle")}</h3>
        <label
          >{t("snap.cleanHint")}
          <input type="date" bind:value={cleanBefore} />
        </label>
        <div class="clean">
          <button type="button" onclick={clean}>{t("snap.clean")}</button>
          {#if cleaned}<span>{cleaned}</span>{/if}
        </div>
      </div>
    {:else if section === "you"}
      <div class="fields">
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
      </div>
    {:else if section === "appearance"}
      <div class="fields wide">
        {#if look.own}
          <div class="elsewhere">
            <p>{t("look.active")}</p>
            <button type="button" onclick={() => show("look")}>{t("look.open")}</button>
          </div>
        {/if}
        <ThemePicker value={app.settings} set={setApp} />
        {#if uiZoom.where === "browser"}
          <div class="field"><span class="label">{t("appearance.uiZoom")}</span></div>
        {:else}
          <label class="narrow"
            >{t("appearance.uiZoom")}
            <select value={app.settings.uiZoom} disabled={uiZoom.where !== "app"} onchange={(e) => setApp({ uiZoom: Number(e.currentTarget.value) })}>
              {#each UI_ZOOMS as z (z)}<option value={z}>{Math.round(z * 100)}%{z === 1 ? ` (${t("appearance.usual")})` : ""}</option>{/each}
              {#if !UI_ZOOMS.includes(app.settings.uiZoom)}<option value={app.settings.uiZoom}>{Math.round(app.settings.uiZoom * 100)}%</option>{/if}
            </select>
          </label>
        {/if}
        <p class="hint">{t(uiZoom.where === "browser" ? "appearance.uiZoomBrowser" : uiZoom.where === "old-mac" ? "appearance.uiZoomOldMac" : "appearance.uiZoomHint")}</p>
      </div>
    {:else if section === "text"}
      <div class="fields">
        {#if look.own}
          <div class="elsewhere">
            <p>{t("look.active")}</p>
            <button type="button" onclick={() => show("look")}>{t("look.open")}</button>
          </div>
        {/if}
        <EditorTextSettings value={lookOf(app.settings)} set={setApp} />
      </div>
      <aside class="preview" aria-label={t("appearance.sample")}>
        <span class="caption">{t("appearance.sample")}</span>
        <TextSample value={lookOf(app.settings)} />
      </aside>
    {:else if section === "writing"}
      <div class="fields">
        <label class="check"><input type="checkbox" checked={app.settings.paragraphs} onchange={(e) => setApp({ paragraphs: e.currentTarget.checked })} /> {t("appearance.paragraphs")}</label>
        <p class="hint">{t("appearance.paragraphsHint")}</p>
        {#if !app.settings.paragraphs}
          <label class="check"><input type="checkbox" checked={app.settings.askBlankLines} onchange={(e) => setApp({ askBlankLines: e.currentTarget.checked })} /> {t("appearance.askBlankLines")}</label>
          <p class="hint">{t("appearance.askBlankLinesHint")}</p>
        {/if}
        <h3>{t("appearance.spelling")}</h3>
        <label class="check"><input type="checkbox" checked={app.settings.spellcheck} onchange={(e) => setApp({ spellcheck: e.currentTarget.checked })} /> {t("appearance.spellcheck")}</label>
        <p class="hint">{t("appearance.spellcheckHint")}</p>
        <h3>{t("dictionary.title")}</h3>
        <p class="hint">{t("dictionary.hint")}</p>
        <div class="define">
          <input
            bind:value={newWord}
            aria-label={t("dictionary.word")}
            placeholder={t("dictionary.word")}
            onkeydown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addWords();
            }}
          />
          <button type="button" disabled={!newWord.trim()} onclick={addWords}>{t("dictionary.add")}</button>
        </div>
        {#if novel.dictionary.length}
          <ul class="words" aria-label={t("dictionary.title")}>
            {#each novel.dictionary as word (word)}
              <li>
                {word}
                <button type="button" title={t("dictionary.remove", { word })} aria-label={t("dictionary.remove", { word })} onclick={() => (novel.dictionary = novel.dictionary.filter((w) => w !== word))}>×</button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {:else if section === "shortcuts"}
      <div class="fields wide">
        <p class="hint">{t("shortcuts.hint")} <HelpLink chapter="shortcuts" /></p>
        <ul class="shortcuts">
          {#each SHORTCUT_IDS as id (id)}
            {@const own = id in ownShortcuts}
            <li data-shortcut={id}>
              <span class="name">{t(`shortcut.${id}` as MessageKey)}</span>
              {#if capturing === id}
                <span class="press" role="status">{t("shortcuts.press")}</span>
              {:else}
                <kbd class:own>{shortcutText(comboNow(id))}</kbd>
                {#if own}<span class="own-note">{t("shortcuts.own")}</span>{/if}
              {/if}
              <span class="buttons">
                {#if own && capturing !== id}<button type="button" onclick={() => setShortcut(id, null)}>{t("shortcuts.reset")}</button>{/if}
                <button
                  type="button"
                  aria-pressed={capturing === id}
                  onclick={(e) => {
                    shortcutError = "";
                    capturing = capturing === id ? null : id;
                    e.currentTarget.blur();
                  }}>{t("shortcuts.change")}</button
                >
              </span>
            </li>
            {#if capturing === id && shortcutError}<li class="refused" role="alert">{shortcutError}</li>{/if}
          {/each}
        </ul>
        {#if Object.keys(ownShortcuts).length}
          <div class="clean"><button type="button" onclick={() => setApp({ shortcuts: {} })}>{t("shortcuts.resetAll")}</button></div>
        {/if}
      </div>
    {:else if section === "backup"}
      <div class="fields">
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
          <label class="narrow"
            >{t("backup.keep")}
            <input type="number" min="1" max="100" value={app.settings.backupKeep} onchange={(e) => setApp({ backupKeep: clamp(e.currentTarget.value, 1, 100, app.settings.backupKeep) })} />
          </label>
          <p class="hint">{backup?.latest ? t("backup.last", { date: backupDate(backup.latest), count: backup.count }) : t("backup.none")}</p>
          <div class="clean">
            <button type="button" disabled={backingUp} onclick={makeBackup}>{backingUp ? t("backup.running") : t("backup.now")}</button>
            {#if backup?.latest}<button type="button" onclick={showBackups}>{t("backup.show")}</button>{/if}
            {#if backupMessage}<span>{backupMessage}</span>{/if}
          </div>
          {#if backupList.length}
              <h3>{t("backup.listTitle")}</h3>
              <p class="hint">{t("backup.listHint")}</p>
              <ul class="backups">
                {#each backupList as name (name)}
                  <li>
                    <span>{backupDate(name)}</span>
                    <button type="button" disabled={!!opening} onclick={() => openBackup(name)}>{opening === name ? t("backup.opening") : t("backup.open")}</button>
                  </li>
                {/each}
              </ul>
          {/if}
        {:else}
          <p class="hint">{t("backup.browserHint")}</p>
          <div class="clean">
            <button type="button" disabled={backingUp} onclick={makeBackup}>{t("backup.download")}</button>
            {#if backupMessage}<span>{backupMessage}</span>{/if}
          </div>
        {/if}
      </div>
    {:else if section === "updates"}
      <div class="fields">
        {#if inTauri() || WEB_BUILD}
          <h3>{t("update.title")}</h3>
          {#if updates.version}<p class="hint">{t("update.version", { version: updates.version })}</p>{/if}
          {#if updates.supported}
            <label class="check"><input type="checkbox" checked={app.settings.checkUpdates} onchange={(e) => setApp({ checkUpdates: e.currentTarget.checked })} /> {t("update.atStart")}</label>
            {#if inTauri()}
              <label class="narrow"
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
      </div>
    {/if}
    </form>
    {/if}
  </div>
</div>

<style>
  /* A list of sections on the left and one short page on the right, as wide as the window
     allows: fields in a column, and what they change drawn beside them. Grid and flex only,
     so it lays out the same on the Safari of macOS 10.15. */
  .settings {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  .sections {
    overflow: auto;
    padding: 16px 12px 24px;
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
  }
  .search {
    width: 100%;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .group {
    display: grid;
    gap: 1px;
    margin-top: 12px;
  }
  .caption {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .item {
    border: none;
    border-radius: 6px;
    background: none;
    padding: 6px 8px;
    text-align: left;
    font-size: 14px;
    color: var(--text);
  }
  .item:hover {
    background: var(--bg-hover);
  }
  .item[aria-current="page"] {
    background: var(--bg-active);
    font-weight: 500;
  }
  .page {
    overflow: auto;
    padding: 20px 32px 64px;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 16px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  .scope,
  .status {
    font-size: 12px;
    color: var(--text-muted);
  }
  .status {
    margin-left: auto;
  }
  form {
    display: grid;
    grid-template-columns: minmax(0, 560px) minmax(240px, 1fr);
    gap: 8px 40px;
    align-items: start;
    max-width: 1180px;
  }
  .fields {
    grid-column: 1;
    min-width: 0;
  }
  .fields.wide {
    grid-column: 1 / -1;
    max-width: 860px;
  }
  .fields.second {
    grid-column: 2;
    max-width: 520px;
  }
  .preview {
    grid-column: 2;
    position: sticky;
    top: 0;
    display: grid;
    gap: 8px;
    justify-items: start;
    min-width: 0;
  }
  .preview .caption {
    padding: 0;
  }
  h3 {
    font-size: 15px;
    margin: 20px 0 8px;
  }
  .fields > h3:first-child {
    margin-top: 0;
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
  .weekdays {
    display: flex;
    flex-wrap: wrap;
    gap: 0 14px;
  }
  label.narrow {
    max-width: 260px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0 12px;
  }
  .row label {
    flex: 1;
    min-width: 160px;
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
  .hint {
    color: var(--text-muted);
    font-size: 12px;
    margin: 0 0 12px;
  }
  .box-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .box-row label {
    flex: 1;
  }
  .box-row input.emoji {
    width: 4em;
  }
  .chip {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border-radius: 3px;
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
    flex-wrap: wrap;
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
  .shortcuts {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: grid;
    max-width: 720px;
  }
  .shortcuts li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
  }
  .shortcuts .name {
    flex: 1;
    min-width: 0;
  }
  .shortcuts kbd {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-hover);
    font: inherit;
    font-size: 13px;
    white-space: nowrap;
  }
  .shortcuts kbd.own {
    border-color: var(--accent);
  }
  .shortcuts .own-note,
  .shortcuts .press {
    font-size: 12px;
    color: var(--text-muted);
  }
  .shortcuts .press {
    color: var(--accent);
  }
  .shortcuts .buttons {
    display: flex;
    gap: 6px;
    min-width: 170px;
    justify-content: flex-end;
  }
  .shortcuts .refused {
    min-height: 0;
    color: var(--danger);
    font-size: 13px;
  }
  .backups {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .backups li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .error {
    color: var(--danger);
  }
  /* A choice kept in another section, with the way there. */
  .elsewhere {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-panel);
    font-size: 13px;
  }
  .elsewhere p {
    flex: 1;
    margin: 0;
  }
  .elsewhere button {
    flex: none;
  }
  /* The previews: the headings as a small tree, the dots, a page. */
  .outline {
    display: grid;
    gap: 4px;
    width: 100%;
    max-width: 360px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-panel);
    font-size: 13px;
    white-space: pre-line;
  }
  .outline .part {
    font-weight: 600;
  }
  .outline .chapter {
    font-weight: 500;
  }
  .outline .scene {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 16px;
    color: var(--text-muted);
  }
  .outline .nested {
    margin-left: 16px;
  }
  .outline .hint {
    margin: 0;
    white-space: normal;
  }
  .dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .sheet {
    display: grid;
    align-content: start;
    gap: 7px;
    width: 150px;
    height: 212px;
    padding: 20px 18px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--editor-bg);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  }
  .sheet i {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: var(--text-muted);
    opacity: 0.5;
  }
  .sheet i.short {
    width: 55%;
    margin-bottom: 6px;
  }
  .holds {
    font-size: 13px;
  }
  /* A narrower window: the preview goes under the fields, then the sections go above the page. */
  @media (max-width: 1150px) {
    form {
      grid-template-columns: minmax(0, 620px);
    }
    .preview,
    .fields.second {
      grid-column: 1;
      position: static;
    }
  }
  @media (max-width: 760px) {
    .settings {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }
    .sections {
      max-height: 40vh;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
  }
  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .words li {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 4px 2px 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 13px;
  }
  .words button {
    min-width: 0;
    padding: 0 6px;
    border: none;
    background: none;
    color: var(--text-muted);
  }
  .wholes {
    display: grid;
    gap: 6px;
    margin: 8px 0 20px;
    padding: 0;
    list-style: none;
  }
  .wholes li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .wholes .what {
    flex: 1;
    min-width: 0;
  }
  .wholes small {
    display: block;
    color: var(--text-muted);
  }
</style>
