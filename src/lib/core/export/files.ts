// Where exports go and what they are called: a folder of the project, and file names
// made of authors, title and time, so each export is kept next to the earlier ones.

/** Folder of the project that holds the exported files. */
export const EXPORT_FOLDER = "export";

/** The authors of a byline such as "Ada Rossi, Bruno Neri e Carla Bianchi". */
export function authorsOf(byline: string): string[] {
  return byline
    .split(/\s*(?:[,;&+/]|\s(?:e|ed|and|y|et|und)\s)\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

/** The words of a text, without characters that file names cannot or should not hold. */
function words(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{M}\p{N}'’.-]/gu, "").replace(/^[.-]+|\.+$/g, ""))
    .filter(Boolean);
}

/** "2026-10-16-11-30", in local time. */
export function exportStamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}-${two(date.getHours())}-${two(date.getMinutes())}`;
}

/** "Ada_Rossi_Bruno_Neri_La_casa_sul_lago_2026-10-16-11-30", without extension. */
export function exportBaseName(details: { title: string; authors: string[] }, date: Date, fallbackTitle = "manuscript"): string {
  const title = words(details.title);
  const parts = [...details.authors.flatMap(words), ...(title.length ? title : words(fallbackTitle))];
  return [...parts, exportStamp(date)].join("_");
}
