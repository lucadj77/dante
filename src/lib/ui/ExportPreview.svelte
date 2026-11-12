<script lang="ts">
  // The small pictures beside the pages of the Export section: they are drawn from the choices
  // on the left as they change, so each choice shows what it does before the book is made.
  import { levelHeading } from "$lib/core/numbering";
  import {
    PAGE_SIZES,
    separatorParts,
    type DocxSettings,
    type ExportFormat,
    type GamebookExportSettings,
    type HeadingKind,
    type NovelSettings,
    type ParatextSettings,
    type Separator,
    type TypographySettings,
  } from "$lib/core/settings";
  import { applyTypography } from "$lib/core/typography";
  import { t } from "$lib/state.svelte";

  interface Props {
    page: "format" | "page" | "structure" | "gamebook" | "typography" | "paratext";
    format: ExportFormat;
    options: DocxSettings;
    typography: TypographySettings;
    paratext: ParatextSettings;
    structure: NovelSettings["structure"];
    gamebook: GamebookExportSettings;
    settings: NovelSettings;
    cover: boolean;
    coverUrl: string;
    /** The first dialogue of the novel and the scene it comes from; null while none was found. */
    dialogue: { text: string; scene: string } | null;
  }
  let p: Props = $props();

  const italian = $derived(p.settings.language.startsWith("it"));
  const author = $derived(p.settings.authors?.[0] ?? "");

  // The sheet: 270 pixels wide whatever the paper, so sizes in points and centimetres keep their proportions.
  const WIDTH = 270;
  const size = $derived(p.options.pageSize === "custom" ? [Number(p.options.pageWidth) || 21, Number(p.options.pageHeight) || 29.7] : (PAGE_SIZES[p.options.pageSize] ?? PAGE_SIZES.a4));
  const perCm = $derived(WIDTH / size[0]);
  const perPt = $derived((perCm * 2.54) / 72);
  const typeset = $derived(p.options.profile === "typeset");
  const paged = $derived(p.format === "docx" || p.format === "pdf");

  const chapter = $derived(levelHeading(p.structure.chapter, 1, t("sample.chapterTitle"), p.settings.language).text);
  const chapter2 = $derived(levelHeading(p.structure.chapter, 2, t("sample.chapterTitle2"), p.settings.language).text);
  const part = $derived(p.structure.parts ? levelHeading(p.structure.part, 1, t("sample.partTitle"), p.settings.language, true).text : "");
  const scene = (n: number, title: string) => levelHeading(p.options.scene, n, title, p.settings.language, true).text;
  const lines = (text: string) => text.split("\n");

  const SAMPLE = $derived(
    italian
      ? [
          "Il telefono squillò alle tre del mattino. Nessuno chiama a quell'ora con buone notizie, e Anna lo sapeva meglio di chiunque altro in quella casa.",
          "Rimase a guardare lo schermo che si illuminava nel buio, contò fino a cinque e poi rispose. Dall'altra parte, per un momento, ci fu soltanto il rumore del vento.",
        ]
      : [
          "The telephone rang at three in the morning. Nobody calls at that hour with good news, and Anna knew it better than anyone else in that house.",
          "She watched the screen light up in the dark, counted to five and then answered. At the other end, for a moment, there was only the sound of the wind.",
        ],
  );
  const RAW = $derived(
    italian ? `"E' tardi" disse Anna...  Nessuno rispose .\n"Non c'e' piu' tempo", aggiunse piano.` : `"It's late" said Anna...  Nobody answered .\n"There's no time left", she added quietly.`,
  );
  const written = $derived(p.dialogue?.text ?? RAW);
  const typed = $derived(applyTypography(written, p.typography));

  // Titles in the outline: 11 pixels stand for the size of the text, so sizes and spaces keep their proportions.
  const perTextPt = $derived(11 / (Number(p.options.fontSize) || 12));
  const look = (kind: HeadingKind) => {
    const h = p.options.headings[kind];
    return [
      `font-family: ${JSON.stringify(h.font || p.options.font)}, Georgia, serif`,
      `font-size: ${Math.min(30, h.size * perTextPt).toFixed(1)}px`,
      `text-align: ${h.align}`,
      `font-weight: ${h.bold ? 700 : 400}`,
      `font-style: ${h.italic ? "italic" : "normal"}`,
      `text-transform: ${h.uppercase ? "uppercase" : "none"}`,
      `letter-spacing: 0`,
      `line-height: ${(h.lineSpacing * 1.15).toFixed(2)}`,
      `margin: ${Math.min(40, h.before * perTextPt * 0.5).toFixed(1)}px 0 ${Math.min(40, h.after * perTextPt * 0.5).toFixed(1)}px`,
    ].join("; ");
  };

  // The chapter heading on the sheet, at the scale of the sheet.
  const sheetHeading = $derived.by(() => {
    const h = p.options.headings.chapter;
    return [
      `font-family: ${JSON.stringify(h.font || p.options.font)}`,
      `font-size: ${(h.size * perPt).toFixed(2)}px`,
      `text-align: ${h.align}`,
      `font-weight: ${h.bold ? 700 : 400}`,
      `font-style: ${h.italic ? "italic" : "normal"}`,
      `text-transform: ${h.uppercase ? "uppercase" : "none"}`,
      `line-height: ${(h.lineSpacing * 1.15).toFixed(2)}`,
      `margin: ${(h.before * perPt).toFixed(1)}px 0 ${(h.after * perPt).toFixed(1)}px`,
    ].join("; ");
  });

  /** What a break between two pieces looks like: a new page, empty lines or the writer's signs. */
  function gap(kind: Separator): { page: boolean; empty: number; signs: string[] } {
    if (kind === "pageBreak") return { page: true, empty: 0, signs: [] };
    if (kind === "blankLine") return { page: false, empty: 1, signs: [] };
    if (kind === "twoBlankLines") return { page: false, empty: 2, signs: [] };
    if (kind === "characters") {
      const parts = separatorParts(p.options.sceneSeparator, p.options.lineSign);
      return { page: false, empty: 0, signs: parts.lines.length ? parts.lines : [""] };
    }
    return { page: false, empty: 0, signs: [] };
  }

  const pieces = $derived([
    { name: t("export.pieceCover"), on: p.cover && p.format !== "md" },
    { name: t("export.titlePage"), on: p.options.titlePage },
    { name: t("export.dedication"), on: !!p.paratext.dedication.trim() },
    { name: t("export.epigraph"), on: !!p.paratext.epigraph.trim() },
    { name: t("export.toc"), on: p.options.toc && paged },
    { name: t("export.pieceText"), on: true, main: true },
    { name: t("export.authorNote"), on: !!p.paratext.authorNote.trim() },
    { name: t("export.acknowledgements"), on: !!p.paratext.acknowledgements.trim() },
    { name: t("export.colophon"), on: !!p.paratext.colophon.trim() },
  ]);
