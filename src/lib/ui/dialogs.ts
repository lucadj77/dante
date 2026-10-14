import { t } from "$lib/state.svelte";

/** Asks before deleting, with the system's dialog when there is one. */
export async function confirmDelete(message: string): Promise<boolean> {
  try {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return await ask(message, { title: "Dante", kind: "warning", okLabel: t("tree.delete"), cancelLabel: t("tree.cancel") });
  } catch {
    return window.confirm(message);
  }
}
