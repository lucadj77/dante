import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { linkHandler } from "./links";
import { focused, setFocus } from "./tables";
import { embeddedPart, findNoteEmbeds } from "../core/embeds";
import { cleanSource, markdownToBlocks, type Run } from "../core/export/book";

// A note embedded with ![[Nota]] on a line of its own shows its text in a box, read only,
// as in Obsidian; on the line with the cursor the embed shows as typed.

function runsTo(parent: HTMLElement, runs: Run[]) {
  for (const r of runs) {
    if (r.lineBreak) {
      parent.append(document.createElement("br"));
      continue;
    }
    let node: Node = document.createTextNode(r.text);
    const wrap = (tag: string) => {
      const el = document.createElement(tag);
      el.append(node);
      node = el;
    };
    if (r.code) wrap("code");
    if (r.italic) wrap("em");
    if (r.bold) wrap("strong");
    if (r.strike) wrap("s");
    parent.append(node);
  }
}

/** The note's text drawn with the same blocks the export uses. */
function render(parent: HTMLElement, markdown: string) {
  for (const block of markdownToBlocks(cleanSource(markdown))) {
    let el: HTMLElement;
    if (block.type === "heading") {
      el = document.createElement("div");
      el.className = `md-embed-h md-embed-h${Math.min(block.level, 4)}`;
      runsTo(el, block.runs);
    } else if (block.type === "quote") {
      el = document.createElement("blockquote");
      runsTo(el, block.runs);
    } else if (block.type === "break") {
      el = document.createElement("hr");
    } else if (block.type === "table") {
      el = document.createElement("table");
      el.className = "md-table";
      const row = (cells: Run[][], tag: string) => {
        const tr = document.createElement("tr");
        cells.forEach((cell, i) => {
          const td = document.createElement(tag);
          if (block.align[i]) td.style.textAlign = block.align[i]!;
          runsTo(td, cell);
          tr.append(td);
        });
        return tr;
      };
      el.append(row(block.header, "th"), ...block.rows.map((r) => row(r, "td")));
    } else if (block.type === "image") {
      continue;
    } else if (block.type === "item") {
      el = document.createElement("p");
      el.className = "md-embed-item";
      el.style.marginLeft = `${(block.level + 1) * 1.5}em`;
      if (block.marker) {
        const marker = document.createElement("span");
        marker.className = "md-embed-marker";
        marker.textContent = block.marker;
        el.append(marker);
      } else el.style.textIndent = "0";
      runsTo(el, block.runs);
    } else {
      el = document.createElement("p");
      if (block.align) el.style.textAlign = block.align;
      runsTo(el, block.runs);
    }
    parent.append(el);
  }
}

class EmbedWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly section: string,
  ) {
    super();
  }
  eq(other: EmbedWidget) {
    return other.target === this.target && other.section === this.section;
  }
  toDOM(view: EditorView) {
    const links = view.state.facet(linkHandler);
    const box = document.createElement("div");
    box.className = "md-embed";
    const title = document.createElement("div");
    title.className = "md-embed-title";
    title.textContent = this.section ? `${this.target} › ${this.section.replace(/^\^/, "")}` : this.target;
    const body = document.createElement("div");
    body.className = "md-embed-body";
    box.append(title, body);
    const missing = () => {
      box.classList.add("md-embed-missing");
      body.textContent = "?";
    };
    if (!links?.note) missing();
    else {
      links
        .note(this.target)
        .then((text) => {
          const part = text === null ? null : embeddedPart(text, this.section);
          if (part === null) return missing();
          render(body, part);
          view.requestMeasure();
        })
        .catch(missing);
    }
    // The title opens the note; a click in the text shows the embed as typed, to change it.
    box.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if ((event.target as HTMLElement).closest(".md-embed-title") && links) {
        links.open(this.target, event.altKey);
        return;
      }
      const pos = view.posAtDOM(box);
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.lineAt(pos).to } });
    });
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

function build(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  if (!state.facet(linkHandler)?.note) return builder.finish();
  const hasFocus = state.field(focused);
  const doc = state.doc;
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (!line.text.includes("![[")) continue;
    const embeds = findNoteEmbeds(line.text);
    // Only an embed alone on its line becomes a box; one inside a sentence stays a link.
    if (embeds.length !== 1 || line.text.trim() !== line.text.slice(embeds[0].from, embeds[0].to)) continue;
    if (hasFocus && state.selection.ranges.some((r) => r.to >= line.from && r.from <= line.to)) continue;
    builder.add(line.from, line.to, Decoration.replace({ widget: new EmbedWidget(embeds[0].target, embeds[0].section), block: true }));
  }
  return builder.finish();
}

const embeds = StateField.define<DecorationSet>({
  create: build,
  update(value, tr) {
    if (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(setFocus))) return build(tr.state);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Embedded notes drawn with their text, away from the cursor. */
export const embedPreview: Extension = [focused, embeds];
