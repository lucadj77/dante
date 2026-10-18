import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { RangeSetBuilder, type EditorState } from "@codemirror/state";
import { linkHandler } from "./links";
import { tablePreview } from "./tables";
import { embedPreview } from "./embeds";
import { ImageWidget, imageDecorations, imageInput } from "./images";
import { isImagePath } from "../core/images";
import { aligned, alignedEditing, alignmentTheme, paragraphAround } from "./alignment";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

// Markers hidden when the cursor is elsewhere, as in Obsidian's live preview.
const HIDDEN = new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark", "CodeMark", "QuoteMark"]);
const hide = Decoration.replace({});

const styles: Record<string, Decoration> = {
  ATXHeading1: Decoration.line({ class: "md-h1" }),
  ATXHeading2: Decoration.line({ class: "md-h2" }),
  ATXHeading3: Decoration.line({ class: "md-h3" }),
  ATXHeading4: Decoration.line({ class: "md-h4" }),
};
const quoteLine = Decoration.line({ class: "md-quote" });
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
// ==highlight==, but not CriticMarkup's {==highlight==} (the "{" before is checked where
// it is used: no lookbehind, which macOS 10.15 does not know).
const HIGHLIGHT = /==(?=\S)([^=\n]+?)==(?!\})/g;
const highlight = Decoration.mark({ class: "md-highlight" });
const alignLines = {
  left: Decoration.line({ class: "md-align-left" }),
  center: Decoration.line({ class: "md-align-center" }),
  right: Decoration.line({ class: "md-align-right" }),
  justify: Decoration.line({ class: "md-align-justify" }),
};

/**
 * The start of a list item's first line, up to its text: drawn as its bullet, number or
 * checkbox away from the cursor, in a box as wide as the indent, so that the text of every
 * line of the item starts at the same place.
 */
