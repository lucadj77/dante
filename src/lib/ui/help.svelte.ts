// The help window: open over whatever is on screen, from the side bar, the start screen or
// the Mac's Help menu.

export type HelpPage = "first" | "guide" | "news";

export const help = $state<{ open: boolean; page: HelpPage; chapter: number }>({ open: false, page: "first", chapter: 0 });

/**
 * The chapters of the guide that panels link to, by number: the same in docs/guida.md and
 * docs/guide.md. A test checks them against the headings, so a reordered guide is noticed.
 */
export const GUIDE_CHAPTERS = { shortcuts: 9, views: 13, export: 17, gamebook: 18 } as const;

/** Opens the help; `chapter` is the number of a chapter of the guide to show at once. */
export function openHelp(page: HelpPage = help.page, chapter = 0) {
  help.chapter = page === "guide" ? chapter : 0;
  help.page = page;
  help.open = true;
}
