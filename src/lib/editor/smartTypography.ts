import { isolateHistory } from "@codemirror/commands";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { TypographySettings } from "$lib/core/settings";
import { QUOTE_MARKS } from "$lib/core/typography";

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
  if (typed === '"' && rules.quotes === "dash") {
    // Dialogue opens with "— " and closes with " —"; the export drops a dash left at the end.
    const opening = before === "" || /[\s(]/.test(prev);
    return opening ? { back: 0, insert: "— " } : { back: 0, insert: " —" };
  }
  if (typed === '"' && rules.quotes === "dashAttached") {
    // Spanish: —Ven —dijo él—. Es tarde. An odd number of dashes before means a line of
    // dialogue is open: the dash closes it, after a space. Otherwise it opens one, or ends
    // the narration touching its last word.
    const inside = ((before.match(/—/g) ?? []).length % 2) === 1;
    return { back: 0, insert: inside && !/\s/.test(prev) ? " —" : "—" };
  }
  if (typed === '"' && rules.quotes !== "keep") {
    const [open, close] = QUOTE_MARKS[rules.quotes] ?? ["“", "”"];
    const opening = before === "" || /[\s([{—–\-]/.test(prev);
    return { back: 0, insert: opening ? open : close };
  }
  if (typed === " " && (rules.quotes === "dash" || rules.quotes === "dashAttached") && /^[ \t]*--?$/.test(before)) {
    const dash = before.trimStart();
    // The space is typed too in the Italian way; in the Spanish one the words touch the dash.
    return rules.quotes === "dash" ? { back: dash.length, insert: "— " } : { back: dash.length, insert: "—" };
  }
  if (typed === "." && rules.ellipsis && before.endsWith("..") && !before.endsWith("...")) return { back: 2, insert: "…" };
  return null;
}

/** What smartTypography needs of an editor view. */
interface Typing {
  readonly state: EditorState;
  dispatch(spec: TransactionSpec): void;
}

/** Types `text` over `from`–`to` applying the conventions; false when none applies. */
export function typeSmartly(view: Typing, from: number, to: number, text: string, rules: TypographySettings): boolean {
  if (text.length !== 1) return false;
  const line = view.state.doc.lineAt(from);
  const before = line.text.slice(0, from - line.from);
  const replacement = smartReplacement(before, text, rules);
  if (!replacement) return false;
  // First the character as typed, then the correction as its own undo step.
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + 1 }, userEvent: "input.type" });
  // Revision marks and the tags of an aligned paragraph can move what was typed: the
  // correction goes where the character ended up, before the cursor.
  const head = view.state.selection.main.head;
  const start = head - 1 - replacement.back;
  if (start < 0 || view.state.sliceDoc(start, head) !== before.slice(before.length - replacement.back) + text) return true;
  view.dispatch({
    changes: { from: start, to: head, insert: replacement.insert },
    selection: { anchor: start + replacement.insert.length },
    userEvent: "input.type.smart",
    annotations: isolateHistory.of("full"),
  });
  return true;
}

/** Applies typographic conventions while typing. Undo brings back what was typed. */
export function smartTypography(rules: TypographySettings) {
  return EditorView.inputHandler.of((view, from, to, text) => !view.composing && typeSmartly(view, from, to, text, rules));
}
