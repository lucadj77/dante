import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { guideToHtml, slug } from "../guide";

describe("guide", () => {
  it("makes anchors as GitHub does", () => {
    expect(slug("1. Cos'è Dante")).toBe("1-cosè-dante");
    expect(slug("13. Esportare in Word, PDF ed EPUB")).toBe("13-esportare-in-word-pdf-ed-epub");
  });

  it("reads headings, nested lists, tables, code and images", () => {
    const md = [
      "# Titolo",
      "",
      "Un **grassetto**, un *corsivo* e `<script>` in codice.",
      "",
      "- **Uno**: primo",
      "  - dentro",
      "",
      "    ![Figura](img/a.png)",
      "- Due",
      "",
      "1. Primo passo",
      "2. Secondo",
      "",
      "| A | B |",
      "| --- | ---: |",
      "| `x\\|y` | 2 |",
      "",
      "```text",
      "<b>così</b>",
      "```",
      '<img src="img/b.png" width="280" alt="B">',
      "",
      "## Come si fa",
      "## Come si fa",
    ].join("\n");
    const page = guideToHtml(md, { image: (src) => `/assets/${src}` });
    expect(page.html).toContain('<h1 id="titolo">Titolo</h1>');
    expect(page.html).toContain("<strong>grassetto</strong>");
    expect(page.html).toContain("<em>corsivo</em>");
    expect(page.html).toContain("<code>&lt;script&gt;</code>");
    expect(page.html).toContain("<ul><li><strong>Uno</strong>: primo<ul><li><p>dentro</p><p><img src=\"/assets/img/a.png\"");
    expect(page.html).toContain("<ol><li>Primo passo</li><li>Secondo</li></ol>");
    expect(page.html).toContain('<td><code>x|y</code></td><td style="text-align:right">2</td>');
    expect(page.html).toContain("<pre><code>&lt;b&gt;così&lt;/b&gt;</code></pre>");
    expect(page.html).toContain('<img src="/assets/img/b.png" alt="B" width="280"');
    expect(page.headings.map((h) => h.id)).toEqual(["titolo", "come-si-fa", "come-si-fa-1"]);
  });

  it("never lets HTML or scripts through", () => {
    const page = guideToHtml('<script>alert(1)</script>\n\n[x](javascript:alert(1)) <b onclick="x">b</b>');
    expect(page.html).not.toContain("<script");
    expect(page.html).not.toContain("<b ");
    expect(page.html).not.toContain("javascript:");
  });

  it("reads the whole guide, with every chapter of the index", () => {
    const md = readFileSync(new URL("../../../../docs/guida.md", import.meta.url), "utf8");
    const page = guideToHtml(md, { image: (src) => src });
    const ids = new Set(page.headings.map((h) => h.id));
    for (const [, anchor] of md.matchAll(/\]\(#([^)]+)\)/g)) expect(ids.has(decodeURIComponent(anchor))).toBe(true);
    expect(page.html.replace(/<code>[^<]*<\/code>/g, "")).not.toMatch(/\*\*|\]\(/);
  });
});
