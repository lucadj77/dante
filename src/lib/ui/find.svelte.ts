import type { FindRequest } from "$lib/editor/sceneEditor";

/**
 * A match chosen in the project's find and replace: the editor of `path` shows it as soon as
 * it is on screen, whether it was open already or opens because of it.
 */
export const pendingFind = $state<{ request: (FindRequest & { path: string }) | null }>({ request: null });

export function showMatch(path: string, request: FindRequest) {
  pendingFind.request = { ...request, path };
}

/** The request for `path`, handed out once. */
export function takeFind(path: string): FindRequest | null {
  const request = pendingFind.request;
  if (!request || request.path !== path) return null;
  pendingFind.request = null;
  return request;
}
