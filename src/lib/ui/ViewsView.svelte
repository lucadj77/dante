<script lang="ts">
  import { writeProperties } from "$lib/core/frontmatter";
  import { findNode, folderNotePath } from "$lib/core/manuscript";
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
    chapterPaths,
    values,
    moveBefore,
    shiftEnd,
    VIEW_KINDS,
    type Group,
    type Moment,
    type ViewKind,
    type ViewRow,
    type ViewSpec,
  } from "$lib/core/views";
  import type { MessageKey } from "$lib/i18n";
  import { num, t } from "$lib/state.svelte";
  import { confirmDelete } from "./dialogs";
  import { navigator } from "./navigation";
  import { displayValue, parseValue } from "./propertyText";
  import { SYNOPSIS, TITLE } from "$lib/core/manuscript";
  import { coerce, emptyValue, propertyDef } from "$lib/core/properties";
  import { isWithin } from "$lib/core/path";
  import { readableLinks } from "$lib/core/wikilinks";
  import PropertyField from "./PropertyField.svelte";
  import { panes } from "./panes.svelte";
  import { tick } from "svelte";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    /** The view file shown; the first one when null. */
    open: string | null;
    onShow: (path: string | null) => void;
    onReload: () => Promise<void>;
    /** Shown in a pane beside another section: the view alone, without the list of views. */
    embedded?: boolean;
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
  const chapters = $derived.by(() => {
    void rows;
    return chapterPaths(p.project.manuscript, p.project.settings);
  });
  /** The groups the view lists, else the property's allowed values, else every chapter. */
  const defaultGroups = $derived(groupDef?.values.length ? groupDef.values : spec.group_by === "chapter" ? [...chapters.keys()] : []);
  const groups = $derived<Group[]>(spec.group_by ? group(spec.groups.length ? spec : { ...spec, groups: defaultGroups }, rows) : [{ key: "", rows }]);
  /** Each row's group, for the timeline's lanes. */
  const groupOf = $derived(new Map(groups.map((g) => g.rows.map((r) => [r.path, g.key] as const)).flat()));

  function label(field: string): string {
    return (BUILT_IN as readonly string[]).includes(field) ? t(`views.field.${field}` as MessageKey) : field;
  }

  /** A field as shown: types by their names, the rest as written. */
  function shown(row: ViewRow, field: string): string {
    if (field === "type" && row.type) {
      if (["part", "chapter", "prologue", "epilogue", "scene"].includes(row.type)) return t(`kind.${row.type}` as MessageKey);
      return p.project.settings.types[row.type]?.name ?? row.type;
    }
    if (field === "words") return num(row.words);
    return readableLinks(display(row, field));
  }
  /** A group's heading: links by their names. */
  const groupName = (key: string) => (key ? readableLinks(key) : t("views.noValue"));

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

  // The card of a note: its properties, changed without opening it.
  let inspecting = $state<string | null>(null);
  const inspected = $derived(inspecting ? (rows.find((r) => r.path === inspecting) ?? null) : null);
  let newProperty = $state("");
  // Another view starts without a card open.
  $effect(() => {
    void selected;
    inspecting = null;
  });
  const hidden = new Set<string>([SYNOPSIS, TITLE, "kind", "type", "aliases", ...BUILT_IN]);
  // The view's own properties (fields, grouping, sorting, dates) and those of the note's type are
  // on the card even when the note has none yet, so a note without a value can be given one.
  const viewKeys = $derived([...fields, spec.group_by, spec.sort.replace(/^-/, ""), spec.date, spec.end, ...Object.keys(spec.filter)]);
  function cardKeys(row: ViewRow): string[] {
    const keys: string[] = [];
    const typeKeys = (row.type && p.project.settings.types[row.type]?.properties) || [];
    for (const k of [...Object.keys(row.properties), ...viewKeys, ...typeKeys])
      if (k && !hidden.has(k) && !keys.some((o) => o.toLowerCase() === k.toLowerCase())) keys.push(k);
    return keys;
  }
  /** A click on an item shows its card; with Alt (Option) it opens beside, in a pane. */
  function inspect(row: ViewRow, e?: MouseEvent) {
    if (e?.altKey) {
      nav?.open(row.file ?? row.path, true);
      return;
    }
    // In a pane there is no room for the card: the item opens in its section.
    if (p.embedded) {
      openRow(row);
      return;
    }
    inspecting = inspecting === row.path ? null : row.path;
  }

  /** The item of the scene being written, marked so it can be found at a glance. */
  const writes = (row: ViewRow) => !!panes.writing && (row.path === panes.writing || row.file === panes.writing);
  let body = $state<HTMLDivElement | null>(null);
  // Brings the scene being written into view when it changes.
  $effect(() => {
    const path = panes.writing;
    void rows;
    if (!path || !body) return;
    void tick().then(() => body?.querySelector(".writing")?.scrollIntoView({ block: "nearest", inline: "nearest" }));
  });
  function addProperty(row: ViewRow) {
    const key = newProperty.trim();
    newProperty = "";
    if (!key || key in row.properties) return;
    const def = propertyDef(p.project.settings.properties, key);
    void setValues(row, { [key]: def ? emptyValue(def) : "" });
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

  const synopsisText = (row: ViewRow) => displayValue(row.properties[SYNOPSIS]).trim();

  /** A typed value back from the cell's text, by the property's definition when there is one. */
  function readValue(text: string, previous: unknown, field: string): unknown {
    const def = propertyDef(p.project.settings.properties, field);
    return def ? coerce(text, def) : parseValue(text, previous, field);
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // Dragging an item: to another group it changes the grouping property (a scene grouped by
  // chapter moves into that chapter's folder); among the others it changes the view's order
  // (the manuscript's, for scenes grouped by chapter); on the timeline it changes the date.

  /** Where an item is being dropped: a group (null without one), the item it goes before, a date. */
  interface Target {
    key: string | null;
    before: string | null;
    date?: string;
    reorder: boolean;
  }
  let dragging = $state<ViewRow | null>(null);
  let target = $state<Target | null>(null);
  let newColumn = $state("");

  const builtIn = (field: string) => (BUILT_IN as readonly string[]).includes(field);
  const byChapter = $derived(spec.group_by === "chapter" && spec.items === "scene");
  const canRegroup = $derived(!!spec.group_by && (!builtIn(spec.group_by) || byChapter));
  /** Whether dragging means something in this view. */
  const canDrag = $derived(spec.type === "timeline" ? canRegroup || (!!spec.date && !builtIn(spec.date)) : true);
  const dragTip = $derived(spec.type === "timeline" ? t("tip.views.dragTimeline") : canRegroup ? t("tip.views.drag", { field: label(spec.group_by) }) : t("tip.views.dragOrder"));

  /** Follows the pointer over a drop zone: which item the dragged one would go before. */
  function dragOver(e: DragEvent, zone: Omit<Target, "before">) {
    if (!dragging) return;
    e.preventDefault();
    let before: string | null = null;
    const el = zone.reorder ? (e.target as Element).closest<HTMLElement>("[data-path]") : null;
    if (el) {
      const r = el.getBoundingClientRect();
      const after = el.dataset.flow === "x" ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      before = after ? el.dataset.next || null : (el.dataset.path ?? null);
    }
    if (target?.key !== zone.key || target.before !== before || target.date !== zone.date) target = { ...zone, before };
  }
  function dragLeave(e: DragEvent) {
    const into = e.relatedTarget as Node | null;
    if (!into || !(e.currentTarget as Element).contains(into)) target = null;
  }
  const isZone = (key: string | null, date?: string) => !!dragging && !!target && target.key === key && target.date === date;
  const dropsBefore = (row: ViewRow, key: string | null) => isZone(key) && target!.before === row.path && dragging!.path !== row.path;

  async function drop(e: DragEvent) {
    e.preventDefault();
    const row = dragging;
    const to = target;
    dragging = null;
    target = null;
    if (!row || !to) return;
    const from = groupOf.get(row.path) ?? "";
    const regroup = canRegroup && to.key !== null && from.toLowerCase() !== to.key.toLowerCase();
    const reorder = to.reorder && (to.before !== null || !regroup);
    const changes: Record<string, unknown> = {};
    if (regroup && !byChapter) changes[spec.group_by] = to.key === "" ? undefined : to.key;
    if (to.date !== undefined && spec.date && !builtIn(spec.date)) {
      const start = values(row, spec.date)[0] ?? "";
      if (start !== to.date) {
        changes[spec.date] = to.date;
        const end = spec.end && !builtIn(spec.end) ? (values(row, spec.end)[0] ?? "") : "";
        if (end) {
          const moved = shiftEnd(start, end, to.date);
          if (moved !== end) changes[spec.end] = moved;
        }
      }
    }
    // The view's new order, worked out before the notes change.
    const all = groups.flatMap((g) => g.rows.map((r) => r.path));
    const among = groups.find((g) => g.key === to.key)?.rows.map((r) => r.path) ?? [];
    const order = reorder && !byChapter ? moveBefore(all, row.path, to.before, among) : null;
    try {
      if (byChapter && (regroup || reorder) && to.key !== null) await moveScene(row, to.key, to.before);
      if (Object.keys(changes).length) await setValues(row, changes);
      if (order && (order.join("\n") !== all.join("\n") || spec.sort)) await save({ order, sort: "" });
      else if (byChapter && reorder && (spec.sort || spec.order.length)) await save({ order: [], sort: "" });
    } catch (e) {
      fail(e);
    }
  }

  /** What makes an item draggable: `next` is the item after it in its group, `flow` "x" for a grid. */
  function item(row: ViewRow, next: ViewRow | undefined, flow: "x" | "y" = "y") {
    if (!canDrag || (editing && editing.path === row.path)) return {};
    return {
      draggable: "true" as const,
      "data-path": row.path,
      "data-next": next?.path ?? "",
      "data-flow": flow,
      "data-tip": dragTip,
      ondragstart: (e: DragEvent) => {
        dragging = row;
        e.dataTransfer?.setData("text/plain", row.path);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      },
      ondragend: () => {
        dragging = null;
        target = null;
      },
    };
  }
  /** What makes an element a place to drop items on. */
  function zone(z: Omit<Target, "before">) {
    if (!canDrag) return {};
    return { ondragover: (e: DragEvent) => dragOver(e, z), ondragleave: dragLeave, ondrop: drop };
  }

  /** A scene grouped by chapter moves into the chapter's folder, before `before` or last. */
  async function moveScene(row: ViewRow, key: string, before: string | null) {
    const folder = chapters.get(key);
    if (!folder || !row.file || row.file !== row.path) return;
    const siblings = (findNode(p.project.manuscript, folder)?.children ?? []).filter((c) => c.path !== row.path);
    const at = before ? siblings.findIndex((c) => c.path === before) : -1;
    await p.project.move(row.path, folder, at < 0 ? siblings.length : at);
    await p.onReload();
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

<div class="views" class:inspecting={!!inspected && !p.embedded} class:embedded={p.embedded}>
  {#if !p.embedded}
  <aside>
    <ul>
      {#each views as path (path)}
        <li>
          <button class="view-link" aria-current={path === selected ? "page" : undefined} title={t("tip.openBeside")} onclick={(e) => (e.altKey ? nav?.open(path, true) : p.onShow(path))}>{stripExt(basename(path))}</button>
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
  {/if}

  <main>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if !selected}
      <div class="intro">
        <p>{t("views.none", { folder: p.project.settings.folders.views })}</p>
        <button class="primary" onclick={createStarters}>{t("views.starters")}</button>
      </div>
    {:else}
      <header>
        {#if p.embedded}
          <!-- The pane's header names the view. -->
        {:else if renaming}
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
        {#if !p.embedded}
          <button aria-pressed={settingsOpen} aria-expanded={settingsOpen} data-tip={t("tip.views.settings")} onclick={() => (settingsOpen = !settingsOpen)}>⚙ {t("views.settings")}</button>
          <button class="danger" onclick={remove}>{t("views.delete")}</button>
        {/if}
      </header>

      {#if settingsOpen && !p.embedded}
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
            <select value={spec.group_by} onchange={(e) => save({ group_by: e.currentTarget.value, groups: [] })}>
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
            <label class="check"><input type="checkbox" checked={spec.synopsis} onchange={(e) => save({ synopsis: e.currentTarget.checked })} /> {t("views.synopsis")}</label>
            {#each choices.filter((c) => c !== "name" && c !== SYNOPSIS && c !== TITLE) as c (c)}
              <label class="check"><input type="checkbox" checked={fields.includes(c)} onchange={(e) => toggleField(c, e.currentTarget.checked)} /> {label(c)}</label>
            {/each}
          </fieldset>
        </section>
      {/if}

      <div class="body" bind:this={body}>
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
              <tbody class:over={isZone(g.key) && target?.before === null} {...zone({ key: g.key, reorder: true })}>
                {#if spec.group_by}
                  <tr class="group-row"><th colspan={fields.length + 1}>{groupName(g.key)} <span class="count">{g.rows.length}</span></th></tr>
                {/if}
                {#each g.rows as row, i (row.path)}
                  <tr class:drop-before={dropsBefore(row, g.key)} class:writing={writes(row)} {...item(row, g.rows[i + 1])}>
                    <td><button class="link" onclick={(e) => inspect(row, e)}>{row.name}</button>{@render synopsisOf(row)}</td>
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
            {#if spec.group_by}<h3 class="group-title">{groupName(g.key)} <span class="count">{g.rows.length}</span></h3>{/if}
            <ul class="list" class:over={isZone(g.key) && target?.before === null} {...zone({ key: g.key, reorder: true })}>
              {#each g.rows as row, i (row.path)}
                <li class:drop-before={dropsBefore(row, g.key)} class:writing={writes(row)} {...item(row, g.rows[i + 1])}>
                  <button class="link" onclick={(e) => inspect(row, e)}>{row.name}</button>
                  {@render details(row)}
                  {@render synopsisOf(row)}
                </li>
              {/each}
            </ul>
          {/each}
        {:else if spec.type === "cards"}
          {#each groups as g (g.key)}
            {#if spec.group_by}<h3 class="group-title">{groupName(g.key)} <span class="count">{g.rows.length}</span></h3>{/if}
            <div class="cards" class:over={isZone(g.key) && target?.before === null} {...zone({ key: g.key, reorder: true })}>
              {#each g.rows as row, i (row.path)}
                {@render card(row, true, g.key, g.rows[i + 1], "x")}
              {/each}
            </div>
          {/each}
        {:else if spec.type === "kanban"}
          <div class="board">
            {#each groups as g (g.key)}
              <section class="column" class:over={isZone(g.key) && target?.before === null} aria-label={groupName(g.key)} {...zone({ key: g.key, reorder: true })}>
                <h3>{groupName(g.key)} <span class="count">{g.rows.length}</span></h3>
                {#each g.rows as row, i (row.path)}
                  {@render card(row, false, g.key, g.rows[i + 1])}
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
        {:else if spec.type === "timeline" && spec.group_by}
          {@render lanesOf(timeline(spec, rows))}
        {:else if spec.type === "timeline"}
          {@render timelineOf(timeline(spec, rows))}
        {/if}
      </div>
    {/if}
  </main>
  {#if inspected && !p.embedded}
    {@const row = inspected}
    <section class="inspector" aria-label={row.name}>
      <header>
        <h3>{row.name}</h3>
        <button class="close" aria-label={t("app.close")} onclick={() => (inspecting = null)}>×</button>
      </header>
      <button class="open" onclick={() => openRow(row)}>{t("views.openNote")}</button>
      {#if row.chapter && spec.items === "scene"}<p class="muted small">{row.chapter}</p>{/if}
      {#if row.file === null || isWithin(row.path, p.project.settings.folders.manuscript)}
        <label class="prop">
          <span>{t("panel.synopsis")}</span>
          {#key row.path + synopsisText(row)}
            <textarea
              rows="4"
              value={synopsisText(row)}
              placeholder={t("panel.synopsisHint")}
              onchange={(e) => {
                const value = e.currentTarget.value.trim();
                if (value !== synopsisText(row)) void setValues(row, { [SYNOPSIS]: value || undefined });
              }}
            ></textarea>
          {/key}
        </label>
      {/if}
      {#each cardKeys(row) as key (key)}
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
                if (JSON.stringify(v) !== JSON.stringify(value)) void setValues(row, { [key]: v });
              }}
            />
            {#if key in row.properties}
              <button class="remove" aria-label={t("panel.remove", { name: key })} onclick={() => setValues(row, { [key]: undefined })}>×</button>
            {/if}
          </div>
        </div>
      {/each}
      <form
        class="add"
        onsubmit={(e) => {
          e.preventDefault();
          addProperty(row);
        }}
      >
        <input bind:value={newProperty} placeholder={t("panel.propertyName")} aria-label={t("panel.propertyName")} />
        <button type="submit">{t("panel.addProperty")}</button>
      </form>
    </section>
  {/if}
</div>

{#snippet lanesOf(tl: { moments: Moment[]; undated: ViewRow[] })}
  <!-- One timeline in date order, with a lane for each group side by side. -->
  <div class="lanes" style:--lanes={groups.length}>
    <div class="lane-row head">
      <span></span>
      {#each groups as g (g.key)}<span class="lane-title">{groupName(g.key)} <span class="count">{g.rows.length}</span></span>{/each}
    </div>
    {#each tl.moments as m (m.key + "|" + m.end)}
      <div class="lane-row">
        <div class="when">{m.label}{#if m.end}<span class="end"> – {m.end}</span>{/if}</div>
        {#each groups as g (g.key)}
          <div class="lane" class:over={isZone(g.key, m.label)} {...zone({ key: g.key, date: spec.date && !builtIn(spec.date) ? m.label : undefined, reorder: false })}>
            {#each m.rows.filter((r) => groupOf.get(r.path) === g.key) as row (row.path)}
              {@render card(row, false, g.key)}
            {/each}
          </div>
        {/each}
      </div>
    {/each}
  </div>
  {#if tl.undated.length}
    <h3 class="group-title">{t("views.undated")} <span class="count">{tl.undated.length}</span></h3>
    <ul class="list">
      {#each tl.undated as row (row.path)}
        <li class:writing={writes(row)}><button class="link" onclick={(e) => inspect(row, e)}>{row.name}</button> {@render details(row)}{@render synopsisOf(row)}</li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#snippet timelineOf(tl: { moments: Moment[]; undated: ViewRow[] })}
  <ol class="timeline">
    {#each tl.moments as m (m.key + "|" + m.end)}
      <li>
        <div class="when">{m.label}{#if m.end}<span class="end"> – {m.end}</span>{/if}</div>
        <div class="what" class:over={isZone("", m.label)} {...zone({ key: "", date: spec.date && !builtIn(spec.date) ? m.label : undefined, reorder: false })}>
          {#each m.rows as row (row.path)}
            {@render card(row, false, "")}
          {/each}
        </div>
      </li>
    {/each}
  </ol>
  {#if tl.undated.length}
    <h3 class="group-title">{t("views.undated")} <span class="count">{tl.undated.length}</span></h3>
    <ul class="list">
      {#each tl.undated as row (row.path)}
        <li class:writing={writes(row)}><button class="link" onclick={(e) => inspect(row, e)}>{row.name}</button> {@render details(row)}{@render synopsisOf(row)}</li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#snippet details(row: ViewRow)}
  {#each fields as f (f)}
    {#if shown(row, f)}<span class="field"><span class="key">{label(f)}</span> {shown(row, f)}</span>{/if}
  {/each}
{/snippet}

{#snippet synopsisOf(row: ViewRow)}
  {#if spec.synopsis && synopsisText(row)}<p class="synopsis">{synopsisText(row)}</p>{/if}
{/snippet}

{#snippet card(row: ViewRow, long: boolean, key: string, next?: ViewRow, flow: "x" | "y" = "y")}
  <article class="card" class:drop-before={dropsBefore(row, key)} class:writing={writes(row)} class:flow-x={flow === "x"} {...item(row, next, flow)}>
    <button class="link title" onclick={(e) => inspect(row, e)}>{row.name}</button>
    {#if long && row.chapter && spec.items === "scene"}<div class="muted small">{row.chapter}</div>{/if}
    {#if spec.synopsis && synopsisText(row)}
      {@render synopsisOf(row)}
    {:else if long && row.excerpt}<p class="excerpt">{row.excerpt}</p>{/if}
    <div class="fields">{@render details(row)}</div>
  </article>
{/snippet}

{#snippet need(message: string, key: "group_by" | "date")}
  <div class="intro">
    <p>{message}</p>
    <select aria-label={t("views.pickProperty")} value="" onchange={(e) => save({ [key]: e.currentTarget.value, ...(key === "group_by" ? { groups: [] } : {}) } as Partial<ViewSpec>)}>
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
  .views.embedded {
    grid-template-columns: minmax(0, 1fr);
  }
  .writing {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  tr.writing td {
    background: var(--bg-hover);
  }
  .views.inspecting {
    grid-template-columns: 200px minmax(0, 1fr) 300px;
  }
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
    background: rgba(47, 95, 158, 0.15);
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
    background: rgba(47, 95, 158, 0.15);
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
  .synopsis {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--text-muted);
    white-space: pre-line;
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
  /* Where a dragged item will land: a line before an item, or the outline of its group. */
  .drop-before {
    box-shadow: 0 -2px 0 var(--accent);
  }
  .card.flow-x.drop-before {
    box-shadow: -3px 0 0 var(--accent);
  }
  tr.drop-before > td {
    box-shadow: inset 0 2px 0 var(--accent);
  }
  .list.over,
  .cards.over,
  .lane.over,
  .what.over {
    outline: 2px dashed var(--accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  tbody.over > tr:last-child > td {
    box-shadow: inset 0 -2px 0 var(--accent);
  }
  [draggable="true"] {
    cursor: grab;
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
  .lanes {
    overflow-x: auto;
  }
  .lane-row {
    display: grid;
    grid-template-columns: 140px repeat(var(--lanes), minmax(200px, 1fr));
    border-top: 1px solid var(--border);
  }
  .lane-row.head {
    border-top: none;
    position: sticky;
    top: 0;
    background: var(--bg);
    z-index: 1;
  }
  .lane-title {
    font-weight: 600;
    font-size: 13px;
    padding: 6px 8px;
  }
  .lane-row > :not(:first-child) {
    border-left: 1px solid var(--border);
  }
  .lane {
    display: grid;
    gap: 6px;
    align-content: start;
    padding: 6px 8px;
    min-height: 36px;
  }
  .lane-row:nth-child(even) .lane {
    background: var(--bg-panel);
  }
  .what {
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
</style>
