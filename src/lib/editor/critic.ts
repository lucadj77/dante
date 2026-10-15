import { EditorState, Facet, Prec, RangeSetBuilder, StateField, Transaction, type Extension } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType, type DecorationSet } from "@codemirror/view";
import { discussion, parseCritic, today, trackChange, type CriticItem } from "$lib/core/critic";

/** What the editor asks of the interface about comments. */
export interface CriticHandler {
  /** Start a comment on `[from, to)`, or at a point. */
  newComment(view: EditorView, from: number, to: number): void;
  /** Show the comment thread or change that starts at `from`. */
  openThread(view: EditorView, from: number): void;
}

export const criticHandler = Facet.define<CriticHandler, CriticHandler | null>({
  combine: (values) => values[0] ?? null,
});

/** Edits made by the comments panel, which revision mode leaves as they are. */
export const CRITIC_EVENT = "input.critic";

// Events written as they are even in revision mode: formatting marks, checkboxes,
// accepting and rejecting, and accented letters still being composed.
const UNTRACKED = ["input.format", "input.task", CRITIC_EVENT, "input.type.compose"];

/**
 * Revision mode: typing and deleting become additions and deletions in CriticMarkup,
 * signed by `author`.
 */
export function trackChanges(author: string): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    const event = tr.annotation(Transaction.userEvent);
    if (!event || !(event.startsWith("input") || event.startsWith("delete"))) return tr;
    if (UNTRACKED.some((e) => event === e || event.startsWith(e + "."))) return tr;
    const changes: { from: number; to: number; insert: string }[] = [];
    tr.changes.iterChanges((from, to, _fromB, _toB, inserted) => changes.push({ from, to, insert: inserted.toString() }));
    // Several cursors at once are left as typed.
    if (changes.length !== 1) return tr;
    const text = tr.startState.doc.toString();
    const tracked = trackChange(text, changes[0], author, today(), event !== "delete.forward");
    if (!tracked) return tr;
    return {
      changes: { from: tracked.from, to: tracked.to, insert: tracked.insert },
      selection: { anchor: tracked.cursor },
      userEvent: event,
      scrollIntoView: true,
    };
  });
}

/** The speech bubble that stands for a comment thread. */
class Bubble extends WidgetType {
  constructor(
    readonly count: number,
    readonly title: string,
    readonly from: number,
  ) {
    super();
  }
  eq(other: Bubble) {
    return other.count === this.count && other.title === this.title && other.from === this.from;
  }
  toDOM(view: EditorView) {
    const el = document.createElement("span");
    el.className = "cm-critic-bubble";
    el.textContent = this.count > 1 ? `💬︎${this.count}` : "💬︎";
    el.title = this.title;
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.state.facet(criticHandler)?.openThread(view, this.from);
    });
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

const hidden = Decoration.replace({});
const STYLE: Record<string, string> = {
  addition: "cm-critic-add",
  deletion: "cm-critic-del",
  highlight: "cm-critic-hl",
};

function signer(item: CriticItem): string {
  return [item.author, item.date].filter(Boolean).join(" · ");
}

interface Built {
  decorations: DecorationSet;
  /** Hidden ranges, which the cursor skips over. */
  atomic: DecorationSet;
}

function build(state: EditorState): Built {
  const text = state.doc.toString();
  const found: { from: number; to: number; deco: Decoration; atomic?: boolean }[] = [];
  const hide = (from: number, to: number) => {
    // A replaced range may not cross a line break here.
    if (to > from && !text.slice(from, to).includes("\n")) found.push({ from, to, deco: hidden, atomic: true });
  };
  const mark = (from: number, to: number, cls: string, title: string) => {
    if (to > from) found.push({ from, to, deco: Decoration.mark({ class: cls, attributes: title ? { title } : {} }) });
  };

  for (const item of parseCritic(text)) {
    const title = signer(item);
    if (item.kind !== "comment") {
      hide(item.markFrom, item.contentFrom);
      if (item.kind === "substitution") {
        mark(item.contentFrom, item.contentTo, "cm-critic-del", title);
        hide(item.contentTo, item.newFrom!);
        mark(item.newFrom!, item.newTo!, "cm-critic-add", title);
        hide(item.newTo!, item.markTo);
      } else {
        mark(item.contentFrom, item.contentTo, STYLE[item.kind], title);
        hide(item.contentTo, item.markTo);
      }
    }
    // Signatures disappear; the words of a thread become one bubble.
    const words = discussion(item);
    let bubbled = false;
    for (const c of item.comments) {
      if (c.text && !bubbled && !text.slice(c.from, c.to).includes("\n")) {
        bubbled = true;
        const tip = words.map((w) => `${w.author ?? "?"}: ${w.text}`).join("\n");
        found.push({ from: c.from, to: c.to, deco: Decoration.replace({ widget: new Bubble(words.length, tip, item.from) }), atomic: true });
      } else {
        hide(c.from, c.to);
      }
    }
  }

  found.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide || a.to - b.to);
  const decorations = new RangeSetBuilder<Decoration>();
  const atomic = new RangeSetBuilder<Decoration>();
  for (const f of found) {
    decorations.add(f.from, f.to, f.deco);
    if (f.atomic) atomic.add(f.from, f.to, f.deco);
  }
  return { decorations: decorations.finish(), atomic: atomic.finish() };
}

const marks = StateField.define<Built>({
  create: build,
  update: (value, tr) => (tr.docChanged ? build(tr.state) : value),
  provide: (field) => [
    EditorView.decorations.from(field, (v) => v.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).atomic),
  ],
});

/** Comments and revisions drawn as in a word processor, with their marks hidden. */
export const criticPreview: Extension = [
  marks,
  EditorView.baseTheme({
    ".cm-critic-add": { color: "var(--critic-add, #1a7f37)", textDecoration: "underline", textDecorationColor: "currentColor" },
    ".cm-critic-del": { color: "var(--critic-del, #c62828)", textDecoration: "line-through" },
    ".cm-critic-hl": { backgroundColor: "var(--critic-hl, rgba(255, 196, 0, 0.28))", borderRadius: "2px" },
    ".cm-critic-bubble": {
      cursor: "pointer",
      fontSize: "0.75em",
      verticalAlign: "super",
      padding: "0 2px",
      fontFamily: "var(--ui-font)",
      color: "var(--accent)",
    },
  }),
];

/** Cmd/Ctrl+Alt+M comments the selection, as in word processors. */
export function criticCommands(handler: CriticHandler | undefined): Extension {
  if (!handler) return [];
  return [
    criticHandler.of(handler),
    Prec.high(
      keymap.of([
        {
          key: "Mod-Alt-m",
          run: (view) => {
            const { from, to } = view.state.selection.main;
            handler.newComment(view, from, to);
            return true;
          },
        },
      ]),
    ),
  ];
}