class ListPrefix extends WidgetType {
  constructor(
    readonly marker: string,
    /** Where the marker starts: the indent of the parent items. */
    readonly offset: number,
    readonly width: number,
    readonly checked: boolean | null,
  ) {
    super();
  }
  eq(other: ListPrefix) {
    return other.marker === this.marker && other.offset === this.offset && other.width === this.width && other.checked === this.checked;
  }
  toDOM() {
    const box = document.createElement("span");
    box.className = "md-list-prefix";
    box.style.width = `${this.width}em`;
    box.style.paddingLeft = `${this.offset}em`;
    if (this.checked === null) {
      const mark = document.createElement("span");
      mark.className = /\d/.test(this.marker) ? "md-list-number" : "md-bullet";
      mark.textContent = /\d/.test(this.marker) ? this.marker : "•";
      box.append(mark);
    } else {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = this.checked;
      input.className = "md-task";
      box.append(input);
    }
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

// How far a list goes in, in em: the room of its bullet, number or checkbox.
const BULLET_WIDTH = 1.5;
const numberWidth = (mark: string) => Math.max(BULLET_WIDTH, 0.55 * mark.length + 0.6);
// CodeMirror's own padding of a line, kept under the indent.
const LINE_PADDING = "6px";

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
  const quoted = new Set<number>();
  // The lines of lists, by where they start: the deepest item a line belongs to decides.
  const listLines = new Map<number, Decoration>();
  const prefixes = new Set<number>();

  /** The room an item's marker takes, in em: in a numbered list, the longest number's. */
  const itemWidth = (item: SyntaxNode): number => {
    if (item.parent?.name !== "OrderedList") return BULLET_WIDTH;
    let longest = "";
    for (let sibling = item.parent.firstChild; sibling; sibling = sibling.nextSibling) {
      const mark = sibling.firstChild;
      if (mark?.name === "ListMark" && mark.to - mark.from > longest.length) longest = state.doc.sliceString(mark.from, mark.to);
    }
    return numberWidth(longest);
  };

  /**
   * A list item hangs: its first line starts with the marker, and its text, on every
   * line, starts after it. Items inside other items go in as far as their parents' text.
   */
  const listItem = (item: SyntaxNode) => {
    const mark = item.firstChild;
    if (mark?.name !== "ListMark") return;
    let offset = 0;
    for (let parent = item.parent; parent; parent = parent.parent) if (parent.name === "ListItem") offset += itemWidth(parent);
    const width = itemWidth(item);
    const indent = +(offset + width).toFixed(2);
    const first = state.doc.lineAt(item.from);
    listLines.set(first.from, Decoration.line({ attributes: { style: `padding-left: calc(${LINE_PADDING} + ${indent}em); text-indent: -${indent}em` } }));
    const last = state.doc.lineAt(item.to).number;
    for (let n = first.number + 1; n <= last; n++) {
      listLines.set(state.doc.line(n).from, Decoration.line({ attributes: { style: `padding-left: calc(${LINE_PADDING} + ${indent}em)` } }));
    }
    if (prefixes.has(first.from)) return;
    prefixes.add(first.from);
    const task = mark.nextSibling?.name === "Task" ? mark.nextSibling.firstChild : null;
    let end = task?.name === "TaskMarker" ? task.to : mark.to;
    while (end < first.to && state.doc.sliceString(end, end + 1) === " ") end++;
    if (active.has(first.number)) {
      // As typed, in a box as wide as the marker's, so that the text stays where it was.
      found.push({ from: first.from, to: end, deco: Decoration.mark({ class: "md-list-prefix", attributes: { style: `min-width: ${indent}em` } }) });
    } else {
      const checked = task?.name === "TaskMarker" ? /x/i.test(state.doc.sliceString(task.from, task.to)) : null;
      const marker = state.doc.sliceString(mark.from, mark.to);
      found.push({ from: first.from, to: end, deco: Decoration.replace({ widget: new ListPrefix(marker, offset, indent, checked) }) });
    }
  };

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
        if (node.name === "Blockquote") {
          // Every line of the quote, not only its first; a nested quote adds nothing more.
          for (let n = state.doc.lineAt(node.from).number; n <= state.doc.lineAt(node.to).number; n++) {
            const line = state.doc.line(n);
            if (quoted.has(line.from)) continue;
            quoted.add(line.from);
            found.push({ from: line.from, to: line.from, deco: quoteLine });
          }
        }
        if (node.name === "ListItem") listItem(node.node);
        const mark = marks[node.name];
        if (mark && node.to > node.from) found.push({ from: node.from, to: node.to, deco: mark });
        if (HIDDEN.has(node.name) && !active.has(state.doc.lineAt(node.from).number)) {
          let end = node.to;
          // A heading's "# " and a quote's "> " go together with their space.
          if ((node.name === "HeaderMark" || node.name === "QuoteMark") && state.doc.sliceString(end, end + 1) === " ") end++;
          if (end > node.from) found.push({ from: node.from, to: end, deco: hide });
        }
      },
    });

    // Aligned paragraphs: their lines are aligned and their tags always hidden, even under
    // the cursor, since the alignment itself shows them; Backspace at the start removes it.
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos);
      const paragraph = paragraphAround(state.doc, line.from);
      const p = paragraph && state.doc.sliceString(paragraph.from, paragraph.from + 1) === "<" ? aligned(state.doc, paragraph) : null;
      if (p) {
        for (let n = line.number; n <= state.doc.lineAt(p.to).number; n++) {
          const l = state.doc.line(n);
          found.push({ from: l.from, to: l.from, deco: alignLines[p.align] });
        }
        if (p.from >= from) found.push({ from: p.from, to: p.contentFrom, deco: hide });
        found.push({ from: p.contentTo, to: p.to, deco: hide });
      }
      const end = paragraph ? paragraph.to : line.to;
      if (end + 1 > state.doc.length) break;
      pos = end + 1;
    }

    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos);
      if (line.text.includes("![")) found.push(...imageDecorations(line.text, line.from, active.has(line.number)));
      pos = line.to + 1;
    }

    const text = state.doc.sliceString(from, to);
    HIGHLIGHT.lastIndex = 0;
    for (let m; (m = HIGHLIGHT.exec(text)); ) {
      // After a "{" the search goes on from the next character, as a lookbehind would.
      if (text[m.index - 1] === "{") {
        HIGHLIGHT.lastIndex = m.index + 1;
        continue;
      }
      const start = from + m.index;
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
      // An embedded image draws itself.
      if (text[m.index! - 1] === "!" && isImagePath(m[1].split("#")[0].trim())) continue;
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

  for (const [from, deco] of listLines) found.push({ from, to: from, deco });

  found.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  let lastHiddenEnd = -1;
  for (const { from, to, deco } of found) {
    const isReplace = deco === hide || deco === wikiHidden || deco.spec.widget instanceof ListPrefix || (deco.spec.widget instanceof ImageWidget && to > from);
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
    // The checkbox stands for the start of the line, up to the item's text.
    const line = view.state.doc.lineAt(view.posAtDOM(target));
    const m = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/.exec(line.text);
    if (!m) return true;
    const at = line.from + m[1].length + 1;
    view.dispatch({ changes: { from: at, to: at + 1, insert: m[2] === " " ? "x" : " " }, userEvent: "input.task" });
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

export const livePreview = [plugin, taskClicks, alignedEditing, alignmentTheme, tablePreview, embedPreview, imageInput];
