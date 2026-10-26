<script lang="ts">
  import type { Project } from "$lib/core/project";
  import { folderNotePath, SYNOPSIS } from "$lib/core/manuscript";
  import { isWithin } from "$lib/core/path";
  import { emptyValue, propertyDef } from "$lib/core/properties";
  import type { ViewRow } from "$lib/core/views";
  import { t } from "$lib/state.svelte";
  import PropertyField from "./PropertyField.svelte";
  import { displayValue } from "./propertyText";

  // The card of an item picked in a view, beside it: its synopsis and properties, to change
  // without opening the note.

  interface Props {
    row: ViewRow;
    project: Project;
    /** The view lists scenes: their chapter is shown. */
    scenes: boolean;
    /** The properties on the card, set or not. */
    keys: string[];
    onClose: () => void;
    onOpen: () => void;
    onChange: (changes: Record<string, unknown>) => Promise<void>;
  }
  let p: Props = $props();
  const row = $derived(p.row);
  let newProperty = $state("");

  const synopsis = $derived(displayValue(row.properties[SYNOPSIS]).trim());

  function addProperty() {
    const key = newProperty.trim();
    newProperty = "";
    if (!key || key in row.properties) return;
    const def = propertyDef(p.project.settings.properties, key);
    void p.onChange({ [key]: def ? emptyValue(def) : "" });
  }
</script>

<section class="inspector" aria-label={row.name}>
  <header>
    <h3>{row.name}</h3>
    <button class="close" aria-label={t("app.close")} onclick={p.onClose}>×</button>
  </header>
  <button class="open" onclick={p.onOpen}>{t("views.openNote")}</button>
  {#if row.chapter && p.scenes}<p class="muted small">{row.chapter}</p>{/if}
  {#if row.file === null || isWithin(row.path, p.project.settings.folders.manuscript)}
    <label class="prop">
      <span>{t("panel.synopsis")}</span>
      {#key row.path + synopsis}
        <textarea
          rows="4"
          value={synopsis}
          placeholder={t("panel.synopsisHint")}
          onchange={(e) => {
            const value = e.currentTarget.value.trim();
            if (value !== synopsis) void p.onChange({ [SYNOPSIS]: value || undefined });
          }}
        ></textarea>
      {/key}
    </label>
  {/if}
  {#each p.keys as key (key)}
    {@const value = row.properties[key]}
    <div class="prop" class:unset={!(key in row.properties)}>
      <span>{key}</span>
      <div class="field-row">
        <PropertyField
          name={key}
          {value}
          def={propertyDef(p.project.settings.properties, key)}
          from={row.file ?? folderNotePath(row.path)}
          onChange={(v) => {
            if (value === undefined && (v === "" || (Array.isArray(v) && !v.length))) return;
            if (JSON.stringify(v) !== JSON.stringify(value)) void p.onChange({ [key]: v });
          }}
        />
        {#if key in row.properties}
          <button class="remove" aria-label={t("panel.remove", { name: key })} onclick={() => p.onChange({ [key]: undefined })}>×</button>
        {/if}
      </div>
    </div>
  {/each}
  <form
    class="add"
    onsubmit={(e) => {
      e.preventDefault();
      addProperty();
    }}
  >
    <input bind:value={newProperty} placeholder={t("panel.propertyName")} aria-label={t("panel.propertyName")} />
    <button type="submit">{t("panel.addProperty")}</button>
  </form>
</section>

<style>
  .inspector {
    border-left: 1px solid var(--border);
    background: var(--bg-panel);
    padding: 12px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
  }
  .inspector header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .inspector h3 {
    flex: 1;
    margin: 0;
    font-size: 15px;
  }
  .inspector .close,
  .inspector .remove {
    border: none;
    background: none;
    color: var(--text-muted);
    padding: 0 4px;
  }
  .inspector .open {
    align-self: flex-start;
  }
  .inspector .prop {
    display: grid;
    gap: 3px;
    color: var(--text-muted);
    font-size: 12px;
  }
  .inspector .prop.unset > span {
    font-style: italic;
  }
  .inspector .field-row {
    display: flex;
    gap: 4px;
    align-items: flex-start;
    color: var(--text);
  }
  .inspector textarea {
    font: inherit;
    font-size: 13px;
    color: var(--text);
    resize: vertical;
  }
  .inspector .add {
    display: flex;
    gap: 4px;
  }
  .inspector .add input {
    flex: 1;
    min-width: 0;
  }
  .muted {
    color: var(--text-muted);
  }
  .small {
    font-size: 12px;
  }
</style>
