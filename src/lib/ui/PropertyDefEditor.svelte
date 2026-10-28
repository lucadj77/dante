<script lang="ts">
  import { PROPERTY_KINDS, type PropertyDef, type PropertyKind } from "$lib/core/properties";
  import type { NoteType } from "$lib/core/settings";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import { DOT_COLORS, type DotValue } from "$lib/core/statistics";

  interface Props {
    name: string;
    /** The current definition; null when the property is free text. */
    def: PropertyDef | null;
    types: Record<string, NoteType>;
    /** A new definition, or null to leave the property undefined. */
    onSave: (def: PropertyDef | null) => void;
    /** Whether to say that the definition applies to every note. */
    hint?: boolean;
    /** Gives the property another name in the whole novel; absent when it keeps its name. */
    onRename?: (to: string) => Promise<void>;
    /** The values of the tree's dot, when this property colours it, with their colours. */
    legend?: DotValue[];
    /** A new colour for a value of the dot; "" goes back to the usual one. */
    onColor?: (value: string, color: string) => void;
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
  // svelte-ignore state_referenced_locally
  let newName = $state(p.name);
  let renaming = $state(false);
  async function rename() {
    const to = newName.trim();
    if (!to || to === p.name || !p.onRename) return;
    renaming = true;
    try {
      await p.onRename(to);
    } finally {
      renaming = false;
    }
  }

  /** The colour a value's dot has: the one chosen, or the usual one of its hue or stage. */
  function colorOf(item: DotValue): string {
    if (item.color) return item.color;
    if (item.hue !== null) return DOT_COLORS[item.hue % DOT_COLORS.length];
    // The stages' colours belong to the theme: read as the tree draws them.
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--status-${item.tone ?? 0}`).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#888888";
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
  {#if p.legend}
    <div class="legend">
      <span>{t("property.dotColors")}</span>
      {#if p.legend.length === 0}<p class="hint">{t("property.dotNone")}</p>{/if}
      {#each p.legend as item (item.value)}
        <label class="color"
          ><input type="color" value={colorOf(item)} onchange={(e) => p.onColor?.(item.value, (e.currentTarget as HTMLInputElement).value)} />
          <span class="value">{item.value}</span>
          {#if item.color}<button type="button" class="reset" onclick={() => p.onColor?.(item.value, "")}>{t("property.dotReset")}</button>{/if}
        </label>
      {/each}
    </div>
  {/if}
  {#if p.onRename}
    <form
      class="rename"
      onsubmit={(e) => {
        e.preventDefault();
        void rename();
      }}
    >
      <label
        >{t("property.rename")}
        <span class="row"
          ><input bind:value={newName} aria-label={t("property.rename")} />
          <button type="submit" disabled={renaming || !newName.trim() || newName.trim() === p.name}>{t("property.renameDo")}</button></span
        ></label
      >
      <p class="hint">{t("property.renameHint")}</p>
    </form>
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
  .legend {
    display: grid;
    gap: 4px;
    color: var(--text-muted);
  }
  .color {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text);
  }
  .color input {
    width: 22px;
    height: 18px;
    padding: 0;
    border: none;
    background: none;
  }
  .color .value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reset {
    font-size: 11px;
    padding: 0 6px;
  }
  .rename .row {
    display: flex;
    gap: 4px;
  }
  .rename input {
    flex: 1;
    min-width: 0;
  }
  .rename button {
    font-size: 12px;
  }
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 11px;
  }
</style>
