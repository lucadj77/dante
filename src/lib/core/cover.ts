
// A simple cover made from the novel's settings: the authors at the top, the title in
// the middle, abstract shapes in one or two colours behind them. Nothing is stored but
// the chosen template and palette (in dante.yaml), so the cover follows the title.

export const COVER_TEMPLATES = ["circles", "waves", "stripes", "blocks", "arcs"] as const;
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
} as const satisfies Record<string, Palette>;
export type CoverPalette = keyof typeof COVER_PALETTES;

export interface CoverSettings {
  /** "" picks one from the title, for projects made before covers existed. */
  template: CoverTemplate | "";
  palette: CoverPalette | "";
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
        `<rect x="100" y="390" width="1000" height="6" fill="${p.first}"/>`,
      ].join("");
    case "arcs":
      return [300, 420, 540, 660]
        .map((r, i) => `<circle cx="600" cy="1820" r="${r}" fill="none" stroke="${i % 2 ? p.second : p.first}" stroke-width="56"/>`)
        .join("");
  }
}

export interface CoverText {
  title: string;
  subtitle?: string;
  author: string;
}

/** The cover as an SVG document. */
export function coverSvg(text: CoverText, cover: CoverSettings): string {
  const { template, palette } = resolveCover(cover, text.title);
  const p = COVER_PALETTES[palette];
  const [W, H] = COVER_SIZE;
  const usable = W - 200;
  const out: string[] = [];

  // Authors at the top, in spaced capitals, on up to two lines.
  const author = text.author.trim().toLocaleUpperCase();
  if (author) {
    const lines = fit(author, 16, 2);
    const longest = Math.max(...lines.map((l) => l.length));
    // Letter spacing adds about a tenth of the size to each letter.
    const size = Math.round(Math.min(84, usable / (longest * 0.74)));
    lines.forEach((line, i) => {
      out.push(
        `<text x="${W / 2}" y="${Math.round(210 + i * size * 1.25)}" font-family="${SANS}" font-size="${size}" letter-spacing="${Math.round(size * 0.1)}" text-anchor="middle" fill="${p.text}">${escapeXml(line)}</text>`,
      );
    });
  }

  // The title in the middle, as large as it fits: the line count giving the largest size wins.
  const title = text.title.trim();
  let best = { size: 0, lines: [] as string[] };
  for (let n = 1; title && n <= 5; n++) {
    const lines = wrap(title, n);
    const longest = Math.max(...lines.map((l) => widthOf(l, 1, 0.52)));
    const size = Math.min(190, usable / longest, 760 / (lines.length * 1.12));
    if (size > best.size + 0.5) best = { size, lines };
  }
  const size = Math.round(best.size);
  const lineHeight = size * 1.12;
  const subtitle = text.subtitle?.trim() ? fit(text.subtitle.trim(), 30, 2) : [];
  const subSize = 64;
  const block = best.lines.length * lineHeight + (subtitle.length ? 40 + subtitle.length * subSize * 1.3 : 0);
  let y = 820 - block / 2 + size * 0.8;
  for (const line of best.lines) {
    out.push(`<text x="${W / 2}" y="${Math.round(y)}" font-family="${SERIF}" font-size="${size}" font-weight="bold" text-anchor="middle" fill="${p.text}">${escapeXml(line)}</text>`);
    y += lineHeight;
  }
  y += 40 - lineHeight + subSize * 1.3;
  for (const line of subtitle) {
    out.push(`<text x="${W / 2}" y="${Math.round(y)}" font-family="${SERIF}" font-size="${subSize}" font-style="italic" text-anchor="middle" fill="${p.text}">${escapeXml(line)}</text>`);
    y += subSize * 1.3;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${p.background}"/>${shapes(template, p)}${out.join("")}</svg>`;
}

/** The SVG as a URL an <img> can show. */
export function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
