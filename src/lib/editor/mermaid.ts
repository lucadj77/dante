// Mermaid diagrams (```mermaid blocks) drawn in place, away from the cursor, with a button
// that shows the drawing on the whole screen, where it can be moved and zoomed. A click on a
// box labelled "12 · Title", as in a gamebook's graph, opens that paragraph.
import { syntaxTree } from "@codemirror/language";
import { EditorState, StateField, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { linkHandler } from "./links";
import { focused } from "./tables";
import { titleFromLabel } from "../core/gamebook/graph";
import { t } from "$lib/state.svelte";

type Mermaid = typeof import("mermaid").default;
let loading: Promise<Mermaid> | null = null;
let current = "";

/** Mermaid is large: it is loaded the first time a diagram is drawn. */
function mermaid(): Promise<Mermaid> {
  const dark = typeof matchMedia !== "undefined" && (document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches));
  const wanted = dark ? "dark" : "default";
  loading ??= import("mermaid").then((m) => m.default);
  return loading.then((m) => {
    if (current !== wanted) {
      current = wanted;
      m.initialize({ startOnLoad: false, theme: wanted, securityLevel: "strict", flowchart: { useMaxWidth: false }, maxTextSize: 500_000, maxEdges: 20_000 });
    }
    return m;
  });
}

/** Drawings already made, by source, so that a diagram does not flicker when the text around it changes. */
const drawn = new Map<string, Promise<string>>();
let counter = 0;

function draw(source: string): Promise<string> {
  let svg = drawn.get(source);
  if (!svg) {
    svg = mermaid().then(async (m) => (await m.render(`dante-mermaid-${++counter}`, source)).svg);
    drawn.set(source, svg);
    if (drawn.size > 20) drawn.delete(drawn.keys().next().value!);
    svg.catch(() => drawn.delete(source));
  }
  return svg;
}

/** Opens the paragraph or note a box's label names, if any. */
function follow(view: EditorView, target: EventTarget | null): boolean {
  const node = (target as Element | null)?.closest?.(".node");
  const links = view.state.facet(linkHandler);
  const title = node ? titleFromLabel(node.textContent ?? "") : null;
  if (!title || !links) return false;
  links.open(title, false);
  return true;
}

class MermaidWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
  ) {
    super();
  }
  eq(other: MermaidWidget) {
    return other.source === this.source;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "md-mermaid";
    const bar = document.createElement("div");
    bar.className = "md-mermaid-bar";
    const full = document.createElement("button");
    full.type = "button";
    full.textContent = `⛶ ${t("mermaid.fullscreen")}`;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = t("mermaid.edit");
    bar.append(full, edit);
    const box = document.createElement("div");
    box.className = "md-mermaid-box";
    box.textContent = t("mermaid.drawing");
    wrap.append(bar, box);
    draw(this.source).then(
      (svg) => {
        box.innerHTML = svg;
        view.requestMeasure();
      },
      (e) => {
        box.className = "md-mermaid-box md-mermaid-error";
        box.textContent = `${t("mermaid.error")} ${e instanceof Error ? e.message : String(e)}`;
        view.requestMeasure();
      },
    );
    full.addEventListener("mousedown", (e) => e.preventDefault());
    full.addEventListener("click", () => {
      const svg = box.querySelector("svg");
      if (svg) fullscreen(view, svg);
    });
    edit.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.focus();
      view.dispatch({ selection: { anchor: Math.min(this.from + 4, view.state.doc.length) }, scrollIntoView: true });
    });
    box.addEventListener("click", (e) => {
      if (follow(view, e.target)) e.preventDefault();
    });
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

