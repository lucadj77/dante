import { Annotation, Transaction, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Project } from "$lib/core/project";
import { DocumentStore, type OpenDocument, type Peer } from "$lib/editor/documents";

/** Marks changes that came from another editor of the same file, or from the disk. */
const synced = Annotation.define<boolean>();

const stores = new WeakMap<Project, DocumentStore>();

/** The files of `project` open in editors, shared by every section and pane. */
export function documents(project: Project): DocumentStore {
  let store = stores.get(project);
  if (!store) {
    store = new DocumentStore({
      read: (path, raw) => (raw ? project.fs.readText(path) : project.readBody(path)),
      write: (path, raw, text) => (raw ? project.fs.writeText(path, text) : project.writeBody(path, text)),
      exists: (path) => project.fs.exists(path),
      snapshot: (path) => project.autoSnapshot(path),
    });
    stores.set(project, store);
  }
  return store;
}

/** Writes what is typed in every open editor, before files are moved or renamed. */
export function flushAll(project: Project): Promise<void> {
  return documents(project).flushAll();
}

/**
 * Ties an editor to its document: the extension goes into the editor, `attach` is called
 * once the editor exists and `detach` when it closes.
 */
export function sharing(doc: OpenDocument): { extension: Extension; attach(view: EditorView): void; detach(): void } {
  let peer: Peer | null = null;
  return {
    extension: EditorView.updateListener.of((update) => {
      if (!peer || !update.docChanged) return;
      if (update.transactions.some((tr) => tr.annotation(synced))) return;
      doc.edited(peer, update.changes, update.state.doc.toString());
    }),
    attach(view) {
      peer = {
        get text() {
          return view.state.doc.toString();
        },
        receive(changes) {
          view.dispatch({ changes, annotations: [synced.of(true), Transaction.addToHistory.of(false)] });
        },
        reset(text) {
          if (text === view.state.doc.toString()) return;
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, annotations: synced.of(true) });
        },
      };
      doc.join(peer);
    },
    detach() {
      if (peer) doc.leave(peer);
      peer = null;
    },
  };
}
