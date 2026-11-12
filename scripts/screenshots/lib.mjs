// Playwright is not a dependency of Dante: point PLAYWRIGHT at an installed copy if `playwright` does not resolve.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
/** GUIDE_LANG=en takes the shots of the English guide, from the English interface and sample. */
export const EN = process.env.GUIDE_LANG === 'en';
/** The Italian or the English of a label or of a text of the sample. */
export const P = (it, en) => (EN ? en : it);
/** Where the raw shots go. */
export const SHOTS = EN ? 'shots-en/f-' : 'shots/f-';
export async function start(opts = {}) {
  const b = await chromium.launch({ channel: 'chromium', args: [EN ? '--lang=en-GB' : '--lang=it-IT', '--font-render-hinting=none'] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, locale: EN ? 'en-GB' : 'it-IT', deviceScaleFactor: 2, colorScheme: 'light', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' });
  const page = await ctx.newPage();
  page.on('console', m => { if (process.env.LOG) console.log(m.text()); });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.addInitScript((s) => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('dante.layout', JSON.stringify({ wideNav: false })); localStorage.setItem('dante.app-settings', JSON.stringify(s)); sessionStorage.setItem('init','1'); } },
    { language: EN ? 'en' : 'it', userName: 'Luca', theme: 'light', checkUpdates: false, ...(opts.settings||{}) });
  if (opts.fakeTauri) await page.addInitScript((recent) => {
    localStorage.setItem('dante.recent-projects', JSON.stringify(recent));
    const yaml = Object.fromEntries(recent.map((r) => [r.path, `title: ${JSON.stringify(r.title)}\nauthor: Luca\nlanguage: ${r.language}\n`]));
    window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }, transformCallback: () => 0,
      invoke: async (cmd, args) => { console.log('invoke', cmd, JSON.stringify(args)); if (window.__files) { const f = window.__files, rel = args?.path ?? '';
        if (cmd === 'plugin:path|resolve_directory') return '/Users/luca/Documents'; if (cmd === 'plugin:path|join') return args.paths.join('/'); if (cmd === 'plugin:path|dirname') return args.path.split('/').slice(0, -1).join('/');
        if (cmd === 'list_backups') return { dir: args.dest + '/' + args.name, latest: window.__backups[0], count: window.__backups.length };
        if (cmd === 'list_dir' && args.root.includes('Dante backup')) return window.__backups.map((name) => ({ path: name, name, isDir: false }));
        if (cmd === 'list_dir') { const pre = rel ? rel + '/' : ''; const names = new Set(Object.keys(f).filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length).split('/')[0])); return [...names].map((name) => ({ path: pre + name, name, isDir: !(pre + name in f) })); }
        if (cmd === 'read_text') { if (rel in f) return f[rel]; throw new Error('not found ' + rel); }
        if (cmd === 'path_exists') return rel === '' || Object.keys(f).some((k) => k === rel || k.startsWith(rel + '/'));
        if (cmd === 'file_signatures') return Object.fromEntries(Object.keys(f).map((k) => [k, '1']));
        if (cmd === 'write_text') { f[rel] = args.content; return null; }
        if (cmd === 'read_bytes') throw new Error('not found ' + rel);
      }
      if (cmd === 'read_text') return yaml[args.root] ?? 'title: x\n'; if (cmd === 'path_exists') return true; if (cmd==='list_dir') return []; if (cmd==='plugin:app|version') return '1.0.3'; if (cmd==='updates_supported') return !!window.__updates; if (cmd==='check_update') return { rid: 1, currentVersion: '1.0.3', version: '1.1.0', body: '', rawJson: { news: { it: [{ version: '1.1.0', notes: ['**Copertina**: immagine, testi e colori.'] }], en: [{ version: '1.1.0', notes: ['**Cover**: picture, texts and colours.'] }] } } }; return null; } };
  }, EN
    ? [{ path: '/Users/luca/Novels/The Inheritance', title: 'The Inheritance', language: 'en', opened: '2026-10-17T09:00:00Z' }, { path: '/Users/luca/Novels/The Lighthouse', title: 'The Lighthouse', language: 'en', opened: '2026-10-02T09:00:00Z' }]
    : [{ path: "/Users/luca/Romanzi/L'eredità", title: "L'eredità", language: 'it', opened: '2026-10-17T09:00:00Z' }, { path: '/Users/luca/Romanzi/Il faro', title: 'Il faro', language: 'it', opened: '2026-10-02T09:00:00Z' }]);
  // A folder of the browser's private storage stands in for the folder the user would choose.
  if (opts.picker) await page.addInitScript((name) => {
    const handles = new Map();
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (value instanceof FileSystemHandle) { const id = `shot-handle:${handles.size}`; handles.set(id, value); value = id; }
      return put.call(this, value, key);
    };
    const result = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'result');
    const back = (x) => (typeof x === 'string' && handles.has(x) ? handles.get(x) : x);
    Object.defineProperty(IDBRequest.prototype, 'result', { configurable: true, get() { const r = result.get.call(this); return Array.isArray(r) ? r.map(back) : back(r); } });
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
  }, opts.picker);
  // A small novel kept in memory stands in for a folder of the computer, with its backups.
  if (opts.project) await page.addInitScript(([files, backups]) => { window.__files = files; window.__backups = backups; }, [opts.project.files, opts.project.backups ?? []]);
  if (opts.updates) await page.addInitScript(() => { window.__updates = true; });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(1500);
  if (opts.sample !== false && !opts.fakeTauri) { await page.getByText(EN ? 'Try the sample project' : 'Prova il progetto di esempio').click(); await page.waitForTimeout(1500); }
  return { b, page };
}

/** Numbered badges and outlines over parts of the page, as in a labelled figure. */
export async function badges(page, marks) {
  await page.evaluate((marks) => {
    for (const [sel, n, opt] of marks) {
      const el = document.querySelector(sel); if (!el) { console.log('missing ' + sel); continue; }
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      Object.assign(box.style, { position: 'fixed', left: r.left + 3 + 'px', top: r.top + 3 + 'px', width: r.width - 6 + 'px', height: r.height - 6 + 'px', border: '3px solid #d9480f', borderRadius: '6px', zIndex: 99999, pointerEvents: 'none', boxSizing: 'border-box' });
      const b = document.createElement('div');
      b.textContent = n;
      const dx = opt?.dx ?? 0, dy = opt?.dy ?? 0;
      Object.assign(b.style, { position: 'fixed', left: r.left + r.width / 2 - 18 + dx + 'px', top: r.top + (opt?.top ? 10 : r.height / 2 - 18) + dy + 'px', width: '36px', height: '36px', borderRadius: '50%', background: '#d9480f', color: '#fff', font: 'bold 20px/36px sans-serif', textAlign: 'center', zIndex: 100000, boxShadow: '0 1px 4px rgba(0,0,0,.4)' });
      if (!opt?.nobox) document.body.append(box);
      document.body.append(b);
    }
  }, marks);
}
export async function clip(page, path, x, y, w, h) { await page.screenshot({ path, clip: { x, y, width: w, height: h } }); }
