<script lang="ts">
  import { noteTitle } from "$lib/core/notes";
  import type { Project } from "$lib/core/project";
  import { listTrash, type TrashItem } from "$lib/core/trash";
  import { app, t } from "$lib/state.svelte";
  import { confirmDelete } from "./dialogs";

  interface Props {
    project: Project;
    onClose: () => void;
    /** Called after an item is put back, so views reload. */
    onRestored: () => Promise<void>;
  }
  let p: Props = $props();

  let items = $state.raw<TrashItem[] | null>(null);
  let error = $state("");
  let message = $state("");
  let busy = $state(false);
  const manuscript = $derived(p.project.settings.folders.manuscript);
  const dateFormat = $derived(new Intl.DateTimeFormat(app.settings.language, { dateStyle: "medium", timeStyle: "short" }));

  async function load() {
    try {
      items = await listTrash(p.project.fs);
    } catch (e) {
      fail(e);
      items = [];
    }
  }
  void load();

  function fail(e: unknown) {
    error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
  }

  /** The name as the writer knows it: a scene without its order number or extension. */
  const shown = (item: TrashItem) => (item.isDir ? item.name.replace(/^\d+\s+/, "") : noteTitle(item.from ?? item.name, manuscript));
  /** Where it was: the folder that held it. */
  const place = (from: string) => from.split("/").slice(0, -1).map((part) => part.replace(/^\d+\s+/, "")).join(" › ");

  async function restore(item: TrashItem) {
    busy = true;
    error = "";
    try {
      const path = await p.project.restore(item);
      message = t("trash.restored", { name: shown(item), path: place(path) || "/" });
      await p.onRestored();
      await load();
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }

  async function remove(list: TrashItem[], question: string) {
    if (!(await confirmDelete(question, t("trash.delete")))) return;
    busy = true;
    error = "";
    try {
      await p.project.deleteForever(list);
      message = "";
      await load();
    } catch (e) {
      fail(e);
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
    aria-label={t("trash.title")}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && p.onClose()}
  >
    <header>
      <h2>{t("trash.title")}</h2>
      <button onclick={p.onClose}>{t("trash.close")}</button>
    </header>
    <p class="muted">{t("trash.hint")}</p>
    {#if message}<p class="message" role="status">{message}</p>{/if}
    {#if error}<p class="error">{error}</p>{/if}
    {#if items && items.length === 0}
      <p class="muted">{t("trash.empty")}</p>
    {:else if items}
      <ul>
        {#each items as item (item.path)}
          <li>
            <div class="what">
              <span class="name">{item.isDir ? "📁 " : ""}{shown(item)}</span>
              <span class="from">
                {#if item.from}{t("trash.from", { path: place(item.from) || "/" })}{:else}{t("trash.unknown")}{/if}{#if item.date}
                  · {dateFormat.format(new Date(item.date))}{/if}
              </span>
            </div>
            <button disabled={busy} onclick={() => restore(item)}>{t("trash.restore")}</button>
            <button class="danger" disabled={busy} onclick={() => remove([item], t("trash.confirmDelete", { name: shown(item) }))}>{t("trash.delete")}</button>
          </li>
        {/each}
      </ul>
      <div class="actions">
        <button class="danger" disabled={busy} onclick={() => items && remove(items, t("trash.confirmEmpty", { count: items.length }))}>{t("trash.emptyAll")}</button>
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
    width: min(640px, calc(100vw - 32px));
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
  .muted,
  .message,
  .error {
    font-size: 13px;
    margin: 0;
  }
  .muted {
    color: var(--text-muted);
  }
  .error {
    color: var(--danger);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: auto;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
  }
  .what {
    flex: 1;
    display: grid;
    gap: 1px;
    min-width: 0;
  }
  .name {
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .from {
    font-size: 12px;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  li button {
    font-size: 12px;
    white-space: nowrap;
  }
  .danger {
    color: var(--danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
