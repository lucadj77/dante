
// A simple cover made from the novel's settings: the authors at the top, the title in
// the middle, abstract shapes in one or two colours behind them, or a picture of the
// writer's. Nothing is stored but the choices (in dante.yaml) and the picture, a file of
// the project, so the cover follows the title.

export const COVER_TEMPLATES = ["circles", "waves", "stripes", "blocks", "arcs", "frame", "sun", "mountains", "dots", "corners", "triangles", "band"] as const;
export type CoverTemplate = (typeof COVER_TEMPLATES)[number];

export interface Palette {
  background: string;
  /** The two colours of the shapes. */
  first: string;
  second: string;
  text: string;
}

export const COVER_PALETTES = {
  night: { background: "#1f2a44", first: "#e0b354", second: "#34446a", text: "#f6efdc" },
  terracotta: { background: "#c4623b", first: "#f1d4b0", second: "#8a3820", text: "#fff6ea" },
  sage: { background: "#dfe6d5", first: "#8fae88", second: "#4b6a52", text: "#1d2b22" },
  sea: { background: "#0f5d6e", first: "#7cc4c4", second: "#093c48", text: "#f0fbfb" },
  plum: { background: "#4a2545", first: "#d98aa6", second: "#2c1430", text: "#fbeef3" },
  sand: { background: "#efe3cc", first: "#d39b5c", second: "#a5523a", text: "#38281a" },
  charcoal: { background: "#232323", first: "#e4572e", second: "#4a4a4a", text: "#f5f5f5" },
  sky: { background: "#e6eff8", first: "#93b6db", second: "#2d5d8a", text: "#13283f" },
  forest: { background: "#1e3b2f", first: "#c9a227", second: "#2f5a45", text: "#f3efe1" },
  rose: { background: "#f3dde0", first: "#c97b84", second: "#7d3c4a", text: "#3d1f26" },
  mustard: { background: "#e8b84a", first: "#2f4858", second: "#c4472f", text: "#2a2118" },
  lavender: { background: "#e4def2", first: "#9b8ac4", second: "#4f3f80", text: "#231a3f" },
  mint: { background: "#d9efe6", first: "#5fb49c", second: "#1f6f5c", text: "#11332a" },
  ink: { background: "#f4f1ea", first: "#1d1d1d", second: "#b33a3a", text: "#1d1d1d" },
  burgundy: { background: "#5c1a2b", first: "#e8b4a0", second: "#3a0f1a", text: "#fbeae4" },
  olive: { background: "#5a5f2c", first: "#e2d6a8", second: "#3b3f1a", text: "#f7f3e0" },
  coral: { background: "#fbe3d6", first: "#f06c4f", second: "#2e6e83", text: "#2b2b2b" },
  midnight: { background: "#0d1b2a", first: "#7fb7be", second: "#415a77", text: "#e0e6ed" },
} as const satisfies Record<string, Palette>;
export type CoverPalette = keyof typeof COVER_PALETTES;

export interface CoverSettings {
  /** "" picks one from the title, for projects made before covers existed. */
  template: CoverTemplate | "";
  palette: CoverPalette | "";
  /** A picture of the project (its path) drawn instead of the background and the shapes; "" for none. */
  image?: string;
  /** Which texts the cover shows; all of them unless turned off. */
  show?: { title: boolean; subtitle: boolean; authors: boolean };
  /** Colour of the texts, as #rrggbb; "" takes the palette's. */
  textColor?: string;
  /** Colour of a line around the letters, as #rrggbb; "" for none. */
  outlineColor?: string;
}

/** A colour as #rrggbb, or "" when it is not one. */
export function hexColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : "";
}

/** Width and height of the cover, in pixels: 2:3, as most books. */
export const COVER_SIZE = [1200, 1800] as const;

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return h >>> 0;
}

/** A template and a palette chosen from the title, so different novels look different. */
export function coverFor(title: string): { template: CoverTemplate; palette: CoverPalette } {
  const h = hash(title.trim().toLowerCase() || "dante");
  const palettes = Object.keys(COVER_PALETTES) as CoverPalette[];
  return { template: COVER_TEMPLATES[h % COVER_TEMPLATES.length], palette: palettes[(h >>> 8) % palettes.length] };
}

/** The template and palette to draw, filling an unchosen one from the title. */
export function resolveCover(cover: CoverSettings, title: string): { template: CoverTemplate; palette: CoverPalette } {
  const auto = coverFor(title);
  return {
    template: cover.template && COVER_TEMPLATES.includes(cover.template) ? cover.template : auto.template,
    palette: cover.palette && cover.palette in COVER_PALETTES ? cover.palette : auto.palette,
  };
}

