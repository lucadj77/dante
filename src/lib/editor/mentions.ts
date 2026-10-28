import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import type { NameFound, NameMatcher } from "$lib/core/mentions";
import { linkHandler } from "./links";

/** Sent on the window when the names change, or the underlining is turned on or off. */
export const NAMES_EVENT = "dante-names";

const refresh = StateEffect.define<null>();

/** The names of the Story Bible in the visible text, dotted underlined. */
function build(view: EditorView): DecorationSet {
  const handler = view.state.facet(linkHandler);
  const names = handler?.names?.();
  const builder = new RangeSetBuilder<Decoration>();
  if (!names || names.matcher.empty) return builder.finish();
  for (const { from, to } of view.visibleRanges) {
    const start = view.state.doc.lineAt(from);
    const end = view.state.doc.lineAt(to);
    for (let n = start.number; n <= end.number; n++) {
      const line = view.state.doc.line(n);
      for (const found of names.matcher.find(line.text)) {
        if (found.path === names.own) continue;
        builder.add(line.from + found.from, line.from + found.to, Decoration.mark({ class: "md-named", attributes: { "data-named": found.path } }));
      }
    }
  }
  return builder.finish();
}

/** The name found at a position of the text, if there is one. */
function nameAt(view: EditorView, pos: number): (NameFound & { line: number }) | null {
  const names = view.state.facet(linkHandler)?.names?.();
  if (!names) return null;
  const line = view.state.doc.lineAt(pos);
  for (const found of names.matcher.find(line.text)) {
    if (found.path !== names.own && pos >= line.from + found.from && pos <= line.from + found.to) return { ...found, line: line.from };
  }
  return null;
}

const highlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private listener = () => this.view.dispatch({ effects: refresh.of(null) });
    constructor(readonly view: EditorView) {
      this.decorations = build(view);
      window.addEventListener(NAMES_EVENT, this.listener);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.transactions.some((tr) => tr.effects.some((e) => e.is(refresh)))) this.decorations = build(update.view);
    }
    destroy() {
      window.removeEventListener(NAMES_EVENT, this.listener);
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      // A right click on a name opens the menu of a link to its note; with Shift, the system's menu.
      contextmenu(event, view) {
        const handler = view.state.facet(linkHandler);
        if (!handler?.named || event.shiftKey || !(event.target as HTMLElement).closest?.(".md-named")) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        const found = pos === null ? null : nameAt(view, pos);
        if (!found) return false;
        event.preventDefault();
        const from = found.line + found.from;
        const to = found.line + found.to;
        handler.named(found, { x: event.clientX, y: event.clientY }, (target) => {
          // The name stays as written: [[Lucia Mondella|Lucia]] when it is an alias.
          const insert = target === found.name ? `[[${target}]]` : `[[${target}|${found.name}]]`;
          view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: "input" });
          view.focus();
        });
        return true;
      },
    },
  },
);

/** Dotted underlining of the names of the Story Bible, with their menu on a right click. */
export const namedNotes = [
  highlighter,
  EditorView.baseTheme({
    ".md-named": { textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--text-muted, #888)", textUnderlineOffset: "3px" },
  }),
];
