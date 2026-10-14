import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type EditorState } from "@codemirror/state";
import { linkHandler } from "./links";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

// Markers hidden when the cursor is elsewhere, as in Obsidian's live preview.
const HIDDEN = new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark", "CodeMark"]);
const hide = Decoration.replace({});

const styles: Record<string, Decoration> = {
  ATXHeading1: Decoration.line({ class: "md-h1" }),
  ATXHeading2: Decoration.line({ class: "md-h2" }),
  ATXHeading3: Decoration.line({ class: "md-h3" }),
  ATXHeading4: Decoration.line({ class: "md-h4" }),
  Blockquote: Decoration.line({ class: "md-quote" }),
};
const marks: Record<string, Decoration> = {
  Emphasis: Decoration.mark({ class: "md-em" }),
  StrongEmphasis: Decoration.mark({ class: "md-strong" }),
  Strikethrough: Decoration.mark({ class: "md-strike" }),
  InlineCode: Decoration.mark({ class: "md-code" }),
};
const wikiLink = Decoration.mark({ class: "md-wikilink" });
const wikiMissing = Decoration.mark({ class: "md-wikilink md-unresolved" });
const wikiHidden = Decoration.replace({});
const WIKILINK = /\[\[([^\[\]|\n]+)(\|([^\[\]\n]+))?\]\]/g;
// ==highlight==, but not CriticMarkup's {==highlight==}.
const HIGHLIGHT = /(?<!\{)==(?=\S)([^=\n]+?)==(?!\})/g;
const highlight = Decoration.mark({ class: "md-highlight" });

/** A list's "-", drawn as a bullet away from the cursor. */
class Bullet extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "md-bullet";
    dot.textContent = "•";
    return dot;
  }
}
const bullet = Decoration.replace({ widget: new Bullet() });

/** The [ ] or [x] of a task, drawn as a checkbox that can be clicked. */
class TaskBox extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: TaskBox) {
    return other.checked === this.checked;
  }
  toDOM() {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.className = "md-task";
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

/** Lines touched by the selection show their Markdown as typed. */
function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

function build(view: EditorView, focused: boolean): DecorationSet {
  const { state } = view;
  const active = focused ? activeLines(state) : new Set<number>();
  const found: { from: number; to: number; deco: Decoration }[] = [];
  const links = state.facet(linkHandler);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const lineDeco = styles[node.name];
        if (lineDeco) {
          const line = state.doc.lineAt(node.from);
          found.push({ from: line.from, to: line.from, deco: lineDeco });
        }
        if (node.name === "ListMark" && /^[-*+]$/.test(state.doc.sliceString(node.from, node.to)) && !active.has(state.doc.lineAt(node.from).number)) {
          // Before a checkbox the dash goes away; otherwise it becomes a bullet.
          const task = node.node.nextSibling?.name === "Task";
          const end = task && state.doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
          found.push({ from: node.from, to: end, deco: task ? hide : bullet });
        }
        if (node.name === "TaskMarker") {
          const checked = /x/i.test(state.doc.sliceString(node.from, node.to));
          found.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new TaskBox(checked) }) });
        }
        const mark = marks[node.name];
        if (mark && node.to > node.from) found.push({ from: node.from, to: node.to, deco: mark });
        if (HIDDEN.has(node.name) && !active.has(state.doc.lineAt(node.from).number)) {
          let end = node.to;
          // A heading's "# " goes together with its space.
          if (node.name === "HeaderMark" && state.doc.sliceString(end, end + 1) === " ") end++;
          if (end > node.from) found.push({ from: node.from, to: end, deco: hide });
        }
      },
    });

    const text = state.doc.sliceString(from, to);
    for (const m of text.matchAll(HIGHLIGHT)) {
      const start = from + m.index!;
      const end = start + m[0].length;
      if (active.has(state.doc.lineAt(start).number)) {
        found.push({ from: start, to: end, deco: highlight });
      } else {
        found.push({ from: start, to: start + 2, deco: hide });
        found.push({ from: start + 2, to: end - 2, deco: highlight });
        found.push({ from: end - 2, to: end, deco: hide });
      }
    }
    for (const m of text.matchAll(WIKILINK)) {
      const start = from + m.index!;
      const end = start + m[0].length;
      const lineActive = active.has(state.doc.lineAt(start).number);
      // A link to a note that does not exist is drawn fainter, as in Obsidian.
      const deco = links && !links.resolves(m[1].split("#")[0].trim()) ? wikiMissing : wikiLink;
      if (lineActive) {
        found.push({ from: start, to: end, deco });
      } else {
        // Show only the alias (or the target) of [[target|alias]].
        const shown = m[3] ?? m[1];
        const shownStart = m[3] ? end - 2 - m[3].length : start + 2;
        found.push({ from: start, to: shownStart, deco: wikiHidden });
        found.push({ from: shownStart, to: shownStart + shown.length, deco });
        found.push({ from: shownStart + shown.length, to: end, deco: wikiHidden });
      }
    }
  }

  found.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  let lastHiddenEnd = -1;
  for (const { from, to, deco } of found) {
    const isReplace = deco === hide || deco === wikiHidden || deco === bullet || deco.spec.widget instanceof TaskBox;
    // Overlapping replacements would throw; the first one wins.
    if (isReplace && from < lastHiddenEnd) continue;
    builder.add(from, to, deco);
    if (isReplace) lastHiddenEnd = to;
  }
  return builder.finish();
}

/** Clicking a task's checkbox ticks it in the text, without moving the cursor there. */
const taskClicks = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement;
    if (!target.classList?.contains("md-task")) return false;
    event.preventDefault();
    const pos = view.posAtDOM(target);
    const marker = view.state.doc.sliceString(pos, pos + 3);
    if (!/^\[[ xX]\]$/.test(marker)) return true;
    view.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: marker[1] === " " ? "x" : " " }, userEvent: "input.task" });
    return true;
  },
});

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view, view.hasFocus);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
        this.decorations = build(update.view, update.view.hasFocus);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const livePreview = [plugin, taskClicks];
