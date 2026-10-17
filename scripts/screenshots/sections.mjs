import { start, badges, clip } from './lib.mjs';
// Raw shots; finalize.py crops them into docs/img.
const S='shots/f-';
const open = async (page, t) => { await page.getByText(t, { exact: true }).first().click(); await page.waitForTimeout(800); };
const nav = async (page, name) => { await page.getByRole('button', { name, exact: true }).first().click(); await page.waitForTimeout(900); };
const only = process.argv[2];
const run = (n) => !only || only.split(',').includes(n);

if (run('istantanee')) { const { b, page } = await start();
  await open(page, 'Perpetua');
  await page.getByPlaceholder('Nome (facoltativo)').fill('Prima stesura');
  await page.getByRole('button', { name: /Crea istantanea/ }).click(); await page.waitForTimeout(500);
  const l = page.locator('.cm-line', { hasText: '«La vita!»' }).first(); await l.click(); await page.keyboard.press('End');
  await page.keyboard.type(' esclamò Perpetua.'); await page.waitForTimeout(1500);
  const sb = await page.locator('aside.side').boundingBox();
  await page.locator('aside.side').getByText('Istantanee', { exact: true }).first().scrollIntoViewIfNeeded();
  const h = await page.locator('aside.side').getByText('Istantanee', { exact: true }).first().boundingBox();
  await clip(page, S+'istantanee.png', sb.x, h.y - 10, sb.width, 230);
  await page.getByRole('button', { name: /^Confronta/ }).first().click(); await page.waitForTimeout(700);
  { const d = await page.locator('[role=dialog]').first().boundingBox(); await clip(page, S+'confronta.png', d.x, d.y, d.width, Math.min(d.height, 330)); }
  await b.close(); }

if (run('proprieta')) { const { b, page } = await start();
  await open(page, 'L’incontro');
  const sb = await page.locator('aside.side').boundingBox();
  await clip(page, S+'proprieta.png', sb.x, sb.y, sb.width, 560);
  await page.locator('aside.side').getByRole('button', { name: 'T', exact: true }).first().click(); await page.waitForTimeout(500);
  await page.screenshot({ path: S+'tipo-proprieta-full.png' });
  await b.close(); }

if (run('bibbia')) { const { b, page } = await start();
  await nav(page, 'Bibbia');
  await page.screenshot({ path: S+'bibbia.png' });
  await page.getByText('Lucia Mondella', { exact: true }).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'scheda.png' });
  const link = page.locator('.cm-line').getByText('La casa di Lucia').first(); await link.click(); await page.waitForTimeout(600);
  const lb = await link.boundingBox(); const ed = await page.locator('main').first().boundingBox();
  await clip(page, S+'menu-collegamento.png', lb.x - 300, lb.y - 50, 720, 200);
  await page.getByText('Anteprima', { exact: true }).first().click(); await page.waitForTimeout(800);
  await clip(page, S+'anteprima.png', lb.x - 300, lb.y - 50, 720, 240);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cerca', exact: true }).first().click(); await page.waitForTimeout(400);
  await page.keyboard.type('Lucia'); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'cerca-full.png' });
  await b.close(); }

if (run('commenti')) { const { b, page } = await start();
  await open(page, 'L’incontro');
  await page.locator('aside.side').getByText('Commenti').first().click(); await page.waitForTimeout(700);
  await page.screenshot({ path: S+'commenti-full.png' });
  await page.getByText('1 copia in conflitto').first().click(); await page.waitForTimeout(800);
  { const d = await page.locator('[role=dialog]').first().boundingBox(); await clip(page, S+'conflitto.png', d.x, d.y, d.width, Math.min(d.height, 300)); }
  await b.close(); }

if (run('viste')) { const { b, page } = await start();
  await nav(page, 'Viste');
  await page.screenshot({ path: S+'bacheca-full.png' });
  await page.getByText('Tempo della storia', { exact: true }).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'linea-tempo-full.png' });
  await page.getByText('Scene', { exact: true }).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'tabella-vista-full.png' });
  await page.getByRole('button', { name: /Impostazioni/ }).last().click(); await page.waitForTimeout(700);
  await page.screenshot({ path: S+'vista-impostazioni-full.png' });
  await b.close(); }

if (run('stat')) { const { b, page } = await start();
  await nav(page, 'Statistiche');
  await page.screenshot({ path: S+'statistiche-full.png', fullPage: false });
  await page.getByText('Lunghezza', { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
  await page.screenshot({ path: S+'statistiche2-full.png' });
  await b.close(); }

if (run('export')) { const { b, page } = await start();
  await nav(page, 'Esportazione');
  await page.screenshot({ path: S+'esportazione-full.png' });
  await nav(page, 'Impostazioni');
  await page.getByText('Struttura', { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
  await page.screenshot({ path: S+'struttura-full.png' });
  await b.close(); }

if (run('pannelli')) { const { b, page } = await start();
  await open(page, 'L’incontro');
  await page.getByRole('button', { name: /Schede/ }).first().click(); await page.waitForTimeout(1200);
  await page.screenshot({ path: S+'pannelli-full.png' });
  await b.close(); }
