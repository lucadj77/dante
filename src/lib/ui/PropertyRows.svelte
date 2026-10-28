<script lang="ts">
  import type { Properties } from "$lib/core/frontmatter";
  import { canRenameProperty, type Project } from "$lib/core/project";
  import { KIND_ICONS, propertyDef, withDef, type PropertyDef } from "$lib/core/properties";
  import { dotLegend, dotProperty, treeMarks, type DotValue } from "$lib/core/statistics";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import { failure } from "./errors";
  import PropertyDefEditor from "./PropertyDefEditor.svelte";
  import PropertyField from "./PropertyField.svelte";

  // The properties of a scene, a chapter or a note, each with the sign of its kind before
  // its name: a click on the sign opens its definition, its name and the colours of the dot.
  interface Props {
    project: Project;
    entries: [string, unknown][];
    /** Properties the note does not have but every scene is offered: shown empty, written when filled. */
    offered?: string[];
    /** The note the properties belong to, for links. */
    from: string;
    onUpdate: (changes: Properties) => Promise<void>;
    onChanged: () => Promise<void>;
    onError: (message: string) => void;
  }
  let p: Props = $props();

  /** The property whose definition is open. */
  let defining = $state<string | null>(null);
  let legend = $state<DotValue[] | null>(null);

  // Another note shows its own properties, with no definition open.
  $effect(() => {
    void p.from;
    defining = null;
  });

  const isDot = (key: string) => dotProperty(p.project.settings).name.toLowerCase() === key.toLowerCase();

  // The dot's colours are read when its property's definition opens, and again after a change.
  $effect(() => {
    const key = defining;
    void p.project.settings;
    legend = null;
    if (!key || !isDot(key)) return;
    void p.project.index().then((index) => {
      if (defining !== key) return;
      legend = dotLegend(p.project.manuscript, treeMarks(p.project.manuscript, index, p.project.settings, () => 0), p.project.settings);
    });
  });

  async function save(settings: typeof p.project.settings) {
    try {
      await p.project.saveSettings(settings);
      await p.onChanged();
    } catch (e) {
      p.onError(failure(e));
    }
  }

  const define = (key: string, def: PropertyDef | null) => save({ ...p.project.settings, properties: withDef(p.project.settings.properties, key, def) });

  function color(key: string, value: string, hex: string) {
    const settings = p.project.settings;
    const name = dotProperty(settings).name;
    const own = { ...(settings.tree.colors[name] ?? {}) };
    if (hex) own[value.toLowerCase()] = hex;
    else delete own[value.toLowerCase()];
    const colors = { ...settings.tree.colors };
    if (Object.keys(own).length) colors[name] = own;
    else delete colors[name];
    if (legend) legend = legend.map((item) => (item.value === value ? { ...item, color: hex } : item));
    void save({ ...settings, tree: { ...settings.tree, colors } });
  }

  async function rename(key: string, to: string) {
    try {
      const { skipped } = await p.project.renameProperty(key, to);
      defining = to;
      await p.onChanged();
      if (skipped.length) p.onError(t("property.renameSkipped", { n: skipped.length, name: to }));
    } catch (e) {
      p.onError(failure(e));
    }
  }

  const rows = $derived([...p.entries.map(([k, v]) => ({ key: k, value: v, offered: false })), ...(p.offered ?? []).map((k) => ({ key: k, value: "" as unknown, offered: true }))]);
</script>

<dl>
  {#each rows as row (row.key)}
    {@const def = propertyDef(p.project.settings.properties, row.key)}
    {@const kind = def ? t(`property.kind.${def.kind}` as MessageKey) : t("property.free")}
    <div class="prop" class:offered={row.offered}>
      <dt>
        <button
          class="kind"
          aria-expanded={defining === row.key}
          aria-label={t("property.defineLabel", { name: row.key })}
          data-tip={t("property.defineTip", { kind })}
          onclick={() => (defining = defining === row.key ? null : row.key)}>{KIND_ICONS[def?.kind ?? ""]}</button
        >
        <span class="name">{row.key}</span>
        {#if row.offered}<span class="every" title={t("property.offeredTip")}>{t("property.offered")}</span>{/if}
      </dt>
      <dd>
        <PropertyField name={row.key} value={row.value} {def} from={p.from} onChange={(v) => void p.onUpdate({ [row.key]: v })} />
        {#if !row.offered}
          <button class="remove" aria-label={t("panel.remove", { name: row.key })} title={t("panel.remove", { name: row.key })} onclick={() => void p.onUpdate({ [row.key]: undefined })}>×</button>
        {/if}
      </dd>
      {#if defining === row.key}
        <PropertyDefEditor
          name={row.key}
          {def}
          types={p.project.settings.types}
          onSave={(d) => void define(row.key, d)}
          onRename={canRenameProperty(p.project.settings, row.key) ? (to) => rename(row.key, to) : undefined}
          legend={isDot(row.key) ? (legend ?? []) : undefined}
          onColor={(value, hex) => color(row.key, value, hex)}
        />
      {/if}
    </div>
  {/each}
</dl>

<style>
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
    gap: 6px;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The sign of the kind is a button: it looks like one, so it is found. */
  .kind {
    flex: none;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-panel);
    font-size: 11px;
    line-height: 18px;
    color: var(--accent, var(--text));
  }
  .kind:hover,
  .kind[aria-expanded="true"] {
    background: var(--bg-active);
    border-color: var(--accent, var(--text-muted));
    color: var(--text);
  }
  .every {
    margin-left: auto;
    font-size: 10px;
    padding: 0 5px;
    border: 1px dashed var(--border);
    border-radius: 8px;
  }
  .offered dd {
    opacity: 0.85;
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
</style>
