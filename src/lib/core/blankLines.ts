// Blank lines between paragraphs. Markdown reads any number of empty lines as one paragraph
// break, so a blank line that must show is a paragraph of its own holding only a
// non-breaking space:
//
//   The door closed.
//
//   &nbsp;
//
//   In the morning…
//
// Obsidian, Pandoc and browsers show it as an empty line; it starts no scene. A line holding
// only <br> or a non-breaking space, as other apps write it, is read the same way.

/** The paragraph Dante writes for a blank line. */
export const BLANK_LINE = "&nbsp;";

const BLANK = /^[ \t]*(?:&nbsp;|&#160;|&#x0*a0;| |<br\s*\/?>)(?:[ \t]*(?:&nbsp;|&#160;|&#x0*a0;| |<br\s*\/?>))*[ \t]*$/i;

/** Whether a line (or a paragraph's text) is a blank line. */
export function isBlankLine(text: string): boolean {
  return BLANK.test(text);
}

/**
 * The text with every blank line written as a lone non-breaking space, as the export reads
 * it: an entity would not survive typography, and a lone <br> would be an HTML block.
 */
export function normalizeBlankLines(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => (isBlankLine(line) ? " " : line))
    .join("\n");
}

// Lines that are not running text: their spacing says nothing of how paragraphs are spaced.
const NOT_TEXT = /^\s*(?:[-*+]\s|\d+[.)]\s|\||>|#|```|\* \* \*|---|\{>>)/;

/**
 * How many empty lines the writer usually leaves between paragraphs, 0 or 1, from the
 * texts' gaps between lines of running text; null with too few to tell.
 */
export function blankHabit(texts: string[]): 0 | 1 | null {
  let none = 0;
  let one = 0;
  for (const text of texts) {
    let empty = -1;
    for (const line of text.split("\n")) {
      if (!line.trim()) {
        if (empty >= 0) empty++;
        continue;
      }
      const text = !NOT_TEXT.test(line) && !isBlankLine(line);
      if (text && empty === 0) none++;
      else if (text && empty === 1) one++;
      empty = text ? 0 : -1;
    }
  }
  if (none + one < 5) return null;
  return none > one ? 0 : 1;
}
