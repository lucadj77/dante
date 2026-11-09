<script lang="ts">
  // In a gamebook: the paragraph's number, where it comes from, where it leads, and what is
  // wrong with it.
  import { gamebookOf, paragraphMark, type ParagraphMark } from "$lib/core/gamebook/marks";
  import { KEYS, warnings } from "$lib/core/gamebook/paragraphs";
  import { hiddenReference } from "$lib/core/gamebook/edit";
  import type { Project } from "$lib/core/project";
  import type { MessageKey } from "$lib/i18n";
  import { num, t, tu } from "$lib/state.svelte";
  import { navigator } from "./navigation";
  import { documents, flushAll } from "./documents.svelte";
  import { failure } from "./errors";
  import type { ParagraphChanges } from "$lib/core/gamebook/edit";

  interface Props {
    project: Project;
    path: string;
    /** Changes whenever the text or the project changes, so the panel reads it again. */
    version: string;
    onChanged: () => Promise<void>;
  }
  let p: Props = $props();
  const nav = navigator();

  let mark = $state<ParagraphMark | null>(null);
  let error = $state("");
  /** The other paragraphs of the folder, to choose an anchor or a hidden reference. */
  let others = $state.raw<{ path: string; title: string; number: number }[]>([]);
  /** "Relative" chosen, waiting for the paragraph it follows. */
  let relativeOpen = $state(false);

  async function list(action: "add" | "remove", value: string) {
    error = "";
    try {
      await flushAll(p.project);
      if (action === "add") await p.project.addToParagraphList(p.path, KEYS.hidden, value);
      else await p.project.removeFromParagraphList(p.path, KEYS.hidden, value);
      await documents(p.project).refreshAll();
      await p.onChanged();
    } catch (e) {
      error = failure(e);
    }
  }

  /** Writes the change in the paragraph's file and, for a new number, in the references to it. */
  async function change(changes: ParagraphChanges) {
    error = "";
    try {
      await flushAll(p.project);
      await p.project.setParagraph(p.path, changes);
      await documents(p.project).refreshAll();
      await p.onChanged();
    } catch (e) {
      error = failure(e);
    }
  }

  function renumber(input: HTMLInputElement) {
    const n = Number.parseInt(input.value, 10);
    if (!mark || !Number.isInteger(n) || n < 1 || n === mark.number) {
      if (mark) input.value = String(mark.number);
      return;
    }
    void change({ number: n });
  }

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
      others = index.inScope(paragraph.scope).filter((x) => x.path !== path).map((x) => ({ path: x.path, title: x.title, number: x.number }));
    });
  });
  const unit = $derived(p.project.settings.pages.unit);
  const pages = $derived(mark ? Math.max(1, Math.ceil(mark.length / Math.max(1, p.project.settings.pages.size))) : 0);
</script>

{#if mark}
  <div class="paragraph">
    <div class="head">
      {#key mark.number}
        <input
          class="number"
          type="number"
          min="1"
          value={mark.number}
          aria-label={t("gamebook.number")}
          title={t("gamebook.numberHint")}
          disabled={mark.numberType === "relative"}
          onchange={(e) => renumber(e.currentTarget)}
          onkeydown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      {/key}
      <select
        aria-label={t("gamebook.numberType")}
        value={relativeOpen ? "relative" : mark.numberType}
        onchange={(e) => {
          const v = e.currentTarget.value as "free" | "fixed" | "relative";
          relativeOpen = v === "relative";
          if (v !== "relative") void change({ numberType: v });
        }}
      >
        <option value="free">{t("gamebook.type.free")}</option>
        <option value="fixed">{t("gamebook.type.fixed")}</option>
        <option value="relative">{t("gamebook.type.relative")}</option>
      </select>
    </div>
    {#if relativeOpen || mark.numberType === "relative"}
      {@const current = mark}
      <div class="relative">
        <label>
          <span>{t("gamebook.relativeTo")}</span>
          <select
            value={current.anchor ?? ""}
            onchange={(e) => {
              const anchor = e.currentTarget.value;
              if (anchor) void change({ numberType: "relative", anchor, offset: current.offset ?? 1 }).then(() => (relativeOpen = false));
            }}
          >
            <option value="">{t("gamebook.new.chooseAnchor")}</option>
            {#each others as x (x.path)}<option value={x.title}>{x.number} · {x.title}</option>{/each}
          </select>
        </label>
        <label>
          <span>{t("gamebook.offset")}</span>
          {#key current.offset}
            <input
              type="number"
              value={current.offset ?? 1}
              disabled={!current.anchor}
              onchange={(e) => {
                const offset = Number.parseInt(e.currentTarget.value, 10);
                if (current.anchor && Number.isInteger(offset)) void change({ numberType: "relative", anchor: current.anchor, offset });
              }}
            />
          {/key}
        </label>
      </div>
    {/if}
    <label class="check">
      <input type="checkbox" checked={mark.ending} onchange={(e) => void change({ ending: e.currentTarget.checked })} />
      {t("gamebook.endingCheck")}
    </label>
    {#if mark.empty}<p class="muted">{t("gamebook.empty")}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <p class="muted">
      <span class="length {mark.band}">{tu("gamebook.length", unit, { n: num(mark.length) })}</span>
      · {(pages === 1 ? t("gamebook.pages.one") : t("gamebook.pages", { n: pages }))}
    </p>

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

    <h4>{t("gamebook.hiddenRefs")}</h4>
    <div class="hidden-list">
      {#each mark.outgoing.filter((o) => o.hidden) as to, i (to.raw + i)}
        <span class="ref hidden-ref">
          <button class="link" disabled={!to.path} onclick={() => nav?.open(to.path)}>{to.path ? to.label : `? ${to.label}`}</button>
          <button class="remove" title={t("gamebook.removeHidden")} aria-label={t("gamebook.removeHidden")} onclick={() => void list("remove", to.raw)}>×</button>
        </span>
      {/each}
      <select
        aria-label={t("gamebook.addHidden")}
        value=""
        onchange={(e) => {
          const target = others.find((x) => x.path === e.currentTarget.value);
          e.currentTarget.value = "";
          if (target) void list("add", hiddenReference(target.title, target.number));
        }}
      >
        <option value="">{t("gamebook.addHidden")}</option>
        {#each others as x (x.path)}<option value={x.path}>{x.number} · {x.title}</option>{/each}
      </select>
    </div>

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
    width: 80px;
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .head {
    margin-bottom: 6px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .error {
    color: var(--danger);
    font-size: 12px;
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
  .relative {
    display: grid;
    grid-template-columns: 1fr 80px;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 12px;
  }
  .relative label {
    display: grid;
    gap: 2px;
  }
  .relative select {
    min-width: 0;
  }
  .hidden-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .hidden-list select {
    font-size: 12px;
    max-width: 100%;
  }
  .ref .link,
  .ref .remove {
    border: none;
    background: none;
    padding: 0 2px;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .ref .remove {
    color: var(--text-muted);
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
