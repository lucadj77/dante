<script lang="ts">
  import { buildBook } from "$lib/core/export/book";
  import { bookToDocx, docxBytes } from "$lib/core/export/docx";
  import type { Project } from "$lib/core/project";
  import { PAGE_SIZES, type DocxSettings, type ParatextSettings, type TypographySettings } from "$lib/core/settings";
  import { app, rememberExportPreferences, t } from "$lib/state.svelte";
  import { inTauri } from "$lib/tauriFs";
  import HeadingLevel from "./HeadingLevel.svelte";

  let { project, onSaved }: { project: Project; onSaved: () => Promise<void> } = $props();

  // svelte-ignore state_referenced_locally
  let options = $state<DocxSettings>(structuredClone($state.snapshot(project.settings.export.docx)));
  // svelte-ignore state_referenced_locally
  let typography = $state<TypographySettings>(structuredClone($state.snapshot(project.settings.export.typography)));
  // Part and chapter headings are novel settings, shown here too because the export uses them.
  // svelte-ignore state_referenced_locally
  let structure = $state(structuredClone($state.snapshot(project.settings.structure)));
  // svelte-ignore state_referenced_locally
  let paratext = $state<ParatextSettings>(structuredClone($state.snapshot(project.settings.export.paratext)));

  const PRESETS: Record<DocxSettings["profile"], Partial<DocxSettings>> = {
    manuscript: { font: "Times New Roman", fontSize: 12, lineSpacing: 2, indent: 1.27, sceneSeparator: "#" },
    typeset: { font: "Garamond", fontSize: 11, lineSpacing: 1.15, indent: 0.6, sceneSeparator: "* * *" },
  };

  const NAMES: Partial<Record<keyof typeof PAGE_SIZES, string>> = { a4: "A4", a5: "A5", letter: "Letter", bformat: "B-format" };

  /** "A5 (14,8 × 21 cm)", or inches for the sizes printers give in inches. */
  function pageLabel(size: keyof typeof PAGE_SIZES): string {
    const [w, h] = PAGE_SIZES[size];
    const n = (x: number) => x.toLocaleString(app.settings.language);
    const inches = size.endsWith("in") || size === "letter";
    const dims = inches ? `${n(+(w / 2.54).toFixed(2))} × ${n(+(h / 2.54).toFixed(2))} in` : `${n(w)} × ${n(h)} cm`;
    return NAMES[size] ? `${NAMES[size]} (${dims})` : dims;
  }

  /** Each layout comes with its usual font, size and spacing, which can then be changed. */
  function setProfile(profile: DocxSettings["profile"]) {
    options = { ...options, ...PRESETS[profile], profile };
  }
  // svelte-ignore state_referenced_locally
  let revisions = $state<"accept" | "reject">(project.settings.export.revisions);

  /** The choices on this page, as the project stores them. */
  function chosen() {
    const settings = $state.snapshot(project.settings);
    settings.export.docx = $state.snapshot(options);
    settings.export.typography = $state.snapshot(typography);
    settings.export.paratext = $state.snapshot(paratext);
    settings.export.revisions = revisions;
    settings.structure = $state.snapshot(structure);
    return settings;
  }

  // Every change is kept in the project right away, so the next export starts from it
  // even if this one never happens.
  let lastSaved = JSON.stringify(chosen());
  let saving: Promise<void> = Promise.resolve();
  function persist(): Promise<void> {
    const settings = chosen();
    const json = JSON.stringify(settings);
    if (json === lastSaved) return saving;
    lastSaved = json;
    rememberExportPreferences({
      structure: settings.structure,
      docx: settings.export.docx,
      typography: settings.export.typography,
      revisions: settings.export.revisions,
    });
    saving = saving.then(async () => {
      await project.saveSettings(settings);
      await onSaved();
    });
    return saving;
  }
  $effect(() => {
    JSON.stringify([options, typography, paratext, structure, revisions]);
    const timer = setTimeout(() => void persist().catch((e) => (error = t("error.generic", { message: String(e) }))), 500);
    return () => clearTimeout(timer);
  });

  // The folder of the last export, on this computer, for the save dialog.
  // svelte-ignore state_referenced_locally
  const LAST_PATH_KEY = `dante.last-export:${"root" in project.fs ? (project.fs as { root: string }).root : ""}`;
  let message = $state("");
  let error = $state("");
  let busy = $state(false);

  const breaks = $derived([
    ...(project.settings.structure.parts ? [{ key: "partBreak" as const, label: "export.partBreak" as const }] : []),
    { key: "chapterBreak" as const, label: "export.chapterBreak" as const },
    { key: "sceneBreak" as const, label: "export.sceneBreak" as const },
  ]);

  function fileName() {
    const base = (project.settings.title || "manuscript").replace(/[\\/:*?"<>|]/g, " ").trim();
    return `${base}.docx`;
  }

  /** Where the file went: a path in the desktop app, "" for a browser download, null if cancelled. */
  async function save(bytes: Uint8Array): Promise<string | null> {
    if (inTauri()) {
      const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_PATH_KEY);
      } catch {
        // No storage: the dialog opens in its default folder.
      }
      const defaultPath = last ? last.replace(/[^/\\]+$/, fileName()) : fileName();
      const path = await saveDialog({ defaultPath, filters: [{ name: "Word", extensions: ["docx"] }] });
      if (!path) return null;
      try {
        localStorage.setItem(LAST_PATH_KEY, path);
      } catch {
        // Not remembered; nothing else depends on it.
      }
      await writeFile(path, bytes);
      return path;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "";
  }

  let savedPath = $state<string | null>(null);

  async function openFile() {
    if (!savedPath) return;
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(savedPath);
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function openFolder() {
    if (!savedPath) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(savedPath);
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function run() {
    error = "";
    message = "";
    savedPath = null;
    busy = true;
    try {
      await persist();
      const book = await buildBook(project, { revisions });
      const bytes = await docxBytes(bookToDocx(book, project.settings.export.docx, { words: t("export.words") }));
      const pages = (book.characters / 1800).toLocaleString(undefined, { maximumFractionDigits: 1 });
      const where = await save(bytes);
      if (where !== null) {
        savedPath = where || null;
        message = t("export.done", { words: book.words.toLocaleString(), pages });
      }
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      busy = false;
    }
  }
</script>

<div class="export">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void run();
    }}
  >
    <h2>{t("export.title")}</h2>
    <h3>{t("export.docx")}</h3>
    <label
      >{t("export.profile")}
      <select value={options.profile} onchange={(e) => setProfile((e.currentTarget as HTMLSelectElement).value as DocxSettings["profile"])}>
        <option value="manuscript">{t("export.profileManuscript")}</option>
        <option value="typeset">{t("export.profileTypeset")}</option>
      </select>
    </label>

    <h4>{t("export.page")}</h4>
    <div class="row">
      <label
        >{t("export.pageSize")}
        <select bind:value={options.pageSize}>
          {#each Object.keys(PAGE_SIZES) as size (size)}
            <option value={size}>{pageLabel(size as keyof typeof PAGE_SIZES)}</option>
          {/each}
          <option value="custom">{t("export.pageCustom")}</option>
        </select>
      </label>
      {#if options.pageSize === "custom"}
        <label>{t("export.pageWidth")} <input type="number" min="5" max="60" step="0.1" bind:value={options.pageWidth} /></label>
        <label>{t("export.pageHeight")} <input type="number" min="5" max="60" step="0.1" bind:value={options.pageHeight} /></label>
      {/if}
    </div>
    <label>{t("export.font")} <input bind:value={options.font} /></label>
    <div class="row">
      <label>{t("export.fontSize")} <input type="number" min="8" max="20" bind:value={options.fontSize} /></label>
      <label
        >{t("export.lineSpacing")}
        <select bind:value={options.lineSpacing}>
          <option value={1}>1</option>
          <option value={1.15}>1,15</option>
          <option value={1.5}>1,5</option>
          <option value={2}>2</option>
        </select>
      </label>
      <label>{t("export.indent")} <input type="number" min="0" max="3" step="0.01" bind:value={options.indent} /></label>
    </div>
    <label class="check"><input type="checkbox" bind:checked={options.titlePage} /> {t("export.titlePage")}</label>
    <label class="check"><input type="checkbox" bind:checked={options.header} /> {t("export.header")}</label>

    <h4>{t("export.structure")}</h4>
    <div class="row">
      {#each breaks as item (item.key)}
        <label
          >{t(item.label)}
          <select bind:value={options[item.key]}>
            <option value="pageBreak">{t("export.breakPage")}</option>
            <option value="blankLine">{t("export.breakBlank")}</option>
            <option value="characters">{t("export.breakCharacters")}</option>
            <option value="none">{t("export.breakNone")}</option>
          </select>
        </label>
      {/each}
    </div>
    <label>{t("export.separator")} <input bind:value={options.sceneSeparator} /></label>
    {#if project.settings.structure.parts}
      <fieldset>
        <legend>{t("kind.part")}</legend>
        <HeadingLevel bind:level={structure.part} language={project.settings.language} sample={t("sample.partTitle")} feminine />
      </fieldset>
    {/if}
    <fieldset>
      <legend>{t("kind.chapter")}</legend>
      <HeadingLevel bind:level={structure.chapter} language={project.settings.language} sample={t("sample.chapterTitle")} />
    </fieldset>
    <fieldset>
      <legend>{t("kind.scene")}</legend>
      <HeadingLevel bind:level={options.scene} language={project.settings.language} sample={t("sample.sceneTitle")} />
      {#if options.scene.numbering !== "none"}
        <label class="check"><input type="checkbox" bind:checked={options.sceneNumbersRestart} /> {t("export.sceneRestart")}</label>
      {/if}
      {#if options.scene.numbering !== "none" || options.scene.showTitle}
        <label class="check"><input type="checkbox" bind:checked={options.omitSingleSceneHeading} /> {t("export.sceneOmitSingle")}</label>
      {/if}
    </fieldset>
    <p class="hint">{t("export.publishedTitleHint")}</p>

    <h4>{t("export.typography")}</h4>
    <p class="hint">{t("export.typographyHint")}</p>
    <label
      >{t("export.quotes")}
      <select bind:value={typography.quotes}>
        <option value="keep">{t("export.quotesKeep")}</option>
        <option value="guillemets">{t("export.quotesGuillemets")}</option>
        <option value="curly">{t("export.quotesCurly")}</option>
        <option value="dash">{t("export.quotesDash")}</option>
      </select>
    </label>
    {#if typography.quotes === "dash"}
      <p class="hint">{t("export.quotesDashHint")}</p>
      <div class="row">
        <label
          >{t("export.dialogueDash")}
          <select bind:value={typography.dialogueDash}>
            <option value="em">{t("export.dialogueEm")}</option>
            <option value="en">{t("export.dialogueEn")}</option>
          </select>
        </label>
      </div>
    {/if}
    <label class="check"><input type="checkbox" bind:checked={typography.apostrophes} /> {t("export.apostrophes")}</label>
    <label class="check"><input type="checkbox" bind:checked={typography.ellipsis} /> {t("export.ellipsis")}</label>
    <label class="check"><input type="checkbox" bind:checked={typography.spaces} /> {t("export.spaces")}</label>
    <label class="check"><input type="checkbox" bind:checked={typography.whileTyping} /> {t("export.whileTyping")}</label>

    <h4>{t("export.paratext")}</h4>
    <p class="hint">{t("export.paratextHint")}</p>
    <label>{t("export.dedication")} <textarea rows="2" bind:value={paratext.dedication}></textarea></label>
    <label>{t("export.epigraph")} <textarea rows="3" bind:value={paratext.epigraph}></textarea></label>
    <label>{t("export.epigraphSource")} <input bind:value={paratext.epigraphSource} /></label>
    <label>{t("export.authorNote")} <textarea rows="4" bind:value={paratext.authorNote}></textarea></label>
    <label>{t("export.acknowledgements")} <textarea rows="4" bind:value={paratext.acknowledgements}></textarea></label>
    <label>{t("export.colophon")} <textarea rows="3" bind:value={paratext.colophon}></textarea></label>

    <label
      >{t("export.revisions")}
      <select bind:value={revisions}>
        <option value="accept">{t("export.accept")}</option>
        <option value="reject">{t("export.reject")}</option>
      </select>
    </label>
    <div class="actions">
      <button class="primary" type="submit" disabled={busy}>{busy ? t("export.running") : t("export.run")}</button>
      {#if error}<span class="error" role="alert">{error}</span>{/if}
    </div>
    {#if message}
      <div class="success" role="status">
        <strong>{t("export.success")}</strong>
        <span>{message}</span>
        {#if savedPath}
          <span class="path">{savedPath}</span>
          <div class="buttons">
            <button type="button" onclick={openFile}>{t("export.openFile")}</button>
            <button type="button" onclick={openFolder}>{t("export.openFolder")}</button>
          </div>
        {/if}
      </div>
    {/if}
    <p class="muted">{t("export.later")}</p>
  </form>
</div>

<style>
  .export {
    height: 100%;
    overflow: auto;
    padding: 24px 32px 64px;
  }
  form {
    max-width: 560px;
  }
  h2 {
    font-size: 20px;
    margin: 0 0 16px;
  }
  h3 {
    font-size: 15px;
    margin: 0 0 12px;
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px 12px;
    margin: 0 0 12px;
    display: grid;
    gap: 8px;
  }
  legend {
    font-size: 13px;
    padding: 0 4px;
  }
  fieldset label.check {
    margin: 0;
  }
  h4 {
    font-size: 13px;
    margin: 24px 0 10px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .hint {
    color: var(--text-muted);
    font-size: 12px;
    margin: -4px 0 12px;
  }
  textarea {
    font: inherit;
    color: var(--text);
    font-size: 14px;
    resize: vertical;
  }
  label {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    color: var(--text-muted);
    font-size: 13px;
  }
  label input:not([type="checkbox"]),
  label textarea,
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
  .row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
  }
  .success {
    display: grid;
    gap: 6px;
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid var(--accent);
    border-radius: 8px;
    background: var(--bg-panel);
    font-size: 14px;
  }
  .success .path {
    color: var(--text-muted);
    font-size: 12px;
    word-break: break-all;
  }
  .buttons {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .muted {
    color: var(--text-muted);
    margin-top: 24px;
  }
  .error {
    color: var(--danger);
  }
</style>
