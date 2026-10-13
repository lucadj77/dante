import { describe, expect, it } from "vitest";
import { findLinks, resolveLink, rewriteLinks } from "../wikilinks";

const notes = [
  "Codex/Characters/Marta Rinaldi.md",
  "Manuscript/010 Return/010 Arrival.md",
  "Manuscript/020 Letter/010 Arrival.md",
  "Research/map.png",
];

describe("wikilinks", () => {
  it("finds links with headings and aliases", () => {
    const [link] = findLinks("See [[Marta Rinaldi#Past|Marta]].");
    expect(link).toMatchObject({ target: "Marta Rinaldi", subpath: "#Past", alias: "Marta" });
  });

  it("resolves like Obsidian", () => {
    expect(resolveLink("marta rinaldi", "x.md", notes)).toBe("Codex/Characters/Marta Rinaldi.md");
    expect(resolveLink("map.png", "x.md", notes)).toBe("Research/map.png");
    expect(resolveLink("020 Letter/010 Arrival", "x.md", notes)).toBe("Manuscript/020 Letter/010 Arrival.md");
    // With two notes of the same name, the closest one wins.
    expect(resolveLink("010 Arrival", "Manuscript/020 Letter/020 Next.md", notes)).toBe("Manuscript/020 Letter/010 Arrival.md");
  });

  it("rewrites links to moved notes, keeping heading and alias", () => {
    const renames = new Map([["Codex/Characters/Marta Rinaldi.md", "Codex/Characters/Marta Neri.md"]]);
    const after = notes.map((n) => renames.get(n) ?? n);
    const text = "[[Marta Rinaldi#Past|Marta]] and ![[map.png]]";
    expect(rewriteLinks(text, "x.md", renames, notes, after)).toBe("[[Marta Neri#Past|Marta]] and ![[map.png]]");
  });

  it("leaves working links alone", () => {
    const renames = new Map([["Manuscript/010 Return/010 Arrival.md", "Manuscript/015 Return/010 Arrival.md"]]);
    const after = notes.map((n) => renames.get(n) ?? n);
    expect(rewriteLinks("[[Marta Rinaldi]]", "x.md", renames, notes, after)).toBeNull();
  });
});
