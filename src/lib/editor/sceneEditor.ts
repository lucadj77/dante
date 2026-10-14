import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { focusMode, typewriterMode } from "./modes";
import { livePreview } from "./livePreview";
import { smartTypography } from "./smartTypography";
import type { TypographySettings } from "$lib/core/settings";

export interface SceneEditorOptions {
  parent: HTMLElement;
  text: string;
  /** Hides Markdown markers away from the cursor. Off for the raw Markdown view. */
  preview: boolean;
  placeholder?: string;
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
}

export interface SceneEditor {
  view: EditorView;
  setText(text: string): void;
  setModes(modes: { typewriter: boolean; focus: boolean }): void;
  focus(at: "start" | "end"): void;
  destroy(): void;
}

export function createSceneEditor(options: SceneEditorOptions): SceneEditor {
  const modes = new Compartment();
  const split = (handler?: (before: string, after: string) => void) => (view: EditorView) => {
    if (!handler) return false;
    const { from, to } = view.state.selection.main;
    handler(view.state.doc.sliceString(0, from), view.state.doc.sliceString(to));
    return true;
  };
  const leave = (direction: "up" | "down") => (view: EditorView) => {
    if (!options.onLeave) return false;
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
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString());
      if (update.focusChanged && update.view.hasFocus) options.onFocus?.();
    }),
    EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on", autocapitalize: "sentences" }),
    modes.of([]),
  ];
  if (options.preview) extensions.push(livePreview);
  if (options.typography?.whileTyping) extensions.push(smartTypography(options.typography));
  if (options.placeholder) extensions.push(placeholderExt(options.placeholder));

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
    setModes({ typewriter, focus }) {
      view.dispatch({ effects: modes.reconfigure([typewriter ? typewriterMode : [], focus ? focusMode : []]) });
    },
    focus(at) {
      view.focus();
      const pos = at === "start" ? 0 : view.state.doc.length;
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    },
    destroy() {
      view.destroy();
    },
  };
}
