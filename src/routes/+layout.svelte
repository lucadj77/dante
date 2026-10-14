<script lang="ts">
  import "../app.css";
  import { app } from "$lib/state.svelte";
  import Tooltip from "$lib/ui/Tooltip.svelte";

  let { children } = $props();

  $effect(() => {
    const root = document.documentElement;
    const { theme, language, fontFamily, fontSize } = app.settings;
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
    root.lang = language;
    root.style.setProperty("--editor-font", fontFamily);
    root.style.setProperty("--editor-size", `${fontSize}px`);
  });
</script>

{@render children()}
<Tooltip />
