<script lang="ts">
  import { PROPERTY_KINDS, type PropertyDef, type PropertyKind } from "$lib/core/properties";
  import type { NoteType } from "$lib/core/settings";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";

  interface Props {
    name: string;
    /** The current definition; null when the property is free text. */
    def: PropertyDef | null;
    types: Record<string, NoteType>;
    /** A new definition, or null to leave the property undefined. */
    onSave: (def: PropertyDef | null) => void;
    /** Whether to say that the definition applies to every note. */
    hint?: boolean;
  }
  let p: Props = $props();

  const kind = $derived(p.def?.kind ?? "");
  // svelte-ignore state_referenced_locally
  let values = $state(p.def?.values.join(", ") ?? "");
  $effect(() => {
    values = p.def?.values.join(", ") ?? "";
  });

  function save(changes: Partial<PropertyDef>) {
    const base: PropertyDef = p.def ?? { kind: "text", values: [], note_type: "" };
    p.onSave({ ...base, ...changes });
  }
  const split = (text: string) => [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];
</script>

<div class="def">
  <label
    >{t("property.kind")}
    <select
      value={kind}
      onchange={(e) => {
        const value = (e.currentTarget as HTMLSelectElement).value;
        if (value === "") p.onSave(null);
        else save({ kind: value as PropertyKind });
      }}
    >
      <option value="">{t("property.free")}</option>
      {#each PROPERTY_KINDS as k (k)}
        <option value={k}>{t(`property.kind.${k}` as MessageKey)}</option>
      {/each}
    </select>
  </label>
  {#if kind === "text" || kind === "list"}
    <label
      >{t(kind === "text" ? "property.valuesOne" : "property.valuesMany")}
      <input bind:value={values} placeholder={t("property.valuesHint")} onchange={() => save({ values: split(values) })} />
    </label>
  {:else if kind === "link"}
    <label
      >{t("property.noteType")}
      <select value={p.def?.note_type ?? ""} onchange={(e) => save({ note_type: (e.currentTarget as HTMLSelectElement).value })}>
        <option value="">{t("property.anyNote")}</option>
        {#each Object.entries(p.types) as [id, type] (id)}
          <option value={id}>{type.icon} {type.name}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if p.hint !== false}<p class="hint">{t("property.shared", { name: p.name })}</p>{/if}
</div>

<style>
  .def {
    display: grid;
    gap: 6px;
    padding: 8px;
    margin: 4px 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-panel);
    font-size: 12px;
  }
  label {
    display: grid;
    gap: 2px;
    color: var(--text-muted);
  }
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 11px;
  }
</style>
