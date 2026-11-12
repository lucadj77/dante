<script lang="ts">
  import Dialog from "./Dialog.svelte";
  import ErrorText from "./ErrorText.svelte";
  import PropertyField from "./PropertyField.svelte";
  import { failure } from "$lib/ui/errors";
  import { emptyValue, propertyDef } from "$lib/core/properties";
  import { RESERVED_PROPERTIES, type Project } from "$lib/core/project";
  import { t } from "$lib/state.svelte";

  // One property, one value, for all the scenes chosen in the tree: ten scenes go from
  // «bozza» to «rivista» in one step.

  interface Props {
    project: Project;
    paths: string[];
    onDone: () => Promise<void> | void;
    onClose: () => void;
  }
  let p: Props = $props();

  const OTHER = "\u0000other";
  let names = $state.raw<string[]>([]);
  let name = $state("");
  let custom = $state("");
  let value = $state<unknown>("");
  let busy = $state(false);
  let error = $state("");

  /** The properties the novel knows: those of every scene, those with a kind, those these scenes have. */
  async function load() {
    const found = new Map<string, string>();
    const add = (key: string) => {
      if (!RESERVED_PROPERTIES.includes(key) && !found.has(key.toLowerCase())) found.set(key.toLowerCase(), key);
    };
    try {
      Object.keys(await p.project.sceneProperties()).forEach(add);
      Object.keys(p.project.settings.properties).forEach(add);
      for (const path of p.paths) Object.keys(await p.project.properties(path)).forEach(add);
    } catch (e) {
      error = failure(e);
    }
    names = [...found.values()];
    name = names[0] ?? OTHER;
  }
  void load();

  const chosenName = $derived(name === OTHER ? custom.trim() : name);
  const def = $derived(chosenName ? propertyDef(p.project.settings.properties, chosenName) : null);
  // Another property starts from its empty value: a text, an unticked box, an empty list.
  $effect(() => {
    void chosenName;
    value = emptyValue(def);
  });

  async function apply() {
    if (!chosenName || busy) return;
    busy = true;
    error = "";
    try {
      await p.project.setPropertiesOf(p.paths, { [chosenName]: value });
      await p.onDone();
      p.onClose();
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog label={t("bulk.title", { n: p.paths.length })} onClose={p.onClose} width={460}>
  <h2>{t("bulk.title", { n: p.paths.length })}</h2>
  <p class="hint">{t("bulk.hint")}</p>
  <label class="field">
    <span>{t("bulk.property")}</span>
    <select bind:value={name}>
      {#each names as n (n)}<option value={n}>{n}</option>{/each}
      <option value={OTHER}>{t("bulk.other")}</option>
    </select>
  </label>
  {#if name === OTHER}
    <label class="field">
      <span>{t("bulk.name")}</span>
      <input bind:value={custom} />
    </label>
  {/if}
  {#if chosenName}
    <div class="field">
      <span>{t("bulk.value")}</span>
      {#key chosenName}
        <PropertyField name={chosenName} {value} {def} from={p.paths[0]} onChange={(v) => (value = v)} />
      {/key}
    </div>
  {/if}
  {#if error}<p class="error"><ErrorText text={error} /></p>{/if}
  <div class="actions">
    <button type="button" onclick={p.onClose}>{t("tree.cancel")}</button>
    <button type="button" class="primary" disabled={!chosenName || busy} onclick={apply}>{t("bulk.apply", { n: p.paths.length })}</button>
  </div>
</Dialog>

<style>
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .field {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: 13px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