/** The drawing on the whole window: the wheel zooms, dragging moves it, Esc closes. */
function fullscreen(view: EditorView, source: SVGSVGElement) {
  const overlay = document.createElement("div");
  overlay.className = "md-mermaid-full";
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.removeAttribute("style");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  const stage = document.createElement("div");
  stage.className = "md-mermaid-stage";
  stage.append(svg);
  const bar = document.createElement("div");
  bar.className = "md-mermaid-bar";
  const button = (text: string, run: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", run);
    bar.append(b);
  };
  overlay.append(bar, stage);
  document.body.append(overlay);

  const box = svg.viewBox.baseVal;
  const natural = { w: box?.width || source.getBoundingClientRect().width, h: box?.height || source.getBoundingClientRect().height };
  let scale = 1;
  let x = 0;
  let y = 0;
  const apply = () => {
    svg.style.width = `${natural.w * scale}px`;
    svg.style.height = `${natural.h * scale}px`;
    svg.style.transform = `translate(${x}px, ${y}px)`;
  };
  const fit = () => {
    const r = stage.getBoundingClientRect();
    scale = Math.min(r.width / natural.w, r.height / natural.h) * 0.95;
    x = (r.width - natural.w * scale) / 2;
    y = (r.height - natural.h * scale) / 2;
    apply();
  };
  const zoom = (factor: number, cx: number, cy: number) => {
    const next = Math.min(8, Math.max(0.05, scale * factor));
    x = cx - ((cx - x) * next) / scale;
    y = cy - ((cy - y) * next) / scale;
    scale = next;
    apply();
  };
  const center = () => {
    const r = stage.getBoundingClientRect();
    return [r.width / 2, r.height / 2] as const;
  };
  button("−", () => zoom(1 / 1.25, ...center()));
  button("+", () => zoom(1.25, ...center()));
  button(t("mermaid.fit"), fit);
  button("1:1", () => {
    const [cx, cy] = center();
    zoom(1 / scale, cx, cy);
  });
  const hint = document.createElement("span");
  hint.className = "md-mermaid-hint";
  hint.textContent = t("mermaid.hint");
  bar.append(hint);
  button(`✕ ${t("mermaid.close")}`, close);

  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY / 300), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );
  let drag: { x: number; y: number; moved: boolean } | null = null;
  stage.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: false };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    x += dx;
    y += dy;
    drag.x = e.clientX;
    drag.y = e.clientY;
    apply();
  });
  stage.addEventListener("pointerup", (e) => {
    const wasClick = drag && !drag.moved;
    drag = null;
    if (wasClick) {
      // Pointer capture sends the click to the stage: the box under the pointer is looked up.
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (follow(view, under)) close();
    }
  });
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  document.addEventListener("keydown", onKey, true);
  requestAnimationFrame(fit);
}

function build(state: EditorState): DecorationSet {
  const hasFocus = state.field(focused);
  const ranges: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "FencedCode") return;
      const info = node.node.getChild("CodeInfo");
      if (!info || state.doc.sliceString(info.from, info.to).trim().toLowerCase() !== "mermaid") return false;
      const first = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(node.to);
      if (hasFocus && state.selection.ranges.some((r) => r.to >= first.from && r.from <= last.to)) return false;
      const code = node.node.getChild("CodeText");
      const source = code ? state.doc.sliceString(code.from, code.to) : "";
      if (!source.trim()) return false;
      ranges.push(Decoration.replace({ widget: new MermaidWidget(source, first.from), block: true }).range(first.from, last.to));
      return false;
    },
  });
  return Decoration.set(ranges, true);
}

const diagrams = StateField.define<DecorationSet>({
  create: build,
  update(value, tr) {
    if (tr.docChanged || tr.selection || tr.effects.length || syntaxTree(tr.state) !== syntaxTree(tr.startState)) return build(tr.state);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const styles = EditorView.baseTheme({
  ".md-mermaid": { margin: "6px 0", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", fontFamily: "var(--ui-font, system-ui)" },
  ".md-mermaid-bar": { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", padding: "4px 8px", fontSize: "12px", background: "var(--bg-panel)", borderBottom: "1px solid var(--border)" },
  ".md-mermaid-bar button": { border: "1px solid var(--border)", background: "var(--bg)", color: "inherit", borderRadius: "4px", padding: "1px 8px", font: "inherit", cursor: "pointer" },
  ".md-mermaid-box": { maxHeight: "420px", overflow: "auto", padding: "8px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" },
  ".md-mermaid-box svg": { maxWidth: "100%", height: "auto" },
  ".md-mermaid-box .node, .md-mermaid-full .node": { cursor: "pointer" },
  ".md-mermaid-error": { color: "var(--danger)", textAlign: "left", whiteSpace: "pre-wrap" },
});

/** Styles of the full-screen view, which lives outside the editor. */
function globalStyle() {
  if (typeof document === "undefined" || document.getElementById("dante-mermaid-style")) return;
  const style = document.createElement("style");
  style.id = "dante-mermaid-style";
  style.textContent = `
.md-mermaid-full { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; background: var(--bg); }
.md-mermaid-full .md-mermaid-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 10px; font: 12px var(--ui-font, system-ui); background: var(--bg-panel); border-bottom: 1px solid var(--border); color: var(--text); }
.md-mermaid-full .md-mermaid-bar button { border: 1px solid var(--border); background: var(--bg); color: inherit; border-radius: 4px; padding: 2px 10px; font: inherit; cursor: pointer; }
.md-mermaid-full .md-mermaid-bar button:last-child { margin-left: auto; }
.md-mermaid-hint { color: var(--text-muted); }
.md-mermaid-stage { flex: 1; position: relative; overflow: hidden; cursor: grab; touch-action: none; }
.md-mermaid-stage:active { cursor: grabbing; }
.md-mermaid-stage svg { position: absolute; left: 0; top: 0; transform-origin: 0 0; max-width: none; }
`;
  document.head.append(style);
}

export function mermaidPreview(): Extension {
  globalStyle();
  return [focused, diagrams, styles];
}
