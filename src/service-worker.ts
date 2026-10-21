/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// The web version keeps all its files in the browser, so it opens and works offline. Each
// version has its own cache; a new one is downloaded in the background and takes over when
// the writer restarts Dante from the update banner (or at the next start with no window open).
// Nothing else passes through here: the project's files never leave the computer.

import { base, build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `dante-${version}`;
/** The page itself, the program and the static files. version.json is always asked anew. */
const ASSETS = [`${base}/`, ...build, ...files.filter((f) => !f.endsWith("/version.json"))];

sw.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE && key.startsWith("dante-")) await caches.delete(key);
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener("message", (event) => {
  if (event.data === "take-over") void sw.skipWaiting();
});

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin || url.pathname.endsWith("/version.json")) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Every page of Dante is the same single page.
      const key = request.mode === "navigate" ? `${base}/` : url.pathname;
      const cached = await cache.match(key);
      if (cached) return cached;
      return fetch(request);
    })(),
  );
});
