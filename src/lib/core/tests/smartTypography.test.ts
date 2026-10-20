import { describe, expect, it } from "vitest";
import { EditorState, type Extension, type TransactionSpec } from "@codemirror/state";
import { smartReplacement, typeSmartly } from "$lib/editor/smartTypography";
import { trackChanges } from "$lib/editor/critic";
import { alignedEditing } from "$lib/editor/alignment";
import { ALIGN_CLOSE, alignOpen } from "$lib/core/alignment";
import type { TypographySettings } from "../settings";

const it_: TypographySettings = { quotes: "guillemets", apostrophes: true, ellipsis: true, spaces: true, dialogueDash: "em", whileTyping: true };

describe("typing", () => {
  it("opens and closes quotes from the context", () => {
    expect(smartReplacement("", '"', it_)).toEqual({ back: 0, insert: "«" });
    expect(smartReplacement("disse ", '"', it_)).toEqual({ back: 0, insert: "«" });
    expect(smartReplacement("«Ciao", '"', it_)).toEqual({ back: 0, insert: "»" });
    expect(smartReplacement("She said ", '"', { ...it_, quotes: "curly" })).toEqual({ back: 0, insert: "“" });
  });

  it("corrects apostrophes, È and ellipses", () => {
    expect(smartReplacement("l", "'", it_)).toEqual({ back: 0, insert: "’" });
    expect(smartReplacement("Ma E", "'", it_)).toEqual({ back: 1, insert: "È" });
    expect(smartReplacement("Forse..", ".", it_)).toEqual({ back: 2, insert: "…" });
    expect(smartReplacement(" ", "'", it_)).toBeNull();
  });

  it("leaves wikilinks, code and disabled rules alone", () => {
    expect(smartReplacement("[[L", "'", it_)).toBeNull();
    expect(smartReplacement("`a", '"', it_)).toBeNull();
    expect(smartReplacement("l", "'", { ...it_, apostrophes: false })).toBeNull();
  });
});

describe("typing dashes", () => {
  it("leaves hyphens inside a sentence as typed", () => {
    expect(smartReplacement("Lui -", " ", it_)).toBeNull();
    expect(smartReplacement("Lui -", " ", { ...it_, quotes: "dash" })).toBeNull();
  });

  it("opens dialogue only when chosen", () => {
    expect(smartReplacement("-", " ", { ...it_, quotes: "dash" })).toEqual({ back: 1, insert: "— " });
    expect(smartReplacement("-", " ", it_)).toBeNull();
    expect(smartReplacement("", '"', { ...it_, quotes: "dash" })).toEqual({ back: 0, insert: "— " });
    expect(smartReplacement("— Vieni", '"', { ...it_, quotes: "dash" })).toEqual({ back: 0, insert: " —" });
  });
});

describe("typing dialogue of other countries", () => {
  it("opens and closes with each country's marks", () => {
    expect(smartReplacement("Er sagte ", '"', { ...it_, quotes: "low" })).toEqual({ back: 0, insert: "„" });
    expect(smartReplacement("„Komm", '"', { ...it_, quotes: "low" })).toEqual({ back: 0, insert: "“" });
    expect(smartReplacement("", '"', { ...it_, quotes: "guillemetsSpaced" })).toEqual({ back: 0, insert: "« " });
  });

  it("places the Spanish dash from the context", () => {
    const es = { ...it_, quotes: "dashAttached" as const };
    expect(smartReplacement("", '"', es)).toEqual({ back: 0, insert: "—" });
    expect(smartReplacement("—Ven", '"', es)).toEqual({ back: 0, insert: " —" });
    expect(smartReplacement("—Ven —dijo él", '"', es)).toEqual({ back: 0, insert: "—" });
    expect(smartReplacement("-", " ", es)).toEqual({ back: 1, insert: "—" });
  });
});

describe("typing with the conventions inside the editor", () => {
  const typing = (doc: string, extensions: Extension[] = []) => {
    let state = EditorState.create({ doc, extensions });
    return {
      get state() {
        return state;
      },
      dispatch(spec: TransactionSpec) {
        state = state.update(spec).state;
      },
    };
  };
  const curly: TypographySettings = { ...it_, quotes: "curly" };

  it("corrects the character once in revision mode", () => {
    const view = typing("Disse ", [trackChanges("anna")]);
    expect(typeSmartly(view, 6, 6, '"', curly)).toBe(true);
    expect(view.state.doc.toString()).toMatch(/^Disse \{\+\+“\+\+\}\{>>@anna [-\d]+<<\}$/);
  });

  it("keeps the tags of an aligned paragraph whole", () => {
    const start = typing(`${alignOpen("center")}Fine${ALIGN_CLOSE}`, [alignedEditing]);
    typeSmartly(start, 0, 0, '"', curly);
    expect(start.state.doc.toString()).toBe(`${alignOpen("center")}“Fine${ALIGN_CLOSE}`);
    const doc = `${alignOpen("center")}Fine${ALIGN_CLOSE}\n\nNext`;
    const end = typing(doc, [alignedEditing]);
    typeSmartly(end, doc.indexOf("\n"), doc.indexOf("\n"), '"', curly);
    expect(end.state.doc.toString()).toBe(`${alignOpen("center")}Fine”${ALIGN_CLOSE}\n\nNext`);
  });
});
