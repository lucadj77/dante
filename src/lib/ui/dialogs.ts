import { t } from "$lib/state.svelte";

/** Asks before deleting, with the system's dialog when there is one. */
export async function confirmDelete(message: string, okLabel = t("tree.delete")): Promise<boolean> {
  try {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return await ask(message, { title: "Dante", kind: "warning", okLabel, cancelLabel: t("tree.cancel") });
  } catch {
    return window.confirm(message);
  }
}
