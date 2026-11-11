import { start, clip } from './lib.mjs';
import { BOOKS, bookFiles } from '../tutorials/assets/gamebook.mjs';
// Raw shots for the chapters on the browser, help, look and gamebooks; finalize.py crops them.
const S = 'shots/f-';
const only = process.argv[2];
const run = (n) => !only || only.split(',').includes(n);
const section = async (page, id) => { await page.locator(`nav button[data-section="${id}"]`).click(); await page.waitForTimeout(800); };

if (run('browser')) { const { b, page } = await start({ sample: false });
  await page.waitForTimeout(500);
  await page.locator('main').first().screenshot({ path: S + 'nel-browser.png' });
  await b.close(); }

if (run('aiuto')) { const { b, page } = await start();
  await section(page, 'help');
  await page.getByRole('tab', { name: 'Guida completa' }).click().catch(() => page.getByText('Guida completa', { exact: true }).first().click());
  await page.waitForTimeout(1200);
  await page.locator('[role=dialog]').first().screenshot({ path: S + 'aiuto.png' });
  await b.close(); }

if (run('aspetto')) { const { b, page } = await start();
  await section(page, 'settings');
  await page.getByRole('button', { name: 'Aspetto', exact: true }).first().click(); await page.waitForTimeout(800);
  await page.screenshot({ path: S + 'aspetto-full.png' });
  await b.close(); }

if (run('librogame')) { const { b, page } = await start({ sample: false, settings: { formatBar: true }, picker: BOOKS.it.title });
  const files = bookFiles('it');
  files['dante.yaml'] += 'gamebook:\n  enabled: true\n';
  await page.evaluate(async ({ files, name }) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
    for (const [path, text] of Object.entries(files)) {
      const parts = path.split('/');
      let dir = root;
      for (const x of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(x, { create: true });
      const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable();
      await w.write(text); await w.close();
    }
  }, { files, name: BOOKS.it.title });
  await page.getByText('Apri cartella…').first().click(); await page.waitForTimeout(2500);
  await page.locator('aside.tree').getByText('La scala', { exact: true }).first().click(); await page.waitForTimeout(1000);
  await page.screenshot({ path: S + 'libro-game-full.png' });
  await page.getByRole('button', { name: /Rimescola/ }).first().click(); await page.waitForTimeout(1000);
  await page.locator('[role=dialog]').first().screenshot({ path: S + 'rimescola.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Grafo/ }).first().click(); await page.waitForTimeout(3500);
  await page.screenshot({ path: S + 'grafo-full.png' });
  await b.close(); }
