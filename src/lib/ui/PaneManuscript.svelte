<script lang="ts">
  import { tick } from "svelte";
  import { findNode, headings as computeHeadings, parentOf, type ManuscriptNode } from "$lib/core/manuscript";
  import type { Project } from "$lib/core/project";
  import { rebase } from "$lib/core/path";
  import { t } from "$lib/state.svelte";
  import SceneBlock, { type SceneHandle } from "./SceneBlock.svelte";
  import { flushAll } from "./documents.svelte";
  import { panes } from "./panes.svelte";

  interface Props {
    project: Project;
    /** A scene, or a chapter or part folder whose scenes are shown one after the other. */
    path: string;
    rev: number;
    diskRev: number;
    onReload: () => Promise<void>;
    /** The pane shows another item, as after a rename. */
    onPath: (path: string) => void;
  }
  let p: Props = $props();

  const tree = $derived.by(() => {
    void p.rev;
    return p.project.manuscript;
  });
  const node = $derived(findNode(tree, p.path));
  const headingMap = $derived(computeHeadings(tree, p.project.settings));

  type Item = { type: "heading"; path: string; text: string; kind: string } | { type: "scene"; node: ManuscriptNode };
  const items = $derived.by((): Item[] => {
    const root = node;
    if (!root) return [];
    if (root.kind === "scene") return [{ type: "scene", node: root }];
    const out: Item[] = [];
    const visit = (n: ManuscriptNode, top: boolean) => {
      // The pane's own chapter is named in its header already.
      if (!top && n.kind !== "manuscript" && n.kind !== "scene") out.push({ type: "heading", path: n.path, text: headingMap.get(n.path) ?? n.title, kind: n.kind });
      for (const child of n.children) {
        if (child.kind === "scene") out.push({ type: "scene", node: child });
        else visit(child, false);
      }
    };
    visit(root, true);
    return out;
  });
  const scenes = $derived(items.flatMap((i) => (i.type === "scene" ? [i.node.path] : [])));

  const editors = new Map<string, SceneHandle>();
  let pendingFocus: { path: string; at: "start" | "end" } | null = null;
  let error = $state("");

  function register(path: string, handle: SceneHandle | null) {
    if (handle) {
      editors.set(path, handle);
      if (pendingFocus?.path === path) {
        handle.focus(pendingFocus.at);
        pendingFocus = null;
      }
    } else {
      editors.delete(path);
    }
  }

  async function run(operation: () => Promise<string | void>) {
    error = "";
    try {
      await flushAll(p.project);
      const result = await operation();
      await p.onReload();
      if (typeof result === "string") {
        // A new scene in a pane showing one scene takes its place there.
        if (node?.kind === "scene" && !findNode(p.project.manuscript, p.path)) p.onPath(result);
        pendingFocus = { path: result, at: "start" };
        await tick();
        if (editors.has(result)) register(result, editors.get(result)!);
      }
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  function leave(path: string, direction: "up" | "down"): boolean {
    const i = scenes.indexOf(path);
    const next = scenes[direction === "up" ? i - 1 : i + 1];
    if (!next || !editors.has(next)) return false;
    editors.get(next)!.focus(direction === "up" ? "end" : "start");
    return true;
  }

  function addAfter(path: string) {
    const parent = parentOf(tree, path);
    if (!parent) return;
    const index = parent.children.findIndex((c) => c.path === path);
    void run(() => p.project.createScene(parent.path, index + 1, t("untitledScene")));
  }

  async function rename(path: string, title: string) {
    const target = findNode(tree, path);
    let renamed = path;
    await run(async () => {
      if (target && target.title !== target.fileTitle) await p.project.retitle(path, title);
      else renamed = await p.project.rename(path, title);
    });
    if (renamed !== path) p.onPath(rebase(p.path, path, renamed));
  }
</script>

<div class="pane-manuscript">
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="column">
    {#if items.length === 0}<p class="empty">{t("editor.empty")}</p>{/if}
    {#each items as item (item.type === "scene" ? item.node.path : `h|${item.path}`)}
      {#if item.type === "heading"}
        <h2 class="heading {item.kind}">{item.text}</h2>
      {:else}
        <SceneBlock
          project={p.project}
          node={item.node}
          raw={false}
          typewriter={false}
          focusMode={false}
          diskRev={p.diskRev}
          {register}
          onSplitScene={(path, before, after) => {
            editors.get(path)?.cancel();
            void run(() => p.project.splitScene(path, before, after, t("untitledScene")));
          }}
          onSplitChapter={(path, before, after) => {
            editors.get(path)?.cancel();
            void run(() => p.project.splitChapter(path, before, after, t("untitled"), t("untitledScene")));
          }}
          onLeave={leave}
          onFocus={(path) => (panes.writing = path)}
          onText={() => {}}
          onAddAfter={addAfter}
          onRename={rename}
        />
      {/if}
    {/each}
  </div>
</div>

<style>
  .pane-manuscript {
    padding: 0 20px 30vh;
  }
  .column {
    font-family: var(--editor-font);
    font-size: var(--editor-size);
  }
  .heading {
    font-family: var(--editor-font);
    font-weight: 400;
    text-align: center;
    margin: 36px 0 8px;
    font-size: 1.2em;
    white-space: pre-line;
  }
  .heading.part {
    font-size: 1.5em;
  }
  .empty {
    color: var(--text-muted);
  }
  .error {
    color: var(--danger);
  }
</style>
