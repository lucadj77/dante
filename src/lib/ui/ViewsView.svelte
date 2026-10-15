<script lang="ts">
  import { writeProperties } from "$lib/core/frontmatter";
  import { folderNotePath } from "$lib/core/manuscript";
  import type { NoteIndex } from "$lib/core/notes";
  import { basename, stripExt } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import {
    arrange,
    BUILT_IN,
    collect,
    defaultView,
    display,
    group,
    parseView,
    propertyNames,
    timeline,
    values,
    VIEW_KINDS,
    type Group,
    type ViewKind,
    type ViewRow,
    type ViewSpec,
  } from "$lib/core/views";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import { confirmDelete } from "./dialogs";
  import { navigator } from "./navigation";
  import { displayValue, parseValue } from "./propertyText";
  import { coerce, propertyDef } from "$lib/core/properties";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    /** The view file shown; the first one when null. */
    open: string | null;
    onShow: (path: string | null) => void;
    onReload: () => Promise<void>;
  }
  let p: Props = $props();
  const nav = navigator();

  const ICONS: Record<ViewKind, string> = { table: "▦", list: "☰", cards: "▤", kanban: "▥", timeline: "⟶" };

  const views = $derived.by(() => {
    void p.rev;
    return p.project.views;
  });
  const selected = $derived(p.open && views.includes(p.open) ? p.open : (views[0] ?? null));

  let spec = $state<ViewSpec>(defaultView());
  let error = $state("");
  let settingsOpen = $state(false);
  let creating = $state(false);
  let newName = $state("");
  let renaming = $state(false);
  let nameDraft = $state("");

  // The view file is read again when another view is chosen or the files change on disk.
  $effect(() => {
    const path = selected;
    void p.diskRev;
    if (!path) return;
    void p.project.fs.readText(path).then(
      (text) => {
        if (selected === path) spec = parseView(text);
      },
      () => {},
    );
  });

  let index = $state.raw<NoteIndex | null>(null);
  $effect(() => {
    void p.rev;
    void p.diskRev;
    void p.project.index().then((i) => (index = i));
  });

  /** Every note the view could list, before its conditions. */
  const all = $derived.by(() => {
    void p.rev;
    return index ? collect(spec, index, p.project.manuscript, p.project.settings) : [];
  });
  const rows = $derived(arrange(spec, all));

  /** Fields offered in the settings: the built-in ones, the type's, and those the notes use. */
  const choices = $derived.by(() => {
    const type = p.project.settings.types[spec.items];
    const names = new Set<string>([...BUILT_IN, ...(type?.properties ?? []), ...propertyNames(all)]);
    for (const f of [...spec.fields, spec.group_by, spec.date, spec.end, spec.sort.replace(/^-/, ""), ...Object.keys(spec.filter)]) if (f) names.add(f);
    names.delete("aliases");
    return [...names];
  });

  /** Fields shown on each item; a table without a choice shows the properties in use. */
  const fields = $derived.by(() => {
    if (spec.fields.length) return spec.fields;
    if (spec.type !== "table") return [];
    // "kind" only tells a chapter's folder note what the folder is, shown as its type.
    const used = propertyNames(rows).filter((f) => f !== "aliases" && f !== "type" && f !== "kind");
    return [...(spec.items === "scene" ? ["chapter"] : spec.items === "chapter" ? ["type"] : []), ...used.slice(0, 6), "words"];
  });

  // A property with allowed values gives its columns when the view lists none.
  const groupDef = $derived(spec.group_by ? propertyDef(p.project.settings.properties, spec.group_by) : null);
  const groups = $derived<Group[]>(
    spec.group_by ? group(spec.groups.length || !groupDef?.values.length ? spec : { ...spec, groups: groupDef.values }, rows) : [{ key: "", rows }],
  );
  const moments = $derived(timeline(spec, rows));

  function label(field: string): string {
    return (BUILT_IN as readonly string[]).includes(field) ? t(`views.field.${field}` as MessageKey) : field;
  }

  /** A field as shown: types by their names, the rest as written. */
  function shown(row: ViewRow, field: string): string {
    if (field === "type" && row.type) {
      if (["part", "chapter", "prologue", "epilogue", "scene"].includes(row.type)) return t(`kind.${row.type}` as MessageKey);
      return p.project.settings.types[row.type]?.name ?? row.type;
    }
    return display(row, field);
  }

  function itemsLabel(items: string): string {
    if (items === "scene" || items === "chapter" || items === "note") return t(`views.items.${items}`);
    const type = p.project.settings.types[items];
    return type ? `${type.icon} ${type.name}`.trim() : items;
  }

  const fail = (e: unknown) => (error = t("error.generic", { message: e instanceof Error ? e.message : String(e) }));

  async function save(changes: Partial<ViewSpec>) {
    if (!selected) return;
    const next = { ...spec, ...changes };
    spec = next;
    try {
      await p.project.saveView(selected, next);
    } catch (e) {
      fail(e);
    }
  }

  async function create(name: string, view: ViewSpec): Promise<string | null> {
    error = "";
    try {
      const path = await p.project.createView(name, view);
      await p.onReload();
      p.onShow(path);
      return path;
    } catch (e) {
      fail(e);
      return null;
    }
  }

  async function createNew() {
    const name = newName.trim();
    if (!name) return;
    creating = false;
    newName = "";
    if (await create(name, { ...defaultView("table"), items: "scene" })) settingsOpen = true;
  }

  async function createStarters() {
    await create(t("views.starter.board"), { ...defaultView("kanban"), items: "scene", group_by: "status", groups: ["idea", "draft", "revised", "done"], fields: ["pov"] });
    await create(t("views.starter.scenes"), { ...defaultView("table"), items: "scene", fields: ["chapter", "status", "pov", "words"] });
  }

  async function rename() {
    renaming = false;
    if (!selected || !nameDraft.trim()) return;
    try {
      const to = await p.project.renamePath(selected, nameDraft);
      await p.onReload();
      p.onShow(to);
    } catch (e) {
      fail(e);
    }
  }

  async function remove() {
    if (!selected || !(await confirmDelete(t("views.confirmDelete", { name: stripExt(basename(selected)) })))) return;
    try {
      await p.project.trash(selected);
      await p.onReload();
      p.onShow(null);
    } catch (e) {
      fail(e);
    }
  }

  function openRow(row: ViewRow) {
    nav?.open(row.file ?? row.path);
  }

  /** Writes properties of the note behind a row, or of a chapter's folder note. */
  async function setValues(row: ViewRow, changes: Record<string, unknown>) {
    const file = row.file ?? folderNotePath(row.path);
    try {
      const text = (await p.project.fs.exists(file)) ? await p.project.fs.readText(file) : "";
      await p.project.writeNote(file, writeProperties(text, changes));
      await p.onReload();
    } catch (e) {
      fail(e);
    }
  }

  // Table: sorting by a column and changing a cell.

  function sortBy(field: string) {
    void save({ sort: spec.sort === field ? `-${field}` : spec.sort === `-${field}` ? "" : field });
  }
  const sortMark = (field: string) => (spec.sort === field ? " ▲" : spec.sort === `-${field}` ? " ▼" : "");

  let editing = $state<{ path: string; field: string; text: string } | null>(null);
  const editable = (field: string) => !(BUILT_IN as readonly string[]).includes(field);

  function startEdit(row: ViewRow, field: string) {
    editing = { path: row.path, field, text: displayValue(row.properties[field]) };
  }

  async function commitEdit(row: ViewRow) {
    const e = editing;
    editing = null;
    if (!e || e.text === displayValue(row.properties[e.field])) return;
    const value = e.text.trim() === "" ? undefined : readValue(e.text, row.properties[e.field], e.field);
    await setValues(row, { [e.field]: value });
  }

  /** A typed value back from the cell's text, by the property's definition when there is one. */
  function readValue(text: string, previous: unknown, field: string): unknown {
    const def = propertyDef(p.project.settings.properties, field);
    return def ? coerce(text, def) : parseValue(text, previous, field);
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // Board: dragging a card to another column changes the grouping property.

  let dragging = $state<ViewRow | null>(null);
  let over = $state<string | null>(null);
  let newColumn = $state("");

  async function drop(key: string) {
    const row = dragging;
    dragging = null;
    over = null;
    if (!row || (values(row, spec.group_by)[0] ?? "").toLowerCase() === key.toLowerCase()) return;
    await setValues(row, { [spec.group_by]: key === "" ? undefined : key });
  }

  function addColumn() {
    const name = newColumn.trim();
    newColumn = "";
    if (!name || spec.groups.some((g) => g.toLowerCase() === name.toLowerCase())) return;
    const shown = groups.map((g) => g.key).filter(Boolean);
    void save({ groups: [...new Set([...spec.groups, ...shown, name])] });
  }

  // Settings.

  const csv = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

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

  const count = (n: number) => (n === 1 ? t("views.countOne") : t("views.count", { count: n }));
  const typeIds = $derived(Object.keys(p.project.settings.types));
</script>

<div class="views">
  <aside>
    <ul>
      {#each views as path (path)}
        <li>
          <button class="view-link" aria-current={path === selected ? "page" : undefined} onclick={() => p.onShow(path)}>{stripExt(basename(path))}</button>
        </li>
      {/each}
    </ul>
    {#if creating}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void createNew();
        }}
      >
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={newName} placeholder={t("views.newName")} aria-label={t("views.newName")} autofocus onkeydown={(e) => e.key === "Escape" && (creating = false)} />
        <button class="primary" disabled={!newName.trim()}>{t("views.create")}</button>
      </form>
    {:else}
      <button onclick={() => (creating = true)}>+ {t("views.new")}</button>
    {/if}
  </aside>

  <main>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if !selected}
      <div class="intro">
        <p>{t("views.none", { folder: p.project.settings.folders.views })}</p>
        <button class="primary" onclick={createStarters}>{t("views.starters")}</button>
      </div>
    {:else}
      <header>
        {#if renaming}
          <form
            onsubmit={(e) => {
              e.preventDefault();
              void rename();
            }}
          >
            <!-- svelte-ignore a11y_autofocus -->
            <input class="name-input" bind:value={nameDraft} autofocus aria-label={t("views.rename")} onblur={rename} onkeydown={(e) => e.key === "Escape" && (renaming = false)} />
          </form>
        {:else}
          <h2>
            <button
              class="name"
              data-tip={t("views.rename")}
              onclick={() => {
                nameDraft = stripExt(basename(selected));
                renaming = true;
              }}>{stripExt(basename(selected))}</button
            >
          </h2>
        {/if}
        <span class="count">{itemsLabel(spec.items)} · {count(rows.length)}</span>
        <div class="kinds" role="group">
          {#each VIEW_KINDS as kind (kind)}
            <button
              aria-pressed={spec.type === kind}
              data-tip={t("tip.views.kind", { kind: t(`views.kind.${kind}`).toLowerCase() })}
              onclick={() => save({ type: kind })}><span aria-hidden="true">{ICONS[kind]}</span> {t(`views.kind.${kind}`)}</button
            >
          {/each}
        </div>
        <button aria-pressed={settingsOpen} aria-expanded={settingsOpen} data-tip={t("tip.views.settings")} onclick={() => (settingsOpen = !settingsOpen)}>⚙ {t("views.settings")}</button>
        <button class="danger" onclick={remove}>{t("views.delete")}</button>
      </header>

      {#if settingsOpen}
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
          <label>
            <span>{t("views.source")}</span>
            <input
              list="view-folders"
              value={spec.source.join(", ")}
              placeholder={t("views.sourceHint")}
              onchange={(e) => save({ source: csv(e.currentTarget.value).map((s) => s.replace(/^\/+|\/+$/g, "")) })}
            />
            <datalist id="view-folders">
              {#each p.project.folders as folder (folder)}<option value={folder}></option>{/each}
            </datalist>
          </label>
          <div class="filters">
            <span>{t("views.filter")}</span>
            {#each Object.entries(spec.filter) as [field, accepted], i (field)}
              <div class="filter">
                <select value={field} aria-label={t("views.filter")} onchange={(e) => setFilter(i, e.currentTarget.value, accepted)}>
                  {#each choices as c (c)}<option value={c}>{label(c)}</option>{/each}
                </select>
                <input
                  value={accepted.join(", ")}
                  placeholder={t("views.filterValues")}
                  aria-label={t("views.filterValues")}
                  onchange={(e) => setFilter(i, field, csv(e.currentTarget.value))}
                />
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
            <select value={spec.group_by} onchange={(e) => save({ group_by: e.currentTarget.value })}>
              <option value="">{t("views.nothing")}</option>
              {#each choices as c (c)}<option value={c}>{label(c)}</option>{/each}
            </select>
          </label>
          {#if spec.group_by}
            <label>
              <span>{t("views.groups")}</span>
              <input value={spec.groups.join(", ")} placeholder={t("views.groupsHint")} onchange={(e) => save({ groups: csv(e.currentTarget.value) })} />
            </label>
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
            {#each choices.filter((c) => c !== "name") as c (c)}
              <label class="check"><input type="checkbox" checked={fields.includes(c)} onchange={(e) => toggleField(c, e.currentTarget.checked)} /> {label(c)}</label>
            {/each}
          </fieldset>
        </section>
      {/if}

      <div class="body">
        {#if !index}
          …
        {:else if spec.type === "kanban" && !spec.group_by}
          {@render need(t("views.needGroup"), "group_by")}
        {:else if spec.type === "timeline" && !spec.date}
          {@render need(t("views.needDate"), "date")}
        {:else if rows.length === 0 && spec.type !== "kanban"}
          <p class="muted">{t("views.empty")}</p>
        {:else if spec.type === "table"}
          <table>
            <thead>
              <tr>
                {#each ["name", ...fields] as f (f)}
                  <th class:number={f === "words"}><button data-tip={t("tip.views.sort")} onclick={() => sortBy(f)}>{label(f)}{sortMark(f)}</button></th>
                {/each}
              </tr>
            </thead>
            {#each groups as g (g.key)}
              <tbody>
                {#if spec.group_by}
                  <tr class="group-row"><th colspan={fields.length + 1}>{g.key || t("views.noValue")} <span class="count">{g.rows.length}</span></th></tr>
                {/if}
                {#each g.rows as row (row.path)}
                  <tr>
                    <td><button class="link" onclick={() => openRow(row)}>{row.name}</button></td>
                    {#each fields as f (f)}
                      <td class:number={f === "words"}>
                        {#if editing && editing.path === row.path && editing.field === f}
                          <input
                            class="cell-input"
                            bind:value={editing.text}
                            aria-label={label(f)}
                            use:focus
                            onblur={() => commitEdit(row)}
                            onkeydown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              else if (e.key === "Escape") editing = null;
                            }}
                          />
                        {:else if editable(f)}
                          <button class="cell" data-tip={t("views.edit")} onclick={() => startEdit(row, f)}>{shown(row, f) || " "}</button>
                        {:else}
                          {shown(row, f)}
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            {/each}
          </table>
        {:else if spec.type === "list"}
          {#each groups as g (g.key)}
            {#if spec.group_by}<h3 class="group-title">{g.key || t("views.noValue")} <span class="count">{g.rows.length}</span></h3>{/if}
            <ul class="list">
              {#each g.rows as row (row.path)}
                <li>
                  <button class="link" onclick={() => openRow(row)}>{row.name}</button>
                  {@render details(row)}
                </li>
              {/each}
            </ul>
          {/each}
        {:else if spec.type === "cards"}
          {#each groups as g (g.key)}
            {#if spec.group_by}<h3 class="group-title">{g.key || t("views.noValue")} <span class="count">{g.rows.length}</span></h3>{/if}
            <div class="cards">
              {#each g.rows as row (row.path)}
                {@render card(row, true)}
              {/each}
            </div>
          {/each}
        {:else if spec.type === "kanban"}
          <div class="board">
            {#each groups as g (g.key)}
              <section
                class="column"
                class:over={over === g.key && dragging !== null}
                aria-label={g.key || t("views.noValue")}
                ondragover={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  over = g.key;
                }}
                ondragleave={() => over === g.key && (over = null)}
                ondrop={(e) => {
                  e.preventDefault();
                  void drop(g.key);
                }}
              >
                <h3>{g.key || t("views.noValue")} <span class="count">{g.rows.length}</span></h3>
                {#each g.rows as row (row.path)}
                  {@render card(row, false)}
                {/each}
              </section>
            {/each}
            <form
              class="column add"
              onsubmit={(e) => {
                e.preventDefault();
                addColumn();
              }}
            >
              <input bind:value={newColumn} placeholder={"+ " + t("views.addColumn")} aria-label={t("views.addColumn")} data-tip={t("views.addColumnHint")} />
            </form>
          </div>
        {:else if spec.type === "timeline"}
          <ol class="timeline">
            {#each moments.moments as m (m.key + "|" + m.end)}
              <li>
                <div class="when">{m.label}{#if m.end}<span class="end"> – {m.end}</span>{/if}</div>
                <div class="what">
                  {#each m.rows as row (row.path)}
                    {@render card(row, false)}
                  {/each}
                </div>
              </li>
            {/each}
          </ol>
          {#if moments.undated.length}
            <h3 class="group-title">{t("views.undated")} <span class="count">{moments.undated.length}</span></h3>
            <ul class="list">
              {#each moments.undated as row (row.path)}
                <li><button class="link" onclick={() => openRow(row)}>{row.name}</button> {@render details(row)}</li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    {/if}
  </main>
</div>

{#snippet details(row: ViewRow)}
  {#each fields as f (f)}
    {#if shown(row, f)}<span class="field"><span class="key">{label(f)}</span> {shown(row, f)}</span>{/if}
  {/each}
{/snippet}

{#snippet card(row: ViewRow, long: boolean)}
  <article
    class="card"
    draggable={spec.type === "kanban" ? "true" : undefined}
    data-tip={spec.type === "kanban" ? t("tip.views.drag", { field: label(spec.group_by) }) : undefined}
    ondragstart={(e) => {
      dragging = row;
      e.dataTransfer?.setData("text/plain", row.path);
    }}
    ondragend={() => {
      dragging = null;
      over = null;
    }}
  >
    <button class="link title" onclick={() => openRow(row)}>{row.name}</button>
    {#if long && row.chapter && spec.items === "scene"}<div class="muted small">{row.chapter}</div>{/if}
    {#if long && row.excerpt}<p class="excerpt">{row.excerpt}</p>{/if}
    <div class="fields">{@render details(row)}</div>
  </article>
{/snippet}

{#snippet need(message: string, key: "group_by" | "date")}
  <div class="intro">
    <p>{message}</p>
    <select aria-label={t("views.pickProperty")} value="" onchange={(e) => save({ [key]: e.currentTarget.value } as Partial<ViewSpec>)}>
      <option value="">{t("views.pickProperty")}</option>
      {#each choices.filter((c) => c !== "name") as c (c)}<option value={c}>{label(c)}</option>{/each}
    </select>
  </div>
{/snippet}

<style>
  .views {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }
  aside {
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
    padding: 8px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  aside ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  aside form {
    display: grid;
    gap: 4px;
  }
  .view-link {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .view-link[aria-current] {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    font-weight: 600;
  }
  main {
    overflow: auto;
    min-height: 0;
    padding: 12px 20px 40px;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  header h2 {
    margin: 0;
    font-size: 18px;
  }
  .name {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 600;
  }
  .name-input {
    font-size: 16px;
  }
  .count {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: normal;
  }
  .kinds {
    display: flex;
    margin-left: auto;
  }
  .kinds button {
    border-radius: 0;
    font-size: 13px;
  }
  .kinds button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .kinds button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .kinds button + button {
    margin-left: -1px;
  }
  .kinds button[aria-pressed="true"],
  header > button[aria-pressed="true"] {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }
  .danger {
    color: var(--danger);
  }
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
  .filters {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .settings label > span:first-child,
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
  .filter input {
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
  .intro {
    max-width: 560px;
    color: var(--text-muted);
    display: grid;
    gap: 10px;
    justify-items: start;
  }
  .muted {
    color: var(--text-muted);
  }
  .small {
    font-size: 12px;
  }
  .error {
    color: var(--danger);
    font-size: 13px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 14px;
  }
  th,
  td {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    line-height: 1.5;
  }
  th button {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 600;
    color: inherit;
  }
  .number {
    text-align: right;
  }
  .group-row th {
    background: var(--bg-panel);
    padding-top: 10px;
  }
  .cell {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    display: block;
    width: 100%;
    min-height: 1.5em;
    line-height: inherit;
    border-radius: 0;
    cursor: text;
  }
  .cell-input {
    width: 100%;
    font: inherit;
  }
  .group-title {
    font-size: 14px;
    margin: 16px 0 6px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    align-items: baseline;
  }
  .field {
    font-size: 12px;
    color: var(--text);
  }
  .key {
    color: var(--text-muted);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    background: var(--bg);
    display: grid;
    gap: 4px;
    align-content: start;
  }
  .card .title {
    font-weight: 600;
  }
  .card .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
  }
  .excerpt {
    margin: 0;
    font-family: var(--editor-font);
    font-size: 14px;
    line-height: 1.5;
  }
  .board {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    overflow-x: auto;
    padding-bottom: 8px;
  }
  .column {
    flex: 0 0 240px;
    display: grid;
    gap: 6px;
    padding: 8px;
    border-radius: 8px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    min-height: 80px;
    align-content: start;
  }
  .column.over {
    border-color: var(--accent);
  }
  .column h3 {
    margin: 0 0 2px;
    font-size: 13px;
  }
  .column .card {
    cursor: grab;
  }
  .column.add {
    background: none;
    border-style: dashed;
    min-height: 0;
  }
  .timeline {
    list-style: none;
    margin: 0;
    padding: 0 0 0 4px;
    border-left: 2px solid var(--border);
  }
  .timeline li {
    position: relative;
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 12px;
    padding: 6px 0 10px 16px;
  }
  .timeline li::before {
    content: "";
    position: absolute;
    left: -7px;
    top: 12px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
  }
  .when {
    font-weight: 600;
    font-size: 13px;
    padding-top: 6px;
  }
  .end {
    font-weight: normal;
    color: var(--text-muted);
  }
  .what {
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
</style>
