<script lang="ts">
  // In a gamebook: shuffles the paragraphs' numbers, with a preview, the numbers written in
  // the prose to look at again, and the earlier operations to undo.
  import type { Project, GamebookOperation } from "$lib/core/project";
  import type { NoteIndex } from "$lib/core/notes";
  import { gamebookOf } from "$lib/core/gamebook/marks";
  import { proseNumbers, reorder, shuffle, type ShuffleError, type ShuffleResult } from "$lib/core/gamebook/shuffle";
  import { titleOf } from "$lib/core/gamebook/paragraphs";
  import { num, t } from "$lib/state.svelte";
  import { failure } from "./errors";
  import ErrorText from "./ErrorText.svelte";

  interface Props {
    /** Shuffle at random, or put the paragraphs in the order the reader meets them. */
    mode: "shuffle" | "reorder";
    project: Project;
    notes: NoteIndex;
    /** The folder whose paragraphs are shuffled. */
    scope: string;
    /** Runs a change to the project, then reloads the views. */
    run: (operation: () => Promise<unknown>) => Promise<void>;
    onOpen: (path: string) => void;
    onClose: () => void;
  }
  let p: Props = $props();

  // svelte-ignore state_referenced_locally
  const index = gamebookOf(p.notes, p.project.settings);
  // svelte-ignore state_referenced_locally
  const paragraphs = index?.inScope(p.scope) ?? [];
  // svelte-ignore state_referenced_locally
  const start = p.project.settings.gamebook.start;
  const numbers = new Set(paragraphs.map((x) => x.number));

  // svelte-ignore state_referenced_locally
  const mode = p.mode;
  /** The keys of the texts that change with the mode. */
  const k = (key: "title" | "intro" | "apply" | "snapshot") => (mode === "reorder" ? (`gamebook.reorder.${key}` as const) : (`gamebook.shuffle.${key}` as const));
  const compute = () => (mode === "reorder" ? reorder(paragraphs, { start }) : shuffle(paragraphs, { start }));
  let result = $state.raw<ShuffleResult>(compute());
  let busy = $state(false);
  let error = $state("");
  let operations = $state.raw<GamebookOperation[]>([]);
  // svelte-ignore state_referenced_locally
  void p.project.gamebookOperations().then((list) => (operations = list));

  /** The numbers in the prose that a shuffle leaves as they are. */
  const prose = paragraphs
    .flatMap((x) => proseNumbers(p.notes.notes.get(x.path)?.text ?? "", (n) => numbers.has(n), p.project.settings.language).map((found) => ({ paragraph: x, ...found })))
    .slice(0, 200);

  const rows = $derived(
    result.ok
      ? [...paragraphs].map((x) => ({ paragraph: x, to: result.ok ? result.numbers.get(x.path)! : x.number })).sort((a, b) => a.to - b.to)
      : [],
  );
  const moved = $derived(rows.filter((r) => r.to !== r.paragraph.number).length);

  function describe(e: ShuffleError): string {
    const names = (paths: string[]) => paths.map(titleOf).join(", ");
    if (e.kind === "anchorCycle") return t("gamebook.shuffle.cycle", { names: names(e.paths) });
    if (e.kind === "noAnchor") return t("gamebook.shuffle.noAnchor", { name: titleOf(e.path), anchor: e.anchor });
    if (e.kind === "fixedClash") return t("gamebook.shuffle.clash", { n: e.number, names: names(e.paths) });
    if (e.kind === "outOfRange") return t("gamebook.shuffle.outOfRange", { names: names(e.paths) });
    return t("gamebook.shuffle.noRoom", { names: names(e.paths) });
  }

  function dateOf(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  async function apply() {
    if (!result.ok || busy) return;
    const chosen = result.numbers;
    busy = true;
    error = "";
    try {
      await p.run(() => p.project.renumberParagraphs(chosen, t(k("snapshot"))));
      p.onClose();
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }

  async function undo(op: GamebookOperation, onlyNumbers: boolean) {
    if (busy) return;
    busy = true;
    error = "";
    try {
      await p.run(() => p.project.undoGamebookOperation(op.id, onlyNumbers, t("gamebook.shuffle.undoSnapshot", { name: op.name })));
      p.onClose();
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="overlay" role="presentation" onclick={p.onClose}>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-label={t(k("title"))}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && p.onClose()}
  >
    <h2>{t(k("title"))}</h2>
    <p class="muted">{t(k("intro"), { start })}</p>

    {#if result.ok}
      <div class="head">
        <span>{t("gamebook.shuffle.summary", { moved, total: paragraphs.length, spread: result.spread })}</span>
        {#if mode === "shuffle"}<button type="button" onclick={() => (result = compute())}>{t("gamebook.shuffle.again")}</button>{/if}
      </div>
      <div class="table">
        <table>
          <thead>
            <tr><th>{t("gamebook.shuffle.after")}</th><th>{t("gamebook.shuffle.before")}</th><th>{t("gamebook.shuffle.paragraph")}</th></tr>
          </thead>
          <tbody>
            {#each rows as r (r.paragraph.path)}
              <tr class:same={r.to === r.paragraph.number}>
                <td class="n">{r.to}</td>
                <td class="n muted">{r.paragraph.number}</td>
                <td>
                  {r.paragraph.title}
                  {#if r.paragraph.numberType === "fixed" || (r.paragraph.numberType === "free" && r.paragraph.number === start)}<span class="tag">🔒</span>{/if}
                  {#if r.paragraph.numberType === "relative"}<span class="tag">↳ {r.paragraph.anchor}</span>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <ul class="errors">
        {#each result.errors as e, i (i)}<li>⚠ {describe(e)}</li>{/each}
      </ul>
    {/if}

    {#if prose.length}
      <details>
        <summary>{t("gamebook.shuffle.prose", { n: prose.length })}</summary>
        <p class="muted">{t("gamebook.shuffle.proseHint")}</p>
        <ul class="prose">
          {#each prose as x, i (x.paragraph.path + i)}
            <li><button class="link" onclick={() => p.onOpen(x.paragraph.path)}>{x.paragraph.number} · {x.paragraph.title}</button> <span class="muted">{x.context}</span></li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if operations.length}
      <details>
        <summary>{t("gamebook.shuffle.operations", { n: operations.length })}</summary>
        <p class="muted">{t("gamebook.shuffle.operationsHint")}</p>
        <ul class="ops">
          {#each operations as op (op.id)}
            <li>
              <span>{dateOf(op.date)} · {op.name} · {t("gamebook.shuffle.files", { n: num(op.files.length) })}</span>
              <span class="buttons">
                <button type="button" disabled={busy} onclick={() => void undo(op, true)}>{t("gamebook.shuffle.undoNumbers")}</button>
                <button type="button" disabled={busy} onclick={() => void undo(op, false)}>{t("gamebook.shuffle.undoAll")}</button>
              </span>
            </li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if error}<p class="error"><ErrorText text={error} /></p>{/if}
    <div class="actions">
      <button type="button" onclick={p.onClose}>{t("tree.cancel")}</button>
      <button type="button" class="primary" disabled={busy || !result.ok} onclick={() => void apply()}>{t(k("apply"))}</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: grid;
    place-items: center;
    z-index: 40;
  }
  .dialog {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(640px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 20px;
    font-size: 13px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .muted {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .table {
    overflow: auto;
    min-height: 120px;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--bg-panel);
    text-align: left;
    font-weight: 600;
    font-size: 11px;
    color: var(--text-muted);
  }
  th,
  td {
    padding: 3px 8px;
    border-bottom: 1px solid var(--border);
  }
  td.n {
    width: 52px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  tr.same td:first-child {
    color: var(--text-muted);
  }
  .tag {
    margin-left: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .errors {
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--danger);
  }
  details {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
  }
  summary {
    cursor: pointer;
  }
  .prose,
  .ops {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    max-height: 180px;
    overflow: auto;
    display: grid;
    gap: 4px;
  }
  .ops li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .buttons {
    display: flex;
    gap: 4px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--wikilink);
    font: inherit;
    cursor: pointer;
  }
  .error {
    margin: 0;
    color: var(--danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
