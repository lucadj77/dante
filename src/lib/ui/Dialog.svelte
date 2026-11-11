<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  // The one window every dialog of Dante is built on. It takes the keyboard when it opens
  // (so Esc closes it without a click first), keeps Tab inside, closes with Esc or a click
  // outside, and gives the keyboard back to where it was.

  interface Props {
    /** The name read by screen readers: the dialog's title. */
    label: string;
    onClose: () => void;
    /** The widest it gets, in pixels. */
    width?: number;
    /** As tall as the window, for a dialog whose content scrolls inside. */
    fill?: boolean;
    /** Smaller text, for dialogs that are mostly lists. */
    small?: boolean;
    /** False for a dialog that must be answered: a click outside does not close it. */
    outside?: boolean;
    /** Keys the dialog handles itself, after Esc and Tab. */
    onkeydown?: (e: KeyboardEvent) => void;
    children: Snippet;
  }
  let { label, onClose, width = 640, fill = false, small = false, outside = true, onkeydown, children }: Props = $props();

  let box: HTMLDivElement | undefined = $state();

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusable = () => Array.from(box?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null);

  onMount(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // A field that asked for the keyboard (autofocus, or a focus action) keeps it.
    if (!box?.contains(document.activeElement)) box?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  });

  function key(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        e.preventDefault();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    onkeydown?.(e);
  }
</script>

<div class="overlay" role="presentation" onclick={() => outside && onClose()}>
  <div
    class="dialog"
    class:fill
    class:small
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabindex="-1"
    style:width="min({width}px, calc(100vw - 32px))"
    bind:this={box}
    onclick={(e) => e.stopPropagation()}
    onkeydown={key}
  >
    {@render children()}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: grid;
    place-items: center;
    z-index: 40;
  }
  .dialog {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 20px;
    text-align: left;
    outline: none;
  }
  .dialog.fill {
    height: calc(100vh - 48px);
  }
  .dialog.small {
    font-size: 13px;
  }
</style>
