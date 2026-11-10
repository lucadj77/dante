<script lang="ts" module>
  /** A section the dialog can send things to. */
  export type TransferSection = "manuscript" | "codex" | "research" | "laboratory";
</script>

<script lang="ts">
  // Moves or copies scenes, chapters, notes, files and folders to another section, or to a
  // precise place in the manuscript, without dragging: a tree of the destination to choose from.
  import type { Project } from "$lib/core/project";
  import { findNode, headings, type ManuscriptNode } from "$lib/core/manuscript";
  import { fold, noteTitle } from "$lib/core/notes";
  import { basename, dirname, isMarkdown, isWithin } from "$lib/core/path";
  import { t } from "$lib/state.svelte";
  import type { MessageKey } from "$lib/i18n";
  import { failure } from "./errors";
  import ErrorText from "./ErrorText.svelte";

  interface Props {
    project: Project;
    /** What is moved or copied, in order. */
    paths: string[];
    mode: "move" | "copy";
    /** Called with where each item ended up, after the change. */
    onDone: (results: string[]) => void | Promise<void>;
    onClose: () => void;
  }
  let p: Props = $props();

  type Where = "before" | "after" | "start" | "end";
  interface Row {
    path: string;
    label: string;
    depth: number;
    icon: string;
    /** A scene in the manuscript: something goes before or after it, not inside. */
    scene: boolean;
    disabled: boolean;
  }

  // svelte-ignore state_referenced_locally
  const project = p.project;
  const folders = project.settings.folders;
  const manuscriptRoot = folders.manuscript;
  const gamebook = project.settings.gamebook.enabled;
  const roots: Record<TransferSection, string> = {
    manuscript: folders.manuscript,
    codex: folders.codex,
    research: folders.research,
    laboratory: folders.laboratory,
  };
  // svelte-ignore state_referenced_locally
  const sources = p.paths;
  // svelte-ignore state_referenced_locally
  const mode = p.mode;
  const files = sources.filter((s) => project.files.includes(s));
  /** Only notes and folders go in the manuscript, not pictures or other files. */
  const manuscriptAllowed = files.every(isMarkdown);
  /** Moving containers, they go beside other containers; moving scenes, inside a chapter. */
  const containers = sources.some((s) => !project.files.includes(s));

  function sectionOf(path: string): TransferSection {
    for (const key of ["manuscript", "codex", "research", "laboratory"] as TransferSection[]) if (isWithin(path, roots[key])) return key;
    return "laboratory";
  }
  const sections = (["manuscript", "codex", "research", "laboratory"] as TransferSection[]).filter((s) => s !== "manuscript" || manuscriptAllowed);
  let section = $state<TransferSection>(sections.includes(sectionOf(sources[0] ?? "")) ? sectionOf(sources[0] ?? "") : sections[0]);
  let filter = $state("");
  let where = $state<Where>("end");
  let busy = $state(false);
  let error = $state("");

  /**
   * Inside something moved, nothing can go: it would go inside itself. A copy can still go
   * just before or after its original.
   */
  const blocked = (path: string) => sources.some((s) => (mode === "copy" ? path !== s && isWithin(path, s) : isWithin(path, s)));
  const isSource = (path: string) => sources.includes(path);
  // svelte-ignore state_referenced_locally
  let picked = $state<string | null>(startingFolder());

  /** Outside the manuscript, the folder of the item itself, such as the type's folder in the Bible. */
  function startingFolder(): string | null {
    if (section === "manuscript") return null;
    const own = dirname(sources[0] ?? "");
    if (isWithin(own, roots[section]) && project.folders.includes(own) && !blocked(own) && !isSource(own)) return own;
    return blocked(roots[section]) || isSource(roots[section]) ? null : roots[section];
  }

  const headingMap = headings(project.manuscript, project.settings);

  function manuscriptRows(): Row[] {
    const rows: Row[] = [{ path: manuscriptRoot, label: t("section.manuscript"), depth: 0, icon: "📖", scene: false, disabled: false }];
    const walk = (node: ManuscriptNode, depth: number) => {
      for (const child of node.children) {
        const scene = child.kind === "scene";
        // In a gamebook a paragraph's place comes from its number: only folders are offered.
        if (scene && gamebook) continue;
        rows.push({
          path: child.path,
          label: (headingMap.get(child.path) ?? child.title).replace(/\n/g, " · "),
          depth,
          icon: scene ? "·" : child.kind === "part" ? "▤" : "▢",
          scene,
          disabled: blocked(child.path),
        });
        if (!scene) walk(child, depth + 1);
      }
    };
    walk(project.manuscript, 1);
    return rows;
  }

  function folderRows(root: string): Row[] {
    const rootLabel = t(`section.${section}` as MessageKey);
    const rows: Row[] = [{ path: root, label: rootLabel, depth: 0, icon: "📁", scene: false, disabled: blocked(root) }];
    const inside = project.folders.filter((f) => f !== root && isWithin(f, root)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    for (const folder of inside) {
      rows.push({ path: folder, label: basename(folder), depth: folder.slice(root.length + 1).split("/").length, icon: "📁", scene: false, disabled: blocked(folder) });
    }
    return rows;
  }

  const rows = $derived(
    (section === "manuscript" ? manuscriptRows() : folderRows(roots[section])).map((r) =>
      // A folder cannot hold a copy of itself, in the other sections either.
      section !== "manuscript" && isSource(r.path) ? { ...r, disabled: true } : r,
    ),
  );
  const shown = $derived.by(() => {
    const words = fold(filter).split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((r) => r.depth === 0 || words.every((w) => fold(r.label).includes(w)));
  });
  const ordered = $derived(section === "manuscript" && !gamebook);
  const pickedRow = $derived(rows.find((r) => r.path === picked) ?? null);

  /** The places offered for the chosen row. */
  const choices = $derived.by((): Where[] => {
    if (!ordered || !pickedRow) return [];
    if (pickedRow.path === manuscriptRoot) return ["start", "end"];
    if (pickedRow.scene || isSource(pickedRow.path)) return ["before", "after"];
    return ["start", "end", "before", "after"];
  });

  function pick(row: Row) {
    if (row.disabled) return;
    picked = row.path;
    if (!ordered) return;
    if (row.scene || isSource(row.path)) where = "after";
    else if (row.path === manuscriptRoot) where = "end";
    else where = containers && row.depth > 0 ? "after" : "end";
  }

  function switchTo(next: TransferSection) {
    section = next;
    filter = "";
    // Outside the manuscript the section's own folder is the usual place: one click less.
    picked = next === "manuscript" || blocked(roots[next]) || isSource(roots[next]) ? null : roots[next];
  }

  /** The folder and the place among its children that the choice means. */
  function target(): { dir: string; index?: number } | null {
    if (!picked) return null;
    if (!ordered) return { dir: picked };
    if (where === "start") return { dir: picked, index: 0 };
    if (where === "end") return { dir: picked };
    const parent = dirname(picked);
    const siblings = findNode(project.manuscript, parent)?.children ?? [];
    const i = siblings.findIndex((c) => c.path === picked);
    return { dir: parent, index: i + (where === "after" ? 1 : 0) };
  }

  const what = $derived(
    sources.length === 1
      ? t("transfer.quoted", { name: headingMap.get(sources[0])?.replace(/\n/g, " · ") ?? (project.files.includes(sources[0]) ? noteTitle(sources[0], manuscriptRoot) : basename(sources[0])) })
      : t("transfer.items", { n: sources.length }),
  );

  async function apply() {
    const place = target();
    if (!place || busy) return;
    busy = true;
    error = "";
    try {
      const results = await project.transfer(sources, place, mode === "copy");
      await p.onDone(results);
      p.onClose();
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="overlay" role="presentation" onclick={p.onClose}>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-label={t(mode === "copy" ? "transfer.copyTitle" : "transfer.moveTitle", { what })}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => {
      if (e.key === "Escape") p.onClose();
      if (e.key === "Enter" && picked && !(e.target instanceof HTMLButtonElement)) void apply();
    }}
  >
    <h2>{t(mode === "copy" ? "transfer.copyTitle" : "transfer.moveTitle", { what })}</h2>

    <div class="sections" role="tablist">
      {#each sections as s (s)}
        <button role="tab" aria-selected={section === s} class:on={section === s} onclick={() => switchTo(s)}>{t(`section.${s}` as MessageKey)}</button>
      {/each}
    </div>

    <!-- svelte-ignore a11y_autofocus -->
    <input type="search" class="filter" placeholder={t(section === "manuscript" ? "transfer.filterManuscript" : "transfer.filterFolders")} bind:value={filter} autofocus />

    <ul class="rows" role="listbox" aria-label={t(`section.${section}` as MessageKey)}>
      {#each shown as row (row.path)}
        <li>
          <button
            role="option"
            aria-selected={picked === row.path}
            class:picked={picked === row.path}
            class:scene={row.scene}
            disabled={row.disabled}
            style="padding-left: {8 + row.depth * 16}px"
            onclick={() => pick(row)}
            ondblclick={() => {
              pick(row);
              void apply();
            }}
          >
            <span class="icon" aria-hidden="true">{row.icon}</span>
            <span class="label">{row.label}</span>
          </button>
        </li>
      {/each}
      {#if shown.length <= 1 && filter.trim()}
        <li class="none">{t("transfer.nothing")}</li>
      {/if}
    </ul>

    {#if choices.length}
      <div class="where" role="radiogroup" aria-label={t("transfer.where")}>
        <span>{t("transfer.where")}</span>
        {#each choices as c (c)}
          <label><input type="radio" name="where" value={c} bind:group={where} /> {t(`transfer.${c}` as MessageKey)}</label>
        {/each}
      </div>
    {/if}

    <p class="muted">
      {#if mode === "copy"}{t("transfer.copyHint")}{:else}{t("transfer.moveHint")}{/if}
    </p>

    {#if error}<p class="error"><ErrorText text={error} /></p>{/if}
    <div class="actions">
      <button type="button" onclick={p.onClose}>{t("tree.cancel")}</button>
      <button type="button" class="primary" disabled={!picked || busy} onclick={apply}>{t(mode === "copy" ? "transfer.copy" : "transfer.move")}</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: grid;
    place-items: center;
    z-index: 40;
  }
  .dialog {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 20px;
    font-size: 13px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sections {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .sections button.on {
    background: var(--bg-active);
    border-color: var(--accent);
  }
  .filter {
    width: 100%;
    box-sizing: border-box;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 4px;
    min-height: 160px;
    max-height: 46vh;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .rows button {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    border: none;
    border-radius: 4px;
    background: none;
    padding-top: 3px;
    padding-bottom: 3px;
    text-align: left;
    font: inherit;
    color: var(--text);
    cursor: pointer;
  }
  .rows button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  .rows button.picked {
    background: var(--bg-active);
    outline: 1px solid var(--accent);
  }
  .rows button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .rows button.scene .label {
    color: var(--text-muted);
  }
  .icon {
    flex: none;
    width: 16px;
    text-align: center;
    color: var(--text-muted);
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .none {
    padding: 6px 8px;
    color: var(--text-muted);
  }
  .where {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
  }
  .where label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .muted {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    color: var(--danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
