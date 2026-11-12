// In full screen only the text shows; the bars and the panels come out when the mouse
// rests on the edge they belong to, and go back when it leaves them.

export type Edge = "top" | "left" | "right";

/** How close to the edge the mouse has to be, and how long it rests there. */
const EDGE_ZONE = 4;
const EDGE_DWELL = 120;

/**
 * The edge whose bars or panel are out. `active` says whether the view is in full screen,
 * `held` whether something open, such as a menu, keeps them out.
 */
export function edgeReveal(active: () => boolean, held: () => boolean) {
  let edge = $state<Edge | null>(null);
  /** The mouse is over the bars or panel that came out. */
  let hovering = false;
  let edgeTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let waiting: Edge | null = null;

  function onMouseMove(event: MouseEvent) {
    if (!active()) return;
    // Out without the mouse ever going over it, as when it moves away at once.
    if (edge) {
      if (!hovering) hideSoon();
      return;
    }
    // A button held down is a drag or the scrollbar, not a wish to see the panels.
    if (event.buttons) return;
    const near: Edge | null =
      event.clientY <= EDGE_ZONE ? "top" : event.clientX <= EDGE_ZONE ? "left" : event.clientX >= window.innerWidth - 1 - EDGE_ZONE ? "right" : null;
    if (near === waiting) return;
    clearTimeout(edgeTimer);
    waiting = near;
    if (near) edgeTimer = setTimeout(() => ((edge = near), (waiting = null)), EDGE_DWELL);
  }

  /** Something in the bars or panel that came out is being typed into, so they stay. */
  function typing(): boolean {
    const focused = document.activeElement as HTMLElement | null;
    const out = document.querySelector(".manuscript .edge-top.shown, .manuscript .edge-panel.shown");
    if (!focused || !out?.contains(focused)) return false;
    return focused.matches("input, textarea, select, [contenteditable=true], .cm-content");
  }

  function enterEdge() {
    hovering = true;
    clearTimeout(hideTimer);
    hideTimer = undefined;
  }

  function hideSoon() {
    if (hideTimer) return;
    hideTimer = setTimeout(() => {
      hideTimer = undefined;
      if (hovering || held() || typing()) return;
      edge = null;
    }, 350);
  }

  function leaveEdge(event: Event) {
    if (event.type === "mouseleave") hovering = false;
    clearTimeout(hideTimer);
    hideTimer = undefined;
    hideSoon();
  }

  return {
    get edge() {
      return edge;
    },
    /** Nothing is out any more, as when full screen starts or ends. */
    reset() {
      edge = null;
      hovering = false;
    },
    onMouseMove,
    enterEdge,
    leaveEdge,
  };
}
