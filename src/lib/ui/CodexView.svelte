<script lang="ts">
  import type { NoteInfo } from "$lib/core/notes";
  import { fold, noteTitle, noteType } from "$lib/core/notes";
  import { isWithin, rebase } from "$lib/core/path";
  import type { Project } from "$lib/core/project";
  import type { NoteType } from "$lib/core/settings";
  import { t } from "$lib/state.svelte";
  import { confirmDelete } from "./dialogs";
  import { displayValue } from "./propertyText";
  import { navigator } from "./navigation";
  import NoteEditor from "./NoteEditor.svelte";
  import NoteProperties from "./NoteProperties.svelte";
  import SidePanel from "./SidePanel.svelte";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    /** The note to show; the list of its type when null. */
    open: string | null;
    onShow: (path: string | null) => void;
    onReload: () => Promise<void>;
  }
  let p: Props = $props();
  const nav = navigator();

  /** "" lists the Codex notes that have no type. */
  let selectedType = $state<string | null>(null);
  let filter = $state("");
  let notes = $state<NoteInfo[]>([]);
  let saves = $state(0);
  let error = $state("");
  let editing = $state<{ id: string; draft: NoteType } | null>(null);
  let newTypeName = $state("");
  let renaming = $state(false);
  let titleDraft = $state("");
  let editor = $state<NoteEditor | null>(null);

  const types = $derived.by(() => {
    void p.rev;
    return p.project.settings.types;
  });

  // Every note in the project, read from the index; Templates are left out.
  $effect(() => {
    void p.rev;
    void saves;
    const templates = p.project.settings.folders.templates;
    void p.project.index().then((index) => {
      notes = [...index.notes.values()].filter((n) => !isWithin(n.path, templates));
    });
  });

  const typed = $derived.by(() => {
    const groups = new Map<string, NoteInfo[]>();
    const codex = p.project.settings.folders.codex;
    for (const note of notes) {
      const type = noteType(note.path, note.properties, p.project.settings);
      // Notes without a type are listed only when they are in the Codex.
      const key = type ?? (isWithin(note.path, codex) ? "" : null);
      if (key === null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(note);
    }
    for (const list of groups.values()) list.sort((a, b) => noteTitle(a.path).localeCompare(noteTitle(b.path), undefined, { numeric: true }));
    return groups;
  });

  /** Types used by notes but not defined in dante.yaml. */
  const unknown = $derived([...typed.keys()].filter((k) => k !== "" && !(k in types)));

  const current = $derived.by(() => {
    void p.rev;
    return p.open && p.project.files.includes(p.open) ? p.open : null;
  });

  // The list follows the open note's type; at first it shows the first type.
  $effect(() => {
    if (current) {
      const note = notes.find((n) => n.path === current);
      const type = noteType(current, note?.properties ?? {}, p.project.settings);
      if (type !== null) selectedType = type;
    } else if (selectedType === null) {
      selectedType = Object.keys(types)[0] ?? "";
    }
  });

  const shown = $derived.by(() => {
    const list = typed.get(selectedType ?? "") ?? [];
    const words = fold(filter).split(/\s+/).filter(Boolean);
    if (!words.length) return list;
    return list.filter((n) => {
      const text = fold([noteTitle(n.path), ...n.aliases, n.body].join(" "));
      return words.every((w) => text.includes(w));
    });
  });

  function typeLabel(id: string): string {
    if (id === "") return t("codex.untyped");
    return types[id] ? `${types[id].name}` : id;
  }

  /** A few property values shown on a card. */
  function details(note: NoteInfo): [string, string][] {
    return Object.entries(note.properties)
      .filter(([key, value]) => key !== "type" && key !== "aliases" && displayValue(value).trim() !== "")
      .slice(0, 3)
      .map(([key, value]) => [key, displayValue(value).replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a, b) => b || a)]);
  }

  /** The start of the text, without Markdown signs. */
  function excerpt(note: NoteInfo): string {
    const plain = note.body
      .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, a, b) => b || a)
      .replace(/^#+\s*/gm, "")
      .replace(/[*_=~`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return plain.length > 140 ? plain.slice(0, 140) + "…" : plain;
  }

  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    error = "";
    try {
      await editor?.flush();
      const result = await operation();
      await p.onReload();
      return result;
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
      return undefined;
    }
  }

  /** The name of a note about to be created; asked first, as templates use it. */
  let newName = $state<string | null>(null);

  async function create() {
    const type = selectedType;
    const name = newName?.trim();
    newName = null;
    if (!type || !types[type] || !name) return;
    const path = await run(() => p.project.createTyped(type, name));
    if (path) p.onShow(path);
  }

  function startRename(path = current) {
    if (!path) return;
    titleDraft = noteTitle(path);
    renaming = true;
  }

  async function rename(path: string, name: string) {
    renaming = false;
    if (!name.trim() || name === noteTitle(path)) return;
    const to = await run(() => p.project.renamePath(path, name));
    if (to && p.open && isWithin(p.open, path)) p.onShow(rebase(p.open, path, to));
  }

  async function remove(path: string) {
    if (!(await confirmDelete(t("files.deleteFile", { name: noteTitle(path) })))) return;
    await run(() => p.project.trash(path));
    p.onShow(null);
  }

  async function editTemplate(type: string) {
    const path = await run(() => p.project.ensureTemplate(type));
    if (path) nav?.open(path);
  }

  async function addType() {
    const name = newTypeName.trim();
    if (!name) return;
    const id = p.project.typeId(name);
    newTypeName = "";
    await run(() => p.project.setType(id, { name, folder: name, icon: "", properties: [] }));
    selectedType = id;
  }

  async function saveType() {
    if (!editing) return;
    const { id, draft } = editing;
    editing = null;
    await run(() => p.project.setType(id, { ...draft, name: draft.name.trim() || id }));
  }

  async function removeType(id: string) {
    const count = typed.get(id)?.length ?? 0;
    if (!(await confirmDelete(t("codex.deleteType", { name: typeLabel(id), count })))) return;
    editing = null;
    await run(() => p.project.setType(id, null));
    selectedType = Object.keys(types)[0] ?? "";
  }

  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
</script>

<div class="codex">
  <aside class="types" aria-label={t("section.codex")}>
    <ul>
      {#each Object.entries(types) as [id, type] (id)}
        <li>
          <button class="type" aria-pressed={selectedType === id && !current} class:on={selectedType === id} onclick={() => { selectedType = id; p.onShow(null); }}>
            <span class="icon" aria-hidden="true">{type.icon || "◆"}</span>
            <span class="name">{type.name}</span>
            <span class="count">{typed.get(id)?.length ?? 0}</span>
          </button>
        </li>
      {/each}
      {#each unknown as id (id)}
        <li>
          <button class="type" class:on={selectedType === id} onclick={() => { selectedType = id; p.onShow(null); }}>
            <span class="icon" aria-hidden="true">◇</span>
            <span class="name">{id}</span>
            <span class="count">{typed.get(id)?.length ?? 0}</span>
          </button>
        </li>
      {/each}
      {#if typed.has("")}
        <li>
          <button class="type" class:on={selectedType === ""} onclick={() => { selectedType = ""; p.onShow(null); }}>
            <span class="icon" aria-hidden="true">·</span>
            <span class="name">{t("codex.untyped")}</span>
            <span class="count">{typed.get("")?.length ?? 0}</span>
          </button>
        </li>
      {/if}
    </ul>
    <form
      class="new-type"
      onsubmit={(e) => {
        e.preventDefault();
        void addType();
      }}
    >
      <input bind:value={newTypeName} placeholder={t("codex.newTypeName")} aria-label={t("codex.newTypeName")} />
      <button type="submit" disabled={!newTypeName.trim()}>{t("codex.addType")}</button>
    </form>
    <p class="hint">{t("codex.typesHint")}</p>
  </aside>

  <main class="center">
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    {#if current}
      <div class="item-bar">
        <button onclick={() => p.onShow(null)}>‹ {typeLabel(selectedType ?? "")}</button>
        <span class="spacer"></span>
        <button class="danger" onclick={() => remove(current)}>{t("tree.deleteItem")}</button>
      </div>
      <h1 class="item-title">
        {#if renaming}
          <input
            bind:value={titleDraft}
            use:focusOnMount
            aria-label={t("tree.rename")}
            onblur={() => rename(current, titleDraft)}
            onkeydown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              if (e.key === "Escape") renaming = false;
            }}
          />
        {:else}
          <button title={t("tree.renameHint")} onclick={() => startRename()}>{noteTitle(current)}</button>
        {/if}
      </h1>
      {#key current}
        <div class="editor"><NoteEditor bind:this={editor} project={p.project} path={current} diskRev={p.diskRev} toolbar onSaved={() => saves++} /></div>
      {/key}
    {:else}
      {@const type = selectedType ? types[selectedType] : undefined}
      <div class="list-bar">
        <h2>{type?.icon ?? ""} {typeLabel(selectedType ?? "")}</h2>
        <input type="search" bind:value={filter} placeholder={t("codex.filter")} aria-label={t("codex.filter")} />
        {#if type && newName !== null}
          <form
            class="new-item"
            onsubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <input
              bind:value={newName}
              use:focusOnMount
              placeholder={t("codex.newName")}
              aria-label={t("codex.newName")}
              onkeydown={(e) => {
                if (e.key === "Escape") newName = null;
              }}
            />
            <button type="submit" class="primary" disabled={!newName.trim()}>{t("codex.create")}</button>
          </form>
        {:else if type}
          <button class="primary" onclick={() => (newName = "")}>{t("codex.new", { type: type.name })}</button>
        {/if}
      </div>
      {#if type && selectedType}
        <div class="type-tools">
          <button onclick={() => editTemplate(selectedType!)}>{t("codex.editTemplate")}</button>
          <button onclick={() => (editing = { id: selectedType!, draft: structuredClone($state.snapshot(type)) })}>{t("codex.editType")}</button>
        </div>
      {/if}
      {#if editing && editing.id === selectedType}
        <form
          class="type-form"
          onsubmit={(e) => {
            e.preventDefault();
            void saveType();
          }}
        >
          <label>{t("codex.typeName")} <input bind:value={editing.draft.name} /></label>
          <label>{t("codex.typeIcon")} <input bind:value={editing.draft.icon} size="4" /></label>
          <label>
            {t("codex.typeProperties")}
            <input
              value={editing.draft.properties.join(", ")}
              onchange={(e) => (editing!.draft.properties = (e.currentTarget as HTMLInputElement).value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
          </label>
          <p class="hint">{t("codex.typeFolder", { folder: `${p.project.settings.folders.codex}/${editing.draft.folder}` })}</p>
          <div class="form-actions">
            <button type="submit" class="primary">{t("settings.save")}</button>
            <button type="button" onclick={() => (editing = null)}>{t("tree.cancel")}</button>
            <span class="spacer"></span>
            <button type="button" class="danger" onclick={() => removeType(editing!.id)}>{t("codex.deleteTypeButton")}</button>
          </div>
        </form>
      {/if}
      {#if shown.length === 0}
        <p class="empty">{filter ? t("search.none") : t("codex.empty")}</p>
      {/if}
      <div class="cards">
        {#each shown as note (note.path)}
          <button class="card" onclick={() => p.onShow(note.path)}>
            <span class="card-title">{noteTitle(note.path)}</span>
            {#if note.aliases.length}<span class="aliases">{note.aliases.join(", ")}</span>{/if}
            {#each details(note) as [key, value] (key)}
              <span class="detail"><span class="key">{key}</span> {value}</span>
            {/each}
            {#if excerpt(note)}<span class="excerpt">{excerpt(note)}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </main>

  <SidePanel project={p.project} path={current} version={p.rev * 10000 + saves} diskRev={p.diskRev}>
    {#snippet properties()}
      {#if current}
        <NoteProperties project={p.project} path={current} rev={p.rev} onChanged={p.onReload} onRename={rename} />
      {:else}
        <p class="empty">{t("codex.pick")}</p>
      {/if}
    {/snippet}
  </SidePanel>
</div>

<style>
  .codex {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 280px;
    height: 100%;
    min-height: 0;
  }
  .types {
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
    overflow: auto;
    padding: 8px;
  }
  .types ul {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
  }
  .type {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: none;
    text-align: left;
    padding: 6px 8px;
  }
  .type.on {
    background: var(--bg-active);
  }
  .type .icon {
    width: 20px;
    text-align: center;
  }
  .type .name {
    flex: 1;
  }
  .count {
    color: var(--text-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .new-type {
    display: flex;
    gap: 4px;
  }
  .new-type input {
    flex: 1;
    min-width: 0;
  }
  .new-type button {
    font-size: 12px;
  }
  .hint {
    font-size: 12px;
    color: var(--text-muted);
  }
  .center {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    background: var(--editor-bg);
  }
  .list-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px 8px;
  }
  .list-bar h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    flex: 1;
  }
  .list-bar input {
    width: 200px;
  }
  .new-item {
    display: flex;
    gap: 4px;
  }
  .type-tools {
    display: flex;
    gap: 8px;
    padding: 0 24px 8px;
  }
  .type-tools button {
    font-size: 12px;
  }
  .type-form {
    display: grid;
    gap: 8px;
    margin: 0 24px 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-panel);
  }
  .type-form label {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .form-actions,
  .item-bar {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  .primary {
    background: var(--accent);
    color: var(--accent-text);
    border-color: var(--accent);
  }
  .danger {
    color: var(--danger);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    padding: 8px 24px 48px;
  }
  .card {
    display: grid;
    align-content: start;
    gap: 4px;
    padding: 12px 14px;
    text-align: left;
    border-radius: 8px;
    background: var(--bg);
    min-height: 110px;
  }
  .card:hover {
    border-color: var(--accent);
    background: var(--bg);
  }
  .card-title {
    font-weight: 600;
    font-size: 15px;
  }
  .aliases {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
  .detail {
    font-size: 12px;
  }
  .detail .key {
    color: var(--text-muted);
  }
  .excerpt {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .item-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }
  .item-bar button {
    font-size: 12px;
  }
  .item-bar button:first-child {
    border: none;
    color: var(--accent);
  }
  .item-title {
    margin: 16px 24px 0;
    text-align: center;
    font-family: var(--editor-font);
    font-weight: 500;
    font-size: 1.6em;
  }
  .item-title button {
    border: none;
    background: none;
    font: inherit;
    padding: 0;
    cursor: text;
  }
  .item-title input {
    font: inherit;
    text-align: center;
    width: 100%;
  }
  .editor {
    flex: 1;
    min-height: 0;
  }
  .empty {
    color: var(--text-muted);
    padding: 8px 24px;
  }
  .error {
    color: var(--danger);
    padding: 0 24px;
  }
</style>
