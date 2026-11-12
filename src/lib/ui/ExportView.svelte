<script lang="ts" module>
  /** The page shown, kept while the app is open. */
  const lastPage = { id: "format" as "format" | "page" | "structure" | "gamebook" | "typography" | "paratext" };
</script>

<script lang="ts">
  import ExportPreview from "./ExportPreview.svelte";
  import HelpLink from "./HelpLink.svelte";
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import { buildBook } from "$lib/core/export/book";
  import { pageCount } from "$lib/core/statistics";
  import { approxWords, bookToDocx, docxBytes } from "$lib/core/export/docx";
  import { bookToEpub, EPUB_CSS } from "$lib/core/export/epub";
  import { bookToTypst, typstImage } from "$lib/core/export/typst";
  import { bookToMarkdown } from "$lib/core/export/markdown";
  import { EXPORT_FOLDER } from "$lib/core/export/files";
  import { coverSvg, svgUrl } from "$lib/core/cover";
  import { coverPicture, coverPng, imageToPng } from "./coverImage";
  import type { Project } from "$lib/core/project";
  import {
    defaultHeadings,
    defaultMargins,
    defaultQuotes,
    EXPORT_FORMATS,
    HEADING_KINDS,
    LINE_SPACING,
    PAGE_SIZES,
    QUOTE_STYLES,
    type DocxSettings,
    type ExportFormat,
    type ExportProfile,
    type HeadingStyle,
    type ParatextSettings,
    type TypographySettings,
  } from "$lib/core/settings";
  import { untrack } from "svelte";
  import { cleanSource } from "$lib/core/export/book";
  import { scenesOf } from "$lib/core/manuscript";
  import { splitNote } from "$lib/core/frontmatter";
  import { dialogueSample } from "$lib/core/typography";
  import HeadingFormat from "./HeadingFormat.svelte";
  import type { MessageKey } from "$lib/i18n";
  import { app, num, rememberExportPreferences, t } from "$lib/state.svelte";
  import { inTauri, TauriFs } from "$lib/tauriFs";
  import { BrowserFs } from "$lib/browserFs";
  import { whereIs } from "$lib/platform";
  import HeadingLevel from "./HeadingLevel.svelte";
  import FontPicker from "./FontPicker.svelte";
  import { gamebookOf } from "$lib/core/gamebook/marks";
  import { warnings as gamebookWarnings, type Warning } from "$lib/core/gamebook/paragraphs";
  import type { GamebookExportSettings } from "$lib/core/settings";
  import { navigator } from "./navigation";
  import { exportSaver, type Saved } from "./exportSave";

  let { project, onSaved }: { project: Project; onSaved: () => Promise<void> } = $props();
  const nav = navigator();

  // A gamebook: what is wrong in it that the printed book would show.
  const gamebook = $derived(project.settings.gamebook.enabled);
  // svelte-ignore state_referenced_locally
  let gbx = $state<GamebookExportSettings>(structuredClone($state.snapshot(project.settings.gamebook.export)));
  /** The faults that spoil a printed gamebook: a reference to nothing, two paragraphs with one number, a wrong number on a reference. */
  const SERIOUS: Warning[] = ["broken", "duplicate", "staleLabel", "bareLink"];
  let problems = $state.raw<{ path: string; number: number; title: string; warnings: Warning[] }[]>([]);
  $effect(() => {
    if (!gamebook) return;
    void project.index().then((notes) => {
      const index = gamebookOf(notes, project.settings);
      if (!index) return;
      const found = gamebookWarnings(index, project.settings.gamebook.start);
      problems = index
        .all()
        .map((p) => ({ path: p.path, number: p.number, title: p.title, warnings: (found.get(p.path) ?? []).filter((w) => SERIOUS.includes(w)) }))
        .filter((x) => x.warnings.length)
        .sort((a, b) => a.number - b.number);
    });
  });

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

  // Headings left as the layout gives them follow the layout, the size and the line spacing
  // of the text; the ones the writer changed stay as chosen.
  const parts = $derived(project.settings.structure.parts);
  const usual = $derived(defaultHeadings({ profile: options.profile, fontSize: Number(options.fontSize) || 12, lineSpacing: Number(options.lineSpacing) || 1 }, parts));
  // Margins left as the page gives them follow the size of the page.
  const usualMargins = $derived(defaultMargins(options));
  const SIDES = ["top", "bottom", "left", "right"] as const;
  const SIDE_LABELS = { top: "export.marginTop", bottom: "export.marginBottom", left: "export.marginLeft", right: "export.marginRight" } as const;
  const marginsChanged = $derived(SIDES.some((side) => options.margins[side] !== usualMargins[side]));
  // svelte-ignore state_referenced_locally
  let followedMargins = usualMargins;
  $effect(() => {
    const next = usualMargins;
    untrack(() => {
      for (const side of SIDES) if (options.margins[side] === followedMargins[side] && options.margins[side] !== next[side]) options.margins[side] = next[side];
      followedMargins = next;
    });
  });
  // svelte-ignore state_referenced_locally
  let followed = usual;
  $effect(() => {
    const next = usual;
    untrack(() => {
      for (const kind of HEADING_KINDS) {
        const now = options.headings[kind];
        for (const key of Object.keys(next[kind]) as (keyof HeadingStyle)[]) {
          if (now[key] === followed[kind][key] && now[key] !== next[kind][key]) (now as unknown as Record<string, unknown>)[key] = next[kind][key];
        }
      }
      followed = next;
    });
  });
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
  /** The cover's picture, read from the project, as a data: URL; "" without one. */
  let picture = $state("");
  $effect(() => {
    const cover = project.settings.cover;
    void coverPicture(project.fs, cover).then((url) => (picture = url));
  });
  const coverUrl = $derived(svgUrl(coverSvg(project.settings, project.settings.cover, picture ? { url: picture } : undefined)));
  // svelte-ignore state_referenced_locally
  let epubCss = $state(project.settings.export.epubCss.trim() ? project.settings.export.epubCss : EPUB_CSS);

  // Export choices kept under a name ("For the publisher", "For print"), in the project.
  // svelte-ignore state_referenced_locally
  let profiles = $state<Record<string, ExportProfile>>(structuredClone($state.snapshot(project.settings.export.profiles)));
  let profileName = $state("");
  const present = (): ExportProfile => ({ format, cover: useCover, docx: $state.snapshot(options) });
  /** The saved profile the page shows now, unchanged; "" when the choices differ from every one. */
  const currentProfile = $derived.by(() => {
    const now = JSON.stringify(present());
    return Object.keys(profiles).find((name) => JSON.stringify(profiles[name]) === now) ?? "";
  });
  function applyProfile(name: string) {
    const saved = profiles[name];
    if (!saved) return;
    // A saved profile comes with its own headings and margins: nothing to follow.
    followed = defaultHeadings(saved.docx, parts);
    followedMargins = defaultMargins(saved.docx);
    options = structuredClone($state.snapshot(saved.docx));
    format = saved.format === "pdf" && !inTauri() && project.fs instanceof BrowserFs ? "docx" : saved.format;
    useCover = saved.cover;
    profileName = name;
  }
  function saveProfile() {
    const name = profileName.trim();
    if (name) profiles = { ...profiles, [name]: present() };
  }
  function deleteProfile(name: string) {
    const { [name]: _gone, ...rest } = profiles;
    profiles = rest;
    if (profileName === name) profileName = "";
  }

  const FORMATS: Record<ExportFormat, { ext: string; name: string; mime: string }> = {
    docx: { ext: "docx", name: "Word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    pdf: { ext: "pdf", name: "PDF", mime: "application/pdf" },
    epub: { ext: "epub", name: "EPUB", mime: "application/epub+zip" },
    md: { ext: "md", name: "Markdown", mime: "text/markdown" },
  };
  /** The pages of the section: short ones, chosen from the list on the left, as in the Settings. */
  type PageId = "format" | "page" | "structure" | "gamebook" | "typography" | "paratext";
  const PAGE_TITLES: Record<PageId, MessageKey> = {
    format: "export.pageFormat",
    page: "export.pageLayout",
    structure: "export.structure",
    gamebook: "export.gamebook",
    typography: "export.typography",
    paratext: "export.paratext",
  };
  const pages = $derived<PageId[]>(["format", "page", ...(!gamebook ? ["structure" as const] : format === "docx" || format === "pdf" ? ["gamebook" as const] : []), "typography", "paratext"]);
  let chosenPage = $state<PageId>(lastPage.id);
  const shown = $derived(pages.includes(chosenPage) ? chosenPage : "format");

  // The typography page shows its choices on the first dialogue of the novel itself.
  let spoken = $state<{ text: string; scene: string } | null>(null);
  let searched = false;
  $effect(() => {
    if (shown !== "typography" || searched) return;
    searched = true;
    void (async () => {
      for (const node of scenesOf(project.manuscript).slice(0, 300)) {
        try {
          const text = dialogueSample(cleanSource(splitNote(await project.fs.readText(node.path)).body, revisions));
          if (text) {
            spoken = { text, scene: node.title };
            return;
          }
        } catch {
          // A scene that cannot be read is skipped: the sample is only a preview.
        }
      }
    })();
  });
  $effect(() => {
    lastPage.id = chosenPage;
  });

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
    settings.export.profiles = $state.snapshot(profiles);
    // The default stylesheet is not copied into the project, so later versions of Dante can improve it.
    settings.export.epubCss = epubCss.trim() === EPUB_CSS.trim() ? "" : epubCss;
    settings.structure = $state.snapshot(structure);
    settings.gamebook.export = $state.snapshot(gbx);
    // The estimate of pages follows the export: a new page for each paragraph or not.
    if (settings.gamebook.enabled) settings.gamebook.onePerPage = gbx.separator === "pageBreak";
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
    const timer = setTimeout(() => void persist().catch((e) => (error = failure(e))), 500);
    return () => clearTimeout(timer);
  });

  let message = $state("");
  let error = $state("");
  let busy = $state(false);

  const breaks = $derived([
    ...(project.settings.structure.parts ? [{ key: "partBreak" as const, label: "export.partBreak" as const }] : []),
    { key: "chapterBreak" as const, label: "export.chapterBreak" as const },
    { key: "sceneBreak" as const, label: "export.sceneBreak" as const },
  ]);

  // Where the files go: the export folder, a place chosen in a dialog, or a download.
  // svelte-ignore state_referenced_locally
  const { fileName, destination, save, root } = exportSaver(project, () => FORMATS[format]);

  let saved = $state<Saved | null>(null);

  const fail = (e: unknown) => (error = failure(e));

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
      // In a gamebook what parts the paragraphs is chosen in its own section.
      const gx = project.settings.gamebook.export;
      const layout = gamebook ? { ...project.settings.export.docx, sceneBreak: gx.separator, sceneSeparator: gx.symbol, lineSign: "\\n" } : project.settings.export.docx;
      // The title page and the summary give the length in the unit the project measures in.
      const inCharacters = project.settings.goals.unit === "characters";
      const labels = { words: t("export.words"), length: inCharacters ? `${approxWords(book.characters, book.language)} ${t("export.characters")}` : undefined };
      const pages = num(pageCount(book, project.settings.pages), 1);
      const withCover = useCover && format !== "md";
      const photo = withCover ? await coverPicture(project.fs, project.settings.cover) : "";
      // With a picture the texts are drawn apart and laid over it, as a PNG or by Typst.
      const cover = withCover ? coverSvg(project.settings, project.settings.cover, photo ? { url: photo, textOnly: true } : undefined) : "";
      /** The whole cover in one SVG, for where the picture cannot be drawn apart. */
      const wholeCover = photo ? coverSvg(project.settings, project.settings.cover, { url: photo }) : cover;
      // Typst reads the picture from the project's folder when it can, else takes it inside the SVG.
      const typstWithCover = () =>
        photo && typstImage(project.settings.cover.image ?? "") ? bookToTypst(book, layout, labels, cover, project.settings.cover.image) : bookToTypst(book, layout, labels, wholeCover);
      let where: Saved | "" | null;
      if (format === "docx") {
        where = await save(await docxBytes(bookToDocx(book, layout, labels, (cover && (await coverPng(cover, photo))) || undefined)), elsewhere);
      } else if (format === "md") {
        where = await save(bookToMarkdown(book, layout), elsewhere);
      } else if (format === "epub") {
        const png = cover ? await coverPng(cover, photo) : null;
        const image = png ? { data: png, mediaType: "image/png" as const } : cover ? { data: wholeCover, mediaType: "image/svg+xml" as const } : undefined;
        where = await save(bookToEpub(book, layout, epubId, new Date(), epubCss, image), elsewhere);
      } else if (desktop) {
        // Typst, inside the app, turns the source into the PDF at the chosen path. Files the
        // text refers to are looked up in the project's folder; the sample project has none.
        const source = typstWithCover();
        where = await destination(elsewhere);
        if (where) {
          if (where.relative) await project.fs.mkdir(EXPORT_FOLDER);
          const { invoke } = await import("@tauri-apps/api/core");
          const typstRoot = root || where.absolute.replace(/[\\/][^\\/]*$/, "") || "/";
          await invoke("compile_pdf", { root: typstRoot, source, output: where.absolute });
        }
      } else {
        // Only the desktop app compiles PDFs; a browser gets the Typst source.
        where = await save(typstWithCover(), elsewhere, fileName("typ"), "text/plain");
        if (where !== null) {
          message = t("export.pdfBrowser");
          return;
        }
      }
      if (where !== null) {
        saved = where || null;
        message = inCharacters ? t("export.doneCharacters", { characters: num(book.characters), pages }) : t("export.done", { words: num(book.words), pages });
      }
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="export">
  <nav class="sections" aria-label={t("export.title")}>
    {#each pages as id (id)}
      <button type="button" class="item" data-export={id} aria-current={shown === id ? "page" : undefined} onclick={() => (chosenPage = id)}>{t(PAGE_TITLES[id])}</button>
    {/each}
  </nav>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void run();
    }}
  >
    <div class="page">
    <div class="fields">
    <header>
      <h2>{t(PAGE_TITLES[shown])}{#if shown === "typography"} <HelpLink chapter="export" />{/if}</h2>
      <span class="scope">{t("export.title")} · {t(`export.format.${format}`)}</span>
    </header>
    {#if shown === "format"}
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
    {/if}
    <label
      >{t("export.revisions")}
      <select bind:value={revisions}>
        <option value="accept">{t("export.accept")}</option>
        <option value="reject">{t("export.reject")}</option>
      </select>
    </label>
    <h4>{t("export.savedTitle")}</h4>
    <div class="profiles">
      <label
        >{t("export.saved")}
        <select aria-label={t("export.saved")} value={currentProfile} onchange={(e) => applyProfile(e.currentTarget.value)}>
          <option value="">{Object.keys(profiles).length ? t("export.savedChanged") : t("export.savedNone")}</option>
          {#each Object.keys(profiles) as name (name)}<option value={name}>{name}</option>{/each}
        </select>
      </label>
      <label
        >{t("export.savedName")}
        <input bind:value={profileName} placeholder={t("export.savedPlaceholder")} />
      </label>
      <button type="button" disabled={!profileName.trim() || currentProfile === profileName.trim()} onclick={saveProfile}>{t("export.savedSave")}</button>
      {#if currentProfile}<button type="button" onclick={() => deleteProfile(currentProfile)}>{t("export.savedDelete")}</button>{/if}
    </div>
    <p class="hint">{t("export.savedHint")}</p>
    {#if folder}<p class="hint">{t("export.folderHint")}</p>{/if}
    {#if web}<p class="hint">{t("export.folderWeb", { path: whereIs(project.fs, EXPORT_FOLDER) })} {t("export.noPdfWeb")}</p>{/if}
    {:else if shown === "page"}
    {#if format === "docx" || format === "pdf"}
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
        <input type="number" min={LINE_SPACING.min} max={LINE_SPACING.max} step="0.01" bind:value={options.lineSpacing} />
      </label>
      {#if !gamebook}<label>{t("export.indent")} <input type="number" min="0" max="3" step="0.01" bind:value={options.indent} /></label>{/if}
    </div>
    <p class="hint">{t("export.lineSpacingHint")}</p>
    <fieldset class="margins">
      <legend>{t("export.margins")}</legend>
      <div class="row four">
        {#each SIDES as side (side)}
          <label>{t(SIDE_LABELS[side])} <input type="number" min="0.5" max="10" step="0.01" bind:value={options.margins[side]} /></label>
        {/each}
      </div>
      {#if marginsChanged}<button type="button" class="link" onclick={() => (options.margins = { ...usualMargins })}>{t("export.marginsReset")}</button>{/if}
    </fieldset>
    <label class="check"><input type="checkbox" bind:checked={options.header} /> {t("export.header")}</label>
    {/if}
    <label class="check"><input type="checkbox" bind:checked={options.titlePage} /> {t("export.titlePage")}</label>
    {#if (format === "docx" || format === "pdf") && !gamebook}
      <label class="check"><input type="checkbox" bind:checked={options.toc} /> {t("export.toc")}</label>
      {#if options.toc && format === "docx"}<p class="hint">{t("export.tocWordHint")}</p>{/if}
    {/if}
    {#if format !== "md"}
      <div class="cover">
        <img src={coverUrl} alt={t("cover.preview")} />
        <div>
          <label class="check"><input type="checkbox" bind:checked={useCover} /> {t("export.cover")}</label>
          <p class="hint">{t("export.coverHint")}</p>
        </div>
      </div>
    {/if}
    {#if format === "epub"}
      <label
        >{t("export.epubCss")}
        <textarea class="code" rows="14" spellcheck="false" bind:value={epubCss}></textarea>
      </label>
      <p class="hint">
        {t("export.epubCssHint")}
        {#if epubCss.trim() !== EPUB_CSS.trim()}<button type="button" class="link" onclick={() => (epubCss = EPUB_CSS)}>{t("export.epubCssReset")}</button>{/if}
      </p>
    {/if}
    {#if format === "md"}<p class="hint">{t("export.mdPageHint")}</p>{/if}
    {:else if shown === "gamebook"}
      <p class="hint">{t("export.gamebookHint")}</p>
      <div class="row">
        <label
          >{t("export.gb.heading")}
          <select bind:value={gbx.heading}>
            <option value="number">{t("export.gb.headingNumber")}</option>
            <option value="numberTitle">{t("export.gb.headingTitle")}</option>
          </select>
        </label>
        <label>{t("export.gb.prefix")} <input class="short" bind:value={gbx.prefix} placeholder="§ " /></label>
        <label
          >{t("export.gb.align")}
          <select bind:value={gbx.align}>
            <option value="center">{t("export.gb.center")}</option>
            <option value="left">{t("export.gb.left")}</option>
          </select>
        </label>
        <label>{t("export.gb.size")} <input class="short" type="number" min="6" max="72" bind:value={gbx.size} /></label>
      </div>
      <div class="row">
        <label
          >{t("export.gb.separator")}
          <select bind:value={gbx.separator}>
            <option value="pageBreak">{t("export.gb.separatorPage")}</option>
            <option value="blankLine">{t("export.gb.separatorBlank")}</option>
            <option value="characters">{t("export.gb.separatorSymbol")}</option>
          </select>
        </label>
        {#if gbx.separator === "characters"}<label>{t("export.gb.symbol")} <input class="short" bind:value={gbx.symbol} /></label>{/if}
        <label
          >{t("export.gb.boxes")}
          <select bind:value={gbx.boxes}>
            <option value="color">{t("export.gb.boxesColor")}</option>
            <option value="gray">{t("export.gb.boxesGray")}</option>
            <option value="none">{t("export.gb.boxesNone")}</option>
          </select>
        </label>
      </div>
      <p class="sub">{t("export.gb.text")}</p>
      <div class="row">
        <label
          >{t("export.gb.justify")}
          <select bind:value={gbx.justify}>
            <option value={true}>{t("export.gb.justified")}</option>
            <option value={false}>{t("export.gb.ragged")}</option>
          </select>
        </label>
        <label>{t("export.gb.indent")} <input class="short" type="number" min="0" max="5" step="0.1" bind:value={gbx.indent} /></label>
        <label>{t("export.gb.spacing")} <input class="short" type="number" min="0" max="48" step="1" bind:value={gbx.spacing} /></label>
        <label>{t("export.gb.boxSize")} <input class="short" type="number" min="0" max="48" step="0.5" bind:value={gbx.boxSize} /></label>
      </div>
      <p class="sub">{t("export.gb.number")}</p>
      <label class="check"><input type="checkbox" bind:checked={gbx.numberBold} /> {t("export.gb.numberBold")}</label>
      <label class="check"><input type="checkbox" bind:checked={gbx.numberItalic} /> {t("export.gb.numberItalic")}</label>
      <div class="field">
        <span class="label">{t("export.gb.numberFont")}</span>
        <FontPicker bind:value={gbx.numberFont} />
      </div>
      <p class="hint">{t("export.gb.textHint")}</p>
      <label class="check"><input type="checkbox" bind:checked={gbx.links} /> {t("export.gb.links")}</label>
      <label class="check"><input type="checkbox" bind:checked={gbx.bold} /> {t("export.gb.bold")}</label>
      <p class="hint">{t("export.gb.linksHint")}</p>
      {#if problems.length}
        <div class="problems" role="alert">
          <strong>{t("export.gamebookProblems", { n: problems.length })}</strong>
          <ul>
            {#each problems.slice(0, 30) as x (x.path)}
              <li>
                <button type="button" class="link" onclick={() => nav?.open(x.path)}>{x.number} · {x.title}</button>:
                {x.warnings.map((w) => t(`gamebook.warning.${w}` as MessageKey)).join("; ")}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {:else if shown === "structure"}
    <div class="row">
      {#each breaks as item (item.key)}
        <label
          >{t(item.label)}
          <select bind:value={options[item.key]}>
            <option value="pageBreak">{t("export.breakPage")}</option>
            <option value="blankLine">{t("export.breakBlank")}</option>
            <option value="twoBlankLines">{t("export.breakTwoBlank")}</option>
            <option value="characters">{t("export.breakCharacters")}</option>
            <option value="none">{t("export.breakNone")}</option>
          </select>
        </label>
      {/each}
    </div>
    <div class="separator">
      <label>{t("export.separator")} <input bind:value={options.sceneSeparator} /></label>
      <label class="sign">{t("export.lineSign")} <input bind:value={options.lineSign} maxlength="4" /></label>
    </div>
    <p class="hint">
      {options.lineSign
        ? t("export.separatorHint", { sign: options.lineSign, example: `${options.lineSign}* * *${options.lineSign}` })
        : t("export.separatorNoSign")}
    </p>
    {#if project.settings.structure.parts}
      <fieldset>
        <legend>{t("kind.part")}</legend>
        <HeadingLevel bind:level={structure.part} language={project.settings.language} sample={t("sample.partTitle")} feminine />
        <HeadingFormat bind:style={options.headings.part} usual={usual.part} textFont={options.font} opens />
      </fieldset>
    {/if}
    <fieldset>
      <legend>{t("kind.chapter")}</legend>
      <HeadingLevel bind:level={structure.chapter} language={project.settings.language} sample={t("sample.chapterTitle")} />
      <HeadingFormat bind:style={options.headings.chapter} usual={usual.chapter} textFont={options.font} opens />
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
      {#if options.scene.numbering !== "none" || options.scene.showTitle}
        <HeadingFormat bind:style={options.headings.scene} usual={usual.scene} textFont={options.font} />
      {/if}
    </fieldset>
    {#if format !== "md"}<p class="hint">{t("export.headingsHint")}</p>{/if}
    <p class="hint">{t("export.publishedTitleHint")}</p>
    {:else if shown === "typography"}
    <p class="hint">{t("export.typographyHint")}</p>
    <label
      >{t("export.quotes")}
      <select bind:value={typography.quotes}>
        {#each QUOTE_STYLES as style (style)}
          <option value={style}>{t(`export.quotes.${style}` as MessageKey)}{style === defaultQuotes(project.settings.language) ? ` · ${t("export.quotesUsual")}` : ""}</option>
        {/each}
      </select>
    </label>
    {#if typography.quotes !== "keep" && typography.quotes !== "dash" && typography.quotes !== "dashAttached"}
      <p class="hint">{t("export.quotesMarksHint")}</p>
    {/if}
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
    {:else if shown === "paratext"}
    <p class="hint">{t("export.paratextHint")}</p>
    <label>{t("export.dedication")} <textarea rows="2" bind:value={paratext.dedication}></textarea></label>
    <label>{t("export.epigraph")} <textarea rows="3" bind:value={paratext.epigraph}></textarea></label>
    <label>{t("export.epigraphSource")} <input bind:value={paratext.epigraphSource} /></label>
    <label>{t("export.authorNote")} <textarea rows="4" bind:value={paratext.authorNote}></textarea></label>
    <label>{t("export.acknowledgements")} <textarea rows="4" bind:value={paratext.acknowledgements}></textarea></label>
    <label>{t("export.colophon")} <textarea rows="3" bind:value={paratext.colophon}></textarea></label>
    {/if}
    </div>
    <ExportPreview page={shown} {format} {options} {typography} {paratext} {structure} gamebook={gbx} settings={project.settings} cover={useCover} {coverUrl} dialogue={spoken} />
    </div>
    <footer>
    <div class="actions">
      <button class="primary" type="submit" disabled={busy}>{busy ? t("export.running") : t("export.run", { format: FORMATS[format].name === "Word" ? "DOCX" : FORMATS[format].name })}</button>
      {#if folder}<button type="button" class="link" disabled={busy} onclick={() => run(true)}>{t("export.saveElsewhere")}</button>{/if}
      {#if error}<span class="error" role="alert"><ErrorText text={error} /></span>{/if}
      <span class="grow"></span>
      {#if desktop}<button type="button" onclick={openExports}>{t("export.openExports")}</button>{/if}
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
    </footer>
  </form>
</div>

<style>
  .problems {
    border: 1px solid var(--danger);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
  }
  .problems ul {
    margin: 4px 0 0;
    padding-left: 16px;
  }
  .separator {
    display: flex;
    gap: 8px;
    align-items: end;
  }
  .separator label:first-child {
    flex: 1;
  }
  .separator .sign input {
    width: 4em;
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
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  .sections {
    display: grid;
    align-content: start;
    gap: 1px;
    overflow: auto;
    padding: 16px 12px 24px;
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
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
  form {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
  }
  .page {
    overflow: auto;
    padding: 20px 32px 32px;
  }
  .page {
    display: grid;
    grid-template-columns: minmax(0, 620px) minmax(240px, 1fr);
    gap: 8px 40px;
    align-items: start;
  }
  .page > :global(.preview) {
    position: sticky;
    top: 0;
  }
  @media (max-width: 1150px) {
    .page {
      grid-template-columns: minmax(0, 620px);
    }
    .page > :global(.preview) {
      position: static;
    }
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
  header h2 {
    margin: 0;
  }
  .scope {
    color: var(--text-muted);
    font-size: 13px;
  }
  footer {
    padding: 12px 32px 16px;
    border-top: 1px solid var(--border);
    background: var(--bg-panel);
  }
  footer .actions {
    margin-top: 0;
  }
  .grow {
    flex: 1;
  }
  footer .success {
    max-width: 620px;
    margin-top: 12px;
  }
  @media (max-width: 760px) {
    .export {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }
    .sections {
      display: flex;
      flex-wrap: wrap;
      border-right: none;
      border-bottom: 1px solid var(--border);
      padding: 8px 12px;
    }
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
  .sub {
    margin: 8px 0 0;
    font-weight: 600;
    font-size: 13px;
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
  input.short {
    width: 5em;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .row.four {
    grid-template-columns: repeat(4, 1fr);
  }
  .margins .link {
    display: inline-block;
    width: auto;
    margin-top: 8px;
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
  .profiles {
    margin-bottom: 6px;
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 8px 12px;
  }
  .profiles label {
    display: grid;
    gap: 4px;
    flex: 1 1 180px;
    margin: 0;
  }
</style>
