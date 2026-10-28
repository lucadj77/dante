import { completionStatus } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { openSearchPanel, search, searchKeymap, SearchQuery, setSearchQuery } from "@codemirror/search";
import { formatting, type FormattingLabels } from "./formatting";
import { cursorLine, focusMode, typewriterMode } from "./modes";
import { livePreview } from "./livePreview";
import { textLayout } from "./layout";
import { tableLabels, type TableLabels } from "./tables";
import { wikilinks, type LinkHandler } from "./links";
import { smartTypography } from "./smartTypography";
import type { Place } from "$lib/core/style";
import { criticCommands, criticPreview, trackChanges, type CriticHandler } from "./critic";
import type { TypographySettings } from "$lib/core/settings";
import { blankLineAsk, type BlankLineAsk } from "./blankAsk";

export interface SceneEditorOptions {
  parent: HTMLElement;
  text: string;
  /** Hides Markdown markers away from the cursor. Off for the raw Markdown view. */
  preview: boolean;
  /** Shown while the text is empty: a word, or an element with a few lines of help. */
  placeholder?: string | HTMLElement;
  /** Conventions applied while typing; none when absent. */
  typography?: TypographySettings;
  onChange: (text: string) => void;
  /** Ctrl/Cmd+Enter: split the scene at the cursor. */
  onSplitScene?: (before: string, after: string) => void;
  /** Ctrl/Cmd+Shift+Enter: start a new chapter at the cursor. */
  onSplitChapter?: (before: string, after: string) => void;
  /** Arrow keys past the first or last line move to the neighbouring scene. */
  onLeave?: (direction: "up" | "down") => boolean;
  onFocus?: () => void;
  /** The selected text, or "" when nothing is selected, whenever the selection changes. */
  onSelection?: (text: string) => void;
  /** Names of the formatting buttons shown over a selection. */
  formatLabels: FormattingLabels;
  /** Names of the buttons over a table being edited; English when absent. */
  tableLabels?: TableLabels;
  /** Following and suggesting wikilinks; without it, links are plain text. */
  links?: LinkHandler;
  /** Starting comments and opening their threads. */
  critic?: CriticHandler;
  /** The words of the find panel (Cmd+F) in the interface language, by CodeMirror's English phrase. */
  phrases?: Record<string, string>;
  /** The language of the text, for the spelling checker and hyphenation; the page's when absent. */
  language?: string;
  /** Asks about an empty line more than the writer usually leaves; never asked when absent. */
  blankLines?: BlankLineAsk;
  /** More behaviour, such as sharing the text with other editors of the same file. */
  extensions?: Extension[];
}

/** A match to show: the find panel opens on `query` and the match at `from`–`to` is selected. */
export interface FindRequest {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  from?: number;
  to?: number;
  /** A passage found by counting words, as the statistics point at one; it is selected whole. */
  place?: Place;
  /** False leaves the find panel closed and only selects the match. */
  panel?: boolean;
}

