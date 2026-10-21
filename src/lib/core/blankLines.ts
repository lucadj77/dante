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
