import { describe, expect, it } from "vitest";
import {
  acceptEdit,
  applyEdits,
  commentEdit,
  discussion,
  parseComment,
  parseCritic,
  rejectEdit,
  replyEdit,
  resolveEdit,
  settleAll,
  trackChange,
  type Tracked,
} from "../critic";

const D = "2026-10-14";
const sig = (who = "luca") => `{>>@${who} ${D}<<}`;

/** Applies a change typed in revision mode; `|` marks the cursor in the result. */
function typed(text: string, from: number, to: number, insert: string, backward = true, who = "luca"): string {
  const result: Tracked | null = trackChange(text, { from, to, insert }, who, D, backward);
  if (!result) {
    const out = text.slice(0, from) + insert + text.slice(to);
    return out.slice(0, from + insert.length) + "|" + out.slice(from + insert.length);
  }
  const out = applyEdits(text, [result]);
  return out.slice(0, result.cursor) + "|" + out.slice(result.cursor);
}

describe("CriticMarkup", () => {
  it("reads signatures and comments", () => {
    expect(parseComment("@anna 2026-10-14: lo sposterei")).toEqual({ author: "anna", date: "2026-10-14", text: "lo sposterei" });
    expect(parseComment("@Luca Di Gialleonardo 2026-10-14")).toEqual({ author: "Luca Di Gialleonardo", date: "2026-10-14", text: "" });
    expect(parseComment("@anna: sì")).toEqual({ author: "anna", date: null, text: "sì" });
    expect(parseComment("just a note")).toEqual({ author: null, date: null, text: "just a note" });
  });

  it("groups changes with the comments after them", () => {
    const text = `La porta era {--chiusa--}${sig("anna")}{++socchiusa++}${sig("anna")}. {==Il vento.==}{>>@luca ${D}: presto?<<}{>>@anna ${D}: sì<<} {>>nota<<}`;
    const items = parseCritic(text);
    expect(items.map((i) => [i.kind, i.author, i.comments.length])).toEqual([
      ["deletion", "anna", 1],
      ["addition", "anna", 1],
      ["highlight", "luca", 2],
      ["comment", null, 1],
    ]);
    expect(discussion(items[2]).map((c) => c.text)).toEqual(["presto?", "sì"]);
    expect(text.slice(items[0].contentFrom, items[0].contentTo)).toBe("chiusa");
  });

  it("reads substitutions", () => {
    const text = "a {~~old~>new~~} b";
    const [item] = parseCritic(text);
    expect(text.slice(item.contentFrom, item.contentTo)).toBe("old");
    expect(text.slice(item.newFrom!, item.newTo!)).toBe("new");
    expect(applyEdits(text, [acceptEdit(text, item)])).toBe("a new b");
    expect(applyEdits(text, [rejectEdit(text, item)])).toBe("a old b");
  });

  it("accepts, rejects, resolves and replies", () => {
    const text = `door {--closed--}${sig()}{++open++}${sig()}{>>@anna ${D}: why?<<} {==wind==}{>>@anna ${D}: early<<}.`;
    const [del, add, hl] = parseCritic(text);
    expect(applyEdits(text, [acceptEdit(text, del), acceptEdit(text, add)])).toBe(`door open {==wind==}{>>@anna ${D}: early<<}.`);
    expect(applyEdits(text, [rejectEdit(text, del), rejectEdit(text, add)])).toContain("door closed {==wind");
    expect(applyEdits(text, [resolveEdit(text, add)])).toContain(`{++open++}${sig()} {==`);
    expect(applyEdits(text, [resolveEdit(text, hl)])).toMatch(/ wind\.$/);
    expect(applyEdits(text, [replyEdit(hl, "luca", D, "ok")])).toMatch(/early<<\}\{>>@luca 2026-10-14: ok<<\}\.$/);
  });

  it("adds comments on a selection or at a point", () => {
    expect(applyEdits("the sea", [commentEdit("the sea", 4, 7, "luca", D, "why?")])).toBe(`the {==sea==}{>>@luca ${D}: why?<<}`);
    expect(applyEdits("the sea ", [commentEdit("the sea ", 3, 8, "luca", D, "x")])).toBe(`the {==sea==}{>>@luca ${D}: x<<} `);
    expect(applyEdits("a b", [commentEdit("a b", 1, 2, "luca", D, "x")])).toBe(`a{>>@luca ${D}: x<<} b`);
    expect(applyEdits("ab", [commentEdit("ab", 1, 1, "luca", D, "here <<}\nnow")])).toBe(`a{>>@luca ${D}: here << } now<<}b`);
  });

  it("settles every change at once", () => {
    const text = `a {--b--}${sig()}{++c++}${sig()} {==d==}{>>x<<}`;
    expect(settleAll(text, "accept")).toBe("a c {==d==}{>>x<<}");
    expect(settleAll(text, "reject")).toBe("a b {==d==}{>>x<<}");
  });
});