/** The passage `place` points at in the text, or null when the words are no longer there. */
export function placeRange(state: EditorState, place: Place): { from: number; to: number } | null {
  const uses = (word: string, from = 0) => new SearchQuery({ search: word, caseSensitive: false, wholeWord: true, literal: true }).getCursor(state, from);
  // The search also takes "è" for "e": only the word as written counts, as in the statistics.
  const nth = (word: string, n: number, from = 0) => {
    const cursor = uses(word, from);
    for (let i = 0; ; ) {
      const next = cursor.next();
      if (next.done) return null;
      if (state.sliceDoc(next.value.from, next.value.to).toLowerCase() !== word.toLowerCase()) continue;
      if (i++ === n) return next.value;
    }
  };
  const start = nth(place.word, place.nth);
  if (!start) return null;
  const end = place.through ? nth(place.through, place.throughNth, start.to) : null;
  let to = end ? end.to : start.to;
  // A sentence ends with its stop and closing quotes, which are selected with it.
  if (place.sentence) while (to < state.doc.length && /[.!?…"'»”’)\]*_]/.test(state.doc.sliceString(to, to + 1))) to++;
  return { from: start.from, to };
}

export interface SceneEditor {
  view: EditorView;
  setText(text: string): void;
  setModes(modes: { typewriter: boolean; focus: boolean; line?: boolean }): void;
  /** Revision mode signed by `author`, or off with null. */
  setRevisions(author: string | null): void;
  /** Read-only while someone else is editing the same file. */
  setReadOnly(readOnly: boolean): void;
  /** The system's spelling checker underlines unknown words, or not. */
  setSpelling(on: boolean): void;
  focus(at: "start" | "end"): void;
  /** Splits at the cursor into a new scene or a new chapter, as the shortcuts do. */
  split(kind: "scene" | "chapter"): void;
  /** Opens the find panel on a query and selects a match, as when coming from the project search. */
  find(request: FindRequest): void;
  destroy(): void;
}

export function createSceneEditor(options: SceneEditorOptions): SceneEditor {
  const modes = new Compartment();
  const spelling = new Compartment();
  const revisions = new Compartment();
  const locked = new Compartment();
  const split = (handler?: (before: string, after: string) => void) => (view: EditorView) => {
    if (!handler) return false;
    const { from, to } = view.state.selection.main;
    handler(view.state.doc.sliceString(0, from), view.state.doc.sliceString(to));
    return true;
  };
  const leave = (direction: "up" | "down") => (view: EditorView) => {
    if (!options.onLeave) return false;
    // The arrows choose among the suggestions while they show.
    if (completionStatus(view.state) === "active") return false;
    const { head, empty } = view.state.selection.main;
    if (!empty) return false;
    const line = view.state.doc.lineAt(head).number;
    const atEdge = direction === "up" ? line === 1 : line === view.state.doc.lines;
    if (!atEdge) return false;
    // Only when the visual cursor is on the first or last wrapped row too.
    const moved = view.moveVertically(view.state.selection.main, direction === "down");
    if (moved.head !== head) return false;
    return options.onLeave(direction);
  };

  const extensions: Extension[] = [
    history(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    Prec.high(
      keymap.of([
        { key: "Mod-Enter", run: split(options.onSplitScene) },
        { key: "Mod-Shift-Enter", run: split(options.onSplitChapter) },
        { key: "ArrowUp", run: leave("up") },
        { key: "ArrowDown", run: leave("down") },
      ]),
    ),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    search({ top: true }),
    options.phrases ? EditorState.phrases.of(options.phrases) : [],
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString());
      if (update.focusChanged && update.view.hasFocus) options.onFocus?.();
      if (options.onSelection && (update.selectionSet || update.docChanged)) {
        const { state } = update;
        options.onSelection(state.selection.ranges.map((r) => state.sliceDoc(r.from, r.to)).join("\n"));
      }
    }),
    spelling.of(spellingAttributes(true)),
    options.language ? EditorView.contentAttributes.of({ lang: options.language }) : [],
    modes.of([]),
    revisions.of([]),
    locked.of([]),
    formatting(options.formatLabels),
    options.tableLabels ? tableLabels.of(options.tableLabels) : [],
    wikilinks(options.links),
    criticCommands(options.critic),
    ...(options.extensions ?? []),
  ];
  if (options.preview) extensions.push(livePreview, criticPreview, textLayout);
  if (options.typography?.whileTyping) extensions.push(smartTypography(options.typography));
  if (options.placeholder) extensions.push(emptyBodyHint(options.placeholder));
  if (options.blankLines && options.preview) extensions.push(blankLineAsk(options.blankLines));

  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({ doc: options.text, extensions }),
  });

  return {
    view,
    setText(text) {
      if (text === view.state.doc.toString()) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    setModes({ typewriter, focus, line = false }) {
      view.dispatch({ effects: modes.reconfigure([typewriter ? typewriterMode : [], focus ? focusMode : [], line ? cursorLine : []]) });
    },
    setRevisions(author) {
      view.dispatch({ effects: revisions.reconfigure(author ? trackChanges(author) : []) });
    },
    setReadOnly(readOnly) {
      view.dispatch({ effects: locked.reconfigure(readOnly ? EditorState.readOnly.of(true) : []) });
    },
    setSpelling(on) {
      view.dispatch({ effects: spelling.reconfigure(spellingAttributes(on)) });
    },
    focus(at) {
      view.focus();
      const pos = at === "start" ? 0 : view.state.doc.length;
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    },
    split(kind) {
      split(kind === "scene" ? options.onSplitScene : options.onSplitChapter)(view);
    },
    find(request) {
      const query = new SearchQuery({ search: request.query, caseSensitive: request.caseSensitive, wholeWord: request.wholeWord, literal: true });
      if (request.panel !== false) {
        openSearchPanel(view);
        view.dispatch({ effects: setSearchQuery.of(query) });
      }
      const { from, to } = request;
      const length = view.state.doc.length;
      // The match comes from the file: the text may have changed since, so it must still be there.
      const at =
        from !== undefined && to !== undefined && to <= length && view.state.doc.sliceString(from, to).toLowerCase() === request.query.toLowerCase()
          ? { from, to }
          : null;
      const range = at ?? (request.place ? placeRange(view.state, request.place) : null) ?? query.getCursor(view.state).next().value;
      if (range && "from" in range) {
        view.dispatch({ selection: { anchor: range.from, head: range.to }, effects: EditorView.scrollIntoView(range.from, { y: "center" }) });
        // The manuscript may still be scrolling to the scene: the match is brought back into view after it.
        setTimeout(() => view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.from, { y: "center" }) }), 600);
      }
      view.focus();
    },
    destroy() {
      view.destroy();
    },
  };
}

/** The engine's spelling checker and, on iPad and phones, its corrections as you type. */
function spellingAttributes(on: boolean) {
  return EditorView.contentAttributes.of(on ? { spellcheck: "true", autocorrect: "on", autocapitalize: "sentences" } : { spellcheck: "false", autocorrect: "off", autocapitalize: "sentences" });
}

/** Properties alone, with no text after them, as a scene made from a template starts. */
const ONLY_PROPERTIES = /^---\r?\n[\s\S]*?\r?\n---[ \t]*\s*$/;

class HintWidget extends WidgetType {
  constructor(private content: string | HTMLElement) {
    super();
  }
  eq(other: HintWidget) {
    return other.content === this.content;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-placeholder";
    span.setAttribute("aria-hidden", "true");
    span.append(typeof this.content === "string" ? this.content : this.content.cloneNode(true));
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

/**
 * What an empty scene says, shown while it has no text: even when it has properties, as a
 * scene made from the template of new scenes does.
 */
function emptyBodyHint(content: string | HTMLElement): Extension {
  const widget = Decoration.widget({ widget: new HintWidget(content), side: 1 });
  const build = (view: EditorView): DecorationSet => {
    const doc = view.state.doc;
    const text = doc.length < 2000 ? doc.toString() : "x";
    const empty = !text.trim() || ONLY_PROPERTIES.test(text);
    return empty ? Decoration.set([widget.range(doc.length)]) : Decoration.none;
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
}
