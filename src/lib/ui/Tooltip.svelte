<script lang="ts">
  // One tooltip for the whole app, shown at once instead of after the system's delay. It takes
  // the text of any title or data-tip attribute; a first line ending in a newline is the
  // tool's name, shown in bold above what it does.
  import { onMount } from "svelte";

  let tip = $state<{ text: string; x: number; y: number; side: "below" | "above" | "right" } | null>(null);
  let box = $state<HTMLDivElement | null>(null);
  let target: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Moving from one tool to the next shows the next tip with no wait at all. */
  let lastHidden = 0;

  const lines = $derived(tip ? tip.text.split("\n") : []);

  function adopt(el: HTMLElement): string | null {
    const title = el.getAttribute("title");
    if (title) {
      // The system's tooltip would show too, late; the text moves to data-tip.
      el.removeAttribute("title");
      el.dataset.tip = title;
      if (!el.hasAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", title.split("\n")[0]);
    }
    return el.dataset.tip || null;
  }

  function show(el: HTMLElement) {
    const text = adopt(el);
    if (!text) return;
    const r = el.getBoundingClientRect();
    const right = el.dataset.tipSide === "right";
    tip = right
      ? { text, x: r.right + 8, y: r.top + r.height / 2, side: "right" }
      : { text, x: r.left + r.width / 2, y: r.bottom + 6, side: r.bottom + 80 > innerHeight ? "above" : "below" };
    if (tip.side === "above") tip.y = r.top - 6;
  }

  function hide() {
    clearTimeout(timer);
    if (tip) lastHidden = Date.now();
    tip = null;
    target = null;
  }

  // Keeps the tip inside the window once its size is known.
  $effect(() => {
    if (!tip || !box) return;
    const b = box.getBoundingClientRect();
    const margin = 6;
    let dx = 0;
    if (b.right > innerWidth - margin) dx = innerWidth - margin - b.right;
    if (b.left + dx < margin) dx = margin - b.left;
    if (dx) box.style.translate = `${dx}px 0`;
  });

  onMount(() => {
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as Element).closest?.<HTMLElement>("[title], [data-tip]");
      if (el === target) return;
      hide();
      if (!el || !el.isConnected) return;
      target = el;
      const quick = Date.now() - lastHidden < 600;
      timer = setTimeout(() => target === el && el.isConnected && show(el), quick ? 0 : 120);
    };
    const leave = (e: PointerEvent) => {
      if (target && !target.contains(e.relatedTarget as Node | null)) hide();
    };
    const focus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches?.(":focus-visible") && (el.hasAttribute("title") || el.dataset?.tip)) {
        target = el;
        show(el);
      }
    };
    const away = () => hide();
    // Focus also leaves when Svelte removes an element, in the middle of an update.
    const blur = () => {
      const was = target;
      queueMicrotask(() => target === was && hide());
    };
    document.addEventListener("pointerover", over, true);
    document.addEventListener("pointerout", leave, true);
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", away, true);
    document.addEventListener("scroll", away, true);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("focusout", blur, true);
    return () => {
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("pointerout", leave, true);
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", away, true);
      document.removeEventListener("scroll", away, true);
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("focusout", blur, true);
    };
  });
</script>

{#if tip}
  <div bind:this={box} class="tooltip {tip.side}" role="tooltip" style="left: {tip.x}px; top: {tip.y}px">
    {#if lines.length > 1}
      <strong>{lines[0]}</strong>
      <span>{lines.slice(1).join("\n")}</span>
    {:else}
      {lines[0]}
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    z-index: 1000;
    display: grid;
    gap: 2px;
    width: max-content;
    max-width: 280px;
    padding: 5px 9px;
    border-radius: 5px;
    background: var(--text);
    color: var(--bg);
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-line;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  .tooltip.below {
    transform: translateX(-50%);
  }
  .tooltip.above {
    transform: translate(-50%, -100%);
  }
  .tooltip.right {
    transform: translateY(-50%);
  }
  strong {
    font-weight: 600;
  }
  span {
    opacity: 0.85;
  }
</style>
