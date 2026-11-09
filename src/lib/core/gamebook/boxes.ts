// Boxes are Pandoc divs with the Word style "box", as the plugin writes them:
//
//   ::: {custom-style="box"}
//   🤔 **You must act fast!**
//
//   Take the dark lane? Read **[[Lane|15]]**.
//   :::
//
// The emoji that opens the content gives the box its type. Each gamebook defines its own
// types in dante.yaml; a new one starts from the plugin's six.

export interface BoxType {
  /** Stable name used in dante.yaml and in CSS, such as "choice". */
  id: string;
  /** The emoji that opens a box of this type. */
  emoji: string;
  /** Shown in menus, such as "Choice". */
  name: string;
  /** Colour of the band beside the box, as #rrggbb. */
  color: string;
  /** Text a new box of this type starts with, after the emoji. */
  text: string;
  /** Frontmatter list the box's value is also written to, such as "carattere"; "" for none. */
  property: string;
  /** The box closes the adventure, like the plugin's 😢. */
  ending: boolean;
}

export interface Box {
  /** The type's id, or "" when the emoji is not one of the gamebook's types. */
  type: string;
  emoji: string;
  from: number;
  to: number;
  openLine: string;
  closeLine: string;
  content: string;
}

export const OPEN_LINE = '::: {custom-style="box"} ';
export const CLOSE_LINE = ":::";

/** The plugin's six types, with the frontmatter keys Missione Cavaliere uses. */
export function defaultBoxTypes(language = "it"): BoxType[] {
  const it = language.startsWith("it");
  return [
    { id: "choice", emoji: "🤔", name: it ? "Scelta" : "Choice", color: "#3b82c4", text: it ? "**Devi agire in fretta!**" : "**You must act fast!**", property: "", ending: false },
    { id: "trait", emoji: "❤️", name: it ? "Carattere" : "Trait", color: "#c8445a", text: it ? "**Carattere**" : "**Trait**", property: "carattere", ending: false },
    { id: "item", emoji: "✏️", name: it ? "Oggetto" : "Item", color: "#d39a2b", text: it ? "**Oggetto**" : "**Item**", property: "parole chiave", ending: false },
    { id: "encounter", emoji: "✅", name: it ? "Incontro" : "Encounter", color: "#3f9b5a", text: it ? "**Incontro memorabile**" : "**Memorable encounter**", property: "incontri", ending: false },
    { id: "ending", emoji: "😢", name: it ? "Fine" : "Ending", color: "#7a6a8f", text: it ? "**Fine**" : "**The end**", property: "", ending: true },
    { id: "confirm", emoji: "🆗", name: it ? "Corretto" : "Confirmed", color: "#2f9c9c", text: it ? "**Corretto**" : "**Confirmed**", property: "", ending: false },
  ];
}

const BOX = /^(::: \{custom-style="box"\}[ \t]*)\n([\s\S]*?)\n(:::[ \t]*)(?=\n|$)/gm;

/** Without the variation selector, so ❤ and ❤️ are the same emoji. */
function bare(s: string): string {
  return s.replace(/️/g, "");
}

function typeOf(content: string, types: BoxType[]): { type: string; emoji: string } {
  const first = content.split("\n").find((line) => line.trim() !== "") ?? "";
  const start = first.trimStart();
  for (const t of types) {
    const e = bare(t.emoji);
    if (e && bare(start).startsWith(e)) return { type: t.id, emoji: t.emoji };
  }
  return { type: "", emoji: [...start][0] ?? "" };
}

export function findBoxes(text: string, types: BoxType[]): Box[] {
  const out: Box[] = [];
  for (const m of text.matchAll(BOX)) {
    const { type, emoji } = typeOf(m[2], types);
    out.push({ type, emoji, from: m.index, to: m.index + m[0].length, openLine: m[1], closeLine: m[3], content: m[2] });
  }
  return out;
}

export function withoutBoxes(text: string, types: BoxType[]): string {
  let out = text;
  for (const b of findBoxes(text, types).reverse()) out = out.slice(0, b.from) + out.slice(b.to);
  return out;
}

export function boxText(type: BoxType, extra = ""): string {
  return `${OPEN_LINE}\n${type.emoji} ${type.text}${extra ? `\n\n${extra}` : ""}\n${CLOSE_LINE}`;
}
