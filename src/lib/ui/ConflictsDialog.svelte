<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import type { ConflictCopy } from "$lib/core/conflicts";
  import type { DiffPart } from "$lib/core/diff";
  import { conflictDiff } from "$lib/core/conflicts";
  import { splitNote } from "$lib/core/frontmatter";
  import { basename, isMarkdown } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import { app, t } from "$lib/state.svelte";

  interface Props {
    project: Project;
    conflicts: ConflictCopy[];
    onClose: () => void;
    /** Called after a copy is settled, so views reload. */
    onResolved: () => Promise<void>;
  }
  let p: Props = $props();

  let chosen = $state<string | null>(null);
  const current = $derived(p.conflicts.find((c) => c.path === chosen) ?? p.conflicts[0] ?? null);
  let parts = $state<DiffPart[] | null>(null);
  let error = $state("");
  let busy = $state(false);

  $effect(() => {
    const c = current;
    parts = null;
    if (!c || !isMarkdown(c.original)) return;
    void Promise.all([p.project.fs.readText(c.original), p.project.fs.readText(c.path)]).then(
      ([original, copy]) => {
        if (current === c) parts = conflictDiff(splitNote(original).body, splitNote(copy).body);
      },
      () => (parts = []),
    );
  });

  async function resolve(how: "original" | "copy" | "merge") {
    if (!current) return;
    busy = true;
    error = "";
    try {
      await p.project.resolveConflict(current, how, t("conflicts.snapshot"), app.settings.userName.trim() || t("conflicts.other"));
      chosen = null;
      await p.onResolved();
      if (p.conflicts.length === 0) p.onClose();
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }

  const same = $derived(parts !== null && parts.every((x) => x.type === "same"));
</script>

<div class="overlay" role="presentation" onclick={p.onClose}>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-label={t("conflicts.title")}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && p.onClose()}
  >
    <header>
      <h2>{t("conflicts.title")}</h2>
      <button onclick={p.onClose}>{t("snap.close")}</button>
    </header>
    <p class="intro">{t("conflicts.intro")}</p>
    {#if p.conflicts.length > 1}
      <ul class="list">
        {#each p.conflicts as c (c.path)}
          <li>
            <button aria-pressed={c === current} onclick={() => (chosen = c.path)}>{basename(c.path)}</button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if current}
      <p class="names">
        <span>{t("conflicts.original")}: <b>{current.original}</b></span>
        <span>{t("conflicts.copy")}: <b>{basename(current.path)}</b>{#if current.who} ({current.who}){/if}</span>
      </p>
      {#if isMarkdown(current.original)}
        <p class="legend"><del>{t("conflicts.onlyOriginal")}</del> <ins>{t("conflicts.onlyCopy")}</ins></p>
        <div class="diff">
          {#if parts === null}
            …
          {:else if same}
            <p class="muted">{t("conflicts.same")}</p>
          {:else}
            {#each parts as part, i (i)}
              {#if part.type === "added"}<ins>{part.text}</ins>{:else if part.type === "removed"}<del>{part.text}</del>{:else}<span>{part.text}</span>{/if}
            {/each}
          {/if}
        </div>
      {:else}
        <p class="muted">{t("conflicts.binary")}</p>
      {/if}
      {#if error}<p class="error" role="alert"><ErrorText text={error} /></p>{/if}
      <div class="actions">
        <button disabled={busy} title={t("tip.conflict.original")} onclick={() => resolve("original")}>{t("conflicts.keepOriginal")}</button>
        <button disabled={busy} title={t("tip.conflict.copy")} onclick={() => resolve("copy")}>{t("conflicts.keepCopy")}</button>
        {#if isMarkdown(current.original) && !same}
          <button class="primary" disabled={busy} title={t("tip.conflict.merge")} onclick={() => resolve("merge")}>{t("conflicts.merge")}</button>
        {/if}
      </div>
    {/if}
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
    width: min(820px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 20px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 16px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .intro,
  .names,
  .legend,
  .muted {
    font-size: 13px;
    margin: 0;
  }
  .names {
    display: grid;
    gap: 2px;
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--text-muted);
  }
  .list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list button {
    font-size: 12px;
  }
  .legend {
    display: flex;
    gap: 12px;
  }
  .diff {
    flex: 1;
    min-height: 120px;
    overflow: auto;
    font-family: var(--editor-font);
    font-size: 16px;
    line-height: 1.7;
    white-space: pre-wrap;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
  }
  ins {
    background: rgba(58, 154, 91, 0.22);
    background: color-mix(in srgb, #3a9a5b 22%, transparent);
    text-decoration: none;
  }
  del {
    background: rgba(163, 59, 43, 0.2);
    background: color-mix(in srgb, var(--danger) 20%, transparent);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }
  .error {
    color: var(--danger);
    font-size: 13px;
    margin: 0;
  }
</style>
