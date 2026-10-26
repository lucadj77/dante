<script lang="ts">
  import { t } from "$lib/state.svelte";
  import { DETAIL } from "./errors";

  /** A message from failure(): the system's words, after the sentence, show on request. */
  let { text }: { text: string } = $props();
  const at = $derived(text.indexOf(DETAIL));
  let open = $state(false);
</script>

{#if at < 0}{text}{:else}{text.slice(0, at)}
  <button type="button" class="more" aria-expanded={open} onclick={() => (open = !open)}>{t("error.details")}</button>
  {#if open}<span class="detail">{text.slice(at + DETAIL.length)}</span>{/if}
{/if}

<style>
  .more {
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    font-size: 0.9em;
    text-decoration: underline;
    cursor: pointer;
    opacity: 0.8;
  }
  .detail {
    display: block;
    margin-top: 4px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    opacity: 0.8;
    overflow-wrap: anywhere;
  }
</style>