/**
 * Splits text into at most `max` lines of similar length, breaking only between words.
 * The longest line is as short as it can be.
 */
export function wrap(text: string, max: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const total = words.join(" ").length;
  for (let width = Math.ceil(total / max); ; width++) {
    const lines: string[] = [];
    for (const word of words) {
      const last = lines[lines.length - 1];
      if (last !== undefined && last.length + 1 + word.length <= width) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    if (lines.length <= max) return lines;
  }
}

/** The fewest lines, up to `max`, that keep each line within `chars` characters. */
function fit(text: string, chars: number, max: number): string[] {
  for (let n = 1; n < max; n++) {
    const lines = wrap(text, n);
    if (Math.max(...lines.map((l) => l.length)) <= chars) return lines;
  }
  return wrap(text, max);
}

// Text widths are guessed, since the cover is drawn without measuring fonts: on average a
// letter of these faces is about half as wide as the font size, capitals a little more.
const SERIF = "Georgia, 'Times New Roman', 'Libertinus Serif', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, 'Libertinus Sans', sans-serif";
const widthOf = (line: string, size: number, factor: number) => line.length * size * factor;

/** The shapes of a template, drawn on a 1200 × 1800 cover. */
function shapes(template: CoverTemplate, p: Palette): string {
  switch (template) {
    case "circles":
      return [
        `<circle cx="930" cy="1520" r="430" fill="${p.first}"/>`,
        `<circle cx="210" cy="1650" r="300" fill="${p.second}"/>`,
        `<circle cx="1060" cy="250" r="70" fill="${p.first}"/>`,
      ].join("");
    case "waves":
      return [
        `<path d="M0 1330 C 300 1230 500 1450 800 1350 S 1100 1250 1200 1300 V 1800 H 0 Z" fill="${p.second}"/>`,
        `<path d="M0 1480 C 250 1400 550 1600 850 1490 S 1120 1420 1200 1460 V 1800 H 0 Z" fill="${p.first}"/>`,
        `<path d="M0 1640 C 300 1580 600 1720 900 1640 S 1150 1600 1200 1620 V 1800 H 0 Z" fill="${p.second}"/>`,
      ].join("");
    case "stripes":
      return [
        `<polygon points="0,1440 1200,1120 1200,1260 0,1580" fill="${p.first}"/>`,
        `<polygon points="0,1640 1200,1320 1200,1800 0,1800" fill="${p.second}"/>`,
        `<polygon points="0,0 260,0 0,180" fill="${p.first}"/>`,
      ].join("");
    case "blocks":
      return [
        `<rect x="0" y="1340" width="720" height="460" fill="${p.second}"/>`,
        `<rect x="720" y="1220" width="480" height="580" fill="${p.first}"/>`,
        `<rect x="100" y="1240" width="180" height="180" fill="${p.first}"/>`,
      ].join("");
    case "arcs":
      return [300, 420, 540, 660]
        .map((r, i) => `<circle cx="600" cy="1820" r="${r}" fill="none" stroke="${i % 2 ? p.second : p.first}" stroke-width="56"/>`)
        .join("");
    case "frame":
      return [
        `<rect x="60" y="60" width="1080" height="1680" fill="none" stroke="${p.first}" stroke-width="20"/>`,
        `<rect x="60" y="1460" width="1080" height="280" fill="${p.second}"/>`,
      ].join("");
    case "sun":
      return [`<circle cx="600" cy="1520" r="270" fill="${p.first}"/>`, `<rect x="0" y="1520" width="1200" height="280" fill="${p.second}"/>`].join("");
    case "mountains":
      return [
        `<polygon points="0,1800 0,1450 320,1200 620,1480 900,1250 1200,1500 1200,1800" fill="${p.second}"/>`,
        `<polygon points="0,1800 0,1620 260,1420 560,1650 860,1460 1200,1670 1200,1800" fill="${p.first}"/>`,
      ].join("");
    case "dots": {
      const dots: string[] = [];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 10; col++) {
          dots.push(`<circle cx="${150 + col * 100}" cy="${1320 + row * 100}" r="${18 + row * 4}" fill="${(row + col) % 2 ? p.second : p.first}"/>`);
        }
      }
      return dots.join("");
    }
    case "corners":
      return [
        `<circle cx="0" cy="1800" r="520" fill="${p.first}"/>`,
        `<circle cx="1200" cy="1800" r="360" fill="${p.second}"/>`,
        `<circle cx="1200" cy="0" r="120" fill="${p.second}"/>`,
      ].join("");
    case "triangles":
      return [
        `<polygon points="-100,1800 350,1250 800,1800" fill="${p.first}"/>`,
        `<polygon points="450,1800 900,1340 1350,1800" fill="${p.second}"/>`,
      ].join("");
    case "band":
      return [`<rect x="0" y="1560" width="1200" height="120" fill="${p.first}"/>`, `<rect x="0" y="1680" width="1200" height="120" fill="${p.second}"/>`].join("");
  }
}

