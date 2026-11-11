<script lang="ts">
  import "../app.css";
  import { app, appearance, t } from "$lib/state.svelte";
  import { applyAppearance } from "$lib/themes";
  import { applyMenuLabels, applyUiZoom } from "$lib/uiZoom.svelte";
  import Tooltip from "$lib/ui/Tooltip.svelte";

  let { children } = $props();

  // Follows the system when it turns dark or light, for the "system" theme.
  const query = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  let systemDark = $state(query?.matches ?? false);
  $effect(() => {
    if (!query) return;
    const change = () => (systemDark = query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  });

  $effect(() => {
    const root = document.documentElement;
    root.lang = app.settings.language;
    applyAppearance(root, appearance(), systemDark);
  });
  $effect(() => {
    applyUiZoom(app.settings.uiZoom);
  });
  $effect(() => {
    void app.settings.language;
    const keys = ["about", "checkUpdates", "services", "hide", "hideOthers", "showAll", "quit", "edit", "undo", "redo", "cut", "copy", "paste", "selectAll", "view", "fullscreen", "window", "minimize", "zoom", "close", "help", "openHelp"] as const;
    applyMenuLabels(Object.fromEntries(keys.map((key) => [key, t(`macMenu.${key}`)])));
  });
</script>

{@render children()}
<Tooltip />
