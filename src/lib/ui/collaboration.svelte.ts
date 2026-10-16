import type { SceneEditor } from "$lib/editor/sceneEditor";
import { app } from "$lib/state.svelte";
import { editorChanged, editorFor, preferEditor, registerEditor, unregisterEditor } from "./editors.svelte";
import { announce, leave, lockedBy } from "./presence.svelte";

/**
 * What an editor does to work with other people on the same folder: it is listed for the
 * comments panel, follows revision mode, tells the others which file it edits, and turns
 * read-only while someone else is editing that file. Call it while the component starts.
 */
export function collaboration(path: string, options: { raw?: () => boolean } = {}) {
  let editor = $state<SceneEditor | null>(null);
  let forced = $state(false);
  const holder = $derived(forced ? null : lockedBy(path));

  $effect(() => {
    const name = app.settings.userName.trim();
    const on = app.settings.revisions && !!name && !options.raw?.();
    editor?.setRevisions(on ? name : null);
  });
  $effect(() => {
    if (!editor) return;
    editor.setReadOnly(holder !== null);
    editorChanged();
  });

  return {
    /** Someone else editing this file, or null. */
    get holder() {
      return holder;
    },
    /** Edits anyway, after the warning. */
    force() {
      forced = true;
      announce(path);
    },
    ready(created: SceneEditor) {
      editor = created;
      registerEditor(path, created.view);
    },
    focused() {
      if (editor) preferEditor(path, editor.view);
      if (holder === null) announce(path);
    },
    changed() {
      editorChanged();
    },
    destroy() {
      if (editor) unregisterEditor(path, editor.view);
      // Another editor of the same file, as in a pane, keeps it announced.
      if (!editorFor(path)) leave(path);
      editor = null;
    },
  };
}
