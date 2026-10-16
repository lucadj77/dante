<script lang="ts">
  import { t } from "$lib/state.svelte";

  /** The authors of the novel, one field each; an empty list shows one empty field. */
  let { authors = $bindable() }: { authors: string[] } = $props();

  const fields = $derived(authors.length ? authors : [""]);

  function set(i: number, value: string) {
    const next = [...fields];
    next[i] = value;
    authors = next;
  }
</script>

<div class="authors" role="group" aria-label={t("settings.authors")}>
  <span class="label">{t("settings.authors")}</span>
  {#each fields as name, i (i)}
    <div class="row">
      <input value={name} aria-label={`${t("settings.authors")} ${i + 1}`} oninput={(e) => set(i, (e.currentTarget as HTMLInputElement).value)} />
      {#if fields.length > 1}
        <button
          type="button"
          class="remove"
          title={t("settings.removeAuthor", { name: name || String(i + 1) })}
          aria-label={t("settings.removeAuthor", { name: name || String(i + 1) })}
          onclick={() => (authors = fields.filter((_, j) => j !== i))}>×</button
        >
      {/if}
    </div>
  {/each}
  <button type="button" class="add" onclick={() => (authors = [...fields, ""])}>+ {t("settings.addAuthor")}</button>
</div>

<style>
  .authors {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
  }
  .label {
    color: var(--text-muted);
    font-size: 13px;
  }
  .row {
    display: flex;
    gap: 6px;
  }
  .row input {
    flex: 1;
    color: var(--text);
    font-size: 14px;
  }
  .remove {
    width: 30px;
    padding: 0;
  }
  .add {
    justify-self: start;
    border: none;
    background: none;
    padding: 2px 0;
    color: var(--accent);
    font-size: 13px;
    cursor: pointer;
  }
</style>
