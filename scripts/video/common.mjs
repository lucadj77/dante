// Playwright is not a dependency of Dante: point PLAYWRIGHT at an installed copy if `playwright` does not resolve.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
export async function launch(init = []) {
  const b = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4/3, locale: 'en-US', colorScheme: 'light', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('dante.app-settings', JSON.stringify({ language: 'en', userName: 'Luca', theme: 'light', checkUpdates: false })); sessionStorage.setItem('init','1'); } });
  for (const [fn, arg] of init) await page.addInitScript(fn, arg);
  await page.goto('http://127.0.0.1:5173/'); await page.waitForTimeout(1500);
  return { b, ctx, page };
}
