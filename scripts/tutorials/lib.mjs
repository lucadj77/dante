// The common part of the tutorials: opens Dante in Chromium, draws the pointer, the highlight box with
// its text, the section titles and the zoom, and saves the frames with their times.
// One script per video in videos/ uses it; run.mjs starts it. FAST=1 runs the path without the pauses
// and without saving frames; SHOT=file.png saves the page when a step fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
export const FAST = process.env.FAST === '1';
export const URL = process.env.DANTE_URL ?? 'http://127.0.0.1:5173/';
export const AUTHOR = 'Luca Di Gialleonardo';
export const ICON = fs.readFileSync(path.join(ROOT, 'src-tauri/icons/icon.svg'), 'utf8');

const { en } = await import(path.join(ROOT, 'src/lib/i18n/en.ts'));
const { it } = await import(path.join(ROOT, 'src/lib/i18n/it.ts'));
const MESSAGES = { en, it };

/** Seconds a text stays on screen: slow, in proportion to its length. */
export const readTime = (text) => (FAST ? 0.05 : Math.min(10, Math.max(3, 1.6 + text.length * 0.065)));

// The desktop app's welcome, with recent projects and their covers: a pretend Tauri answers its calls,
// until the page is reloaded as the plain browser app (sessionStorage desktop = 0).
function fakeTauri({ recent, answers }) {
  if (sessionStorage.getItem('desktop') !== '1') return;
  localStorage.setItem('dante.recent-projects', JSON.stringify(recent.map(({ path, title, opened }) => ({ path, title, opened }))));
  const yaml = Object.fromEntries(recent.map((r) => [r.path, `title: ${r.title}\nauthor: ${r.author}\nlanguage: ${r.language}\n`]));
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    transformCallback: () => 0,
    invoke: async (cmd, args) =>
      cmd in answers ? answers[cmd] : cmd === 'read_text' ? (yaml[args.root] ?? 'title: x\n') : cmd === 'path_exists' ? true : cmd === 'list_dir' ? [] : cmd === 'plugin:app|version' ? '1.0.0' : null,
  };
}

// The folder picker of the browser cannot be driven: it answers with a folder in the page's own storage.
// Chromium here closes the page when it reads such a folder back from IndexedDB, so the page keeps
// the folders itself and IndexedDB only a name for each (enough while the page is not reloaded).
function fakePicker() {
  const handles = new Map();
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    if (value instanceof FileSystemHandle) {
      const id = `tu-handle:${handles.size}`;
      handles.set(id, value);
      value = id;
    }
    return put.call(this, value, key);
  };
  const result = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'result');
  const back = (x) => (typeof x === 'string' && handles.has(x) ? handles.get(x) : x);
  Object.defineProperty(IDBRequest.prototype, 'result', {
    configurable: true,
    get() { const r = result.get.call(this); return Array.isArray(r) ? r.map(back) : back(r); },
  });
  window.showDirectoryPicker = async () => {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(sessionStorage.getItem('folder') || 'Romanzi', { create: true });
  };
}