describe("revision mode", () => {
  it("wraps typed text and continues the same addition", () => {
    const first = typed("ab", 1, 1, "X");
    expect(first).toBe(`a{++X|++}${sig()}b`);
    const text = first.replace("|", "");
    const at = first.indexOf("|");
    expect(typed(text, at, at, "Y")).toBe(`a{++XY|++}${sig()}b`);
    // Right after the signature, as when the cursor skipped the hidden marks.
    const end = text.indexOf("b");
    expect(typed(text, end, end, "Z")).toBe(`a{++XZ|++}${sig()}b`);
  });

  it("deletes into a deletion and grows it with backspace", () => {
    const first = typed("abc", 2, 3, "");
    expect(first).toBe(`ab|{--c--}${sig()}`);
    const second = typed(first.replace("|", ""), 1, 2, "");
    expect(second).toBe(`a|{--bc--}${sig()}`);
  });

  it("grows a deletion with forward delete", () => {
    const first = typed("abc", 0, 1, "", false);
    expect(first).toBe(`{--a--}${sig()}|bc`);
    const at = first.indexOf("|");
    expect(typed(first.replace("|", ""), at, at + 1, "", false)).toBe(`{--ab--}${sig()}|c`);
  });

  it("removes text from one's own addition directly", () => {
    const text = `a{++XY++}${sig()}b`;
    expect(typed(text, 5, 6, "")).toBe(`a{++X|++}${sig()}b`);
    expect(typed(`a{++X++}${sig()}b`, 4, 5, "")).toBe(`a|b`);
  });

  it("turns typing over a selection into a deletion and an addition", () => {
    expect(typed("the closed door", 4, 10, "open")).toBe(`the {--closed--}${sig()}{++open|++}${sig()} door`);
  });

  it("leaves other people's marks alone", () => {
    const text = `a{--b--}${sig("anna")}c`;
    // Backspace inside Anna's deletion does nothing.
    expect(typed(text, 4, 5, "")).toBe(`a{--|b--}${sig("anna")}c`);
    // Typing inside it goes after the whole item.
    const out = typed(text, 4, 4, "X");
    expect(out).toBe(`a{--b--}${sig("anna")}{++X|++}${sig()}c`);
    // A selection across it: the plain text around is deleted, Anna's mark stays.
    const all = typed(text, 0, text.length, "");
    expect(all).toBe(`|{--a--}${sig()}{--b--}${sig("anna")}{--c--}${sig()}`);
  });

  it("drops one's own additions inside a deleted range", () => {
    const text = `x {++new++}${sig()} y`;
    expect(typed(text, 0, text.length, "")).toBe(`|{--x --}${sig()}{-- y--}${sig()}`);
  });

  it("edits highlighted text directly", () => {
    expect(typed("{==sea==}{>>c<<}", 4, 5, "")).toBe("{==s|a==}{>>c<<}");
  });
});
