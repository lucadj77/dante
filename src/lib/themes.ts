import type { AppSettings } from "./state.svelte";

// The look of Dante: the themes (colours in app.css, under data-theme for light or dark and
// data-palette for sepia and night), the accent colour and the page layout of the editor,
// all set on the root element as attributes and CSS variables.

/** Accent colours, for light and for dark themes. */
export const ACCENTS: Record<string, { light: string; dark: string }> = {
  blue: { light: "#2f5f9e", dark: "#7ea6dd" },
  green: { light: "#2e7a4c", dark: "#6cc28f" },
  red: { light: "#a8432f", dark: "#e58a73" },
  purple: { light: "#6b4c9a", dark: "#b39ddb" },
  teal: { light: "#1f7178", dark: "#6cc3c9" },
  amber: { light: "#8f6210", dark: "#e0b45c" },
};

/** The same colour, see-through: color-mix is missing in the Safari of macOS 10.15. */
function translucent(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Whether the theme chosen is a dark one, with the system's choice for "system". */
export function isDark(theme: AppSettings["theme"], systemDark: boolean): boolean {
  return theme === "dark" || theme === "night" || (theme === "system" && systemDark);
}

export function applyAppearance(root: HTMLElement, s: AppSettings, systemDark: boolean) {
  const dark = isDark(s.theme, systemDark);
  root.dataset.theme = dark ? "dark" : "light";
  if (s.theme === "sepia" || s.theme === "night") root.dataset.palette = s.theme;
  else delete root.dataset.palette;

  const accent = ACCENTS[s.accent];
  for (const name of ["--accent", "--wikilink", "--bg-active"]) root.style.removeProperty(name);
  if (accent) {
    const colour = dark ? accent.dark : accent.light;
    root.style.setProperty("--accent", colour);
    root.style.setProperty("--wikilink", colour);
    root.style.setProperty("--bg-active", translucent(colour, dark ? 0.28 : 0.16));
  }

  root.style.setProperty("--editor-font", s.fontFamily);
  root.style.setProperty("--editor-size", `${s.fontSize}px`);
  root.style.setProperty("--editor-line-height", String(s.lineHeight));
  root.style.setProperty("--editor-gap", String(s.paragraphGap));
  root.style.setProperty("--editor-indent", `${s.indent}em`);
  root.style.setProperty("--editor-align", s.justify ? "justify" : "left");
  root.style.setProperty("--editor-hyphens", s.justify ? "auto" : "manual");
}
