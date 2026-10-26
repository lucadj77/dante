// Reads the text of an RTF file, as Scrivener keeps each document, into paragraphs of
// Markdown. Bold, italic, strikethrough and highlighting are kept, and so are centred and
// right-aligned paragraphs; fonts, colours, pictures and the rest of the layout are left out.

import { setAlignment, type Align } from "../alignment";
import { escapeStart, renderFormatted, type Format } from "./docx";

interface State extends Format {
  /** Inside a group whose text is not part of the document, such as the font table. */
  skip: boolean;
  /** Characters that stand in for a \u character, to leave out after it. */
  uc: number;
}

// Groups that hold no text of the document.
const DESTINATIONS = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "headerl", "headerr", "headerf",
  "footer", "footerl", "footerr", "footerf", "fldinst", "listtable", "listoverridetable", "rsidtbl", "generator",
  "xmlnstbl", "themedata", "colorschememapping", "latentstyles", "datastore", "expandedcolortbl", "pgdsctbl",
  "filetbl", "revtbl", "footnote", "annotation", "atnid", "atnauthor", "bkmkstart", "bkmkend", "nonshppict",
]);

// The characters of code page 1252 that are not those of Latin-1.
const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6,
  0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c,
  0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

const SYMBOLS: Record<string, string> = {
  emdash: "—", endash: "–", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”", bullet: "•", emspace: " ", enspace: " ",
};

/** The paragraphs of an RTF document, in Markdown; empty paragraphs stay, as "". */
export function rtfParagraphs(rtf: string): string[] {
  const paragraphs: string[] = [];
  let pieces: { text: string; format: Format }[] = [];
  let align: Align | null = null;
  let state: State = { skip: false, uc: 1 };
  const stack: State[] = [];
  /** Fallback characters still to leave out after a \u. */
  let fallback = 0;
  /** A group just opened, whose first control word may say what it holds. */
  let groupStart = false;

  const add = (text: string) => {
    if (state.skip || !text) return;
    const format: Format = { bold: state.bold, italic: state.italic, strike: state.strike, highlight: state.highlight };
    const last = pieces[pieces.length - 1];
    if (last && JSON.stringify(last.format) === JSON.stringify(format)) last.text += text;
    else pieces.push({ text, format });
  };
  const endParagraph = () => {
    const text = escapeStart(renderFormatted(pieces).replace(/[ \t]+\n/g, "\n").trim());
    paragraphs.push(text ? setAlignment(text, align) : "");
    pieces = [];
  };

  let i = 0;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === "{") {
      stack.push(state);
      state = { ...state };
      groupStart = true;
      i++;
      continue;
    }
    if (c === "}") {
      state = stack.pop() ?? state;
      groupStart = false;
      i++;
      continue;
    }
    if (c === "\\") {
      const next = rtf[i + 1] ?? "";
      if (/[a-zA-Z]/.test(next)) {
        const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 40))!;
        i += m[0].length;
        const word = m[1];
        const param = m[2] === undefined ? null : Number(m[2]);
        const first = groupStart;
        groupStart = false;
        if (first && DESTINATIONS.has(word)) {
          state.skip = true;
          continue;
        }
        if (fallback > 0 && word !== "u") fallback = 0;
        switch (word) {
          case "par":
          case "sect":
            if (!state.skip) endParagraph();
            break;
          case "line":
            add("\n");
            break;
          case "tab":
            add(" ");
            break;
          case "b":
            state.bold = param !== 0;
            break;
          case "i":
            state.italic = param !== 0;
            break;
          case "strike":
          case "striked":
            state.strike = param !== 0;
            break;
          case "highlight":
            state.highlight = param !== null && param !== 0;
            break;
          case "plain":
            state.bold = state.italic = state.strike = state.highlight = false;
            break;
          case "pard":
            align = null;
            break;
          case "qc":
            align = "center";
            break;
          case "qr":
            align = "right";
            break;
          case "ql":
          case "qj":
            align = null;
            break;
          case "uc":
            state.uc = param ?? 1;
            break;
          case "u":
            if (param !== null) add(String.fromCharCode(param < 0 ? param + 65536 : param));
            fallback = state.uc;
            break;
          default:
            if (word in SYMBOLS) add(SYMBOLS[word]);
        }
        continue;
      }
      groupStart = false;
      if (next === "*") {
        // An optional destination this reader does not know: its text is left out.
        state.skip = true;
        i += 2;
        continue;
      }
      if (next === "'") {
        const code = parseInt(rtf.slice(i + 2, i + 4), 16);
        i += 4;
        if (fallback > 0) {
          fallback--;
          continue;
        }
        if (!Number.isNaN(code)) add(String.fromCharCode(CP1252[code] ?? code));
        continue;
      }
      i += 2;
      if (next === "\n" || next === "\r") {
        if (!state.skip) endParagraph();
      } else if (next === "~") add(" ");
      else if (next === "_") add("‑");
      else if (next === "-") {
        // An optional hyphen: not part of the word.
      } else add(next);
      continue;
    }
    groupStart = false;
    i++;
    if (c === "\n" || c === "\r") continue;
    if (fallback > 0) {
      fallback--;
      continue;
    }
    add(c);
  }
  if (pieces.some((p) => p.text.trim())) endParagraph();
  // The empty paragraphs at the end are only where the document stops.
  while (paragraphs.length && paragraphs[paragraphs.length - 1] === "") paragraphs.pop();
  return paragraphs;
}
