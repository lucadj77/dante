// The frontmatter as the Obsidian plugin «Librogame» reads it: line by line, not as YAML.
// A line that starts without a space or "#" and holds ":" opens a key; the indented
// "- item" lines after an empty value are its list. An inline list such as `["25"]` is one
// piece of text. Gamebook paragraphs are read (and later written) this way, so that the
// same files keep working in Obsidian with the plugin.

export type FmValue = { kind: "empty" } | { kind: "scalar"; text: string } | { kind: "list"; items: string[] };

export interface FmEntry {
  key: string;
  /** The entry's original lines, without the final newline, kept as they are until replaced. */
  raw: string;
  value: FmValue;
}

export interface Frontmatter {
  entries: FmEntry[];
}

export interface FmDocument {
  frontmatter: Frontmatter | null;
  body: string;
}

const OPENING = /^---\r?\n/;

export function readDocument(text: string): FmDocument {
  if (!OPENING.test(text)) return { frontmatter: null, body: text };
  const lines = text.split("\n");
  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, "") === "---") {
      closing = i;
      break;
    }
  }
  if (closing === -1) return { frontmatter: null, body: text };
  return { frontmatter: { entries: parseEntries(lines.slice(1, closing)) }, body: lines.slice(closing + 1).join("\n") };
}

function parseEntries(lines: string[]): FmEntry[] {
  const entries: FmEntry[] = [];
  let current: string[] | null = null;
  let key = "";
  const close = () => {
    if (current === null) return;
    entries.push({ key, raw: current.join("\n"), value: parseValue(current) });
    current = null;
  };
  for (const line of lines) {
    const m = /^([^\s#][^:]*):(.*)$/.exec(line.replace(/\r$/, ""));
    if (m) {
      close();
      key = m[1];
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
  }
  close();
  return entries;
}

function parseValue(lines: string[]): FmValue {
  const first = lines[0].replace(/\r$/, "");
  const after = first.slice(first.indexOf(":") + 1).trim();
  if (after !== "") return { kind: "scalar", text: after };
  const items: string[] = [];
  for (const line of lines.slice(1)) {
    const m = /^\s*-\s*(.*)$/.exec(line.replace(/\r$/, ""));
    if (m) items.push(m[1].trim());
  }
  return items.length > 0 ? { kind: "list", items } : { kind: "empty" };
}

function render(key: string, value: FmValue): string {
  switch (value.kind) {
    case "empty":
      return `${key}:`;
    case "scalar":
      return `${key}: ${value.text}`;
    case "list":
      return value.items.length === 0 ? `${key}:` : [`${key}:`, ...value.items.map((v) => `  - ${v}`)].join("\n");
  }
}

export function writeDocument(doc: FmDocument): string {
  if (doc.frontmatter === null) return doc.body;
  return `---\n${doc.frontmatter.entries.map((e) => e.raw).join("\n")}\n---\n${doc.body}`;
}

function find(fm: Frontmatter | null, key: string): FmEntry | undefined {
  return fm?.entries.find((e) => e.key === key);
}

export function readScalar(fm: Frontmatter | null, key: string): string | null {
  const e = find(fm, key);
  return e && e.value.kind === "scalar" ? e.value.text : null;
}

export function readList(fm: Frontmatter | null, key: string): string[] {
  const e = find(fm, key);
  if (!e) return [];
  if (e.value.kind === "list") return [...e.value.items];
  if (e.value.kind === "scalar") return [e.value.text];
  return [];
}

/** Sets a key, keeping the other entries byte for byte and in their order. */
export function setEntry(fm: Frontmatter | null, key: string, value: FmValue): Frontmatter {
  const entry: FmEntry = { key, raw: render(key, value), value };
  if (fm === null) return { entries: [entry] };
  const i = fm.entries.findIndex((e) => e.key === key);
  const entries = [...fm.entries];
  if (i === -1) entries.push(entry);
  else entries[i] = entry;
  return { entries };
}

export function removeEntry(fm: Frontmatter, key: string): Frontmatter {
  return { entries: fm.entries.filter((e) => e.key !== key) };
}

export function unquote(text: string): string {
  return text.trim().replace(/^["']|["']$/g, "");
}
