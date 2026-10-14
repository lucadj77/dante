<script lang="ts">
  import { t } from "$lib/state.svelte";
  import { MAX_PANEL, MIN_MIDDLE, MIN_PANEL, setWidth, width, type Side } from "./layout.svelte";

  interface Props {
    /** The section whose panel this resizes; widths are kept per section. */
    section: string;
    side: Side;
    /** The panel's usual width. */
    usual: number;
    /** The width of the panel on the other side, 0 when hidden, so the middle keeps room. */
    other: number;
  }
  let p: Props = $props();

  let handle: HTMLDivElement;
  let dragging = $state(false);
  const current = $derived(width(p.section, p.side, p.usual));

  function clamp(value: number): number {
    const container = handle.parentElement!.getBoundingClientRect().width;
    const most = Math.min(MAX_PANEL, container - p.other - MIN_MIDDLE);
    return Math.max(MIN_PANEL, Math.min(Math.max(MIN_PANEL, most), value));
  }

  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    handle.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!dragging) return;
    const box = handle.parentElement!.getBoundingClientRect();
    const value = p.side === "left" ? event.clientX - box.left : box.right - event.clientX;
    setWidth(p.section, p.side, clamp(value));
  }

  function up(event: PointerEvent) {
    dragging = false;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  }

  function key(event: KeyboardEvent) {
    const step = event.shiftKey ? 48 : 16;
    // The arrow points where the edge goes.
    const grow = p.side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = p.side === "left" ? "ArrowLeft" : "ArrowRight";
    if (event.key === grow) setWidth(p.section, p.side, clamp(current + step));
    else if (event.key === shrink) setWidth(p.section, p.side, clamp(current - step));
    else if (event.key === "Home" || event.key === "Enter") setWidth(p.section, p.side, null);
    else return;
    event.preventDefault();
  }
</script>

<!-- A focusable separator is how a resizable splitter is announced (WAI-ARIA "window splitter"). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={handle}
  class="resizer {p.side}"
  class:dragging
  style="{p.side}: {current - 3}px"
  role="separator"
  aria-orientation="vertical"
  aria-label={t(p.side === "left" ? "nav.resizeLeft" : "nav.resizeRight")}
  aria-valuenow={current}
  aria-valuemin={MIN_PANEL}
  aria-valuemax={MAX_PANEL}
  title={t("nav.resizeHint")}
  tabindex="0"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  ondblclick={() => setWidth(p.section, p.side, null)}
  onkeydown={key}
></div>
{#if dragging}
  <!-- Keeps the cursor and stops text being selected while dragging over the editor. -->
  <div class="drag-cover"></div>
{/if}

<style>
  .resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 5;
    width: 6px;
    cursor: col-resize;
    touch-action: none;
  }
  .resizer:hover,
  .resizer:focus-visible,
  .resizer.dragging {
    background: var(--accent);
    opacity: 0.5;
    outline: none;
  }
  .drag-cover {
    position: fixed;
    inset: 0;
    z-index: 4;
    cursor: col-resize;
  }
</style>
