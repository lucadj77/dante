import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { Facet, Prec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export interface LinkSuggestion {
  /** What goes between [[ and ]]: the shortest name that reaches the note. */
  target: string;
  /** Shown instead of the target, and written as [[target|alias]]. */
  alias?: string;
  /** Where the note is, or its type. */
  detail?: string;
}

/** What the editor needs from the project to follow and suggest wikilinks. */
export interface LinkHandler {
  open(target: string): void;
  resolves(target: string): boolean;
  suggestions(): LinkSuggestion[];
}

export const linkHandler = Facet.define<LinkHandler, LinkHandler | null>({
  combine: (values) => values[0] ?? null,
});

// The same links the live preview draws: [[target]] or [[target|alias]], with an optional
// #heading after the target.
const LINK = /!?\[\[([^\[\]|\n]+)(\|[^\[\]\n]*)?\]\]/g;

/** The target of the wikilink at `pos`, without its #heading, if there is one. */
export function linkAt(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  for (const m of line.text.matchAll(LINK)) {
    const start = line.from + m.index!;
    if (pos >= start && pos <= start + m[0].length) return m[1].split("#")[0].trim();
  }
  return null;
}

/**
 * A click on a link drawn by the live preview opens its note; on a line being edited,
 * where the brackets show, it takes Cmd or Ctrl as well.
 */
const clicks = EditorView.domEventHandlers({
  mousedown(event, view) {
    const handler = view.state.facet(linkHandler);
    if (!handler || event.button !== 0) return false;
    const modified = event.metaKey || event.ctrlKey;
    const onLink = (event.target as HTMLElement).closest?.(".md-wikilink");
    if (!modified && !onLink) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    const target = linkAt(view, pos);
    if (!target) return false;
    const line = view.state.doc.lineAt(pos).number;
    const editing = view.hasFocus && view.state.selection.ranges.some((r) => {
      const first = view.state.doc.lineAt(r.from).number;
      return line >= first && line <= view.state.doc.lineAt(r.to).number;
    });
    if (editing && !modified) return false;
    event.preventDefault();
    handler.open(target);
    return true;
  },
});

/** Suggests notes after "[[", by name and by alias. */
function complete(context: CompletionContext): CompletionResult | null {
  const handler = context.state.facet(linkHandler);
  if (!handler) return null;
  const before = context.matchBefore(/\[\[[^\[\]|\n]*$/);
  if (!before) return null;
  const from = before.from + 2;
  const closed = context.state.doc.sliceString(context.pos, context.pos + 2) === "]]";
  const options: Completion[] = handler.suggestions().map((s) => {
    const insert = s.alias ? `${s.target}|${s.alias}` : s.target;
    return {
      label: s.alias ?? s.target,
      detail: s.alias ? `→ ${s.target}` : s.detail,
      type: s.alias ? "alias" : "note",
      apply: (view, _completion, start, end) => {
        // Brackets already closed after the cursor are written over, not doubled.
        const to = closed ? end + 2 : end;
        view.dispatch({
          changes: { from: start, to, insert: insert + "]]" },
          selection: { anchor: start + insert.length + 2 },
          userEvent: "input.complete",
        });
      },
    };
  });
  return { from, options, validFor: /^[^\[\]|\n]*$/ };
}

/** Following and suggesting wikilinks, for notes and scenes alike. */
export function wikilinks(handler: LinkHandler | undefined): Extension {
  if (!handler) return [];
  return [
    linkHandler.of(handler),
    Prec.high(clicks),
    autocompletion({ override: [complete], icons: false, activateOnTyping: true }),
  ];
}
