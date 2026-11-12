<script lang="ts">
  import { t } from "$lib/state.svelte";

  // A list of short values: each is shown with a × to take it away, and a field adds new
  // ones, offering those Dante already knows. Nothing to separate with commas.

  interface Props {
    values: string[];
    /** Values offered while typing; those already chosen are left out. */
    suggestions?: string[];
    /** The name read by screen readers, and the hint in the empty field. */
    label: string;
    placeholder?: string;
    /** How a value is shown, when not as it is written. */
    show?: (value: string) => string;
    onChange: (values: string[]) => void;
  }
  let { values, suggestions = [], label, placeholder = "", show = (v) => v, onChange }: Props = $props();

  const listId = `chips-${Math.random().toString(36).slice(2)}`;
  let text = $state("");
  const offered = $derived(suggestions.filter((s) => s && !values.includes(s)));

  function add(raw = text) {
    // A pasted "a, b, c" still gives three values.
    const added = raw.split(",").map((s) => s.trim()).filter((s) => s && !values.includes(s));
    text = "";
    if (added.length) onChange([...values, ...new Set(added)]);
  }

  function key(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      if (!text.trim()) return;
      e.preventDefault();
      e.stopPropagation();
      add();
    } else if (e.key === "Backspace" && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  function input(e: Event) {
    // Choosing from the list arrives as a whole value at once: it is taken straight away.
    const kind = (e as InputEvent).inputType;
    if ((kind === "insertReplacementText" || kind === undefined) && offered.includes(text)) add();
  }
</script>

<div class="chips" role="group" aria-label={label}>
  {#each values as value (value)}
    <span class="chip">
      {show(value)}
      <button type="button" title={t("chips.remove", { value: show(value) })} aria-label={t("chips.remove", { value: show(value) })} onclick={() => onChange(values.filter((v) => v !== value))}>×</button>
    </span>
  {/each}
  <input bind:value={text} list={listId} aria-label={label} placeholder={values.length ? "" : placeholder} onkeydown={key} oninput={input} onblur={() => add()} />
  <datalist id={listId}>
    {#each offered as s (s)}<option value={s}>{show(s) === s ? "" : show(s)}</option>{/each}
  </datalist>
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 3px 4px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
  }
  .chips:focus-within {
    border-color: var(--accent);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 2px 1px 8px;
    border-radius: 999px;
    background: var(--bg-active);
    color: var(--text);
    font-size: 12px;
    white-space: nowrap;
  }
  .chip button {
    min-width: 0;
    padding: 0 5px;
    border: none;
    background: none;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1;
  }
  .chip button:hover {
    color: var(--text);
  }
  input {
    flex: 1 1 40px;
    min-width: 40px;
    padding: 2px 4px;
    border: none;
    outline: none;
    background: none;
    color: var(--text);
    font-size: 13px;
  }
</style>
