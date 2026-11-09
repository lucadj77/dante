<script lang="ts">
  // In a gamebook: the paragraph's number, where it comes from, where it leads, and what is
  // wrong with it.
  import { gamebookOf, paragraphMark, type ParagraphMark } from "$lib/core/gamebook/marks";
  import { warnings } from "$lib/core/gamebook/paragraphs";
  import type { Project } from "$lib/core/project";
  import type { MessageKey } from "$lib/i18n";
  import { num, t, tu } from "$lib/state.svelte";
  import { navigator } from "./navigation";

  interface Props {
    project: Project;
    path: string;
    /** Changes whenever the text or the project changes, so the panel reads it again. */
    version: string;
  }
  let p: Props = $props();
  const nav = navigator();

  let mark = $state<ParagraphMark | null>(null);
  let note = $state("");

  $effect(() => {
    void p.version;
    const path = p.path;
    void p.project.index().then((notes) => {
      if (path !== p.path) return;
      const index = gamebookOf(notes, p.project.settings);
      const paragraph = index?.get(path);
      if (!index || !paragraph) {
        mark = null;
        return;
      }
      mark = paragraphMark(index, paragraph, warnings(index, p.project.settings.gamebook.start).get(path) ?? [], p.project.settings);
      note = paragraph.note;
    });
  });
  const unit = $derived(p.project.settings.pages.unit);
  const pages = $derived(mark ? Math.max(1, Math.ceil(mark.length / Math.max(1, p.project.settings.pages.size))) : 0);
</script>

{#if mark}
  <div class="paragraph">
    <p class="head">
      <span class="number">{mark.number}</span>
      <span class="type">{t(`gamebook.type.${mark.numberType}` as MessageKey)}</span>
      {#if mark.ending}<span class="tag">{t("gamebook.ending")}</span>{/if}
      {#if mark.empty}<span class="tag">{t("gamebook.empty")}</span>{/if}
    </p>
    <p class="muted">
      <span class="length {mark.band}">{tu("gamebook.length", unit, { n: num(mark.length) })}</span>
      · {(pages === 1 ? t("gamebook.pages.one") : t("gamebook.pages", { n: pages }))}
    </p>
    {#if note}<p class="note">{note}</p>{/if}

    <h4>{t("gamebook.incoming")}</h4>
    {#if mark.incoming.length}
      <p class="refs">
        {#each mark.incoming as from, i (from.path + i)}
          <button class="ref" class:hidden-ref={from.hidden} title={from.hidden ? t("gamebook.hidden") : undefined} onclick={() => nav?.open(from.path)}>{from.number}</button>
        {/each}
      </p>
    {:else}
      <p class="muted">{mark.number === p.project.settings.gamebook.start ? t("gamebook.isStart") : t("gamebook.noIncoming")}</p>
    {/if}

    <h4>{t("gamebook.outgoing")}</h4>
    {#if mark.outgoing.length}
      <p class="refs">
        {#each mark.outgoing as to, i (to.label + i)}
          <button
            class="ref"
            class:hidden-ref={to.hidden}
            class:broken={!to.path}
            class:empty-ref={to.empty}
            title={!to.path ? t("gamebook.brokenTo", { target: to.label }) : to.hidden ? t("gamebook.hidden") : to.empty ? t("gamebook.empty") : undefined}
            disabled={!to.path}
            onclick={() => nav?.open(to.path)}>{to.path ? to.label : `? ${to.label}`}</button
          >
        {/each}
      </p>
    {:else}
      <p class="muted">{mark.ending ? t("gamebook.isEnding") : t("gamebook.noOutgoing")}</p>
    {/if}

    {#if mark.warnings.length}
      <ul class="warnings">
        {#each mark.warnings as w (w)}
          <li>⚠ {t(`gamebook.warning.${w}` as MessageKey)}</li>
        {/each}
      </ul>
    {/if}
  </div>
{:else}
  <p class="muted">{t("gamebook.notParagraph")}</p>
{/if}

<style>
  .paragraph p {
    margin: 0 0 6px;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .number {
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .type {
    color: var(--text-muted);
  }
  .tag {
    padding: 0 6px;
    border-radius: 3px;
    background: var(--bg-hover);
    font-size: 11px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .note {
    font-size: 12px;
    font-style: italic;
  }
  .length.short {
    color: var(--status-2);
  }
  .length.long {
    color: var(--danger);
  }
  h4 {
    margin: 10px 0 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .refs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .ref {
    min-width: 30px;
    padding: 1px 6px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    color: var(--wikilink);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .ref.hidden-ref {
    border-style: dashed;
  }
  .ref.empty-ref {
    color: var(--text-muted);
  }
  .ref.broken {
    color: var(--danger);
    cursor: default;
  }
  .warnings {
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    color: var(--danger);
    font-size: 12px;
  }
  .warnings li {
    margin-bottom: 3px;
  }
</style>