export interface CoverText {
  title: string;
  subtitle?: string;
  authors: string[];
}

export interface CoverPicture {
  /** The picture as a URL an SVG can hold: a data: URL. */
  url: string;
  /** Only the texts, on a transparent ground, to be laid over the picture drawn apart. */
  textOnly?: boolean;
}

/**
 * The cover as an SVG document. With `picture` (the cover's image, read from the project)
 * it fills the cover in place of the background and the shapes.
 */
export function coverSvg(text: CoverText, cover: CoverSettings, picture?: CoverPicture): string {
  const { template, palette } = resolveCover(cover, text.title);
  const p = COVER_PALETTES[palette];
  const [W, H] = COVER_SIZE;
  const usable = W - 200;
  const out: string[] = [];
  const show = { title: true, subtitle: true, authors: true, ...cover.show };
  const fill = hexColor(cover.textColor) || p.text;
  const outline = hexColor(cover.outlineColor);
  // The line goes behind the letters, so it widens them without thinning them.
  const stroke = (size: number) => (outline ? ` stroke="${outline}" stroke-width="${Math.max(3, Math.round(size * 0.07))}" stroke-linejoin="round" paint-order="stroke"` : "");

  // Authors at the top, in spaced capitals: one per line when there are up to three,
  // otherwise all together on up to three lines.
  const names = show.authors ? text.authors.map((a) => a.trim().toLocaleUpperCase()).filter(Boolean) : [];
  if (names.length) {
    const lines = names.length === 1 ? fit(names[0], 16, 2) : names.length <= 3 ? names : fit(names.join(" · "), 22, 3);
    const longest = Math.max(...lines.map((l) => l.length));
    // Letter spacing adds about a tenth of the size to each letter.
    const size = Math.round(Math.min(lines.length > 2 ? 64 : 84, usable / (longest * 0.74)));
    lines.forEach((line, i) => {
      out.push(
        `<text x="${W / 2}" y="${Math.round(190 + i * size * 1.25)}" font-family="${SANS}" font-size="${size}" letter-spacing="${Math.round(size * 0.1)}" text-anchor="middle" fill="${fill}"${stroke(size)}>${escapeXml(line)}</text>`,
      );
    });
  }

  // The title in the middle, as large as it fits: the line count giving the largest size wins.
  const title = show.title ? text.title.trim() : "";
  let best = { size: 0, lines: [] as string[] };
  for (let n = 1; title && n <= 5; n++) {
    const lines = wrap(title, n);
    const longest = Math.max(...lines.map((l) => widthOf(l, 1, 0.52)));
    const size = Math.min(190, usable / longest, 760 / (lines.length * 1.12));
    if (size > best.size + 0.5) best = { size, lines };
  }
  const size = Math.round(best.size);
  const lineHeight = size * 1.12;
  const subtitle = show.subtitle && text.subtitle?.trim() ? fit(text.subtitle.trim(), 30, 2) : [];
  const subSize = 64;
  const block = best.lines.length * lineHeight + (subtitle.length ? 40 + subtitle.length * subSize * 1.3 : 0);
  let y = 820 - block / 2 + size * 0.8;
  for (const line of best.lines) {
    out.push(`<text x="${W / 2}" y="${Math.round(y)}" font-family="${SERIF}" font-size="${size}" font-weight="bold" text-anchor="middle" fill="${fill}"${stroke(size)}>${escapeXml(line)}</text>`);
    y += lineHeight;
  }
  y += 40 - lineHeight + subSize * 1.3;
  for (const line of subtitle) {
    out.push(`<text x="${W / 2}" y="${Math.round(y)}" font-family="${SERIF}" font-size="${subSize}" font-style="italic" text-anchor="middle" fill="${fill}"${stroke(subSize)}>${escapeXml(line)}</text>`);
    y += subSize * 1.3;
  }

  const ground = picture?.textOnly
    ? ""
    : picture
      ? `<rect width="${W}" height="${H}" fill="${p.background}"/><image href="${escapeXml(picture.url)}" xlink:href="${escapeXml(picture.url)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect width="${W}" height="${H}" fill="${p.background}"/>${shapes(template, p)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${ground}${out.join("")}</svg>`;
}

/** The SVG as a URL an <img> can show. */
export function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
