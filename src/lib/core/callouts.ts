// Callouts, the quotes that open with `> [!note]` or `> [!warning]`: their colours and how
// their first line reads, shared by the editor and the export.

const COLORS: Record<string, string> = {
  note: "#3b82c4",
  info: "#3b82c4",
  todo: "#3b82c4",
  abstract: "#1f9d8a",
  summary: "#1f9d8a",
  tip: "#1f9d8a",
  hint: "#1f9d8a",
  success: "#2f9e44",
  check: "#2f9e44",
  done: "#2f9e44",
  question: "#d9822b",
  help: "#d9822b",
  warning: "#d9822b",
  caution: "#d9822b",
  attention: "#d9822b",
  important: "#8b5cc4",
  failure: "#d64545",
  danger: "#d64545",
  error: "#d64545",
  bug: "#d64545",
  example: "#8b5cc4",
  quote: "#868e96",
};

/** The first line of a callout: "> [!tip]- Title" gives the type and the title written after it. */
export const CALLOUT_OPEN = /^>[ \t]*\[!([\w-]+)\][+-]?[ \t]*(.*)$/;

export function calloutColor(type: string): string {
  return COLORS[type.toLowerCase()] ?? "#868e96";
}

/** The name a callout shows: its own title, or else its type with a capital letter. */
export function calloutTitle(type: string, title: string): string {
  return title.trim() || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}
