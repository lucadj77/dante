// Which panels are shown, and how wide, kept on this computer so the window looks the same
// after switching section or restarting the app.

const KEY = "dante.layout";

export type Side = "left" | "right";

interface Layout {
  /** The section bar shows names next to the icons. */
  wideNav: boolean;
  /** The panel on the left of a section, such as the manuscript's tree. */
  left: boolean;
  /** The panel on the right, with properties and links. */
  right: boolean;
  /** Widths the panels were dragged to, by section. */
  widths: Record<string, Partial<Record<Side, number>>>;
}

/** Narrowest and widest a side panel can be, and the least the middle keeps. */
export const MIN_PANEL = 160;
export const MAX_PANEL = 560;
export const MIN_MIDDLE = 320;

function load(): Layout {
  const fallback: Layout = { wideNav: false, left: true, right: true, widths: {} };
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!stored || typeof stored !== "object") return fallback;
    const flag = (key: "wideNav" | "left" | "right") => (typeof stored[key] === "boolean" ? stored[key] : fallback[key]);
    const widths = stored.widths && typeof stored.widths === "object" ? stored.widths : {};
    return { wideNav: flag("wideNav"), left: flag("left"), right: flag("right"), widths };
  } catch {
    return fallback;
  }
}

export const layout = $state<Layout>(load());

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // Not remembered after a restart; the panels still work.
  }
}

export function toggle(key: "wideNav" | "left" | "right") {
  layout[key] = !layout[key];
  save();
}

/** A panel's width in a section: the one it was dragged to, or its usual one. */
export function width(section: string, side: Side, usual: number): number {
  const w = layout.widths[section]?.[side];
  return typeof w === "number" ? Math.min(MAX_PANEL, Math.max(MIN_PANEL, w)) : usual;
}

/** Sets a panel's width; null goes back to the usual one. */
export function setWidth(section: string, side: Side, value: number | null) {
  const widths = { ...(layout.widths[section] ?? {}) };
  if (value === null) delete widths[side];
  else widths[side] = Math.round(value);
  layout.widths[section] = widths;
  save();
}

/** The grid columns of a section: its left panel, the middle, its right panel; 0 leaves one out. */
export function columns(section: string, left: number, right: number): string {
  return [
    layout.left && left ? `${width(section, "left", left)}px` : "",
    "minmax(0, 1fr)",
    layout.right && right ? `${width(section, "right", right)}px` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
