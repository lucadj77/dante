<script lang="ts">
  import { app, num, t } from "$lib/state.svelte";
  import { installUpdate, newsSince, updates } from "$lib/updates.svelte";

  /** Saves the open project before the update restarts Dante. */
  let { beforeInstall }: { beforeInstall: () => Promise<void> } = $props();

  const news = $derived(updates.available ? newsSince(updates.available.rawJson, updates.version, app.settings.language) : []);
  let open = $state(false);

  /** A note's **bold** parts, the only markup the notes use. */
  const pieces = (note: string) => note.split(/\*\*(.+?)\*\*/g).map((text, i) => ({ text, bold: i % 2 === 1 }));

  const shown = $derived(
    updates.available !== null && (!updates.dismissed || updates.state === "downloading" || updates.state === "error"),
  );
</script>

{#if shown && updates.available}
  <div class="update" role="status">
    {#if updates.state === "downloading"}
      <span
        >{updates.progress === null
          ? t("update.downloading")
          : t("update.downloadingPercent", { percent: num(Math.round(updates.progress * 100)) })}</span
      >
    {:else}
      <span>
        {t("update.available", { version: updates.available.version })}
        {#if news.length}
          <button class="link" onclick={() => (open = !open)}>{open ? t("update.hideNews") : t("update.news")}</button>
        {/if}
        {#if updates.state === "error"}<span class="error">{t("update.failed", { message: updates.error })}</span>{/if}
        {#if open}
          <span class="news">
            {#each news as v (v.version)}
              {#if news.length > 1}<span class="news-version">{v.version}</span>{/if}
              <ul>
                {#each v.notes as note, i (i)}
                  <li>{#each pieces(note) as p, j (j)}{#if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}{/each}</li>
                {/each}
              </ul>
            {/each}
          </span>
        {/if}
      </span>
      <button class="primary" onclick={() => void installUpdate(beforeInstall)}>{t("update.install")}</button>
      <button onclick={() => (updates.dismissed = true)}>{t("update.later")}</button>
    {/if}
  </div>
{/if}

<style>
  .update {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(560px, calc(100vw - 32px));
    padding: 10px 12px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
  }
  .update > span {
    flex: 1;
  }
  .error {
    display: block;
    margin-top: 4px;
    color: var(--danger);
    font-size: 12px;
  }
  button {
    white-space: nowrap;
    align-self: flex-start;
  }
  button.link {
    border: none;
    background: none;
    padding: 0;
    margin-left: 6px;
    color: var(--accent, inherit);
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
  }
  .news {
    display: block;
    max-height: 40vh;
    overflow-y: auto;
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.45;
  }
  .news ul {
    margin: 0 0 6px;
    padding-left: 18px;
  }
  .news li {
    margin-bottom: 4px;
  }
  .news-version {
    display: block;
    font-weight: 600;
    margin-top: 4px;
  }
</style>
