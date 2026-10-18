import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The Mac window is drawn by the system WebKit: on macOS 10.15 (Catalina) that is Safari 15.6,
// which rejects a whole script that holds a regex lookbehind and ignores color-mix().

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "tests" ? [] : sources(path);
    return /\.(ts|js|svelte|css)$/.test(name) ? [path] : [];
  });
}

const files = sources("src").map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("compatibility with macOS 10.15", () => {
  it("uses no regex lookbehind", () => {
    const found = files.filter(({ text }) => /\(\?<[=!]/.test(text)).map(({ path }) => path);
    expect(found).toEqual([]);
  });

  it("gives every color-mix() a plain colour before it", () => {
    const found = files
      .filter(({ text }) => {
        const covered = text.match(/background: rgba\([^)]*\);\s*background: color-mix\(/g)?.length ?? 0;
        return covered !== (text.match(/color-mix\(/g)?.length ?? 0);
      })
      .map(({ path }) => path);
    expect(found).toEqual([]);
  });

  it("builds for Safari 15", () => {
    expect(readFileSync("vite.config.js", "utf8")).toContain('"safari15"');
  });
});
