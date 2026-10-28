<script lang="ts" module>
  /** A click on a wikilink: what it points to and where it was clicked. */
  export interface LinkMenuRequest {
    /** The link's target as written, without its #heading. */
    target: string;
    /** The note holding the link. */
    from: string;
    /** The note the link reaches, or null when it does not exist yet. */
    path: string | null;
    x: number;
    y: number;
    /** Puts the cursor inside the link, to change it. */
    edit: () => void;
    /** A name of the Story Bible found in the text without a link, which `link` makes one. */
    named?: { name: string; link: () => void };
  }
</script>

<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import Icon from "./Icon.svelte";
  import { failure } from "$lib/ui/errors";
  import { onMount } from "svelte";
  import type { Project } from "$lib/core/project";
  import { basename, isMarkdown, join } from "$lib/core/path";
  import { noteTitle } from "$lib/core/notes";
  import { t } from "$lib/state.svelte";
  import type { MessageKey } from "$lib/i18n";
  import NoteEditor from "./NoteEditor.svelte";
  import FileViewer from "./FileViewer.svelte";

  interface Props {
    project: Project;
    diskRev: number;
    request: LinkMenuRequest;
    onOpen: (path: string, beside: boolean) => void;
    /** A note was created for the link. */
    onCreated: (path: string) => void;
    onClose: () => void;
  }
  let p: Props = $props();

  /** The menu first; the preview replaces it when asked for. */
  let previewing = $state(false);
  let error = $state("");
  let box: HTMLDivElement;
  let left = $state(0);
  let top = $state(0);

  // svelte-ignore state_referenced_locally
  const request = p.request;
  // svelte-ignore state_referenced_locally
  const settings = p.project.settings;
  const title = request.path ? noteTitle(request.path, settings.folders.manuscript) : basename(request.target);

  interface Place {
    label: string;
    detail: string;
    create: () => Promise<string>;
  }
  /** Where a missing note can be created: as a note of each type, or in Research and Laboratory. */
  const places: Place[] = [
    ...Object.entries(settings.types).map(([id, type]) => ({
      label: `${type.icon ? type.icon + " " : ""}${type.name}`,
      detail: join(settings.folders.codex, type.folder),
      create: () => p.project.createTyped(id, basename(request.target)),
    })),
    ...(["research", "laboratory"] as const).map((key) => ({
      label: t(`section.${key}` as MessageKey),
      detail: settings.folders[key],
      create: () => p.project.createNote(settings.folders[key], basename(request.target)),
    })),
  ];

  async function create(place: Place) {
    error = "";
    try {
      p.onCreated(await place.create());
    } catch (e) {
      error = failure(e);
    }
  }

  /** Near the click, kept inside the window. */
  function place() {
    if (!box) return;
    const { width, height } = box.getBoundingClientRect();
    left = Math.max(8, Math.min(request.x, window.innerWidth - width - 8));
    const below = request.y + 14;
    top = below + height + 8 <= window.innerHeight ? below : Math.max(8, request.y - height - 10);
  }

  onMount(place);
  $effect(() => {
    void previewing;
    requestAnimationFrame(place);
  });

  function edit() {
    p.onClose();
    request.edit();
  }

  function outside(e: MouseEvent) {
    const el = e.target as HTMLElement;
    // A click on another link opens its own menu in place of this one.
    if (!box || box.contains(el) || el.closest?.(".md-wikilink")) return;
    p.onClose();
  }

  function key(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      p.onClose();
    }
  }
</script>

<svelte:window onmousedown={outside} onkeydown={key} onresize={place} />

