<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import type { Properties } from "$lib/core/frontmatter";
  import { noteTitle, noteType } from "$lib/core/notes";
  import type { Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";
  import { isList } from "./propertyText";
  import { emptyValue, propertyDef } from "$lib/core/properties";
  import PropertyAdd from "./PropertyAdd.svelte";
  import PropertyRows from "./PropertyRows.svelte";

  interface Props {
    project: Project;
    path: string;
    rev: number;
    onChanged: () => Promise<void>;
    onRename: (path: string, name: string) => void;
  }
  let p: Props = $props();

  let properties = $state<Properties>({});
  let adding = $state(false);
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
      error = failure(e);
    }
  }

  function add(key: string) {
    if (!key || key in properties) return;
    const def = propertyDef(p.project.settings.properties, key);
    void update({ [key]: def ? emptyValue(def) : isList(key, undefined) ? [] : "" });
  }
</script>

<section>
  <div class="heading">
    <h3>{t("panel.properties")}</h3>
    {#if isNote}
      <button class="plus" aria-expanded={adding} title={t("panel.newPropertyTip")} aria-label={t("panel.newProperty")} onclick={() => (adding = !adding)}>+ {t("panel.newProperty")}</button>
    {/if}
  </div>
  {#if isNote && adding}
    <PropertyAdd
      project={p.project}
      existing={Object.keys(properties)}
      scene={false}
      onAdd={async (name, value) => {
        await p.project.setProperties(p.path, { [name]: value });
        await p.onChanged();
      }}
      onClose={() => (adding = false)}
    />
  {/if}
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
    <PropertyRows project={p.project} {entries} from={p.path} onUpdate={update} onChanged={p.onChanged} onError={(m) => (error = m)} />
    {#if missing.length}
      <div class="suggested">
        {#each missing as key (key)}
          <button title={t("codex.addSuggested")} onclick={() => add(key)}>+ {key}</button>
        {/each}
      </div>
    {/if}
  {/if}
  {#if error}<p class="error"><ErrorText text={error} /></p>{/if}
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
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .heading h3 {
    margin: 0;
  }
  .plus {
    font-size: 11px;
    padding: 1px 8px;
  }
  .plus[aria-expanded="true"] {
    background: var(--bg-active);
  }
  .error {
    color: var(--danger);
  }
</style>
