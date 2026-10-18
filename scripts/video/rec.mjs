// Records the Dante presentation video from the app in the browser (npm run dev on :5173).
import { launch } from './common.mjs';
import fs from 'node:fs';
const SCENES = JSON.parse(fs.readFileSync('scenes.json', 'utf8'));
const only = process.argv[2]; // a scene number, to try one scene (no video)
const ICON = fs.readFileSync('../../src-tauri/icons/icon.svg', 'utf8');

// The first scene shows the desktop app's welcome, with recent projects: a pretend Tauri
// answers its calls. The rest runs in the plain browser, after a reload.
const fakeTauri = (recent) => {
  if (sessionStorage.getItem('desktop') === '0') return;
  localStorage.setItem('dante.recent-projects', JSON.stringify(recent.map(({ path, title, opened }) => ({ path, title, opened }))));
  const yaml = Object.fromEntries(recent.map((r) => [r.path, `title: ${r.title}\nauthor: ${r.author}\nlanguage: en\n`]));
  window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }, transformCallback: () => 0,
    invoke: async (cmd, args) => (cmd === 'read_text' ? yaml[args.root] ?? 'title: x\n' : cmd === 'path_exists' ? true : cmd === 'list_dir' ? [] : cmd === 'plugin:app|version' ? '0.1.29' : null) };
};
const RECENT = [
  { path: '/Users/luca/Novels/The Lighthouse', title: 'The Lighthouse', author: 'Luca', opened: '2026-10-17T09:00:00Z' },
  { path: '/Users/luca/Novels/Winter Roads', title: 'Winter Roads', author: 'Luca', opened: '2026-10-12T09:00:00Z' },
  { path: '/Users/luca/Novels/The Salt House', title: 'The Salt House', author: 'Luca', opened: '2026-09-28T09:00:00Z' },
  { path: '/Users/luca/Novels/Letters from Rome', title: 'Letters from Rome', author: 'Luca', opened: '2026-09-02T09:00:00Z' },
];
// Overlay: a mouse pointer (headless Chromium draws none) and the caption card, on every load.
const overlay = () => addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style'); st.textContent = '.actions + p.note { display: none !important }'; document.head.append(st);
  const cur = document.createElement('div');
  cur.id = 'rec-cursor';
  cur.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M2 2 L2 24 L8 18.5 L12 28 L16 26.3 L12 17 L20 17 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  Object.assign(cur.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.35))', transition: 'transform .12s' });
  const ring = document.createElement('div');
  Object.assign(ring.style, { position: 'fixed', width: '34px', height: '34px', marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%', background: 'rgba(217,72,15,.35)', zIndex: 2147483646, pointerEvents: 'none', opacity: 0, transform: 'scale(.4)', transition: 'opacity .35s, transform .35s' });
  const cap = document.createElement('div');
  cap.id = 'rec-caption';
  Object.assign(cap.style, { position: 'fixed', left: '28px', bottom: '96px', zIndex: 2147483645, pointerEvents: 'none', background: 'rgba(28,32,40,.92)', color: '#fff', font: '600 26px/1.2 Inter, system-ui, sans-serif', padding: '14px 22px 14px 18px', borderRadius: '10px', borderLeft: '5px solid #d9480f', boxShadow: '0 6px 24px rgba(0,0,0,.25)', opacity: 0, transform: 'translateY(12px)', transition: 'opacity .45s, transform .45s', letterSpacing: '.2px' });
  document.documentElement.append(ring, cur, cap);
  const at = (e) => { cur.style.left = e.clientX - 2 + 'px'; cur.style.top = e.clientY - 2 + 'px'; };
  for (const ev of ['mousemove', 'dragover', 'drag']) addEventListener(ev, at, true);
  addEventListener('mousedown', (e) => { ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px'; ring.style.transition = 'none'; ring.style.opacity = 1; ring.style.transform = 'scale(.4)'; requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.transition = 'opacity .45s, transform .45s'; ring.style.opacity = 0; ring.style.transform = 'scale(1.3)'; })); }, true);
  window.__caption = (t) => { if (!t) { cap.style.opacity = 0; cap.style.transform = 'translateY(12px)'; return; } cap.textContent = t; cap.style.opacity = 1; cap.style.transform = 'none'; };
});
const { b, page: p } = await launch([[fakeTauri, RECENT], [overlay]]);
fs.rmSync('frames', { recursive: true, force: true }); fs.mkdirSync('frames');

let mx = 720, my = 500;
const wait = (ms) => p.waitForTimeout(ms);
async function moveTo(x, y, steps) { const d = Math.hypot(x - mx, y - my); await p.mouse.move(x, y, { steps: steps ?? Math.max(8, Math.round(d / 18)) }); mx = x; my = y; }
async function point(loc, dx = 0.5, dy = 0.5) { await loc.scrollIntoViewIfNeeded(); const r = await loc.boundingBox(); if (!r) throw new Error('no box'); await moveTo(r.x + r.width * dx, r.y + r.height * dy); await wait(180); return r; }
async function click(loc, opts = {}) { await point(loc, opts.dx, opts.dy); await p.mouse.down(); await wait(60); await p.mouse.up(); await wait(opts.after ?? 600); }
async function drag(from, to, dy = 0.5) { await point(from); await p.mouse.down(); await wait(150); const r = await to.boundingBox(); await moveTo(r.x + r.width / 2, r.y + r.height * dy, 35); await wait(250); await p.mouse.up(); await wait(800); }
const type = (t, delay = 55) => p.keyboard.type(t, { delay });
const btn = (name, exact = true) => p.getByRole('button', { name, exact }).first();
const text = (t) => p.getByText(t, { exact: true }).first();
const nav = (name) => click(p.locator('nav[aria-label=Sections]').getByRole('button', { name, exact: true }));
const line = (t) => p.locator('.cm-line', { hasText: t }).first();

// Frames from the compositor, saved with their time.
const cdp = await p.context().newCDPSession(p);
const frames = []; let recording = false;
cdp.on('Page.screencastFrame', async (f) => { cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); if (!recording) return; const n = frames.length; fs.writeFileSync(`frames/${String(n).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64')); frames.push(f.metadata.timestamp); });
const marks = [];
const now = () => Date.now() / 1000;
let sceneStart = 0;
async function scene(n, fn) {

  const s = SCENES[n - 1];
  sceneStart = now(); marks.push({ n, start: sceneStart });
  await p.evaluate((t) => window.__caption(t), s.caption);
  await fn();
  const left = s.min - (now() - sceneStart); if (left > 0) await wait(left * 1000);
  await p.evaluate(() => window.__caption(''));
  await wait(450);
  marks[marks.length - 1].end = now();
  await p.screenshot({ path: `t-${n}.png` }).catch(() => {});
}

await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
await card(true); await wait(900); recording = true; const t0 = now();
await moveTo(900, 620, 2);

// A title card: the app's icon, the name and the motto.
async function card(show) {
  await p.evaluate(({ icon, show }) => {
    let d = document.getElementById('rec-card');
    if (!d) {
      d = document.createElement('div'); d.id = 'rec-card';
      d.innerHTML = `<div style="width:220px;height:220px">${icon}</div><div style="margin-top:28px;font:400 120px/1 Georgia,serif;color:#1d232c">Dante</div><div style="margin-top:22px;font:500 34px/1.3 Inter,system-ui,sans-serif;color:#555">Write your novel.</div>`;
      Object.assign(d.style, { position: 'fixed', inset: 0, zIndex: 2147483640, background: '#faf9f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: show ? 0 : 1, transition: 'opacity .8s' });
      d.querySelector('svg').setAttribute('width', '220'); d.querySelector('svg').setAttribute('height', '220');
      document.documentElement.append(d);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => (d.style.opacity = show ? 1 : 0)));
  }, { icon: ICON, show });
}

await wait(3000); await card(false); await wait(1000);

await scene(1, async () => {
  await wait(800);
  await point(btn('New project')); await wait(1300);
  await point(p.locator('.recent .item').first()); await wait(1100);
  await point(p.locator('.recent .item').nth(2)); await wait(1000);
  await point(text('Import from Word…')); await wait(900);
});
await scene(2, async () => {
  await p.evaluate(() => sessionStorage.setItem('desktop', '0'));
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate((t) => window.__caption(t), SCENES[1].caption);
  await moveTo(mx + 1, my + 1, 1);
  await click(text('Import from Word…'), { after: 300 });
  await p.locator('input[type=file]').first().setInputFiles('The Lighthouse.docx'); await wait(1600);
  await point(p.getByText(/I found 2 parts/)); await wait(1800);
  await point(p.locator('select').first()); await wait(1500);
  await point(p.locator('select').nth(1)); await wait(1500);
  await point(text('Title')); await wait(600);
  await click(btn('Cancel'));
});

await scene(3, async () => {
  await click(text('Try the sample project'), { after: 1500 });
  await click(text('A truth universally acknowledged'), { after: 900 });
  await point(p.locator('aside.tree'), 0.5, 0.35); await wait(1200);
  await point(text('Chapter 3: The assembly')); await wait(900);
  await point(p.locator('main.center'), 0.5, 0.45); await wait(1200);
  await point(p.locator('aside.side'), 0.5, 0.3); await wait(1200);
});

await scene(4, async () => {
  await click(line('Mr. Bennet made no answer.'), { dx: 0.98, after: 300 });
  await p.keyboard.press('End');
  await type(' He went on reading his newspaper.');
  await wait(500);
  // select "newspaper", without the full stop
  await p.keyboard.press('End'); await p.keyboard.press('ArrowLeft');
  await p.keyboard.down('Shift'); for (let i = 0; i < 9; i++) await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift');
  await wait(700);
  await click(p.getByRole('button', { name: 'Italic (⌘I)' }).first(), { after: 900 });
  await click(line('Mr. Bennet replied that he had not.'), { dx: 0.5, after: 1200 });
});

await scene(5, async () => {
  await click(btn('Focus'), { after: 300 });
  await click(line('But it is,'), { dx: 0.3, after: 1500 });
  await click(btn('Focus'), { after: 200 });
  await click(btn('Typewriter'), { after: 300 });
  await click(line('You want to tell me'), { dx: 0.3, after: 1500 });
  await click(btn('Typewriter'), { after: 200 });
  await click(btn('Full screen'), { after: 2600 });
  await p.keyboard.press('Escape'); await wait(800);
});

await scene(6, async () => {
  await click(text('After the ball'), { after: 900 });
  await click(line('Here she was interrupted again.'), { dx: 0.02, after: 300 }); await p.keyboard.press('Home');
  await click(p.getByRole('button', { name: /Split into scene/ }).first(), { after: 1300 });
  await drag(p.locator('aside.tree').getByText('Untitled scene', { exact: true }).first(), p.locator('aside.tree').getByText('Jane and Elizabeth', { exact: true }).first(), 0.2);
  await wait(800);
});

await scene(7, async () => {
  await click(text('The ball'), { after: 900 });
  await point(p.getByPlaceholder('What happens here, in a few lines')); await wait(900);
  await point(p.locator('aside.side select').first()); await wait(700);
  await point(p.getByLabel('pov', { exact: true })); await wait(600);
  await click(p.getByPlaceholder('Name', { exact: true }), { after: 200 });
  await type('season', 80);
  await click(btn('Add property'), { after: 700 });
  await click(p.locator('aside.side .prop', { hasText: 'season' }).locator('button.kind'), { after: 600 });
  const kind = p.locator('aside.side .def select').first();
  await point(kind); await kind.selectOption('text'); await wait(600);
  const vals = p.getByPlaceholder('Separated by commas; empty allows anything').last();
  await click(vals, { after: 200 });
  await type('spring, summer, autumn, winter', 45);
  await p.keyboard.press('Enter'); await wait(500);
  await click(p.locator('aside.side .prop', { hasText: 'season' }).locator('button.kind'), { after: 500 });
  const sel = p.getByLabel('season', { exact: true });
  await point(sel); await sel.selectOption('autumn').catch((e) => console.log('season select', e.message)); await wait(1000);
});

await scene(8, async () => {
  await nav('Story Bible');
  await click(text('Elizabeth Bennet'), { after: 1300 });
  await point(p.locator('aside.side'), 0.5, 0.25); await wait(800);
  await click(p.getByRole('button', { name: /‹ Character/ }).first(), { after: 700 });
  await click(p.getByPlaceholder('New type'), { after: 200 }); await type('Letter', 80);
  await click(btn('Add'), { after: 700 });
  await click(btn('Edit type'), { after: 600 });
  const ins = p.locator('main input');
  await click(ins.nth(2), { after: 150 }); await type('✉️', 0);
  await click(ins.nth(3), { after: 150 }); await type('from, to, date', 60);
  await click(btn('Save'), { after: 700 });
  await click(p.getByRole('button', { name: 'New Letter' }), { after: 500 });
  await type('Darcy’s letter', 70); await p.keyboard.press('Enter'); await wait(400); await moveTo(960, 420); await wait(1100);
});

await scene(9, async () => {
  await nav('Manuscript');
  await click(text('A truth universally acknowledged'), { after: 900 });
  await click(line('Mr. Bennet replied that he had not.'), { dx: 0.9, after: 200 }); await p.keyboard.press('End');
  await type(' Nobody at Longbourn talked of anything but [[Nether', 70); await wait(900);
  await p.keyboard.press('Enter'); await wait(500); await type('.', 0); await wait(600);
  await click(p.locator('.cm-content .md-wikilink').first(), { after: 700 });
  await click(text('Preview'), { after: 2200 });
  await p.keyboard.press('Escape'); await wait(300);
  await click(p.locator('button', { hasText: 'Sheets' }).first(), { after: 2200 });
  await click(p.locator('button', { hasText: 'Sheets' }).first(), { after: 300 });
  await moveTo(1000, 560); await wait(300);
});

await scene(10, async () => {
  await nav('Views');
  await wait(800);
  const col = (t) => p.locator(`main :text-is("${t}"):visible`).first();
  await drag(col('After the ball'), col('revised'), 2.5);
  await click(p.locator(':text-is("Scenes"):visible').first(), { after: 1600 });
  await click(p.locator(':text-is("Story time"):visible').first(), { after: 2000 });
});

await scene(11, async () => {
  await nav('Statistics'); await wait(1800);
  await p.mouse.wheel(0, 500); await wait(1500);
  await nav('Manuscript');
  await click(text('The ball'), { after: 600 });
  await click(p.locator('aside.side').getByText('Comments').first(), { after: 1800 });
  await click(text('Talking over the ball'), { after: 2000 });
  await point(p.getByText(/is editing this scene/)); await wait(1200);
});

await scene(12, async () => {
  await nav('Export'); await wait(700);
  await click(p.locator(':text-is("PDF"):visible').first(), { after: 600 });
  await point(p.locator('select:visible').first()); await p.locator('select:visible').first().selectOption({ index: 1 }).catch(() => {}); await wait(1000);
  await moveTo(700, 600); await p.mouse.wheel(0, 420); await wait(1400);
  await click(p.locator(':text-is("EPUB"):visible').first(), { after: 1200 });
  await p.evaluate(() => (document.getElementById('rec-caption').style.opacity = 0));
  await card(true);
  await moveTo(1500, 900); await wait(3500);
});

recording = false; const t1 = now();
await cdp.send('Page.stopScreencast');
await b.close();
fs.writeFileSync('timeline.json', JSON.stringify({ t0, t1, frames, marks }, null, 1));
console.log('frames', frames.length, 'seconds', (t1 - t0).toFixed(1), 'first frame', frames[0], 't0', t0);
