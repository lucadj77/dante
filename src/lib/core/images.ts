import { basename, dirname, extname, join } from "./path";

// Images in the text, written as Obsidian writes them:
//
//   ![[foto.jpg]]           ![[foto.jpg|300]]        ![[foto.jpg|300x200]]
//   ![didascalia](Allegati/foto.jpg)                 ![didascalia|300](Allegati/foto.jpg)
//
// The number is the width in pixels (and the height, after an "x"). An image alone in a
// paragraph aligns with the paragraph's alignment tag, as text does.

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
};

export function isImagePath(path: string): boolean {
  return extname(path).toLowerCase() in MIME;
}

export function imageMime(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
}

export interface ImageEmbed {
  from: number;
  to: number;
  /** What the embed points to: a wikilink target, or a path or URL for ![](…). */
  target: string;
  wiki: boolean;
  alt: string;
  width?: number;
  height?: number;
}

// ![[target|…]] and ![alt|size](url), with the url in <…> or not.
const EMBED = /!\[\[([^\[\]|\n]+)((?:\|[^\[\]|\n]*)*)\]\]|!\[([^\[\]\n]*)\]\((<[^>\n]+>|[^()\s]+)(?:\s+"[^"\n]*")?\)/g;
const SIZE = /^\s*(\d+)\s*(?:x\s*(\d+)\s*)?$/;

/** The images the text embeds, in order. Embedded notes are left out. */
export function findImages(text: string): ImageEmbed[] {
  const out: ImageEmbed[] = [];
  for (const m of text.matchAll(EMBED)) {
    const from = m.index!;
    const to = from + m[0].length;
    if (m[1] !== undefined) {
      const target = m[1].trim();
      if (!isImagePath(target.split("#")[0])) continue;
      const parts = m[2] ? m[2].slice(1).split("|") : [];
      const embed: ImageEmbed = { from, to, target, wiki: true, alt: "" };
      // The last part is the size when it is a number; the others are the description.
      const size = parts.length ? SIZE.exec(parts[parts.length - 1]) : null;
      if (size) {
        parts.pop();
        embed.width = Number(size[1]);
        if (size[2]) embed.height = Number(size[2]);
      }
      embed.alt = parts.join("|").trim();
      out.push(embed);
    } else {
      let url = m[4];
      if (url.startsWith("<")) url = url.slice(1, -1);
      let target = url;
      try {
        target = decodeURI(url);
      } catch {
        // A malformed escape stays as written.
      }
      if (!isImagePath(target.split(/[?#]/)[0]) && !/^https?:/i.test(target)) continue;
      const parts = m[3].split("|");
      const embed: ImageEmbed = { from, to, target, wiki: false, alt: "" };
      const size = parts.length > 1 ? SIZE.exec(parts[parts.length - 1]) : null;
      if (size) {
        parts.pop();
        embed.width = Number(size[1]);
        if (size[2]) embed.height = Number(size[2]);
      }
      embed.alt = parts.join("|").trim();
      out.push(embed);
    }
  }
  return out;
}

/** The embed written again with another width (none for the image's own size). */
export function withWidth(embed: ImageEmbed, width: number | null): string {
  const size = width ? String(Math.round(width)) : "";
  if (embed.wiki) {
    const parts = [embed.target];
    if (embed.alt) parts.push(embed.alt);
    if (size) parts.push(size);
    return `![[${parts.join("|")}]]`;
  }
  const alt = [embed.alt, size].filter(Boolean).join("|");
  const url = /[\s()<>]/.test(embed.target) ? `<${embed.target}>` : embed.target;
  return `![${alt}](${url})`;
}

/** The embed Dante writes for a file in the project. */
export function embedFor(target: string): string {
  return `![[${target}]]`;
}

/**
 * The project file a ![](…) embed points to: relative to the note, or to the project
 * when that finds nothing, as in Obsidian. Wikilink embeds resolve as links do.
 */
export function resolveImagePath(target: string, fromPath: string, files: string[]): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const clean = target.replace(/^\.\//, "");
  const candidates = [join(dirname(fromPath), clean), clean.replace(/^\/+/, "")];
  // "../" climbs out of the note's folder.
  const normalized = candidates.map((p) => {
    const out: string[] = [];
    for (const part of p.split("/")) {
      if (part === "..") out.pop();
      else if (part !== "." && part !== "") out.push(part);
    }
    return out.join("/");
  });
  const lower = new Map(files.map((f) => [f.toLowerCase(), f]));
  for (const p of normalized) {
    const found = lower.get(p.toLowerCase());
    if (found) return found;
  }
  return null;
}

/** The image format of downloaded bytes, from their first bytes; null when not an image. */
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  const starts = (...b: number[]) => b.every((x, i) => bytes[i] === x);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return { mime: "image/png", ext: ".png" };
  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: ".jpg" };
  if (starts(0x47, 0x49, 0x46, 0x38)) return { mime: "image/gif", ext: ".gif" };
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", ext: ".webp" };
  if (starts(0x42, 0x4d)) return { mime: "image/bmp", ext: ".bmp" };
  const head = new TextDecoder().decode(bytes.slice(0, 1024)).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg\b/i.test(head)) return { mime: "image/svg+xml", ext: ".svg" };
  return null;
}

/** A file name for an image downloaded from `url`, with the extension of its real format. */
export function nameFromUrl(url: string, ext: string): string {
  let name = "";
  try {
    name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    name = "";
  }
  const stem = safeFileName(name).replace(/\.[^.]*$/, "").slice(0, 80) || "image";
  return stem + ext;
}

/** True for a web address that ends like an image file. */
export function isImageUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return false;
  try {
    return isImagePath(new URL(t).pathname);
  } catch {
    return false;
  }
}

/** Width and height in pixels, read from the file's header; null when unknown. */
export function imageSize(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = (i: number) => (i < bytes.length ? bytes[i] : 0);
  try {
    if (mime === "image/png" && bytes.length >= 24) return { width: view.getUint32(16), height: view.getUint32(20) };
    if (mime === "image/gif" && bytes.length >= 10) return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    if (mime === "image/bmp" && bytes.length >= 26) return { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (at(i) !== 0xff) {
          i++;
          continue;
        }
        const marker = at(i + 1);
        const length = view.getUint16(i + 2);
        // Start-of-frame markers carry the size; C4, C8 and CC are not frames.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
        }
        i += 2 + length;
      }
      return null;
    }
    if (mime === "image/webp" && bytes.length >= 30) {
      const chunk = String.fromCharCode(at(12), at(13), at(14), at(15));
      if (chunk === "VP8X") return { width: 1 + (at(24) | (at(25) << 8) | (at(26) << 16)), height: 1 + (at(27) | (at(28) << 8) | (at(29) << 16)) };
      if (chunk === "VP8L") {
        const b = view.getUint32(21, true);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      return null;
    }
    if (mime === "image/svg+xml") {
      const head = new TextDecoder().decode(bytes.slice(0, 4096));
      const tag = /<svg\b[^>]*>/i.exec(head)?.[0] ?? "";
      const num = (name: string) => {
        const m = new RegExp(`\\b${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, "i").exec(tag);
        return m ? Number(m[1]) : null;
      };
      const w = num("width");
      const h = num("height");
      if (w && h) return { width: w, height: h };
      const box = /\bviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
      if (box) return { width: Number(box[1]), height: Number(box[2]) };
    }
  } catch {
    // A truncated file has no size we can trust.
  }
  return null;
}

const ATTACHMENTS: Record<string, string> = { en: "Attachments", it: "Allegati", es: "Adjuntos", fr: "Pièces jointes" };

/** The name of the folder, inside Research, for images added from Dante, in the novel's language. */
export function attachmentsFolderName(language: string): string {
  return ATTACHMENTS[language.slice(0, 2)] ?? ATTACHMENTS.en;
}

/** A file name for an image that has none of its own, such as one pasted. */
export function pastedName(ext: string, now = new Date(), label = "Pasted image"): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${label} ${stamp}${ext}`;
}

/** A name safe on every system, keeping the extension. */
export function safeFileName(name: string): string {
  const clean = basename(name).replace(/[\\/:*?"<>|#^\[\]]/g, "-").trim();
  return clean || "image.png";
}
