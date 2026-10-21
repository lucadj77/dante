<script lang="ts">
  import type { Snippet } from "svelte";
  import type { DocxContent } from "$lib/core/import/docx";
  import {
    counts,
    headingLevels,
    plainText,
    SCENE_BREAK,
    similar,
    structure,
    type BlankLines,
    type BlockRole,
    type HeadingRole,
    type ImportedBook,
    type Mark,
  } from "$lib/core/import/structure";
  import { num, t } from "$lib/state.svelte";
  import type { MessageKey } from "$lib/i18n/en";

  interface Props {
    content: DocxContent;
    fileName: string;
    /** What each heading level becomes. */
    roles: Record<number, HeadingRole>;
    /** How many empty paragraphs in a row start a new scene. */
    blanks: BlankLines;
    /** What the writer said single blocks are, by their place in the document. */
    marks: Record<number, Mark>;
    /** The label of the button that goes on with the book as shown. */
    action: string;
    busy?: boolean;
    error?: string;
    onDone: (book: ImportedBook) => void;
    onCancel: () => void;
    /** Choices shown above the buttons, such as where the book goes. */
    footer?: Snippet<[ImportedBook]>;
  }
  let { content, fileName, roles = $bindable(), blanks = $bindable(), marks = $bindable(), action, busy = false, error = "", onDone, onCancel, footer }: Props =
    $props();

  const ROLES: HeadingRole[] = ["part", "chapter", "scene", "text"];
  const MARKS: Mark[] = ["part", "chapter", "scene", "break", "text", "skip"];
  const levels = $derived(headingLevels(content.blocks));
  const hasBlanks = $derived(content.blocks.some((b) => b.kind === "paragraph" && b.text === ""));
  const book = $derived(structure(content.blocks, { start: t("untitled"), scene: (n) => t("import.scene", { n }) }, content.title, roles, blanks, marks));
  const total = $derived(counts(book));
  const blockRoles = $derived<BlockRole[]>(book.blocks ?? []);

  /** The line clicked last, and the lines like it. */
  let selected = $state<number | null>(null);
  let withSimilar = $state(true);
  const alike = $derived(selected === null ? [] : similar(content.blocks, selected));

  /** The words of a block, short enough for one line or two. */
  function preview(i: number): string {
    const raw = content.blocks[i].text;
    // A line of marks such as "* * *" would lose them as emphasis.
    const text = SCENE_BREAK.test(raw) ? raw.trim() : plainText(raw);
    return text.length > 220 ? text.slice(0, 220) + "…" : text;
  }

  function words(text: string): number {
    return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  }

  function choose(mark: Mark | null) {
    if (selected === null) return;
    const targets = withSimilar && alike.length > 1 ? alike : [selected];
    const next = { ...marks };
    for (const i of targets) {
      if (mark) next[i] = mark;
      else delete next[i];
    }
    marks = next;
  }

  /** Shows a block in the document column and selects it. */
  function show(at: number | undefined) {
    if (at === undefined) return;
    selected = at;
    document.getElementById(`import-block-${at}`)?.scrollIntoView({ block: "center" });
  }

  const badges: Partial<Record<BlockRole, MessageKey>> = {
    title: "import.badge.title",
    part: "import.badge.part",
    chapter: "import.badge.chapter",
    scene: "import.badge.scene",
    break: "import.badge.break",
    heading: "import.badge.heading",
    skip: "import.badge.skip",
  };
</script>

