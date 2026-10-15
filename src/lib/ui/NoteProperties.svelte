<script lang="ts">
  import type { Properties } from "$lib/core/frontmatter";
  import { noteTitle, noteType } from "$lib/core/notes";
  import type { Project } from "$lib/core/project";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import { displayValue, isList, parseValue } from "./propertyText";
  import PropertyField from "./PropertyField.svelte";
  import { emptyValue, KIND_ICONS, propertyDef, withDef, type PropertyDef } from "$lib/core/properties";
  import PropertyDefEditor from "./PropertyDefEditor.svelte";

  interface Props {
    project: Project;
    path: string;
    rev: number;
    onChanged: () => Promise<void>;
    onRename: (path: string, name: string) => void;
  }
  let p: Props = $props();

  let properties = $state<Properties>({});
  let newName = $state("");
  let error = $state("");
  const isNote = $derived(p.path.toLowerCase().endsWith(".md"));

  $effect(() => {
    void p.rev;
    const path = p.path;
    if (!path.toLowerCase().endsWith(".md")) {
      properties = {};
      return;
    }
    p.project.properties(path).then((value) => {
      if (p.path === path) properties = value;
    }, () => (properties = {}));
  });

  const type = $derived(noteType(p.path, properties, p.project.settings));
  const known = $derived(type !== null && type in p.project.settings.types);
  /** The type's suggested properties the note does not have yet. */
  const missing = $derived(known ? p.project.settings.types[type!].properties.filter((k) => !(k in properties)) : []);
  const entries = $derived(Object.entries(properties).filter(([key]) => key !== "type"));

  async function update(changes: Properties) {
    error = "";
    try {
      await p.project.setProperties(p.path, changes);
      await p.onChanged();
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  /** The property whose definition is being edited. */
  let defining = $state<string | null>(null);

  async function define(key: string, def: PropertyDef | null) {
    error = "";
    try {
      await p.project.saveSettings({ ...p.project.settings, properties: withDef(p.project.settings.properties, key, def) });
      await p.onChanged();
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  function change(key: string, value: unknown) {
    if (JSON.stringify(value) !== JSON.stringify(properties[key])) void update({ [key]: value });
  }

  function add(key = newName.trim()) {
    if (!key || key in properties) return;
    newName = "";
    const def = propertyDef(p.project.settings.properties, key);
    void update({ [key]: def ? emptyValue(def) : isList(key, undefined) ? [] : "" });
  }
</script>

<section>
  <h3>{t("panel.properties")}</h3>
  <label class="field">
    <span>{t("panel.title")}</span>
    {#key p.path}
      <input
        value={noteTitle(p.path)}
        onchange={(e) => {
          const value = (e.currentTarget as HTMLInputElement).value;
          if (value.trim() && value !== noteTitle(p.path)) p.onRename(p.path, value);
        }}
        onkeydown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
    {/key}
  </label>
  {#if isNote}
    <label class="field">
      <span>{t("codex.type")}</span>
      <select
        value={type ?? ""}
        onchange={(e) => {
          const value = (e.currentTarget as HTMLSelectElement).value;
          void update({ type: value === "" ? undefined : value });
        }}
      >
        <option value="">{t("codex.noType")}</option>
        {#each Object.entries(p.project.settings.types) as [id, def] (id)}
          <option value={id}>{def.icon} {def.name}</option>
        {/each}
        {#if type !== null && !known}
          <option value={type}>{type}</option>
        {/if}
      </select>
    </label>
    {#if entries.length === 0 && missing.length === 0}
      <p class="muted">{t("panel.noProperties")}</p>
    {/if}
    <dl>
      {#each entries as [key, value] (key)}
        {@const def = propertyDef(p.project.settings.properties, key)}
        <div class="prop">
          <dt>
            <button
              class="kind"
              aria-expanded={defining === key}
              data-tip={t("property.defineTip", { kind: def ? t(`property.kind.${def.kind}` as MessageKey) : t("property.free") })}
              onclick={() => (defining = defining === key ? null : key)}>{KIND_ICONS[def?.kind ?? ""]}</button
            >
            {key}
          </dt>
          <dd>
            <PropertyField
              name={key}
              {value}
              {def}
              from={p.path}
              onChange={(v) => change(key, v)}
            />
            <button class="remove" aria-label={t("panel.remove", { name: key })} onclick={() => update({ [key]: undefined })}>×</button>
          </dd>
          {#if defining === key}
            <PropertyDefEditor name={key} {def} types={p.project.settings.types} onSave={(d) => define(key, d)} />
          {/if}
        </div>
      {/each}
    </dl>
    {#if missing.length}
      <div class="suggested">
        {#each missing as key (key)}
          <button title={t("codex.addSuggested")} onclick={() => add(key)}>+ {key}</button>
        {/each}
      </div>
    {/if}
    <form
      class="add"
      onsubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <input bind:value={newName} placeholder={t("panel.propertyName")} aria-label={t("panel.propertyName")} />
      <button type="submit">{t("panel.addProperty")}</button>
    </form>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}
</section>

<style>
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .field input,
  .field select {
    font-size: 14px;
  }
  .muted {
    color: var(--text-muted);
  }
  dl {
    margin: 0;
  }
  .prop {
    margin-bottom: 8px;
  }
  dt {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .kind {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    font-size: 11px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .kind:hover,
  .kind[aria-expanded="true"] {
    background: var(--bg-active);
    color: var(--text);
  }
  dd {
    margin: 0;
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  .remove {
    border: none;
    padding: 0 6px;
    color: var(--text-muted);
  }
  .suggested {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 4px 0 8px;
  }
  .suggested button {
    font-size: 12px;
    padding: 1px 8px;
    border-style: dashed;
    color: var(--text-muted);
  }
  .add {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }
  .add input {
    flex: 1;
    min-width: 0;
  }
  .add button {
    font-size: 12px;
  }
  .error {
    color: var(--danger);
  }
</style>