<div class="float" class:preview={previewing} bind:this={box} style="left: {left}px; top: {top}px" role={previewing ? "dialog" : "menu"} aria-label={title}>
  {#if previewing && request.path}
    {@const path = request.path}
    <header>
      <span class="title">{title}</span>
      <button title={t("linkMenu.open")} onclick={() => p.onOpen(path, false)}>{t("linkMenu.openShort")}</button>
      <button title={t("linkMenu.beside")} onclick={() => p.onOpen(path, true)}>{t("linkMenu.besideShort")}</button>
      <button class="close" aria-label={t("linkMenu.close")} onclick={p.onClose}>×</button>
    </header>
    <div class="body">
      {#if isMarkdown(path)}
        <NoteEditor project={p.project} {path} diskRev={p.diskRev} compact preview />
      {:else}
        <FileViewer project={p.project} {path} compact />
      {/if}
    </div>
  {:else if request.path && request.named}
    {@const path = request.path}
    {@const named = request.named}
    <div class="heading">{t("linkMenu.named", { name: named.name, note: title })}</div>
    <button role="menuitem" onclick={() => p.onOpen(path, false)}>{t("linkMenu.open")}</button>
    <button role="menuitem" onclick={() => p.onOpen(path, true)}>{t("linkMenu.beside")}</button>
    <button role="menuitem" onclick={() => (previewing = true)}>{t("linkMenu.preview")}</button>
    <hr />
    <button
      role="menuitem"
      onclick={() => {
        p.onClose();
        named.link();
      }}>{t("linkMenu.makeLink")}</button
    >
    <p class="note">{t("linkMenu.systemMenu")}</p>
    <p class="note off">{t("linkMenu.namedOff")} <span class="toggle"><Icon name="named" size={12} /> {t("mode.namedNotes")}</span></p>
  {:else if request.path}
    {@const path = request.path}
    <div class="heading">{title}</div>
    <button role="menuitem" onclick={() => p.onOpen(path, false)}>{t("linkMenu.open")}<span class="detail">{t("linkMenu.openKey")}</span></button>
    <button role="menuitem" onclick={() => p.onOpen(path, true)}>{t("linkMenu.beside")}<span class="detail">{t("linkMenu.besideKey")}</span></button>
    <button role="menuitem" onclick={() => (previewing = true)}>{t("linkMenu.preview")}</button>
    <hr />
    <button role="menuitem" onclick={edit}>{t("linkMenu.edit")}</button>
  {:else}
    <div class="heading">{t("linkMenu.missing", { name: basename(request.target) })}</div>
    {#each places as place (place.detail)}
      <button role="menuitem" title={place.detail} onclick={() => create(place)}>
        {place.label}<span class="detail">{place.detail}</span>
      </button>
    {/each}
    {#if error}<p class="error" role="alert"><ErrorText text={error} /></p>{/if}
    <hr />
    <button role="menuitem" onclick={edit}>{t("linkMenu.edit")}</button>
  {/if}
</div>

<style>
  .float {
    position: fixed;
    z-index: 30;
    display: grid;
    min-width: 220px;
    max-width: 340px;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    font-size: 13px;
  }
  .float.preview {
    display: flex;
    flex-direction: column;
    width: min(480px, calc(100vw - 16px));
    max-width: none;
    height: min(380px, calc(100vh - 16px));
    padding: 0;
  }
  .heading {
    padding: 6px 10px 4px;
    color: var(--text-muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button[role="menuitem"] {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    border: none;
    background: none;
    text-align: left;
  }
  button[role="menuitem"]:hover {
    background: var(--bg-hover);
  }
  .note {
    margin: 2px 10px 4px;
    color: var(--text-muted);
    font-size: 11px;
  }
  .note .toggle {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 0 4px;
    border: 1px solid var(--border);
    border-radius: 4px;
    white-space: nowrap;
  }
  .detail {
    color: var(--text-muted);
    font-size: 11px;
  }
  hr {
    width: 100%;
    margin: 4px 0;
    border: none;
    border-top: 1px solid var(--border);
  }
  .error {
    margin: 4px 10px;
    color: var(--danger);
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px 6px 12px;
    border-bottom: 1px solid var(--border);
  }
  header .title {
    flex: 1;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  header button {
    font-size: 12px;
  }
  header .close {
    border: none;
    background: none;
    font-size: 16px;
    line-height: 1;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 16px;
  }
</style>
