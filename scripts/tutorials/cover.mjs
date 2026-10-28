// The opening and closing covers of a tutorial, as 1920×1080 PNG: node cover.mjs <out folder>.
// The folder holds meta.json (written by run.mjs); the opening cover is also the YouTube thumbnail.
import fs from 'node:fs';
import path from 'node:path';
import { ICON, AUTHOR } from './lib.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const out = process.argv[2];
const meta = JSON.parse(fs.readFileSync(path.join(out, 'meta.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = { it: `Tutorial ${meta.n}`, en: `Tutorial ${meta.n}` }[meta.lang];
const site = 'dante.lucadj.eu';
const page = (body) => `<!doctype html><meta charset="utf-8"><style>
  html, body { margin: 0; width: 1920px; height: 1080px; background: #faf9f6; color: #1d232c }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Inter, system-ui, sans-serif }
  .icon svg { width: 210px; height: 210px }
  .name { font: 400 64px/1 Georgia, serif; margin-top: 22px; color: #555 }
  .label { margin-top: 70px; font-weight: 600; font-size: 28px; letter-spacing: 4px; text-transform: uppercase; color: #d9480f }
  h1 { margin: 22px 0 0; font: 400 104px/1.1 Georgia, serif; text-align: center; max-width: 1600px }
  .sub { margin-top: 26px; font-size: 40px; color: #555; text-align: center; max-width: 1500px }
  .author { position: absolute; bottom: 64px; font-size: 30px; color: #777 }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: #d9480f }
</style>${body}<div class="bar"></div>`;

const first = page(`<div class="icon">${ICON}</div><div class="name">Dante</div>
  <div class="label">${esc(label)}</div><h1>${esc(meta.title)}</h1><div class="sub">${esc(meta.subtitle)}</div>
  <div class="author">${esc(AUTHOR)}</div>`);
const last = page(`<div class="icon">${ICON}</div><h1 style="margin-top:34px">Dante</h1>
  <div class="sub">${meta.lang === 'it' ? 'Scrivi il tuo romanzo.' : 'Write your novel.'}</div>
  <div class="sub" style="margin-top:60px;color:#d9480f;font-weight:600">${site}</div>
  <div class="author">${esc(AUTHOR)}</div>`);

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, html] of [['cover-start.png', first], ['cover-end.png', last]]) {
  await p.setContent(html);
  await p.screenshot({ path: path.join(out, name) });
}
await browser.close();
