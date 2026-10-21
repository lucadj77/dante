/**
 * The web version: built with VITE_DANTE_WEB=1 to be served from a site, where it works
 * offline and updates itself through a service worker (src/service-worker.ts).
 */
export const WEB_BUILD = import.meta.env.VITE_DANTE_WEB === "1";
