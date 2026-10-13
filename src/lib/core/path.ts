// Project paths are always relative to the project root and use "/" as separator,
// whatever the operating system. The filesystem adapter converts them.

export function join(...parts: string[]): string {
  return parts
    .filter((p) => p !== "")
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function extname(path: string): string {
  const name = basename(path);
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i);
}

export function stripExt(path: string): string {
  const ext = extname(path);
  return ext ? path.slice(0, -ext.length) : path;
}

export function isMarkdown(path: string): boolean {
  return extname(path).toLowerCase() === ".md";
}

/** True when `path` is `dir` itself or lies inside it. */
export function isWithin(path: string, dir: string): boolean {
  return dir === "" || path === dir || path.startsWith(dir + "/");
}

/** Rewrites the `from` prefix of `path` to `to`, if `path` lies within `from`. */
export function rebase(path: string, from: string, to: string): string {
  if (path === from) return to;
  if (isWithin(path, from)) return join(to, path.slice(from.length + 1));
  return path;
}
