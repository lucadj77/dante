import { parseDocument } from "yaml";

export interface NoteParts {
  /** YAML text between the `---` fences, without them; null when the note has no frontmatter. */
  frontmatter: string | null;
  body: string;
}

const FENCE = /^---[ \t]*\r?\n/;

/** Splits a note into frontmatter and body without altering either. */
export function splitNote(text: string): NoteParts {
  if (!FENCE.test(text)) return { frontmatter: null, body: text };
  const start = text.indexOf("\n") + 1;
  const close = /^---[ \t]*(\r?\n|$)/m;
  const rest = text.slice(start);
  // An empty frontmatter has its closing fence right away.
  const match = close.exec(rest);
  if (!match) return { frontmatter: null, body: text };
  const frontmatter = rest.slice(0, match.index).replace(/\r?\n$/, "");
  const body = rest.slice(match.index + match[0].length);
  return { frontmatter, body };
}

export function joinNote(parts: NoteParts): string {
  if (parts.frontmatter === null) return parts.body;
  const yaml = parts.frontmatter === "" ? "" : parts.frontmatter.replace(/\n?$/, "\n");
  return `---\n${yaml}---\n${parts.body}`;
}

export type Properties = Record<string, unknown>;

export function readProperties(text: string): Properties {
  const { frontmatter } = splitNote(text);
  if (!frontmatter) return {};
  const doc = parseDocument(frontmatter);
  if (doc.errors.length > 0) return {};
  const value = doc.toJS();
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Properties) : {};
}

/**
 * Sets (or with `undefined`, removes) properties in the note's frontmatter. Key order,
 * comments and the formatting of untouched keys are kept. The body is never changed.
 */
export function writeProperties(text: string, changes: Properties): string {
  const parts = splitNote(text);
  const doc = parseDocument(parts.frontmatter ?? "");
  if (doc.errors.length > 0) throw new Error("The note's frontmatter is not valid YAML");
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) doc.delete(key);
    else doc.set(key, value);
  }
  const empty = doc.contents === null || (doc.toJS() && Object.keys(doc.toJS()).length === 0);
  if (empty) return parts.body;
  const yaml = doc.toString({ lineWidth: 0 }).replace(/\n$/, "");
  return joinNote({ frontmatter: yaml, body: parts.body });
}

/** Replaces the body, keeping the frontmatter exactly as it is. */
export function replaceBody(text: string, body: string): string {
  const parts = splitNote(text);
  return joinNote({ frontmatter: parts.frontmatter, body });
}
