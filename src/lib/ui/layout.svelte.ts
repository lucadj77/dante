// Which panels are shown, kept on this computer so the window looks the same after
// switching section or restarting the app.

const KEY = "dante.layout";

interface Layout {
  /** The section bar shows names next to the icons. */
  wideNav: boolean;
  /** The panel on the left of a section, such as the manuscript's tree. */
  left: boolean;
  /** The panel on the right, with properties, links and search. */
  right: boolean;
}

function load(): Layout {
  const fallback: Layout = { wideNav: false, left: true, right: true };
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!stored || typeof stored !== "object") return fallback;
    const flag = (key: keyof Layout) => (typeof stored[key] === "boolean" ? stored[key] : fallback[key]);
    return { wideNav: flag("wideNav"), left: flag("left"), right: flag("right") };
  } catch {
    return fallback;
  }
}

export const layout = $state<Layout>(load());

export function toggle(key: keyof Layout) {
  layout[key] = !layout[key];
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // Not remembered after a restart; the panels still work.
  }
}

/** The grid columns of a section: its left panel, the middle, its right panel; 0 leaves one out. */
export function columns(left: number, right: number): string {
  return [layout.left && left ? `${left}px` : "", "minmax(0, 1fr)", layout.right && right ? `${right}px` : ""].filter(Boolean).join(" ");
}
