import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, showTooltip, type Tooltip } from "@codemirror/view";
import { BLANK_LINE, isBlankLine } from "$lib/core/blankLines";

// Markdown reads any number of empty lines as one paragraph break, so an empty line more
// than the writer usually leaves does not show in the book. When one is left, Dante asks,
// in a small bar by the new paragraph, whether to write a blank line that does show.

export interface BlankLineAsk {
  /** The empty lines the writer usually leaves between paragraphs; null when not known yet. */
  habit(): 0 | 1 | null;
  /** Whether to ask at all; turned off by "Don't ask again". */
  enabled(): boolean;
  onNever(): void;
  labels: { question: string; why: string; insert: string; no: string; never: string };
}

/** The gap asked about: from the end of the paragraph before to the start of the new one. */
interface Gap {
  from: number;
  to: number;
  /** Where the bar points: the start of the new paragraph. */
  at: number;
}

const ask = StateEffect.define<Gap | null>();

/** The gap above `line`, when it holds more empty lines than the habit and nothing else. */
function extraGap(state: EditorView["state"], lineNumber: number, habit: 0 | 1): Gap | null {
  const doc = state.doc;
  let n = lineNumber - 1;
  let empty = 0;
  while (n >= 1 && !doc.line(n).text.trim()) {
    empty++;
    n--;
  }
  if (n < 1 || empty <= habit) return null;
  const before = doc.line(n);
  // A blank line already written, or a separator, is a choice made.
  if (isBlankLine(before.text) || /^\s*(\* \* \*|---|\*\*\*)\s*$/.test(before.text)) return null;
  const line = doc.line(lineNumber);
  return { from: before.to, to: line.from, at: line.from };
}

export function blankLineAsk(options: BlankLineAsk): Extension {
  const field = StateField.define<Gap | null>({
    create: () => null,
    update(value, tr) {
      for (const e of tr.effects) if (e.is(ask)) return e.value;
      if (!value) return value;
      if (!tr.docChanged) return value;
      // Typing goes on in the new paragraph; an edit in the gap itself withdraws the question.
      const touched = tr.changes.touchesRange(value.from, value.to);
      if (touched === true || touched === "cover") return null;
      return { from: tr.changes.mapPos(value.from), to: tr.changes.mapPos(value.to), at: tr.changes.mapPos(value.at) };
    },
    provide: (f) => showTooltip.from(f, (gap): Tooltip | null => (gap ? tooltip(gap) : null)),
  });

  const tooltip = (gap: Gap): Tooltip => ({
    pos: gap.at,
    above: true,
    strictSide: false,
    create(view) {
      const dom = document.createElement("div");
      dom.className = "cm-blank-ask";
      dom.setAttribute("role", "status");
      const text = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = options.labels.question;
      text.append(strong, " ", options.labels.why);
      const buttons = document.createElement("div");
      const button = (label: string, run: () => void, primary = false) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        if (primary) b.className = "primary";
        b.onmousedown = (e) => e.preventDefault();
        b.onclick = () => {
          run();
          view.focus();
        };
        buttons.append(b);
      };
      button(
        options.labels.insert,
        () => {
          const current = view.state.field(field);
          if (!current) return;
          const insert = `\n\n${BLANK_LINE}\n\n`;
          view.dispatch({ changes: { from: current.from, to: current.to, insert }, effects: ask.of(null), userEvent: "input" });
        },
        true,
      );
      button(options.labels.no, () => view.dispatch({ effects: ask.of(null) }));
      button(options.labels.never, () => {
        options.onNever();
        view.dispatch({ effects: ask.of(null) });
      });
      dom.append(text, buttons);
      return { dom };
    },
  });

  // The question comes when the first letter of a paragraph is typed after the empty lines.
  const watch = EditorView.updateListener.of((update) => {
    if (!update.docChanged || !options.enabled()) return;
    if (!update.transactions.some((tr) => tr.isUserEvent("input.type"))) return;
    const habit = options.habit();
    if (habit === null) return;
    const { head } = update.state.selection.main;
    const line = update.state.doc.lineAt(head);
    // The line was empty before this typing: a new paragraph starts.
    let started = false;
    update.changes.iterChangedRanges((fromA) => {
      if (!update.startState.doc.lineAt(fromA).text.trim()) started = true;
    });
    if (!started || !line.text.trim() || update.state.field(field)) return;
    const gap = extraGap(update.state, line.number, habit);
    // Not while the editor is still applying this update.
    if (gap) queueMicrotask(() => update.view.dispatch({ effects: ask.of(gap) }));
  });

  return [
    field,
    watch,
    EditorView.baseTheme({
      ".cm-tooltip.cm-blank-ask, .cm-blank-ask": { maxWidth: "420px", padding: "8px 10px", fontFamily: "system-ui, sans-serif", fontSize: "12px", lineHeight: "1.4" },
      ".cm-blank-ask p": { margin: "0 0 6px" },
      ".cm-blank-ask div": { display: "flex", gap: "6px", flexWrap: "wrap" },
      ".cm-blank-ask button": { fontSize: "12px" },
    }),
  ];
}
