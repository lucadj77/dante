// Records one tutorial: node run.mjs <number> <it|en>. The frames and their times go in out/<slug>-<lang>/,
// then build.py makes the .mp4. FAST=1 only tries the path; SHOT=file.png saves the page if a step fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [n, lang = 'it'] = process.argv.slice(2);
const file = fs.readdirSync(path.join(HERE, 'videos')).find((f) => f.startsWith(String(n).padStart(2, '0') + '-'));
if (!file || !['it', 'en'].includes(lang)) {
  console.log('usage: node run.mjs <number> <it|en>');
  process.exit(1);
}
const video = await import(path.join(HERE, 'videos', file));
const out = path.join(HERE, 'out', `${file.replace(/\.mjs$/, '')}-${lang}`);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ n: video.meta.n, title: video.meta.title[lang], subtitle: video.meta.subtitle[lang], lang }, null, 1));
const { t, record } = await start({ lang, out, ...(video.setup?.(lang) ?? {}) });
// what the video needs ready before it starts, not recorded
if (video.prepare) await video.prepare(t);
const t0 = Date.now();
await record((t) => video.default(t));
console.log(`${file} ${lang}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
