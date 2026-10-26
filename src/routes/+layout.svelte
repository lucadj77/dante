<script lang="ts">
  import "../app.css";
  import { app } from "$lib/state.svelte";
  import { applyAppearance } from "$lib/themes";
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
    applyAppearance(root, app.settings, systemDark);
  });
</script>

{@render children()}
<Tooltip />
