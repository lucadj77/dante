import { getContext, setContext } from "svelte";
import type { LinkHandler } from "$lib/editor/links";

/** What every view can ask of the workspace: opening a path wherever it belongs. */
export interface Navigator {
  /** Opens a note or file of the project in its section. */
  open(path: string): void;
  /** Link following and suggestions for an editor showing `from`. */
  links(from: string): LinkHandler;
}

const KEY = Symbol("navigator");

export function provideNavigator(navigator: Navigator) {
  setContext(KEY, navigator);
}

/** The workspace's navigator, or null outside a workspace (as in tests). */
export function navigator(): Navigator | null {
  return getContext<Navigator | undefined>(KEY) ?? null;
}
