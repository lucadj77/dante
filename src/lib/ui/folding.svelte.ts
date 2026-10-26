// Which branches of each tree are folded or unfolded, kept on this computer so the trees
// look the same after switching section or restarting the app.

const KEY = "dante.tree-folds";

function load(): Record<string, string[]> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

const folds = $state<{ scopes: Record<string, string[]> }>({ scopes: load() });

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(folds.scopes));
  } catch {
    // Not remembered after a restart; the trees still work.
  }
}

/** The paths marked in one tree, such as the folded chapters of a project's manuscript. */
export function marked(scope: string): Set<string> {
  return new Set(folds.scopes[scope] ?? []);
}

export function mark(scope: string, paths: Iterable<string>, on: boolean) {
  const set = marked(scope);
  for (const path of paths) {
    if (on) set.add(path);
    else set.delete(path);
  }
  folds.scopes[scope] = [...set];
  save();
}

/** Replaces every mark of a tree at once, as "fold all" does. */
export function markOnly(scope: string, paths: string[]) {
  folds.scopes[scope] = [...paths];
  save();
}

/** Whether a tree was ever folded or unfolded on this computer. */
export function hasMarks(scope: string): boolean {
  return scope in folds.scopes;
}
