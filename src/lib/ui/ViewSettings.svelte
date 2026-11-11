<script lang="ts">
  import type { ViewSpec } from "$lib/core/views";
  import { SYNOPSIS, TITLE } from "$lib/core/manuscript";
  import { t } from "$lib/state.svelte";
  import ChipsInput from "./ChipsInput.svelte";

  // The settings of a view: what it shows, from where, filtered, sorted and grouped how.

  interface Props {
    spec: ViewSpec;
    /** The properties the items have, to filter, sort and group by. */
    choices: string[];
    /** The properties shown now. */
    fields: string[];
    /** The note types of the project. */
    typeIds: string[];
    /** The project's folders, offered as sources. */
    folders: string[];
    label: (field: string) => string;
    itemsLabel: (items: string) => string;
    /** The values the items have for a property, offered where values are chosen. */
    valuesOf?: (field: string) => string[];
    save: (changes: Partial<ViewSpec>) => Promise<void>;
  }
  let { spec, choices, fields, typeIds, folders, label, itemsLabel, valuesOf = () => [], save }: Props = $props();

  function setFilter(i: number, field: string, accepted: string[]) {
    const entries = Object.entries(spec.filter);
    entries[i] = [field, accepted];
    void save({ filter: Object.fromEntries(entries.filter(([f]) => f)) });
  }

  function removeFilter(i: number) {
    void save({ filter: Object.fromEntries(Object.entries(spec.filter).filter((_, j) => j !== i)) });
  }

  function addFilter() {
    const field = choices.find((c) => !(c in spec.filter) && c !== "name");
    if (field) void save({ filter: { ...spec.filter, [field]: [] } });
  }

  function toggleField(field: string, on: boolean) {
    const current = spec.fields.length ? spec.fields : fields;
    void save({ fields: on ? [...current.filter((f) => f !== field), field] : current.filter((f) => f !== field) });
  }
</script>

<section class="settings" aria-label={t("views.settings")}>
  <label>
    <span>{t("views.items")}</span>
    <select value={spec.items} onchange={(e) => save({ items: e.currentTarget.value })}>
      {#each ["scene", "chapter", "note", ...typeIds] as id (id)}
        <option value={id}>{itemsLabel(id)}</option>
      {/each}
      {#if !["scene", "chapter", "note", ...typeIds].includes(spec.items)}<option value={spec.items}>{spec.items}</option>{/if}
    </select>
  </label>
  <div class="row">
    <span>{t("views.source")}</span>
    <ChipsInput
      values={spec.source}
      suggestions={folders}
      label={t("views.source")}
      placeholder={t("views.sourceHint")}
      onChange={(source) => save({ source: source.map((s) => s.replace(/^\/+|\/+$/g, "")).filter(Boolean) })}
    />
  </div>
  <div class="filters">
    <span>{t("views.filter")}</span>
    {#each Object.entries(spec.filter) as [field, accepted], i (field)}
      <div class="filter">
        <select value={field} aria-label={t("views.filter")} onchange={(e) => setFilter(i, e.currentTarget.value, accepted)}>
          {#each choices as c (c)}<option value={c}>{label(c)}</option>{/each}
        </select>
        <ChipsInput values={accepted} suggestions={valuesOf(field)} label={t("views.filterValues")} placeholder={t("views.filterValues")} onChange={(list) => setFilter(i, field, list)} />
        <button aria-label={t("views.removeFilter")} data-tip={t("views.removeFilter")} onclick={() => removeFilter(i)}>×</button>
      </div>
    {/each}
    <button class="small" onclick={addFilter}>+ {t("views.addFilter")}</button>
  </div>
  <label>
    <span>{t("views.sort")}</span>
    <select value={spec.sort.replace(/^-/, "")} onchange={(e) => save({ sort: e.currentTarget.value ? (spec.sort.startsWith("-") ? "-" : "") + e.currentTarget.value : "" })}>
      <option value="">{t("views.natural")}</option>
      {#each choices as c (c)}<option value={c}>{label(c)}</option>{/each}
    </select>
    {#if spec.sort}
      <span class="check">
        <input type="checkbox" checked={spec.sort.startsWith("-")} onchange={(e) => save({ sort: (e.currentTarget.checked ? "-" : "") + spec.sort.replace(/^-/, "") })} />
        {t("views.descending")}
      </span>
    {/if}
  </label>
  <label>
    <span>{spec.type === "kanban" ? t("views.columnsBy") : t("views.groupBy")}</span>
    <select value={spec.group_by} onchange={(e) => save({ group_by: e.currentTarget.value, groups: [] })}>
      <option value="">{t("views.nothing")}</option>
      {#each choices as c (c)}<option value={c}>{label(c)}</option>{/each}
    </select>
  </label>
  {#if spec.group_by}
    <div class="row">
      <span>{t("views.groups")}</span>
      <ChipsInput values={spec.groups} suggestions={valuesOf(spec.group_by)} label={t("views.groups")} placeholder={t("views.groupsHint")} onChange={(groups) => save({ groups })} />
    </div>
  {/if}
  {#if spec.type === "timeline"}
    <label>
      <span>{t("views.date")}</span>
      <select value={spec.date} onchange={(e) => save({ date: e.currentTarget.value })}>
        <option value="">{t("views.pickProperty")}</option>
        {#each choices as c (c)}<option value={c}>{label(c)}</option>{/each}
      </select>
    </label>
    <label>
      <span>{t("views.end")}</span>
      <select value={spec.end} onchange={(e) => save({ end: e.currentTarget.value })}>
        <option value="">{t("views.nothing")}</option>
        {#each choices as c (c)}<option value={c}>{label(c)}</option>{/each}
      </select>
    </label>
  {/if}
  <fieldset>
    <legend>{t("views.fields")}</legend>
    <label class="check"><input type="checkbox" checked={spec.synopsis} onchange={(e) => save({ synopsis: e.currentTarget.checked })} /> {t("views.synopsis")}</label>
    {#each choices.filter((c) => c !== "name" && c !== SYNOPSIS && c !== TITLE) as c (c)}
      <label class="check"><input type="checkbox" checked={fields.includes(c)} onchange={(e) => toggleField(c, e.currentTarget.checked)} /> {label(c)}</label>
    {/each}
  </fieldset>
</section>

<style>
  .settings {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px 20px;
    padding: 12px;
    margin-bottom: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-panel);
    font-size: 13px;
  }
  .settings label,
  .settings .row,
  .filters {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .settings label > span:first-child,
  .settings .row > span:first-child,
  .filters > span,
  legend {
    color: var(--text-muted);
  }
  .filters,
  fieldset {
    grid-column: 1 / -1;
  }
  .filter {
    display: flex;
    gap: 4px;
  }
  .filter :global(.chips) {
    flex: 1;
  }
  .filters .small {
    align-self: start;
    font-size: 12px;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
  }
  .settings label.check,
  .check {
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
</style>