<div class="overlay" role="presentation">
  <div class="dialog" role="dialog" aria-modal="true" aria-label={t("import.preview.title", { file: fileName })} tabindex="-1" onkeydown={(e) => e.key === "Escape" && onCancel()}>
    <header>
      <h2>{t("import.preview.title", { file: fileName })}</h2>
      <p class="summary">
        {#if total.parts}{t("import.parts", { n: total.parts })},{/if}
        {t("import.counts", { chapters: total.chapters, scenes: total.scenes, words: num(total.words) })}
      </p>
      <p class="note">{t("import.preview.how")}</p>
    </header>

    {#if levels.length || hasBlanks}
      <div class="rules">
        {#each levels as level (level.level)}
          <label>
            <span class="examples" title={level.examples.join(" · ")}>{t("import.level", { n: level.level, count: level.count })}: {level.examples.join(" · ")}</span>
            <select bind:value={roles[level.level]}>
              {#each ROLES as role (role)}
                <option value={role}>{t(`import.role.${role}`)}</option>
              {/each}
            </select>
          </label>
        {/each}
        {#if hasBlanks}
          <label>
            <span class="examples">{t("import.blanks")}</span>
            <select bind:value={blanks}>
              <option value={1}>{t("import.blanks.one")}</option>
              <option value={2}>{t("import.blanks.two")}</option>
              <option value={0}>{t("import.blanks.none")}</option>
            </select>
          </label>
        {/if}
      </div>
    {/if}

    <div class="columns">
      <section class="document" aria-label={t("import.preview.document")}>
        <h3>{t("import.preview.document")}</h3>
        {#if selected !== null}
          <div class="chooser" role="group" aria-label={t("import.selected")}>
            <span class="what">{t("import.selected")} <q>{preview(selected).slice(0, 60)}</q></span>
            <div class="choices">
              {#each MARKS as mark (mark)}
                <button aria-pressed={marks[selected] === mark} disabled={busy} onclick={() => choose(mark)}>{t(`import.mark.${mark}`)}</button>
              {/each}
              {#if marks[selected]}
                <button disabled={busy} onclick={() => choose(null)}>{t("import.mark.auto")}</button>
              {/if}
            </div>
            {#if alike.length > 1}
              <label class="check"><input type="checkbox" bind:checked={withSimilar} /> {t("import.similar", { n: alike.length - 1 })}</label>
            {/if}
          </div>
        {/if}
        <ol class="blocks">
          {#each content.blocks as block, i (i)}
            {@const role = blockRoles[i] ?? "text"}
            {#if role === "blank" && !marks[i]}
              <li class="blank" aria-hidden="true"></li>
            {:else}
              <li id="import-block-{i}">
                <button
                  class="block {role}"
                  class:selected={selected === i}
                  class:alike={selected !== i && withSimilar && alike.includes(i)}
                  class:empty={!block.text}
                  onclick={() => (selected = i)}
                >
                  {#if badges[role]}<span class="badge">{t(badges[role]!)}{#if marks[i]}<span class="mine" title={t("import.byYou")}> •</span>{/if}</span>{/if}
                  <span class="text">{preview(i) || "¶"}</span>
                </button>
              </li>
            {/if}
          {/each}
        </ol>
      </section>

      <section class="result" aria-label={t("import.preview.result")}>
        <h3>{t("import.preview.result")}</h3>
        <ol class="outline">
          {#each book.parts as part, p (p)}
            {#if book.hasParts && part.title}
              <li class="part"><button onclick={() => show(part.at)}>{t("import.badge.part")}: {part.title}</button></li>
            {/if}
            {#each part.chapters as chapter, c (c)}
              <li class="chapter">
                <button onclick={() => show(chapter.at ?? chapter.scenes[0]?.at)}>
                  <span class="name">{chapter.title}</span>
                  <span class="muted">{t("import.chapterInfo", { scenes: chapter.scenes.length, words: num(chapter.scenes.reduce((n, s) => n + words(s.text), 0)) })}</span>
                </button>
                <ol>
                  {#each chapter.scenes as scene, s (s)}
                    <li class="scene">
                      <button onclick={() => show(scene.at)}>
                        <span class="name">{scene.title}</span>
                        <span class="muted">{plainText(scene.text.split("\n")[0] ?? "").slice(0, 60) || "—"} · {t("import.words", { n: num(words(scene.text)) })}</span>
                      </button>
                    </li>
                  {/each}
                </ol>
              </li>
            {/each}
          {/each}
        </ol>
      </section>
    </div>

    <footer>
      <p class="note small">{t("import.how")}</p>
      {#if footer}{@render footer(book)}{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions">
        <button class="primary" disabled={busy} onclick={() => onDone(book)}>{action}</button>
        <button disabled={busy} onclick={onCancel}>{t("welcome.cancel")}</button>
      </div>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    display: grid;
    place-items: center;
    z-index: 40;
  }
  .dialog {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(1100px, calc(100vw - 32px));
    height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 20px;
    text-align: left;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 4px;
  }
  h3 {
    font-size: 13px;
    margin: 0 0 6px;
    color: var(--text-muted);
    font-weight: 600;
  }
  header p {
    margin: 0;
  }
  .summary {
    font-size: 14px;
  }
  .note {
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.45;
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
  .rules {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 6px 16px;
    font-size: 13px;
  }
  .rules label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
  }
  .examples {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .columns {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 16px;
  }
  @media (max-width: 760px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }
  section {
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .blocks,
  .outline {
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  .chooser {
    display: grid;
    gap: 6px;
    padding: 8px;
    margin-bottom: 6px;
    border-radius: 6px;
    background: var(--bg-panel);
    font-size: 13px;
  }
  .what {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .choices button {
    font-size: 12px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
  }
  .block {
    display: flex;
    gap: 8px;
    align-items: baseline;
    width: 100%;
    text-align: left;
    border: 1px solid transparent;
    background: none;
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 13px;
    line-height: 1.4;
  }
  .block:hover {
    background: var(--bg-hover);
  }
  .block.selected {
    border-color: var(--accent);
  }
  .block.alike {
    border-style: dashed;
    border-color: var(--accent);
  }
  .block .text {
    flex: 1;
    min-width: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .block.part .text,
  .block.chapter .text,
  .block.title .text {
    font-weight: 700;
  }
  .block.scene .text {
    font-style: italic;
    font-weight: 600;
  }
  .block.skip .text {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .block.break,
  .block.empty {
    color: var(--text-muted);
  }
  .block.part,
  .block.chapter,
  .block.title {
    margin-top: 10px;
  }
  .badge {
    flex: none;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--accent-text);
  }
  .block.break .badge,
  .block.heading .badge,
  .block.skip .badge {
    background: var(--bg-hover);
    color: var(--text-muted);
  }
  .blank {
    height: 4px;
  }
  .outline button {
    display: grid;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
  }
  .outline button:hover {
    background: var(--bg-hover);
  }
  .outline .part > button {
    font-weight: 700;
    margin-top: 8px;
  }
  .outline .chapter > button .name {
    font-weight: 600;
  }
  .outline .chapter {
    margin-top: 4px;
  }
  .outline .scene {
    padding-left: 14px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  footer {
    display: grid;
    gap: 8px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .error {
    color: var(--danger);
    margin: 0;
  }
</style>
