// Checks the built scripts hold no regex lookbehind written as a literal: Safari before 16.4
// (macOS 10.15 stops at 15.6) rejects the whole script that holds one, so Dante would open
// blank there. The test in src/lib/core/tests/compatibility.test.ts covers Dante's own code;
// this covers the libraries, after a dependency update. A lookbehind inside a string given to
// new RegExp() fails only when that line runs, and is not reported.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "acorn";

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.m?js$/.test(name) ? [path] : [];
  });

const found = [];
for (const path of files("build")) {
  const code = readFileSync(path, "utf8");
  try {
    parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      onToken(token) {
        if (token.type.label === "regexp" && /\(\?<[=!]/.test(token.value.pattern)) found.push(`${path}: /${token.value.pattern.slice(0, 60)}/`);
      },
    });
  } catch (error) {
    found.push(`${path}: cannot be read (${error.message})`);
  }
}
if (found.length) {
  console.error("Regex lookbehind in the built scripts (Safari 15 rejects the script):\n" + found.join("\n"));
  process.exit(1);
}
console.log("no regex lookbehind in the built scripts");
