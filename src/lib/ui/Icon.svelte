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
    lineHighlight: "M3 10h18v4H3z M3 5h14 M3 19h12",
    fullscreen: "M3 8V3h5 M21 8V3h-5 M3 16v5h5 M21 16v5h-5",
    alignCenter: "M4 5h16 M7 10h10 M4 15h16 M8 20h8",
    alignRight: "M4 5h16 M10 10h10 M4 15h16 M12 20h8",
    table: "M3 5h18v14H3z M3 10h18 M3 15h18 M9 5v14 M15 5v14",
    image: "M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15.5 8a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z",
    revisions: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    zoomOut: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M21 21l-4.3-4.3 M8 11h6",
    zoomIn: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M21 21l-4.3-4.3 M8 11h6 M11 8v6",
    // Sections of the side bar.
    search: "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z M20 20l-4.8-4.8",
    manuscript: "M12 3l6 7.5L12 21l-6-10.5z M12 13v8 M12 9.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z",
    codex: "M5 19V5a2 2 0 0 1 2-2h12v14H7a2 2 0 0 0-2 2a2 2 0 0 0 2 2h12v-4 M10 3v7l2-1.5 2 1.5V3",
    research: "M8 3h8l4 4v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M16 3v4h4 M4 7v13a1 1 0 0 0 1 1h11 M10 11h7 M10 15h5",
    laboratory: "M9 3h6 M10 3v6l-5.6 9.8A1.5 1.5 0 0 0 5.7 21h12.6a1.5 1.5 0 0 0 1.3-2.2L14 9V3 M7.5 15h9",
    notes: "M5 3h10l4 4v14H5z M15 3v4h4 M8 11h8 M8 15h8 M8 19h5",
    help: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14 M12 17.5v.5",
    more: "M5 12h.01 M12 12h.01 M19 12h.01",
    views: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M9 4v16 M15 4v16 M5 8h2 M11 8h2 M17 8h2 M11 12h2",
    stats: "M4 20h16 M7 17v-6 M12 17V6 M17 17v-9",
    export: "M12 15V3 M7 8l5-5 5 5 M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5",
    settings: "M4 6h9 M17 6h3 M15 4v4 M4 12h3 M11 12h9 M9 10v4 M4 18h11 M19 18h1 M17 16v4",
    trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
    close: "M13 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7 M10 12h11 M18 9l3 3-3 3",
    showNames: "M6 6l6 6-6 6 M13 6l6 6-6 6",
    hideNames: "M18 6l-6 6 6 6 M11 6l-6 6 6 6",
    // Panes beside the section.
    beside: "M3 4h18v16H3z M12 4v16",
    pin: "M9 3h6 M10 3v6l-3 4h10l-3-4V3 M12 13v8",
    toMain: "M15 3h6v6 M21 3l-7 7 M9 21H3v-6 M3 21l7-7",
    swap: "M7 7h13 M16 3l4 4-4 4 M17 17H4 M8 13l-4 4 4 4",
    cross: "M6 6l12 12 M18 6L6 18",
    word: "M6 2h7l5 5v15H6z M13 2v5h5 M8.5 11l1.5 6 2-4 2 4 1.5-6",
    sheets: "M3 5h18v14H3z M8 9.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4z M5 17a3 3 0 0 1 6 0 M14 10h4 M14 14h4",
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
