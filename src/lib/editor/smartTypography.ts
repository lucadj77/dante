import { isolateHistory } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import type { TypographySettings } from "$lib/core/settings";

export interface Replacement {
  /** How many characters before the cursor the replacement starts. */
  back: number;
  insert: string;
}

/**
 * What to type instead of `typed`, given the text of the line before the cursor, or
 * null to type it as it is. Follows the same rules as the export.
 */
export function smartReplacement(before: string, typed: string, rules: TypographySettings): Replacement | null {
  // Note names in wikilinks must stay as they are, or the links would break.
  if (before.lastIndexOf("[[") > before.lastIndexOf("]]")) return null;
  // Inline code is left alone too.
  if ((before.match(/`/g) ?? []).length % 2 === 1) return null;
  const prev = before.slice(-1);
  if (typed === "'" && rules.ellipsis && /(?:^|[\s«“"(—–-])E$/.test(before)) return { back: 1, insert: "È" };
  if (typed === "'" && rules.apostrophes && /[\p{L}\p{N}]/u.test(prev)) return { back: 0, insert: "’" };
  if (typed === '"' && rules.quotes !== "keep") {
    const [open, close] = rules.quotes === "guillemets" ? ["«", "»"] : ["“", "”"];
    const opening = before === "" || /[\s([{—–\-]/.test(prev);
    return { back: 0, insert: opening ? open : close };
  }
  if (typed === "." && rules.ellipsis && before.endsWith("..") && !before.endsWith("...")) return { back: 2, insert: "…" };
  return null;
}

/** Applies typographic conventions while typing. Undo brings back what was typed. */
export function smartTypography(rules: TypographySettings) {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (text.length !== 1 || view.composing) return false;
    const line = view.state.doc.lineAt(from);
    const replacement = smartReplacement(line.text.slice(0, from - line.from), text, rules);
    if (!replacement) return false;
    // First the character as typed, then the correction as its own undo step.
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + 1 }, userEvent: "input.type" });
    view.dispatch({
      changes: { from: from - replacement.back, to: from + 1, insert: replacement.insert },
      selection: { anchor: from - replacement.back + replacement.insert.length },
      userEvent: "input.type.smart",
      annotations: isolateHistory.of("full"),
    });
    return true;
  });
}
