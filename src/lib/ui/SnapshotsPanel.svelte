<script lang="ts">
  import { diffWords, type DiffPart } from "$lib/core/diff";
  import { splitNote } from "$lib/core/frontmatter";
  import type { Project } from "$lib/core/project";
  import { listSnapshots, restoreSnapshot, takeSnapshot, type Snapshot } from "$lib/core/snapshots";
  import { app, t } from "$lib/state.svelte";

  interface Props {
    project: Project;
    path: string;
    /** Writes the editor's pending changes before snapshots read the file. */
    beforeRead: (path: string) => Promise<void>;
    onRestored: () => void;
  }
  let p: Props = $props();

  let snapshots = $state<Snapshot[]>([]);
  let name = $state("");
  let error = $state("");
  let comparing = $state<{ title: string; parts: DiffPart[] } | null>(null);

  async function refresh() {
    try {
      snapshots = await listSnapshots(p.project.fs, p.path);
    } catch {
      snapshots = [];
    }
  }

  $effect(() => {
    void p.path;
    void refresh();
  });

  async function act(fn: () => Promise<void>) {
    error = "";
    try {
      await fn();
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  const label = (s: Snapshot) => s.name ?? t("snap.auto");
  const when = (s: Snapshot) =>
    s.date.toLocaleString(app.settings.language, { dateStyle: "medium", timeStyle: "short" });

  const take = () =>
    act(async () => {
      await p.beforeRead(p.path);
      // A named snapshot is taken even when the text has not changed since the last one.
      await takeSnapshot(p.project.fs, p.path, name.trim() || t("snap.manual"));
      name = "";
      await refresh();
    });

  const compare = (s: Snapshot) =>
    act(async () => {
      await p.beforeRead(p.path);
      const old = splitNote(await p.project.fs.readText(s.path)).body;
      const now = await p.project.readBody(p.path);
      comparing = { title: t("snap.compareTitle", { name: `${label(s)} (${when(s)})` }), parts: diffWords(old, now) };
    });

  const restore = (s: Snapshot) =>
    act(async () => {
      if (!confirm(t("snap.confirmRestore"))) return;
      await p.beforeRead(p.path);
      await restoreSnapshot(p.project.fs, p.path, s.path);
      await refresh();
      p.onRestored();
    });

  const remove = (s: Snapshot) =>
    act(async () => {
      await p.project.fs.remove(s.path);
      await refresh();
    });
</script>

<section>
  <h3>{t("snap.title")}</h3>
  <form
    class="take"
    onsubmit={(e) => {
      e.preventDefault();
      void take();
    }}
  >
    <input bind:value={name} placeholder={t("snap.namePlaceholder")} aria-label={t("snap.namePlaceholder")} />
    <button type="submit" title={t("tip.snapTake")}>{t("snap.take")}</button>
  </form>
  {#if snapshots.length === 0}
    <p class="muted">{t("snap.none")}</p>
  {/if}
  <ul>
    {#each snapshots as s (s.path)}
      <li>
        <div class="info">
          <span class="name" class:auto={s.name === null}>{label(s)}</span>
          <span class="date">{when(s)}</span>
        </div>
        <div class="actions">
          <button title={t("tip.snapCompare")} onclick={() => compare(s)}>{t("snap.compare")}</button>
          <button title={t("tip.snapRestore")} onclick={() => restore(s)}>{t("snap.restore")}</button>
          <button class="delete" aria-label={t("snap.delete")} title={t("snap.delete")} onclick={() => remove(s)}>×</button>
        </div>
      </li>
    {/each}
  </ul>
  {#if error}<p class="error">{error}</p>{/if}
</section>

{#if comparing}
  <div class="overlay" role="presentation" onclick={() => (comparing = null)}>
    <div class="dialog" role="dialog" aria-modal="true" aria-label={comparing.title} tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === "Escape" && (comparing = null)}>
      <header>
        <h2>{comparing.title}</h2>
        <button onclick={() => (comparing = null)}>{t("snap.close")}</button>
      </header>
      <p class="legend"><del>{t("snap.removed")}</del> <ins>{t("snap.added")}</ins></p>
      <div class="diff">
        {#each comparing.parts as part, i (i)}
          {#if part.type === "added"}<ins>{part.text}</ins>{:else if part.type === "removed"}<del>{part.text}</del>{:else}<span>{part.text}</span>{/if}
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .take {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }
  .take input {
    flex: 1;
    min-width: 0;
  }
  .take button {
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.4;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .info {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }
  .name.auto {
    color: var(--text-muted);
  }
  .date {
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .actions button {
    font-size: 12px;
    padding: 1px 8px;
  }
  .actions .delete {
    margin-left: auto;
    border: none;
    color: var(--text-muted);
  }
  .error {
    color: var(--danger);
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    display: grid;
    place-items: center;
    z-index: 10;
  }
  .dialog {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
  }
  .dialog header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 16px;
  }
  .dialog h2 {
    font-size: 16px;
    margin: 0;
  }
  .legend {
    font-size: 12px;
    display: flex;
    gap: 12px;
  }
  .diff {
    overflow: auto;
    font-family: var(--editor-font);
    font-size: 16px;
    line-height: 1.7;
    white-space: pre-wrap;
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
</style>
