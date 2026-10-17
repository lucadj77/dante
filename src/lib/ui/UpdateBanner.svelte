<script lang="ts">
  import { num, t } from "$lib/state.svelte";
  import { installUpdate, updates } from "$lib/updates.svelte";

  /** Saves the open project before the update restarts Dante. */
  let { beforeInstall }: { beforeInstall: () => Promise<void> } = $props();

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
        {#if updates.state === "error"}<span class="error">{t("update.failed", { message: updates.error })}</span>{/if}
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
    max-width: min(520px, calc(100vw - 32px));
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
  }
</style>
