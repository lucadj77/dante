// Playwright is not a dependency of Dante: point PLAYWRIGHT at an installed copy if `playwright` does not resolve.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
export async function start(opts = {}) {
  const b = await chromium.launch({ channel: 'chromium', args: ['--lang=it-IT', '--font-render-hinting=none'] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, locale: 'it-IT', deviceScaleFactor: 2, colorScheme: 'light', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' });
  const page = await ctx.newPage();
  page.on('console', m => { if (process.env.LOG) console.log(m.text()); });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.addInitScript((s) => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('dante.app-settings', JSON.stringify(s)); sessionStorage.setItem('init','1'); } },
    { language: 'it', userName: 'Luca', theme: 'light', checkUpdates: false, ...(opts.settings||{}) });
  if (opts.fakeTauri) await page.addInitScript((recent) => {
    localStorage.setItem('dante.recent-projects', JSON.stringify(recent));
    const yaml = { '/Users/luca/Romanzi/L\'eredità': "title: L'eredità\nauthor: Luca\nlanguage: it\n", '/Users/luca/Romanzi/Il faro': 'title: Il faro\nauthor: Luca\nlanguage: it\n' };
    window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }, transformCallback: () => 0,
      invoke: async (cmd, args) => { console.log('invoke', cmd, JSON.stringify(args)); if (cmd === 'read_text') return yaml[args.root] ?? 'title: x\n'; if (cmd === 'path_exists') return true; if (cmd==='list_dir') return []; if (cmd==='plugin:app|version') return '0.1.29'; if (cmd==='updates_supported') return !!window.__updates; if (cmd==='plugin:updater|check') return { rid: 1, currentVersion: '0.1.29', version: '0.1.30', date: null, body: '', rawJson: {} }; return null; } };
  }, [{ path: "/Users/luca/Romanzi/L'eredità", title: "L'eredità", opened: '2026-10-17T09:00:00Z' }, { path: '/Users/luca/Romanzi/Il faro', title: 'Il faro', opened: '2026-10-02T09:00:00Z' }]);
  if (opts.updates) await page.addInitScript(() => { window.__updates = true; });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(1500);
  if (opts.sample !== false && !opts.fakeTauri) { await page.getByText(opts.settings?.language === 'en' ? 'Try the sample project' : 'Prova il progetto di esempio').click(); await page.waitForTimeout(1500); }
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
