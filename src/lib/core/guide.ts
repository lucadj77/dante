// The guide shown inside Dante: the Markdown of docs/*.md made into HTML. It reads only what
// those pages use (headings, paragraphs, lists, tables, code blocks, quotes, images, links,
// bold, italics and code), escaping everything else, so a page can never run a script.

export interface GuideHeading {
  id: string;
  level: number;
  text: string;
}

export interface GuidePage {
  html: string;
  headings: GuideHeading[];
}

export interface GuideOptions {
  /** The address of an image of the docs folder, such as "img/cerca.png"; null leaves it out. */
  image?: (src: string) => string | null;
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The anchor GitHub gives a heading: "1. Cos'è Dante" is "1-cosè-dante". */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

const BULLET = /^([-*+])\s+/;
const ORDERED = /^(\d+)[.)]\s+/;
const FENCE = /^(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RAW_IMG = /^<img\s[^>]*>\s*$/i;
const RULE = /^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/;

const indentOf = (line: string) => line.length - line.trimStart().length;
const isBlank = (line: string) => line.trim() === "";
const isTableRule = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Cells of a table row, split at the bars that are not written as \|. */
function cells(row: string): string[] {
  let text = row.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  const out: string[] = [];
  let cell = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && text[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (text[i] === "|") {
      out.push(cell.trim());
      cell = "";
    } else cell += text[i];
  }
  out.push(cell.trim());
  return out;
}

class Renderer {
  headings: GuideHeading[] = [];
  private seen = new Map<string, number>();
  constructor(private options: GuideOptions) {}

  private image(src: string, alt: string, width?: string): string {
    const url = /^https?:\/\//i.test(src) ? src : (this.options.image?.(src) ?? null);
    if (!url) return "";
    const size = width && /^\d+$/.test(width) ? ` width="${width}"` : "";
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${size} loading="lazy">`;
  }

  /** Bold, italics, code, links and images in a line of text. */
  inline(text: string): string {
    const codes: string[] = [];
    // Code first, so nothing inside it is read as anything else.
    let s = text.replace(/`([^`]+)`/g, (_, code: string) => {
      codes.push(`<code>${escapeHtml(code)}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    });
    // Backslash escapes keep the character as it is.
    const kept: string[] = [];
    s = s.replace(/\\([\\`*_[\]()#+\-.!|<>{}])/g, (_, ch: string) => {
      kept.push(escapeHtml(ch));
      return `\u0001${kept.length - 1}\u0001`;
    });
    const parts: string[] = [];
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, src: string) => {
      parts.push(this.image(src, alt));
      return `\u0002${parts.length - 1}\u0002`;
    });
    s = escapeHtml(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
      // Only pages, anchors and web addresses: nothing that could run.
      /^(https?:|mailto:|#|[\w./-]+(#[^"]*)?$)/i.test(href) ? `<a href="${href}">${label}</a>` : label,
    );
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^\p{L}\p{N}*])\*([^*\s][^*]*?)\*(?=[^\p{L}\p{N}*]|$)/gu, "$1<em>$2</em>");
    s = s.replace(/(^|[^\p{L}\p{N}_])_([^_\s][^_]*?)_(?=[^\p{L}\p{N}_]|$)/gu, "$1<em>$2</em>");
    s = s.replace(/\u0002(\d+)\u0002/g, (_, i: string) => parts[+i]);
    s = s.replace(/\u0001(\d+)\u0001/g, (_, i: string) => kept[+i]);
    return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[+i]);
  }

  private rawImage(line: string): string {
    const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(line)?.[1] ?? "";
    return `<p>${this.image(attr("src"), attr("alt"), attr("width"))}</p>`;
  }

  private heading(level: number, raw: string): string {
    const text = raw.replace(/[*`]/g, "");
    let id = slug(text);
    const n = this.seen.get(id) ?? 0;
    this.seen.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    this.headings.push({ id, level, text });
    return `<h${level} id="${escapeHtml(id)}">${this.inline(raw)}</h${level}>`;
  }

  /** Starts a block of its own: a paragraph stops before it. */
  private starts(line: string): boolean {
    const t = line.trimStart();
    return HEADING.test(t) || FENCE.test(t) || BULLET.test(t) || ORDERED.test(t) || RAW_IMG.test(t) || t.startsWith(">") || t.startsWith("|");
  }

  blocks(lines: string[]): string {
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();
      if (!t) {
        i++;
        continue;
      }
      const fence = FENCE.exec(t);
      if (fence) {
        const code: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
        i++;
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        continue;
      }
      const heading = HEADING.exec(t);
      if (heading) {
        out.push(this.heading(heading[1].length, heading[2]));
        i++;
        continue;
      }
      if (RULE.test(t)) {
        out.push("<hr>");
        i++;
        continue;
      }
      if (RAW_IMG.test(t)) {
        out.push(this.rawImage(t));
        i++;
        continue;
      }
      if (t.startsWith("|") && i + 1 < lines.length && isTableRule(lines[i + 1])) {
        const head = cells(t);
        const aligns = cells(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
        const cell = (tag: string, text: string, col: number) => `<${tag}${aligns[col] ? ` style="text-align:${aligns[col]}"` : ""}>${this.inline(text)}</${tag}>`;
        out.push(
          `<table><thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead><tbody>${rows
            .map((r) => `<tr>${head.map((_, k) => cell("td", r[k] ?? "", k)).join("")}</tr>`)
            .join("")}</tbody></table>`,
        );
        continue;
      }
      if (t.startsWith(">")) {
        const quoted: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) quoted.push(lines[i++].trim().replace(/^>\s?/, ""));
        out.push(`<blockquote>${this.blocks(quoted)}</blockquote>`);
        continue;
      }
      if (BULLET.test(t) || ORDERED.test(t)) {
        const ordered = ORDERED.test(t);
        const base = indentOf(line);
        const items: string[] = [];
        let start = ordered ? Number(ORDERED.exec(t)![1]) : 1;
        while (i < lines.length) {
          const first = lines[i];
          const ft = first.trim();
          const marker = (ordered ? ORDERED : BULLET).exec(ft);
          if (!marker || indentOf(first) !== base) break;
          // What follows the marker lines up the item's other lines.
          const inner = base + marker[0].length;
          const body = [ft.slice(marker[0].length)];
          i++;
          while (i < lines.length) {
            const next = lines[i];
            if (isBlank(next)) {
              // A blank line ends the item unless the item goes on, indented, after it.
              let j = i;
              while (j < lines.length && isBlank(lines[j])) j++;
              if (j < lines.length && indentOf(lines[j]) >= inner) {
                body.push("");
                i++;
                continue;
              }
              break;
            }
            if (indentOf(next) >= inner) body.push(next.slice(Math.min(inner, indentOf(next))));
            else if (indentOf(next) > base && !this.starts(next)) body.push(next.trim());
            else break;
            i++;
          }
          let html = this.blocks(body);
          // A short item is its text, without a paragraph around it.
          const single = /^<p>([\s\S]*)<\/p>$/.exec(html);
          if (single && !single[1].includes("<p>")) html = single[1];
          else html = html.replace(/^<p>([\s\S]*?)<\/p>(?=<(ul|ol)>)/, "$1");
          items.push(`<li>${html}</li>`);
          // Blank lines between items of the same list.
          let j = i;
          while (j < lines.length && isBlank(lines[j])) j++;
          if (j < lines.length && indentOf(lines[j]) === base && (ordered ? ORDERED : BULLET).test(lines[j].trim())) i = j;
          else break;
        }
        out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ""}>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
        start = 1;
        continue;
      }
      const para: string[] = [];
      while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !this.starts(lines[i]))) para.push(lines[i++].trim());
      out.push(`<p>${this.inline(para.join(" "))}</p>`);
    }
    return out.join("");
  }
}

/** A page of the guide as HTML, with its headings for the table of contents. */
export function guideToHtml(markdown: string, options: GuideOptions = {}): GuidePage {
  const renderer = new Renderer(options);
  const html = renderer.blocks(markdown.replace(/\r\n?/g, "\n").split("\n"));
  return { html, headings: renderer.headings };
}
