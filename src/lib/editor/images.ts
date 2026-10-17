import { EditorSelection, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { alignedAt, toggleAlign } from "./alignment";
import { linkHandler } from "./links";
import { embedFor, findImages, isImagePath, isImageUrl, pastedName, withWidth, type ImageEmbed } from "../core/images";

/** What the editor needs from the project to show and add images. */
export interface ImageHandler {
  /** An address the editor can show for an embed's target; null when there is no such file. */
  url(target: string, wiki: boolean): Promise<string | null>;
  /** Saves an image in the project and returns the target to embed it with, or null. */
  add(data: Uint8Array, name: string): Promise<string | null>;
  /** Downloads an image from the web into the project and returns the target to embed it with. */
  download(url: string): Promise<string>;
  labels: ImageLabels;
}

export interface ImageLabels {
  small: string;
  medium: string;
  large: string;
  original: string;
  left: string;
  center: string;
  right: string;
  missing: string;
  pasted: string;
  download: string;
  downloadFailed: string;
}

// The widths offered over an image, in pixels as Obsidian writes them; null is the image's own.
const SIZES: [keyof ImageLabels, number | null][] = [
  ["small", 200],
  ["medium", 400],
  ["large", 600],
  ["original", null],
];

const handlerOf = (state: EditorState) => state.facet(linkHandler)?.images ?? null;

/** The embed on the line of `pos` closest to it, read again from the current text. */
function embedNear(view: EditorView, pos: number): { embed: ImageEmbed; offset: number } | null {
  const line = view.state.doc.lineAt(pos);
  let best: ImageEmbed | null = null;
  for (const e of findImages(line.text)) {
    const d = Math.min(Math.abs(line.from + e.from - pos), Math.abs(line.from + e.to - pos));
    const bestD = best ? Math.min(Math.abs(line.from + best.from - pos), Math.abs(line.from + best.to - pos)) : Infinity;
    if (d < bestD) best = e;
  }
  return best ? { embed: best, offset: line.from } : null;
}

function setWidth(view: EditorView, dom: HTMLElement, width: number | null) {
  const found = embedNear(view, view.posAtDOM(dom));
  if (!found) return;
  const { embed, offset } = found;
  view.dispatch({ changes: { from: offset + embed.from, to: offset + embed.to, insert: withWidth(embed, width) }, userEvent: "input.image" });
}

function setAlign(view: EditorView, dom: HTMLElement, align: "left" | "center" | "right") {
  const found = embedNear(view, view.posAtDOM(dom));
  if (!found) return;
  const pos = found.offset + found.embed.from;
  const current = alignedAt(view.state.doc, pos)?.align ?? "left";
  if (current === align) return;
  // Alignment works on the paragraph where the cursor is: left is the one without a tag.
  view.dispatch({ selection: EditorSelection.cursor(pos) });
  view.dispatch(view.state.update(toggleAlign(view.state, align === "left" ? (current as "center" | "right") : align), { userEvent: "input.format" }));
}

/** Replaces a web image with a copy downloaded into the project, keeping its width. */
async function downloadEmbed(view: EditorView, dom: HTMLElement, button: HTMLButtonElement) {
  const handler = handlerOf(view.state);
  const found = embedNear(view, view.posAtDOM(dom));
  if (!handler || !found) return;
  const url = found.embed.target;
  button.textContent = "…";
  button.disabled = true;
  try {
    const target = await handler.download(url);
    // The text may have changed while downloading: find the embed again.
    const again = embedNear(view, view.posAtDOM(dom));
    if (!again || again.embed.target !== url) return;
    const { embed, offset } = again;
    const local: ImageEmbed = { ...embed, target, wiki: true };
    view.dispatch({ changes: { from: offset + embed.from, to: offset + embed.to, insert: withWidth(local, embed.width ?? null) }, userEvent: "input.image" });
  } catch (e) {
    button.textContent = "✕";
    button.title = `${handler.labels.downloadFailed}: ${e instanceof Error ? e.message : String(e)}`;
    button.disabled = false;
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly wiki: boolean,
    readonly width: number | undefined,
    readonly alt: string,
    /** Shown under its Markdown, on a line being edited. */
    readonly below = false,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return other.target === this.target && other.wiki === this.wiki && other.width === this.width && other.alt === this.alt && other.below === this.below;
  }
  toDOM(view: EditorView) {
    const handler = handlerOf(view.state);
    const wrap = document.createElement("span");
    wrap.className = this.below ? "md-image md-image-below" : "md-image";
    const img = document.createElement("img");
    img.alt = this.alt || this.target;
    if (this.width) img.style.width = `${this.width}px`;
    wrap.append(img);
    const name = this.target.split("/").pop()!.split("#")[0];
    const missing = () => {
      img.remove();
      const note = document.createElement("span");
      note.className = "md-image-missing";
      note.textContent = `${handler?.labels.missing ?? "?"}: ${name}`;
      wrap.prepend(note);
    };
    if (!handler) missing();
    else handler.url(this.target, this.wiki).then((url) => (url ? (img.src = url) : missing()), missing);

    if (handler) {
      const bar = document.createElement("span");
      bar.className = "md-image-bar";
      const button = (label: string, text: string, run: () => void, on = false) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.title = label;
        if (on) b.className = "on";
        b.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          run();
        });
        bar.append(b);
      };
      for (const [key, width] of SIZES) {
        button(handler.labels[key], key === "original" ? "1:1" : String(width), () => setWidth(view, wrap, width), (this.width ?? null) === width);
      }
      const gap = document.createElement("span");
      gap.className = "md-image-gap";
      bar.append(gap);
      button(handler.labels.left, "⇤", () => setAlign(view, wrap, "left"));
      button(handler.labels.center, "↔", () => setAlign(view, wrap, "center"));
      button(handler.labels.right, "⇥", () => setAlign(view, wrap, "right"));
      if (!this.wiki && /^https?:\/\//i.test(this.target)) {
        const gap2 = document.createElement("span");
        gap2.className = "md-image-gap";
        bar.append(gap2);
        button(handler.labels.download, "⤓", () => void downloadEmbed(view, wrap, bar.lastElementChild as HTMLButtonElement));
      }
      wrap.append(bar);
    }

    // A click on the image puts the cursor after it, where its Markdown shows.
    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest(".md-image-bar")) return;
      e.preventDefault();
      const found = embedNear(view, view.posAtDOM(wrap));
      if (!found) return;
      view.focus();
      view.dispatch({ selection: { anchor: found.offset + found.embed.to } });
    });
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

