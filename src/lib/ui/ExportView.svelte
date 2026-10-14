<script lang="ts">
  import { buildBook } from "$lib/core/export/book";
  import { bookToDocx, docxBytes } from "$lib/core/export/docx";
  import type { Project } from "$lib/core/project";
  import type { DocxSettings, ParatextSettings, TypographySettings } from "$lib/core/settings";
  import { t } from "$lib/state.svelte";
  import { inTauri } from "$lib/tauriFs";

  let { project, onSaved }: { project: Project; onSaved: () => Promise<void> } = $props();

  // svelte-ignore state_referenced_locally
  let options = $state<DocxSettings>(structuredClone($state.snapshot(project.settings.export.docx)));
  // svelte-ignore state_referenced_locally
  let typography = $state<TypographySettings>(structuredClone($state.snapshot(project.settings.export.typography)));
  // svelte-ignore state_referenced_locally
  let paratext = $state<ParatextSettings>(structuredClone($state.snapshot(project.settings.export.paratext)));

  const PRESETS: Record<DocxSettings["profile"], Partial<DocxSettings>> = {
    manuscript: { font: "Times New Roman", fontSize: 12, lineSpacing: 2, indent: 1.27, sceneSeparator: "#" },
    typeset: { font: "Garamond", fontSize: 11, lineSpacing: 1.15, indent: 0.6, sceneSeparator: "* * *" },
  };

  /** Each layout comes with its usual font, size and spacing, which can then be changed. */
  function setProfile(profile: DocxSettings["profile"]) {
    options = { ...options, ...PRESETS[profile], profile };
  }
  let revisions = $state<"accept" | "reject">("accept");
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

  async function save(bytes: Uint8Array): Promise<boolean> {
    if (inTauri()) {
      const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await saveDialog({ defaultPath: fileName(), filters: [{ name: "Word", extensions: ["docx"] }] });
      if (!path) return false;
      await writeFile(path, bytes);
      return true;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  async function run() {
    error = "";
    message = "";
    busy = true;
    try {
      // The chosen options become the project's defaults for the next export.
      const settings = $state.snapshot(project.settings);
      settings.export.docx = $state.snapshot(options);
      settings.export.typography = $state.snapshot(typography);
      settings.export.paratext = $state.snapshot(paratext);
      await project.saveSettings(settings);
      await onSaved();
      const book = await buildBook(project, { revisions });
      const bytes = await docxBytes(bookToDocx(book, project.settings.export.docx, { words: t("export.words") }));
      const pages = (book.characters / 1800).toLocaleString(undefined, { maximumFractionDigits: 1 });
      if (await save(bytes)) message = t("export.done", { words: book.words.toLocaleString(), pages });
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
    <label
      >{t("export.headingLayout")}
      <select bind:value={options.headingLayout}>
        <option value="oneLine">{t("export.layoutOneLine")}</option>
        <option value="twoLines">{t("export.layoutTwoLines")}</option>
      </select>
    </label>
    <div class="row">
      <label
        >{t("export.sceneHeadings")}
        <select bind:value={options.sceneHeadings}>
          <option value="none">{t("export.sceneNone")}</option>
          <option value="title">{t("export.sceneTitle")}</option>
          <option value="number">{t("export.sceneNumber")}</option>
          <option value="numberAndTitle">{t("export.sceneNumberTitle")}</option>
        </select>
      </label>
      <label
        >{t("export.sceneNumbering")}
        <select bind:value={options.sceneNumbering} disabled={options.sceneHeadings === "none" || options.sceneHeadings === "title"}>
          <option value="arabic">1, 2, 3</option>
          <option value="roman">I, II, III</option>
          <option value="words">{t("numbering.words")}</option>
        </select>
      </label>
    </div>
    {#if options.sceneHeadings !== "none"}
      <label class="check"><input type="checkbox" bind:checked={options.sceneNumbersRestart} /> {t("export.sceneRestart")}</label>
      <label class="check"><input type="checkbox" bind:checked={options.omitSingleSceneHeading} /> {t("export.sceneOmitSingle")}</label>
    {/if}
    <p class="hint">{t("export.publishedTitleHint")}</p>

    <h4>{t("export.typography")}</h4>
    <p class="hint">{t("export.typographyHint")}</p>
    <label
      >{t("export.quotes")}
      <select bind:value={typography.quotes}>
        <option value="keep">{t("export.quotesKeep")}</option>
        <option value="guillemets">{t("export.quotesGuillemets")}</option>
        <option value="curly">{t("export.quotesCurly")}</option>
      </select>
    </label>
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
      <button class="primary" type="submit" disabled={busy}>{t("export.run")}</button>
      {#if message}<span>{message}</span>{/if}
      {#if error}<span class="error">{error}</span>{/if}
    </div>
    <p class="muted">{t("export.later")}</p>
  </form>
</div>

<style>
  .export {
    height: 100vh;
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
  .muted {
    color: var(--text-muted);
    margin-top: 24px;
  }
  .error {
    color: var(--danger);
  }
</style>