// Pointer, click ring, highlight box with its text, section title and the black of the fades.
function overlay() {
  addEventListener('DOMContentLoaded', () => {
    const css = document.createElement('style');
    css.textContent = `
      #tu-cursor { position: fixed; left: -40px; top: -40px; z-index: 2147483647; pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)) }
      #tu-ring { position: fixed; width: 38px; height: 38px; margin: -19px 0 0 -19px; border-radius: 50%; background: rgba(217,72,15,.38); z-index: 2147483646; pointer-events: none; opacity: 0 }
      #tu-box { position: fixed; z-index: 2147483600; pointer-events: none; border: 4px solid #d9480f; border-radius: 10px; box-shadow: 0 0 0 100vmax rgba(20,22,28,.38); opacity: 0; transition: opacity .5s, left .6s, top .6s, width .6s, height .6s }
      #tu-note { position: fixed; z-index: 2147483601; pointer-events: none; max-width: 520px; background: #fff; color: #1d232c; font: 600 30px/1.3 Inter, system-ui, sans-serif; padding: 18px 24px; border-radius: 12px; border-left: 7px solid #d9480f; box-shadow: 0 10px 34px rgba(0,0,0,.28); opacity: 0; transition: opacity .5s }
      #tu-title { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #faf9f6; opacity: 0; transition: opacity .7s }
      #tu-title b { font: 400 76px/1.15 Georgia, serif; color: #1d232c; text-align: center; max-width: 1200px }
      #tu-title i { margin-top: 26px; font: 500 30px/1.3 Inter, system-ui, sans-serif; color: #666; font-style: normal; text-align: center; max-width: 1000px }
      #tu-title::before { content: ''; width: 90px; height: 6px; background: #d9480f; border-radius: 3px; margin-bottom: 36px }
      body { transition: transform .9s ease-in-out }`;
    document.head.append(css);
    const el = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; document.documentElement.append(d); return d; };
    const cur = el('tu-cursor', '<svg width="24" height="32" viewBox="0 0 22 30"><path d="M2 2 L2 24 L8 18.5 L12 28 L16 26.3 L12 17 L20 17 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>');
    const ring = el('tu-ring'), box = el('tu-box'), note = el('tu-note');
    const title = el('tu-title', '<b></b><i></i>');
    const at = (e) => { cur.style.left = e.clientX - 2 + 'px'; cur.style.top = e.clientY - 2 + 'px'; };
    for (const ev of ['mousemove', 'dragover', 'drag']) addEventListener(ev, at, true);
    addEventListener('mousedown', (e) => {
      ring.animate([{ left: e.clientX + 'px', top: e.clientY + 'px', opacity: 1, transform: 'scale(.4)' }, { left: e.clientX + 'px', top: e.clientY + 'px', opacity: 0, transform: 'scale(1.4)' }], { duration: 500 });
    }, true);
    window.__tu = {
      box(r, text, side) {
        if (!r) { box.style.opacity = 0; note.style.opacity = 0; return; }
        const pad = 8;
        Object.assign(box.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px', opacity: 1 });
        note.textContent = text || '';
        note.style.opacity = text ? 1 : 0;
        if (!text) return;
        const W = innerWidth, H = innerHeight, nw = Math.min(520, note.offsetWidth), nh = note.offsetHeight, gap = 26;
        const fits = { right: r.x + r.width + gap + nw < W - 20, left: r.x - gap - nw > 20, below: r.y + r.height + gap + nh < H - 20, above: r.y - gap - nh > 20 };
        const s = side && fits[side] ? side : ['right', 'below', 'left', 'above'].find((k) => fits[k]) ?? 'inside';
        let x = 0, y = 0;
        if (s === 'right') { x = r.x + r.width + gap; y = r.y + r.height / 2 - nh / 2; }
        if (s === 'left') { x = r.x - gap - nw; y = r.y + r.height / 2 - nh / 2; }
        if (s === 'below') { x = r.x + r.width / 2 - nw / 2; y = r.y + r.height + gap; }
        if (s === 'above') { x = r.x + r.width / 2 - nw / 2; y = r.y - gap - nh; }
        if (s === 'inside') { x = W / 2 - nw / 2; y = H - nh - 40; }
        note.style.left = Math.max(20, Math.min(W - nw - 20, x)) + 'px';
        note.style.top = Math.max(20, Math.min(H - nh - 20, y)) + 'px';
      },
      title(big, small) {
        if (big === null) { title.style.opacity = 0; return; }
        title.querySelector('b').textContent = big;
        title.querySelector('i').textContent = small || '';
        title.style.opacity = 1;
      },
      zoom(r, scale) {
        if (!r) { document.body.style.transform = ''; return; }
        document.body.style.transformOrigin = `${r.x + r.width / 2}px ${r.y + r.height / 2}px`;
        document.body.style.transform = `scale(${scale})`;
      },
    };
  });
}