/**
 * Decorations for the images of a line: the image in place of its Markdown, or after it
 * on a line being edited, so a change of width shows at once.
 */
export function imageDecorations(text: string, offset: number, editing: boolean): { from: number; to: number; deco: Decoration }[] {
  const out: { from: number; to: number; deco: Decoration }[] = [];
  for (const e of findImages(text)) {
    const widget = new ImageWidget(e.target, e.wiki, e.width, e.alt, editing);
    if (editing) out.push({ from: offset + e.to, to: offset + e.to, deco: Decoration.widget({ widget, side: 1 }) });
    else out.push({ from: offset + e.from, to: offset + e.to, deco: Decoration.replace({ widget }) });
  }
  return out;
}

/** Puts embeds for the images at the cursor, each on a paragraph of its own. */
function insertEmbeds(view: EditorView, targets: string[], at?: number) {
  insertBlocks(view, targets.map(embedFor), at);
}

function insertBlocks(view: EditorView, blocks: string[], at?: number) {
  if (!blocks.length) return;
  const pos = at ?? view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from).trim() ? "\n\n" : "";
  const after = line.text.slice(pos - line.from).trim() ? "\n\n" : "";
  const insert = before + blocks.join("\n\n") + after;
  view.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length - after.length }, userEvent: "input.image", scrollIntoView: true });
}

async function addFiles(view: EditorView, files: File[], at?: number): Promise<boolean> {
  const handler = handlerOf(view.state);
  const images = files.filter((f) => f.type.startsWith("image/") || isImagePath(f.name));
  if (!handler || !images.length) return false;
  const targets: string[] = [];
  for (const file of images) {
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : `.${(file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg")}`;
    // A pasted image comes as "image.png": it gets a dated name, as in Obsidian.
    const name = !file.name || /^image\.\w+$/i.test(file.name) ? pastedName(ext, new Date(), handler.labels.pasted) : file.name;
    const target = await handler.add(new Uint8Array(await file.arrayBuffer()), name);
    if (target) targets.push(target);
  }
  insertEmbeds(view, targets, at);
  return true;
}

/** Opens the system's file chooser and adds the chosen images at the cursor. */
export function chooseImages(view: EditorView) {
  if (!handlerOf(view.state)) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.addEventListener("change", () => {
    const files = [...(input.files ?? [])];
    if (files.length) void addFiles(view, files);
  });
  input.click();
}

/** Downloads web images into the project and embeds them; an address that fails is embedded as it is. */
async function addUrls(view: EditorView, urls: string[], at?: number) {
  const handler = handlerOf(view.state);
  if (!handler) return;
  const targets: string[] = [];
  for (const url of urls) {
    try {
      targets.push(embedFor(await handler.download(url)));
    } catch {
      targets.push(`![](${url})`);
    }
  }
  insertBlocks(view, targets, at);
}

/** The web image addresses in pasted or dropped data, when that is all it holds. */
function imageUrls(data: DataTransfer | null): string[] {
  const text = (data?.getData("text/uri-list") || data?.getData("text/plain") || "").trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  return lines.length && lines.every(isImageUrl) ? lines : [];
}

/** Images pasted or dropped on the editor, as files or web addresses, are saved in the project and embedded. */
export const imageInput: Extension = EditorView.domEventHandlers({
  paste(event, view) {
    if (!handlerOf(view.state)) return false;
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.some((f) => f.type.startsWith("image/"))) {
      event.preventDefault();
      void addFiles(view, files);
      return true;
    }
    const urls = imageUrls(event.clipboardData);
    if (!urls.length) return false;
    event.preventDefault();
    void addUrls(view, urls);
    return true;
  },
  drop(event, view) {
    if (!handlerOf(view.state)) return false;
    const at = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? undefined;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.some((f) => f.type.startsWith("image/") || isImagePath(f.name))) {
      event.preventDefault();
      void addFiles(view, files, at);
      return true;
    }
    const urls = imageUrls(event.dataTransfer);
    if (!urls.length) return false;
    event.preventDefault();
    void addUrls(view, urls, at);
    return true;
  },
});
