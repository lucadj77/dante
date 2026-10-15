<script lang="ts" module>
  // Line icons drawn on a 24×24 grid with the current text colour, so they follow the theme.
  const PATHS = {
    scene: "M6 2h7l5 5v15H6z M13 2v5h5 M9 13h6 M9 17h6",
    chapter: "M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
    part: "M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z",
    novel: "M4 4h4v16H4z M10 4h4v16h-4z M16 5.5l3.5-1 3 14.5-3.5 1z",
    collapse: "M7 20l5-5 5 5 M7 4l5 5 5-5",
    expand: "M7 15l5 5 5-5 M7 9l5-5 5 5",
    format: "M7 4h6a4 4 0 0 1 0 8H7z M7 12h7a4 4 0 0 1 0 8H7z",
    raw: "M8 6l-6 6 6 6 M16 6l6 6-6 6",
    focus: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
    typewriter: "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M6 10h1 M10 10h1 M14 10h1 M18 10h1 M7 14h10",
    fullscreen: "M3 8V3h5 M21 8V3h-5 M3 16v5h5 M21 16v5h-5",
    revisions: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    zoomOut: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M21 21l-4.3-4.3 M8 11h6",
    zoomIn: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M21 21l-4.3-4.3 M8 11h6 M11 8v6",
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>

<style>
  .icon {
    flex: none;
    vertical-align: middle;
  }
</style>