/** Opens Dante in `lang` and returns the helpers of a tutorial. */
export async function start({ lang, desktop = false, recent = [], answers = {}, settings = {}, folder = 'Romanzi', out }) {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 4 / 3,
    locale: lang === 'it' ? 'it-IT' : 'en-US',
    colorScheme: 'light',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message));
  p.on('crash', () => console.log('page crashed'));
  p.on('console', (m) => process.env.TRACE && console.log('console:', m.text()));
  await p.addInitScript(({ lang, settings, desktop, folder }) => {
    if (sessionStorage.getItem('init')) return;
    localStorage.clear();
    localStorage.setItem('dante.app-settings', JSON.stringify({ language: lang, userName: 'Luca', theme: 'light', checkUpdates: false, ...settings }));
    sessionStorage.setItem('desktop', desktop ? '1' : '0');
    sessionStorage.setItem('folder', folder);
    sessionStorage.setItem('init', '1');
  }, { lang, settings, desktop, folder });
  await p.addInitScript(fakeTauri, { recent, answers });
  await p.addInitScript(fakePicker);
  await p.addInitScript(overlay);
  await p.goto(URL);
  await p.waitForTimeout(1500);

  const M = MESSAGES[lang];
  /** The label of the interface in this language, as Dante shows it on a Mac. */
  const L = (key, values = {}) => (M[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (m, n) => (n in values ? String(values[n]) : m));

  // Frames taken one after another while recording, each with its time. The screencast sends only the
  // 1440x810 CSS pixels; a screenshot clipped at scale 4/3 draws the page again at 1920x1080.
  const frames = [];
  let recording = false;
  const dir = out && path.join(out, 'frames');
  if (dir && !FAST) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
  const cdp = await ctx.newCDPSession(p);
  const capture = async () => {
    while (recording) {
      const at = Date.now() / 1000;
      // the clip is measured on the whole document: it follows the page when the document scrolls
      const view = (await cdp.send('Page.getLayoutMetrics').catch(() => null))?.cssVisualViewport;
      const clip = { x: view?.pageX ?? 0, y: view?.pageY ?? 0, width: 1440, height: 810, scale: 4 / 3 };
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true, clip }).catch(() => null);
      if (!recording) break;
      // a reload drops a shot or two: wait for the new page instead of stopping
      if (!shot) { await new Promise((r) => setTimeout(r, 50)); continue; }
      fs.writeFileSync(path.join(dir, `${String(frames.length).padStart(6, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
      frames.push(at);
    }
  };

  let mx = 720, my = 460;
  const wait = (s) => p.waitForTimeout(FAST ? Math.min(s * 1000, 250) : s * 1000);
  const moveTo = async (x, y, steps) => {
    const d = Math.hypot(x - mx, y - my);
    await p.mouse.move(x, y, { steps: FAST ? 1 : (steps ?? Math.max(10, Math.round(d / 14))) });
    mx = x; my = y;
  };
  // The element's box, after scrolling it to the middle of its container when it is not all in
  // sight, so the viewer sees the page move; a box taller than the window is cut to what shows.
  const box = async (loc) => {
    await loc.waitFor({ state: 'attached', timeout: 8000 });
    const hidden = await loc.evaluate((e) => {
      const r = e.getBoundingClientRect();
      // something taller than the window moves only when none of it shows
      if (r.height > innerHeight - 100) return r.bottom < 60 || r.top > innerHeight - 40 ? 'start' : '';
      return r.top < 60 || r.bottom > innerHeight - 40 || r.left < 0 || r.right > innerWidth ? 'center' : '';
    });
    if (hidden) {
      await loc.evaluate((e, block) => e.scrollIntoView({ block, inline: 'nearest', behavior: 'smooth' }), hidden);
      await wait(0.9);
    }
    await loc.scrollIntoViewIfNeeded({ timeout: 8000 });
    const r = await loc.boundingBox({ timeout: 8000 });
    if (!r) throw new Error('element without a box');
    const top = Math.max(r.y, 4), bottom = Math.min(r.y + r.height, 810 - 4);
    return { x: r.x, y: top, width: r.width, height: Math.max(bottom - top, 10) };
  };
  // one element, or several: the box around all of them
  const around = async (loc) => {
    const boxes = [];
    for (const l of [loc].flat()) boxes.push(await box(l));
    const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
    return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
  };
  // PEEK=dir saves the page before each section title and at the end, to check a FAST run
  let peeks = 0;
  const peek = async () => { if (process.env.PEEK) await p.screenshot({ path: path.join(process.env.PEEK, `${String(++peeks).padStart(2, '0')}.png`) }); };
  const point = async (loc, dx = 0.5, dy = 0.5) => { const r = await box(loc); await moveTo(r.x + r.width * dx, r.y + r.height * dy); await wait(0.25); return r; };

  const t = {
    page: p, lang, L, wait, moveTo, point,
    /** A button, by its exact label (or a regular expression). */
    button: (name, exact = true) => p.getByRole('button', { name, exact }).first(),
    text: (s) => p.getByText(s, { exact: true }).first(),
    line: (s) => p.locator('.cm-line', { hasText: s }).first(),
    nav: (key) => t.click(p.locator('nav[aria-label]').first().getByRole('button', { name: L(key), exact: true })),
    async click(loc, { dx, dy, after = 0.7 } = {}) { await point(loc, dx, dy); await p.mouse.down(); await wait(0.07); await p.mouse.up(); await wait(after); },
    async type(s, delay = 70) { await p.keyboard.type(s, { delay: FAST ? 0 : delay }); },
    async press(keys, after = 0.5) { await p.keyboard.press(keys); await wait(after); },
    async drag(from, to, { dy = 0.5 } = {}) {
      await point(from); await p.mouse.down(); await wait(0.2);
      const r = await box(to); await moveTo(r.x + r.width / 2, r.y + r.height * dy, 40); await wait(0.3);
      await p.mouse.up(); await wait(0.9);
    },
    /** A box around the element with a text beside it, held long enough to read. */
    async focus(loc, text, { side, hold, pointer = true } = {}) {
      const r = await around(loc);
      if (pointer) await moveTo(r.x + r.width / 2, r.y + r.height / 2);
      await p.evaluate(([r, text, side]) => window.__tu.box(r, text, side), [r, text, side]);
      await wait(hold ?? readTime(text ?? ''));
      await p.evaluate(() => window.__tu.box(null));
      await wait(0.5);
    },
    /** Shows a text in the middle of the bottom, with no box: for what the screen cannot show. */
    async say(text, { hold } = {}) {
      await p.evaluate((text) => window.__tu.box({ x: innerWidth / 2, y: innerHeight - 40, width: 0, height: 0 }, text, 'above'), text);
      await p.evaluate(() => { document.getElementById('tu-box').style.opacity = 0; });
      await wait(hold ?? readTime(text));
      await p.evaluate(() => window.__tu.box(null));
      await wait(0.5);
    },
    /** A section title over the whole page; `after` runs once it is gone, so every click is seen. */
    async title(big, small = '', after) {
      await peek();
      await p.evaluate(([b, s]) => window.__tu.title(b, s), [big, small]);
      await wait(Math.max(2.5, readTime(big + ' ' + small) - 1));
      await p.evaluate(() => window.__tu.title(null));
      await wait(1.1);
      if (after) await after();
    },
    /** Enlarges the page around the element while `fn` runs. */
    async zoom(loc, fn, scale = 1.8) {
      const r = await around(loc);
      await p.evaluate(([r, s]) => window.__tu.zoom(r, s), [r, scale]);
      await wait(1.1);
      try { await fn(); } finally { await p.evaluate(() => window.__tu.zoom(null)); await wait(1); }
    },
    /** Reloads as the plain browser app, leaving the pretend desktop. */
    async browserApp() { await p.evaluate(() => sessionStorage.setItem('desktop', '0')); await p.reload(); await p.waitForTimeout(1500); await moveTo(mx + 1, my + 1, 1); },
  };

  return {
    t,
    async record(fn) {
      recording = true;
      const capturing = !FAST && dir ? capture() : null;
      const t0 = Date.now() / 1000;
      await moveTo(900, 560, 2);
      await wait(1);
      try {
        await fn(t);
        await peek();
        await wait(1.5);
      } catch (e) {
        const shot = process.env.SHOT;
        if (shot) { await p.screenshot({ path: shot }); console.log('page saved in', shot); }
        throw e;
      } finally {
        recording = false;
        await capturing;
        if (dir && !FAST) fs.writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ t0, t1: Date.now() / 1000, frames }));
        await browser.close();
      }
    },
  };
}
