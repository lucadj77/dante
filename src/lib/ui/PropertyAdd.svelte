<script lang="ts">
  import type { Project } from "$lib/core/project";
  import { emptyValue, PROPERTY_KINDS, propertyDef, withDef, type PropertyDef, type PropertyKind } from "$lib/core/properties";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import { failure } from "./errors";
  import { isList } from "./propertyText";

  // The form a "+" beside the heading opens: the name, the kind and, for a scene, whether the
  // property is for this scene alone or for every scene of the novel.
  interface Props {
    project: Project;
    /** Names the note already has. */
    existing: string[];
    /** A scene: the property may be offered to every scene. */
    scene: boolean;
    /** Adds the property with its first value, to this note or (`everywhere`) to every scene. */
    onAdd: (name: string, value: unknown, everywhere: boolean) => Promise<void>;
    onClose: () => void;
  }
  let p: Props = $props();

  let name = $state("");
  let kind = $state<PropertyKind | "">("");
  let everywhere = $state(false);
  let error = $state("");
  let busy = $state(false);

  /** A property already defined keeps its kind; the choice shows it. */
  const known = $derived(propertyDef(p.project.settings.properties, name.trim()));
  const taken = $derived(p.existing.some((k) => k.toLowerCase() === name.trim().toLowerCase()));
  const suggestions = $derived(Object.keys(p.project.settings.properties).filter((k) => !p.existing.includes(k)));

  $effect(() => {
    kind = known?.kind ?? "";
  });

  function focus(el: HTMLInputElement) {
    el.focus();
  }

  async function submit() {
    const key = name.trim();
    if (!key || taken) return;
    error = "";
    busy = true;
    try {
      let def: PropertyDef | null = known;
      // A kind chosen for a new property is written in dante.yaml, as the sign before its name does.
      if (kind && kind !== known?.kind) {
        def = { ...(known ?? { values: [], note_type: "" }), kind };
        await p.project.saveSettings({ ...p.project.settings, properties: withDef(p.project.settings.properties, key, def) });
      }
      await p.onAdd(key, def ? emptyValue(def) : isList(key, undefined) ? [] : "", p.scene && everywhere);
      p.onClose();
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }
</script>

<form
  class="add"
  onsubmit={(e) => {
    e.preventDefault();
    void submit();
  }}
>
  <label
    >{t("panel.propertyName")}
    <input
      use:focus
      bind:value={name}
      list="property-names"
      autocomplete="off"
      onkeydown={(e) => {
        if (e.key === "Escape") p.onClose();
      }}
    />
    <datalist id="property-names">
      {#each suggestions as s (s)}<option value={s}></option>{/each}
    </datalist>
  </label>
  {#if taken}<p class="hint warn">{t("property.taken", { name: name.trim() })}</p>{/if}
  <label
    >{t("property.kind")}
    <select bind:value={kind}>
      <option value="">{t("property.free")}</option>
      {#each PROPERTY_KINDS as k (k)}
        <option value={k}>{t(`property.kind.${k}` as MessageKey)}</option>
      {/each}
    </select>
  </label>
  {#if known}<p class="hint">{t("property.knownKind", { name: name.trim() })}</p>{/if}
  {#if p.scene}
    <fieldset>
      <legend>{t("property.scope")}</legend>
      <label class="radio"><input type="radio" bind:group={everywhere} value={false} /> {t("property.scopeScene")}</label>
      <label class="radio"><input type="radio" bind:group={everywhere} value={true} /> {t("property.scopeAll")}</label>
      <p class="hint">{everywhere ? t("property.scopeAllHint") : t("property.scopeSceneHint")}</p>
    </fieldset>
  {/if}
  <div class="actions">
    <button type="submit" class="primary" disabled={busy || !name.trim() || taken}>{t("panel.addProperty")}</button>
    <button type="button" onclick={p.onClose}>{t("welcome.cancel")}</button>
  </div>
  {#if error}<p class="hint warn">{error}</p>{/if}
</form>

<style>
  .add {
    display: grid;
    gap: 8px;
    padding: 10px;
    margin: 0 0 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-panel);
    font-size: 12px;
  }
  label {
    display: grid;
    gap: 3px;
    color: var(--text-muted);
  }
  label input:not([type="radio"]),
  select {
    font-size: 13px;
    color: var(--text);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: none;
    display: grid;
    gap: 4px;
  }
  legend {
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .radio {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text);
  }
  .hint {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
  }
  .warn {
    color: var(--danger);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .actions button {
    font-size: 12px;
  }
</style>
