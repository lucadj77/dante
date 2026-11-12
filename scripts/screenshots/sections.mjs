import { start, badges, clip, P, SHOTS } from './lib.mjs';
// Raw shots; finalize.py crops them into docs/img.
const S = SHOTS;
const open = async (page, t) => { await page.getByText(t, { exact: true }).first().click(); await page.waitForTimeout(800); };
const nav = async (page, name) => { await page.getByRole('button', { name, exact: true }).first().click(); await page.waitForTimeout(900); };
const only = process.argv[2];
const run = (n) => !only || only.split(',').includes(n);

if (run('istantanee')) { const { b, page } = await start();
  await open(page, P('Perpetua', 'The ball'));
  await page.getByPlaceholder(P('Nome (facoltativo)', 'Name (optional)')).fill(P('Prima stesura', 'First draft'));
  await page.getByRole('button', { name: P(/Crea istantanea/, /Take snapshot/) }).click(); await page.waitForTimeout(500);
  const l = page.locator('.cm-line', { hasText: P('«La vita!»', '“I certainly shall not.') }).first(); await l.click(); await page.keyboard.press('End');
  await page.keyboard.type(P(' esclamò Perpetua.', ' He looked away.')); await page.waitForTimeout(1500);
  const sb = await page.locator('aside.side').boundingBox();
  await page.locator('aside.side').getByText(P('Istantanee', 'Snapshots'), { exact: true }).first().scrollIntoViewIfNeeded();
  const h = await page.locator('aside.side').getByText(P('Istantanee', 'Snapshots'), { exact: true }).first().boundingBox();
  await clip(page, S+'istantanee.png', sb.x, h.y - 10, sb.width, 230);
  await page.getByRole('button', { name: P(/^Confronta/, /^Compare/) }).first().click(); await page.waitForTimeout(700);
  { const d = await page.locator('[role=dialog]').first().boundingBox(); await clip(page, S+'confronta.png', d.x, d.y, d.width, Math.min(d.height, 330)); }
  await b.close(); }

if (run('proprieta')) { const { b, page } = await start();
  await open(page, P('L’incontro', 'The ball'));
  const sb = await page.locator('aside.side').boundingBox();
  await clip(page, S+'proprieta.png', sb.x, sb.y, sb.width, 560);
  const kind = page.locator('aside.side button.kind').first(); await kind.click(); await page.waitForTimeout(500);
  const kb = await kind.boundingBox();
  await clip(page, S+'tipo-proprieta.png', sb.x, kb.y - 10, sb.width, 325);
  await b.close(); }

if (run('bibbia')) { const { b, page } = await start();
  await nav(page, P('Bibbia', 'Story Bible'));
  await page.screenshot({ path: S+'bibbia.png' });
  await page.getByText(P('Lucia Mondella', 'Elizabeth Bennet'), { exact: true }).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'scheda.png' });
  const link = page.locator('.cm-line').getByText(P('La casa di Lucia', 'Longbourn')).first(); await link.click(); await page.waitForTimeout(600);
  const lb = await link.boundingBox(); const ed = await page.locator('main').first().boundingBox();
  await clip(page, S+'menu-collegamento.png', lb.x - 300, lb.y - 50, 720, 200);
  await page.getByText(P('Anteprima', 'Preview'), { exact: true }).first().click(); await page.waitForTimeout(800);
  await clip(page, S+'anteprima.png', lb.x - 300, lb.y - 50, 720, 240);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: P('Cerca', 'Search'), exact: true }).first().click(); await page.waitForTimeout(400);
  await page.keyboard.type(P('Lucia', 'Darcy')); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'cerca-full.png' });
  await b.close(); }

if (run('commenti')) { const { b, page } = await start();
  await open(page, P('L’incontro', 'The ball'));
  await page.locator('aside.side').getByText(P('Commenti', 'Comments')).first().click(); await page.waitForTimeout(700);
  await page.screenshot({ path: S+'commenti-full.png' });
  await page.getByText(P('1 copia in conflitto', '1 conflict copy')).first().click(); await page.waitForTimeout(800);
  { const d = await page.locator('[role=dialog]').first().boundingBox(); await clip(page, S+'conflitto.png', d.x, d.y, d.width, Math.min(d.height, 300)); }
  await b.close(); }

if (run('viste')) { const { b, page } = await start();
  await nav(page, P('Tabelle e bacheche', 'Tables and boards'));
  await page.screenshot({ path: S+'bacheca-full.png' });
  await page.getByText(P('Tempo della storia', 'Story time'), { exact: true }).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'linea-tempo-full.png' });
  await page.getByText(P('Scene', 'Scenes'), { exact: true }).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: S+'tabella-vista-full.png' });
  await page.getByRole('button', { name: P(/Impostazioni/, /Settings/) }).last().click(); await page.waitForTimeout(700);
  await page.screenshot({ path: S+'vista-impostazioni-full.png' });
  await b.close(); }

if (run('stat')) { const { b, page } = await start();
  await nav(page, P('Statistiche', 'Statistics'));
  await page.screenshot({ path: S+'statistiche-full.png', fullPage: false });
  await page.getByText(P('Lunghezza', 'Length'), { exact: true }).first().evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
  await page.screenshot({ path: S+'statistiche2-full.png' });
  await b.close(); }

if (run('export')) { const { b, page } = await start();
  await nav(page, P('Esportazione', 'Export'));
  await page.locator('[data-export="page"]').click(); await page.waitForTimeout(400);
  await page.screenshot({ path: S+'esportazione-full.png' });
  await nav(page, P('Impostazioni', 'Settings'));
  await page.locator('[data-settings="structure"]').click(); await page.waitForTimeout(500);
  await page.screenshot({ path: S+'struttura-full.png' });
  await b.close(); }

if (run('pannelli')) { const { b, page } = await start();
  await open(page, P('L’incontro', 'The ball'));
  await page.locator('button', { has: page.locator('.label', { hasText: P('Altro', 'More') }) }).first().click(); await page.waitForTimeout(300);
  await page.getByText(P('Schede della scena', 'Cards of the scene'), { exact: false }).first().click(); await page.waitForTimeout(1200);
  await page.screenshot({ path: S+'pannelli-full.png' });
  await b.close(); }
