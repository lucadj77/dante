<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "$lib/state.svelte";

  // A section of the side panel that folds away with a click on its heading; each stays as
  // it was left, on this computer.
  interface Props {
    /** Names the section among the remembered ones. */
    id: string;
    title: string;
    /** Buttons beside the heading, such as a "+". */
    actions?: Snippet;
    children: Snippet;
  }
  let p: Props = $props();

  const KEY = "dante.panel-folded";
  function folded(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  // svelte-ignore state_referenced_locally
  let open = $state(!folded().includes(p.id));

  function toggle() {
    open = !open;
    try {
      const rest = folded().filter((id) => id !== p.id);
      localStorage.setItem(KEY, JSON.stringify(open ? rest : [...rest, p.id]));
    } catch {
      // Without storage the section is open again next time.
    }
  }
</script>

<section class="panel-section">
  <div class="heading">
    <button class="toggle" aria-expanded={open} title={open ? t("panel.fold") : t("panel.unfold")} onclick={toggle}>
      <span class="chevron" class:open aria-hidden="true">›</span>
      <h3>{p.title}</h3>
    </button>
    {#if p.actions && open}<span class="actions">{@render p.actions()}</span>{/if}
  </div>
  {#if open}
    <div class="body">{@render p.children()}</div>
  {/if}
</section>

<style>
  .panel-section + :global(.panel-section) {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .heading {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }
  .toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    border: none;
    background: none;
    text-align: left;
    color: var(--text-muted);
  }
  .toggle:hover {
    color: var(--text);
  }
  .chevron {
    display: inline-block;
    width: 10px;
    transition: transform 0.12s;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
    color: inherit;
  }
  .actions {
    display: flex;
    gap: 4px;
  }
</style>