</script>

{#snippet separator(kind: Separator)}
  {@const g = gap(kind)}
  {#if g.page}<div class="newpage"><span>{t("export.previewNewPage")}</span></div>{/if}
  {#each Array(g.empty) as _, i (i)}<div class="empty"></div>{/each}
  {#each g.signs as sign, i (i)}<div class="signs">{sign}</div>{/each}
{/snippet}

<aside class="preview" aria-label={t("export.preview")}>
  <span class="caption">{t("export.preview")}</span>
  {#if p.page === "format" || p.page === "page"}
    {#if p.format === "md"}
      <pre class="markdown">{`---\ntitle: ${p.settings.title}\n---\n\n# ${chapter}\n\n${SAMPLE[0]}\n\n${SAMPLE[1]}`}</pre>
    {:else if p.format === "epub"}
      <div class="reader">
        {#if p.cover}<img src={p.coverUrl} alt="" />{:else}
          <div class="screen">
            <div class="heading">{#each lines(chapter) as line, i (i)}<div>{line}</div>{/each}</div>
            {#each SAMPLE as text, i (i)}<p class:first={i === 0}>{text}</p>{/each}
          </div>
        {/if}
      </div>
      <span class="note">{t("export.previewEpub")}</span>
    {:else}
      <div
        class="sheet"
        style:width="{WIDTH}px"
        style:height="{size[1] * perCm}px"
        style:padding="{2.5 * perCm}px"
        style:font-family={p.options.font}
        style:font-size="{p.options.fontSize * perPt}px"
        style:line-height={typeset ? Math.max(1.2, p.options.lineSpacing * 1.15) : p.options.lineSpacing * 1.15}
      >
        {#if p.options.header}<div class="running" style:top="{1.2 * perCm}px" style:right="{2.5 * perCm}px" style:left="{2.5 * perCm}px">{typeset ? p.settings.title : `${author} / ${p.settings.title.toUpperCase()} / 1`}</div>{/if}
        <div class="heading" style={sheetHeading}>{#each lines(chapter) as line, i (i)}<div>{line}</div>{/each}</div>
        {#each [...SAMPLE, ...SAMPLE, ...SAMPLE] as text, i (i)}
          <p class:justify={typeset} style:text-indent="{i === 0 && typeset ? 0 : p.options.indent * perCm}px">{text}</p>
        {/each}
      </div>
      <span class="note">{t("export.previewPage", { width: size[0], height: size[1], font: p.options.font, size: p.options.fontSize })}</span>
    {/if}
  {:else if p.page === "structure"}
    <div class="outline">
      {#if part}
        <div class="part" style={look("part")}>{#each lines(part) as line, i (i)}<div>{line}</div>{/each}</div>
        {@render separator(p.options.partBreak)}
      {/if}
      <div class="chapter" style={look("chapter")}>{#each lines(chapter) as line, i (i)}<div>{line}</div>{/each}</div>
      {#if scene(1, t("sample.sceneTitle"))}<div class="scene" style={look("scene")}>{#each lines(scene(1, t("sample.sceneTitle"))) as line, i (i)}<div>{line}</div>{/each}</div>{/if}
      <i></i><i></i><i class="short"></i>
      {@render separator(p.options.sceneBreak)}
      {#if scene(2, t("sample.sceneTitle2"))}<div class="scene" style={look("scene")}>{#each lines(scene(2, t("sample.sceneTitle2"))) as line, i (i)}<div>{line}</div>{/each}</div>{/if}
      <i></i><i class="short"></i>
      {@render separator(p.options.chapterBreak)}
      <div class="chapter" style={look("chapter")}>{#each lines(chapter2) as line, i (i)}<div>{line}</div>{/each}</div>
      <i></i><i class="short"></i>
    </div>
  {:else if p.page === "gamebook"}
    <div class="outline">
      {#each [[12, t("sample.sceneTitle")], [13, t("sample.sceneTitle2")]] as [n, title], i (n)}
        {#if i > 0}
          {#if p.gamebook.separator === "pageBreak"}<div class="newpage"><span>{t("export.previewNewPage")}</span></div>
          {:else if p.gamebook.separator === "characters"}<div class="signs">{p.gamebook.symbol}</div>
          {:else}<div class="empty"></div>{/if}
        {/if}
        <div class="number" style:text-align={p.gamebook.align} style:font-weight={p.gamebook.numberBold ? 700 : 400} style:font-style={p.gamebook.numberItalic ? "italic" : "normal"} style:font-family={p.gamebook.numberFont || null}>
          {p.gamebook.prefix}{n}{p.gamebook.heading === "numberTitle" ? ` · ${title}` : ""}
        </div>
        <i></i><i></i>
        <div class="goto" class:bold={p.gamebook.bold} class:link={p.gamebook.links}>{italian ? "vai al" : "turn to"} <b>{Number(n) + 9}</b></div>
        {#if i === 0 && p.gamebook.boxes !== "none"}<div class="box" class:gray={p.gamebook.boxes === "gray"}><i></i><i class="short"></i></div>{/if}
      {/each}
    </div>
  {:else if p.page === "typography"}
    <div class="compare">
      <span class="label">{t("export.previewWritten")}</span>
      <p class="raw">{written}</p>
      <span class="label">{t("export.previewBook")}</span>
      <p class="made">{typed}</p>
    </div>
    <span class="note">{p.dialogue ? t("export.previewDialogue", { scene: p.dialogue.scene }) : t("export.previewNoDialogue")}</span>
  {:else}
    <ol class="pieces">
      {#each pieces as piece (piece.name)}
        <li class:off={!piece.on} class:main={piece.main}>{piece.name}</li>
      {/each}
    </ol>
    <span class="note">{t("export.previewPieces")}</span>
  {/if}
</aside>

<style>
  .preview {
    display: grid;
    gap: 8px;
    justify-items: start;
    align-content: start;
    min-width: 0;
  }
  .caption {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .note {
    max-width: 260px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .sheet {
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
    background: #fff;
    color: #1d1d1d;
    border-radius: 2px;
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 8%),
      0 2px 8px rgb(0 0 0 / 18%);
  }
  .sheet p {
    margin: 0;
  }
  .sheet p.justify {
    text-align: justify;
  }
  .sheet .heading {
    margin-bottom: 1.2em;
    text-align: center;
    font-weight: 700;
  }
  .running {
    position: absolute;
    font-size: 0.8em;
    line-height: 1;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    opacity: 0.7;
  }
  .reader {
    width: 170px;
    aspect-ratio: 3 / 4.2;
    padding: 12px 10px 20px;
    box-sizing: border-box;
    border-radius: 12px;
    background: #2a2a2e;
  }
  .reader img,
  .reader .screen {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border-radius: 2px;
    object-fit: cover;
    background: #f4f1ea;
  }
  .reader .screen {
    overflow: hidden;
    padding: 10px 9px;
    font-family: Georgia, serif;
    font-size: 8px;
    line-height: 1.45;
    color: #1d1d1d;
  }
  .screen .heading {
    margin-bottom: 8px;
    text-align: center;
    font-weight: 700;
    font-size: 10px;
  }
  .screen p {
    margin: 0;
    text-indent: 1.2em;
    text-align: justify;
  }
  .screen p.first {
    text-indent: 0;
  }
  .markdown {
    width: 260px;
    max-width: 100%;
    margin: 0;
    padding: 10px 12px;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--editor-bg);
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .outline {
    display: grid;
    gap: 5px;
    width: 250px;
    max-width: 100%;
    padding: 16px 18px;
    box-sizing: border-box;
    background: #fff;
    color: #1d1d1d;
    border-radius: 2px;
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 8%),
      0 2px 8px rgb(0 0 0 / 18%);
    font-family: Georgia, serif;
  }
  .outline i {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: #c9c9c9;
  }
  .outline i.short {
    width: 60%;
  }
  .part {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .chapter {
    margin: 4px 0;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
  }
  .scene {
    font-size: 12px;
    font-style: italic;
  }
  .empty {
    height: 10px;
  }
  .signs {
    text-align: center;
    font-size: 12px;
    min-height: 10px;
  }
  .newpage {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px -18px;
    font: 10px/1 Inter, system-ui, sans-serif;
    color: #8a8a8a;
  }
  .newpage::before,
  .newpage::after {
    content: "";
    flex: 1;
    border-top: 1px dashed #b5b5b5;
  }
  .number {
    font-size: 15px;
  }
  .goto {
    font-size: 11px;
  }
  .goto b {
    font-weight: 400;
  }
  .goto.bold b {
    font-weight: 700;
  }
  .goto.link b {
    color: #2f5f9e;
    text-decoration: underline;
  }
  .box {
    display: grid;
    gap: 5px;
    padding: 8px;
    border: 1px solid #d39a2b;
    border-radius: 4px;
    background: #fbf3e0;
  }
  .box.gray {
    border-color: #999;
    background: #eee;
  }
  .compare {
    display: grid;
    gap: 4px;
    width: 280px;
    max-width: 100%;
  }
  .compare .label {
    font-size: 12px;
    color: var(--text-muted);
  }
  .compare p {
    margin: 0 0 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    white-space: pre-wrap;
    font-size: 14px;
    line-height: 1.5;
  }
  .compare .raw {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--text-muted);
  }
  .compare .made {
    font-family: Georgia, serif;
    background: var(--editor-bg);
  }
  .pieces {
    display: grid;
    gap: 4px;
    width: 220px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pieces li {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--editor-bg);
    font-size: 13px;
  }
  .pieces li.main {
    padding: 18px 10px;
    font-weight: 600;
  }
  .pieces li.off {
    border-style: dashed;
    background: none;
    color: var(--text-muted);
    opacity: 0.6;
  }
</style>
