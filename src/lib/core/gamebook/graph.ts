// The gamebook as a Mermaid flowchart, written in a note: Dante draws it, and so do
// Obsidian and GitHub. Each paragraph is a box with its number and title; a reference in the
// text is an arrow, a hidden one a dotted arrow; endings, the start, empty paragraphs and
// the ones nobody reaches have their own colours.
import type { GamebookIndex, Paragraph } from "./paragraphs";

export const GRAPH_NOTE = "Grafo del libro game.md";

/** The flowchart of one folder of paragraphs, in Mermaid's language. */
export function mermaidGraph(index: GamebookIndex, scope: string, start: number): string {
  const paragraphs = [...index.inScope(scope)].sort((a, b) => a.number - b.number);
  const ids = new Map<string, string>();
  paragraphs.forEach((p, i) => ids.set(p.path, `p${p.number}${paragraphs.findIndex((q) => q.number === p.number) === i ? "" : `_${i}`}`));
  const unreachable = new Set(index.unreachable(scope, start).map((p) => p.path));
  const lines = ["flowchart TD"];
  for (const p of paragraphs) lines.push(`  ${ids.get(p.path)}["${label(p)}"]`);
  for (const p of paragraphs) {
    const seen = new Set<string>();
    for (const { reference, to } of index.outgoing(p)) {
      if (!to || !ids.has(to.path)) continue;
      const key = `${to.path}|${reference.hidden}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`  ${ids.get(p.path)} ${reference.hidden ? "-.->" : "-->"} ${ids.get(to.path)}`);
    }
  }
  const classes: Record<string, string[]> = { start: [], ending: [], empty: [], lost: [] };
  for (const p of paragraphs) {
    const id = ids.get(p.path)!;
    if (p.number === start) classes.start.push(id);
    else if (p.ending) classes.ending.push(id);
    else if (unreachable.has(p.path)) classes.lost.push(id);
    if (p.empty) classes.empty.push(id);
  }
  lines.push(
    "  classDef start fill:#dbeafe,stroke:#3b82c4,stroke-width:2px",
    "  classDef ending fill:#fde2e2,stroke:#d64545",
    "  classDef lost fill:#fdebd3,stroke:#d9822b,stroke-dasharray:4 3",
    "  classDef empty color:#868e96,stroke-dasharray:2 2",
  );
  for (const [name, list] of Object.entries(classes)) if (list.length) lines.push(`  class ${list.join(",")} ${name}`);
  return lines.join("\n");
}

function label(p: Paragraph): string {
  return `${p.number} · ${p.title}`.replace(/"/g, "#quot;");
}

/** The paragraph's title in a box's label, "12 · Il ponte", to open it from the drawing. */
export function titleFromLabel(text: string): string | null {
  const m = /^\s*\d+\s·\s(.+?)\s*$/.exec(text);
  return m ? m[1] : null;
}

/**
 * The note with the graph: the first Mermaid block of `existing` is replaced, so that what
 * the writer added around it stays; a new note gets a line on how to update it.
 */
export function graphNote(existing: string | null, chart: string, intro: string): string {
  const block = "```mermaid\n" + chart + "\n```";
  const fence = /```mermaid\n[\s\S]*?\n```/;
  if (existing && fence.test(existing)) return existing.replace(fence, () => block);
  return `${intro}\n\n${block}\n`;
}
