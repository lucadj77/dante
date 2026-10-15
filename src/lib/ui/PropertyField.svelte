<script lang="ts">
  import { coerce, problem, type PropertyDef } from "$lib/core/properties";
  import { t } from "$lib/state.svelte";
  import PropertyInput from "./PropertyInput.svelte";
  import { displayValue, isList, parseValue } from "./propertyText";

  interface Props {
    name: string;
    value: unknown;
    /** The property's definition in dante.yaml; null edits it as free text. */
    def: PropertyDef | null;
    /** The note the property belongs to, for links. */
    from: string;
    onChange: (value: unknown) => void;
  }
  let p: Props = $props();

  const issue = $derived(p.def ? problem(p.value, p.def) : null);
  const text = $derived(displayValue(p.value));
  const listed = $derived(Array.isArray(p.value) ? p.value.map(String) : text ? [text] : []);
  const has = (value: string) => listed.some((v) => v.toLowerCase() === value.toLowerCase());

  function fromText(input: string) {
    p.onChange(p.def ? coerce(input, p.def) : parseValue(input, p.value, p.name));
  }

  function blurOnEnter(e: KeyboardEvent) {
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
  }

  function toggle(value: string) {
    const current = Array.isArray(p.value) ? p.value.map(String) : listed;
    p.onChange(has(value) ? current.filter((v) => v.toLowerCase() !== value.toLowerCase()) : [...current, value]);
  }
</script>

<div class="property">
  {#if p.def?.kind === "checkbox" && !issue}
    <input type="checkbox" aria-label={p.name} checked={p.value === true} onchange={(e) => p.onChange((e.currentTarget as HTMLInputElement).checked)} />
  {:else if p.def?.kind === "number" && !issue}
    <input
      type="number"
      step="any"
      aria-label={p.name}
      value={text}
      onkeydown={blurOnEnter}
      onblur={(e) => {
        const v = e.currentTarget.value;
        if (v !== text) p.onChange(v === "" ? "" : Number(v));
      }}
    />
  {:else if p.def?.kind === "date" && !issue}
    <!-- Saved when the field is left: while a date is typed, the browser already reports
         partial ones such as year 2 or 20, which would be written and reload the field. -->
    <input
      type="date"
      aria-label={p.name}
      value={text}
      onkeydown={blurOnEnter}
      onblur={(e) => {
        const v = e.currentTarget.value;
        if (v !== text) p.onChange(v);
      }}
    />
  {:else if p.def?.kind === "text" && p.def.values.length}
    <select aria-label={p.name} value={text} onchange={(e) => p.onChange((e.currentTarget as HTMLSelectElement).value)}>
      <option value="">–</option>
      {#each p.def.values as v (v)}
        <option value={v}>{v}</option>
      {/each}
      {#if text && issue}<option value={text}>{text} ⚠</option>{/if}
    </select>
  {:else if p.def?.kind === "list" && p.def.values.length}
    <div class="chips" role="group" aria-label={p.name}>
      {#each p.def.values as v (v)}
        <button type="button" class="chip" aria-pressed={has(v)} onclick={() => toggle(v)}>{v}</button>
      {/each}
      {#each listed.filter((v) => !p.def!.values.some((x) => x.toLowerCase() === v.toLowerCase())) as v (v)}
        <button type="button" class="chip odd" aria-pressed="true" title={t("property.notAllowed")} onclick={() => toggle(v)}>{v} ⚠</button>
      {/each}
    </div>
  {:else}
    <PropertyInput
      value={text}
      label={p.name}
      from={p.from}
      link={p.def?.kind === "link"}
      noteType={p.def?.kind === "link" ? p.def.note_type : ""}
      placeholder={p.def?.kind === "list" || (!p.def && isList(p.name, p.value)) ? t("panel.listHint") : p.def?.kind === "date" ? "YYYY-MM-DD" : ""}
      onCommit={fromText}
    />
  {/if}
  {#if issue === "kind" && p.def}
    <span class="issue">{t("property.wrongKind", { kind: t(`property.kind.${p.def.kind}`) })}</span>
  {:else if issue === "value" && p.def?.kind === "text"}
    <span class="issue">{t("property.notAllowed")}</span>
  {/if}
</div>

<style>
  .property {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  input:not([type="checkbox"]),
  select {
    width: 100%;
  }
  input[type="checkbox"] {
    justify-self: start;
    margin: 4px 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .chip {
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .chip[aria-pressed="true"] {
    background: var(--bg-active);
    color: var(--text);
    border-color: var(--accent);
  }
  .chip.odd {
    border-style: dashed;
  }
  .issue {
    font-size: 11px;
    color: var(--danger);
  }
</style>
