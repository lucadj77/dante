// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import process from "node:process";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),
    // The web version may live in a folder of a site, such as /dante (DANTE_BASE=/dante).
    paths: { base: process.env.DANTE_BASE ?? "" },
    // The version names the cache of the web version; builds without one get the time.
    version: { name: process.env.DANTE_VERSION || `0.0.${Date.now()}` },
    // Only the web version registers its service worker (src/lib/web.ts); the app has none.
    serviceWorker: { register: false },
  },
};

export default config;
