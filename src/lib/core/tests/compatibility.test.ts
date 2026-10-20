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

  // Functions the compiler cannot rewrite for an older browser: each needs a newer Safari
  // than 15.6, so on Catalina the feature using it fails (or the whole page, if it runs at start).
  const TOO_NEW: [RegExp, string][] = [
    [/new (De)?CompressionStream\(/, "CompressionStream (Safari 16.4)"],
    [/new OffscreenCanvas\(/, "OffscreenCanvas (Safari 16.4)"],
    [/\.(toSorted|toReversed|toSpliced)\(/, "Array.toSorted & co. (Safari 16)"],
    [/Promise\.withResolvers\(/, "Promise.withResolvers (Safari 17.4)"],
    [/(Object|Map)\.groupBy\(/, "Object.groupBy (Safari 17.4)"],
    [/Array\.fromAsync\(/, "Array.fromAsync (Safari 16.4)"],
    [/AbortSignal\.(timeout|any)\(/, "AbortSignal.timeout (Safari 16)"],
    [/\.(isWellFormed|toWellFormed)\(/, "String.isWellFormed (Safari 16.4)"],
    [/\.(union|intersection|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(new Set/, "Set methods (Safari 17)"],
    [/\.(showPopover|hidePopover|togglePopover)\(|\spopover[=\s>]/, "popover (Safari 17)"],
    [/\.checkVisibility\(/, "checkVisibility (Safari 17.4)"],
    [/light-dark\(/, "light-dark() (Safari 17.5)"],
    [/@starting-style/, "@starting-style (Safari 17.5)"],
  ];

  it("uses nothing newer than Safari 15.6 that cannot be rewritten", () => {
    const found = files.flatMap(({ path, text }) => TOO_NEW.filter(([re]) => re.test(text)).map(([, what]) => `${path}: ${what}`));
    expect(found).toEqual([]);
  });

  it("builds for Safari 15", () => {
    expect(readFileSync("vite.config.js", "utf8")).toContain('"safari15"');
  });
});
