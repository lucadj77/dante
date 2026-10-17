/** Removes Markdown syntax that is not part of the prose, keeping wikilink aliases. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\{>>[\s\S]*?<<\}/g, "") // CriticMarkup comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // HTML tags, such as the ones that align a paragraph.
    .replace(/<\/?[a-zA-Z][^<>\n]*>/g, "")
    // Embedded images and notes are not words of the text, as in the export.
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "")
    // Tables: the delimiter row and the bars between cells.
    .replace(/^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/gm, "")
    .replace(/!?\[\[([^\]|]+)\\?\|([^\]]+)\]\]/g, "$2")
    .replace(/!?\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(?<!\\)\|/g, " ")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_~`=]+/g, "");
}

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
}

export function textStats(markdown: string): TextStats {
  const text = plainText(markdown).replace(/\s+/g, " ").trim();
  const words = text === "" ? 0 : (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
  return {
    words,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
  };
}

export function readingMinutes(words: number, wordsPerMinute = 230): number {
  return Math.max(words > 0 ? 1 : 0, Math.round(words / wordsPerMinute));
}
