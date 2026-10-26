// The help window: open over whatever is on screen, from the side bar, the start screen or
// the Mac's Help menu.

export type HelpPage = "first" | "guide" | "news";

export const help = $state<{ open: boolean; page: HelpPage }>({ open: false, page: "first" });

export function openHelp(page: HelpPage = help.page) {
  help.page = page;
  help.open = true;
}
