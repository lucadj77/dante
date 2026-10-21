<script lang="ts">
  import { buildBook } from "$lib/core/export/book";
  import { pageCount } from "$lib/core/statistics";
  import { bookToDocx, docxBytes } from "$lib/core/export/docx";
  import { bookToEpub, EPUB_CSS } from "$lib/core/export/epub";
  import { bookToTypst } from "$lib/core/export/typst";
  import { bookToMarkdown } from "$lib/core/export/markdown";
  import { EXPORT_FOLDER, exportBaseName } from "$lib/core/export/files";
  import { coverSvg, svgUrl } from "$lib/core/cover";
  import { coverPng, imageToPng } from "./coverImage";
  import type { Project } from "$lib/core/project";
  import { defaultQuotes, EXPORT_FORMATS, PAGE_SIZES, QUOTE_STYLES, type DocxSettings, type ExportFormat, type ParatextSettings, type TypographySettings } from "$lib/core/settings";
  import type { MessageKey } from "$lib/i18n";
  import { app, num, rememberExportPreferences, t } from "$lib/state.svelte";
  import { inTauri, TauriFs } from "$lib/tauriFs";
  import { BrowserFs } from "$lib/browserFs";
  import { whereIs } from "$lib/platform";
  import HeadingLevel from "./HeadingLevel.svelte";
  import FontPicker from "./FontPicker.svelte";

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
    const n = (x: number) => num(x);
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
  // svelte-ignore state_referenced_locally
  // A browser makes no PDF yet: a project that last made one starts from Word there.
  // svelte-ignore state_referenced_locally
  let format = $state<ExportFormat>(project.settings.export.format === "pdf" && !inTauri() && project.fs instanceof BrowserFs ? "docx" : project.settings.export.format);
  // svelte-ignore state_referenced_locally
  let epubId = project.settings.export.epubId;
  // svelte-ignore state_referenced_locally
  let useCover = $state(project.settings.export.cover);
  const coverUrl = $derived(svgUrl(coverSvg(project.settings, project.settings.cover)));
  // svelte-ignore state_referenced_locally
  let epubCss = $state(project.settings.export.epubCss.trim() ? project.settings.export.epubCss : EPUB_CSS);

  const FORMATS: Record<ExportFormat, { ext: string; name: string; mime: string }> = {
    docx: { ext: "docx", name: "Word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    pdf: { ext: "pdf", name: "PDF", mime: "application/pdf" },
    epub: { ext: "epub", name: "EPUB", mime: "application/epub+zip" },
    md: { ext: "md", name: "Markdown", mime: "text/markdown" },
  };
  const desktop = inTauri();
  /** A project folder opened in a browser: exports go to its export folder too. */
  // svelte-ignore state_referenced_locally
  const web = project.fs instanceof BrowserFs;
  /** The app or a browser folder: the export folder exists. */
  const folder = desktop || web;

  /** The choices on this page, as the project stores them. */
  function chosen() {
    const settings = $state.snapshot(project.settings);
    settings.export.docx = $state.snapshot(options);
    settings.export.typography = $state.snapshot(typography);
    settings.export.paratext = $state.snapshot(paratext);
    settings.export.revisions = revisions;
    settings.export.format = format;
    settings.export.epubId = epubId;
    settings.export.cover = useCover;
    // The default stylesheet is not copied into the project, so later versions of Dante can improve it.
    settings.export.epubCss = epubCss.trim() === EPUB_CSS.trim() ? "" : epubCss;
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
    JSON.stringify([options, typography, paratext, structure, revisions, format, useCover, epubCss]);
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

  /** "Author_Title_2026-10-16-11-30.ext": each export gets its own name, so none replaces another. */
  function fileName(ext = FORMATS[format].ext, date = new Date()) {
    return `${exportBaseName(project.settings, date)}.${ext}`;
  }

  /** A path in the export folder not taken yet, relative to the project. */
  async function exportPath(ext = FORMATS[format].ext): Promise<string> {
    const name = fileName(ext).replace(/\.[^.]+$/, "");
    let path = `${EXPORT_FOLDER}/${name}.${ext}`;
    for (let n = 2; await project.fs.exists(path); n++) path = `${EXPORT_FOLDER}/${name}-${n}.${ext}`;
    return path;
  }

  /** Asks where to save the file in the desktop app; null if cancelled. */
  async function choosePath(): Promise<string | null> {
    const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_PATH_KEY);
    } catch {
      // No storage: the dialog opens in its default folder.
    }
    const defaultPath = last ? last.replace(/[^/\\]+$/, fileName()) : fileName();
    const { ext, name } = FORMATS[format];
    const path = await saveDialog({ defaultPath, filters: [{ name, extensions: [ext] }] });
    if (!path) return null;
    try {
      localStorage.setItem(LAST_PATH_KEY, path);
    } catch {
      // Not remembered; nothing else depends on it.
    }
    return path;
  }

  /** Where a file went: in the project, or anywhere on the computer. */
  interface Saved {
    /** Path in the project, for files in the export folder. */
    relative: string;
    absolute: string;
  }

  // svelte-ignore state_referenced_locally
  const root = project.fs instanceof TauriFs ? project.fs.root : "";
  const inProject = (relative: string): Saved => ({ relative, absolute: `${root.replace(/[\\/]+$/, "")}/${relative}` });

  /**
   * Where to write: a new file in the export folder, or the place chosen in a dialog.
   * Null if the dialog was cancelled.
   */
  async function destination(elsewhere: boolean): Promise<Saved | null> {
    if (elsewhere) {
      const path = await choosePath();
      return path ? { relative: "", absolute: path } : null;
    }
    return inProject(await exportPath());
  }

  /**
   * In a browser, "elsewhere" asks where with the browser's own dialog, when it has one.
   * Null if cancelled, "" when the browser cannot ask and the file is downloaded instead.
   */
  async function saveInBrowser(bytes: Uint8Array | string, name: string, mime: string): Promise<Saved | "" | null> {
    const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
    if (!picker) return download(bytes, name, mime);
    let handle: FileSystemFileHandle;
    try {
      const { ext, name: kind } = FORMATS[format];
      handle = await picker({ suggestedName: name, id: "dante-export", types: [{ description: kind, accept: { [mime]: [`.${name.split(".").pop() || ext}`] } }] });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
    const writable = await handle.createWritable();
    await writable.write(bytes as FileSystemWriteChunkType);
    await writable.close();
    return { relative: "", absolute: handle.name };
  }

  function download(bytes: Uint8Array | string, name: string, mime: string): "" {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "";
  }

  /** Writes the file in the project's export folder or where chosen; the sample project downloads it and gets "". */
  async function save(bytes: Uint8Array | string, elsewhere: boolean, name = fileName(), mime = FORMATS[format].mime): Promise<Saved | "" | null> {
    if (web) {
      if (elsewhere) return saveInBrowser(bytes, name, mime);
      const where = inProject(await exportPath());
      if (typeof bytes === "string") await project.fs.writeText(where.relative, bytes);
      else await project.fs.writeBytes(where.relative, bytes);
      return where;
    }
    if (desktop) {
      const where = await destination(elsewhere);
      if (!where) return null;
      if (where.relative) {
        if (typeof bytes === "string") await project.fs.writeText(where.relative, bytes);
        else await project.fs.writeBytes(where.relative, bytes);
      } else {
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        await writeFile(where.absolute, typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes);
      }
      return where;
    }
    return download(bytes, name, mime);
  }

  let saved = $state<Saved | null>(null);

  const fail = (e: unknown) => (error = t("error.generic", { message: e instanceof Error ? e.message : String(e) }));

  async function openFile() {
    if (!saved) return;
    try {
      if (saved.relative && project.fs instanceof TauriFs) await project.fs.openWithSystem(saved.relative);
      else {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(saved.absolute);
      }
    } catch (e) {
      fail(e);
    }
  }

  async function openFolder() {
    if (!saved) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(saved.absolute);
    } catch (e) {
      fail(e);
    }
  }

  /** Opens the export folder, where earlier exports are, creating it the first time. */
  async function openExports() {
    error = "";
    try {
      if (!(project.fs instanceof TauriFs)) return;
      await project.fs.mkdir(EXPORT_FOLDER);
      await project.fs.openWithSystem(EXPORT_FOLDER);
    } catch (e) {
      fail(e);
    }
  }

  async function run(elsewhere = false) {
    error = "";
    message = "";
    saved = null;
    busy = true;
    try {
      if (format === "epub" && !epubId) epubId = crypto.randomUUID();
      await persist();
      const book = await buildBook(project, { revisions, convert: imageToPng });
      const layout = project.settings.export.docx;
      const labels = { words: t("export.words") };
      const pages = num(pageCount(book, project.settings.pages), 1);
      const cover = useCover && format !== "md" ? coverSvg(project.settings, project.settings.cover) : "";
      let where: Saved | "" | null;
      if (format === "docx") {
        where = await save(await docxBytes(bookToDocx(book, layout, labels, (cover && (await coverPng(cover))) || undefined)), elsewhere);
      } else if (format === "md") {
        where = await save(bookToMarkdown(book, layout), elsewhere);
      } else if (format === "epub") {
        const png = cover ? await coverPng(cover) : null;
        const image = png ? { data: png, mediaType: "image/png" as const } : cover ? { data: cover, mediaType: "image/svg+xml" as const } : undefined;
        where = await save(bookToEpub(book, layout, epubId, new Date(), epubCss, image), elsewhere);
      } else if (desktop) {
        // Typst, inside the app, turns the source into the PDF at the chosen path. Files the
        // text refers to are looked up in the project's folder; the sample project has none.
        const source = bookToTypst(book, layout, labels, cover);
        where = await destination(elsewhere);
        if (where) {
          if (where.relative) await project.fs.mkdir(EXPORT_FOLDER);
          const { invoke } = await import("@tauri-apps/api/core");
          const typstRoot = root || where.absolute.replace(/[\\/][^\\/]*$/, "") || "/";
          await invoke("compile_pdf", { root: typstRoot, source, output: where.absolute });
        }
      } else {
        // Only the desktop app compiles PDFs; a browser gets the Typst source.
        where = await save(bookToTypst(book, layout, labels, cover), elsewhere, fileName("typ"), "text/plain");
        if (where !== null) {
          message = t("export.pdfBrowser");
          return;
        }
      }
      if (where !== null) {
        saved = where || null;
        message = t("export.done", { words: num(book.words), pages });
      }
    } catch (e) {
      fail(e);
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
    <div class="top">
      <h2>{t("export.title")}</h2>
      {#if desktop}<button type="button" onclick={openExports}>{t("export.openExports")}</button>{/if}
    </div>
    {#if folder}<p class="hint">{t("export.folderHint")}</p>{/if}
    {#if web}<p class="hint">{t("export.folderWeb", { path: whereIs(project.fs, EXPORT_FOLDER) })} {t("export.noPdfWeb")}</p>{/if}
    <div class="formats" role="radiogroup" aria-label={t("export.format")}>
      {#each EXPORT_FORMATS.filter((f) => !(web && f === "pdf")) as f (f)}
        <label class="format" class:chosen={format === f}>
          <input type="radio" name="format" value={f} bind:group={format} />
          <strong>{t(`export.format.${f}`)}</strong>
          <span>{t(`export.format.${f}Hint`)}</span>
        </label>
      {/each}
    </div>
    {#if format === "epub"}
      <p class="hint">{t("export.epubHint")}</p>
      <label
        >{t("export.epubCss")}
        <textarea class="code" rows="14" spellcheck="false" bind:value={epubCss}></textarea>
      </label>
      <p class="hint">
        {t("export.epubCssHint")}
        {#if epubCss.trim() !== EPUB_CSS.trim()}<button type="button" class="link" onclick={() => (epubCss = EPUB_CSS)}>{t("export.epubCssReset")}</button>{/if}
      </p>
    {:else if format === "md"}
      <p class="hint">{t("export.mdHint")}</p>
    {:else}
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
    <div class="field">
      <span class="label">{t("export.font")}</span>
      <FontPicker bind:value={options.font} />
    </div>
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
    <label class="check"><input type="checkbox" bind:checked={options.header} /> {t("export.header")}</label>
    {/if}
    <label class="check"><input type="checkbox" bind:checked={options.titlePage} /> {t("export.titlePage")}</label>
    {#if format !== "md"}
      <div class="cover">
        <img src={coverUrl} alt={t("cover.preview")} />
        <div>
          <label class="check"><input type="checkbox" bind:checked={useCover} /> {t("export.cover")}</label>
          <p class="hint">{t("export.coverHint")}</p>
        </div>
      </div>
    {/if}

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
        {#each QUOTE_STYLES as style (style)}
          <option value={style}>{t(`export.quotes.${style}` as MessageKey)}{style === defaultQuotes(project.settings.language) ? ` · ${t("export.quotesUsual")}` : ""}</option>
        {/each}
      </select>
    </label>
    {#if typography.quotes === "dash" || typography.quotes === "dashAttached"}
      <p class="hint">{t(typography.quotes === "dash" ? "export.quotesDashHint" : "export.quotesDashAttachedHint")}</p>
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
      <button class="primary" type="submit" disabled={busy}>{busy ? t("export.running") : t("export.run", { format: FORMATS[format].name === "Word" ? "DOCX" : FORMATS[format].name })}</button>
      {#if folder}<button type="button" class="link" disabled={busy} onclick={() => run(true)}>{t("export.saveElsewhere")}</button>{/if}
      {#if error}<span class="error" role="alert">{error}</span>{/if}
    </div>
    {#if message}
      <div class="success" role="status">
        <strong>{t("export.success")}</strong>
        <span>{message}</span>
        {#if saved}
          <span class="path">{web && saved.relative ? t("export.savedIn", { path: whereIs(project.fs, saved.relative) }) : saved.relative ? t("export.savedAs", { path: saved.relative }) : saved.absolute}</span>
          {#if desktop}<div class="buttons">
            <button type="button" onclick={openFile}>{t("export.openFile")}</button>
            <button type="button" onclick={openFolder}>{t("export.openFolder")}</button>
          </div>{/if}
        {/if}
      </div>
    {/if}
  </form>
</div>

<style>
  .field {
    display: grid;
    gap: 4px;
  }
  .field .label {
    color: var(--text-muted);
    font-size: 13px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .top h2 {
    margin: 0;
  }
  .cover {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .cover img {
    width: 48px;
    aspect-ratio: 2 / 3;
    border-radius: 2px;
    box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
  }
  .cover .hint {
    margin: 0;
  }
  .actions .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    cursor: pointer;
  }
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
  .formats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .format {
    display: grid;
    align-content: start;
    gap: 2px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
  }
  .format.chosen {
    border-color: var(--accent);
    background: rgba(47, 95, 158, 0.1);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .format input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .format span {
    font-size: 12px;
    color: var(--text-muted);
  }
  .hint .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    font-size: inherit;
    cursor: pointer;
  }
  textarea.code {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
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
  .error {
    color: var(--danger);
  }
</style>
