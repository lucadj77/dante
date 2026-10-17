import { start, badges, clip } from './lib.mjs';
// Raw shots; finalize.py crops them into docs/img.
const S='shots/f-';
const open = async (page, t) => { await page.getByText(t, { exact: true }).first().click(); await page.waitForTimeout(800); };
const only = process.argv[2];
const run = (n) => !only || only.split(',').includes(n);

if (run('benvenuto')) { const { b, page } = await start({ fakeTauri: true });
  await page.waitForTimeout(800);
  await page.locator('main').first().screenshot({ path: S+'benvenuto.png' });
  await page.getByText('Nuovo progetto').first().click(); await page.waitForTimeout(500);
  await page.getByLabel('Titolo').fill('Il mio romanzo'); await page.waitForTimeout(400);
  await page.locator('main').first().screenshot({ path: S+'nuovo-progetto.png' });
  await b.close(); }

if (run('aggiornamento')) { const { b, page } = await start({ fakeTauri: true, updates: true, settings: { checkUpdates: true } });
  await page.waitForTimeout(1500);
  await clip(page, S+'aggiornamento.png', 1035, 795, 455, 85);
  await b.close(); }

if (run('word')) { const { b, page } = await start({ sample: false });
  await page.locator('input[type=file]').setInputFiles('shots/Il faro.docx'); await page.waitForTimeout(1500);
  const box = await page.locator('main').first().boundingBox();
  await page.screenshot({ path: S+'importa-word.png', clip: { x: box.x - 10, y: box.y, width: box.width + 120, height: 420 } });
  await b.close(); }

if (run('area')) { const { b, page } = await start();
  await open(page, 'L’incontro');
  await badges(page, [['nav[aria-label=Sections]', 1, { nobox: true, top: true, dy: 600 }], ['aside.tree', 2, { top: true, dy: 520 }], ['main.center', 3, { top: true, dy: 650 }], ['aside.side', 4, { top: true, dy: 620 }]]);
  await page.screenshot({ path: S+'area-di-lavoro.png' });
  await b.close(); }

if (run('selezione')) { const { b, page } = await start();
  await open(page, 'Perpetua');
  const p = page.locator('.cm-line', { hasText: 'Misericordia! cos’ha' }).first();
  await p.click(); await page.keyboard.press('Home'); await page.keyboard.press('Shift+End'); await page.waitForTimeout(500);
  const c = await page.locator('main.center').boundingBox();
  await clip(page, S+'barra-selezione.png', c.x, c.y + 130, c.width, 340);
  await b.close(); }

if (run('focus')) { const { b, page } = await start();
  await open(page, 'Perpetua');
  await page.getByRole('button', { name: 'Focus' }).click();
  const p = page.locator('.cm-line', { hasText: '«Niente, niente,»' }).first(); await p.click(); await page.waitForTimeout(600);
  const c = await page.locator('main.center').boundingBox();
  await clip(page, S+'focus.png', c.x, c.y + 140, c.width, 420);
  await b.close(); }

if (run('tabella')) { const { b, page } = await start();
  await open(page, 'La notte');
  await page.locator('.cm-line', { hasText: 'Si racconta che il principe' }).first().click(); await page.keyboard.press('Control+End'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /^Tabella:/ }).click(); await page.waitForTimeout(300);
  const cells = ['Personaggio', 'Chi è', 'Prima scena', 'Renzo', 'filatore di seta', 'Il latinorum', 'Lucia', 'promessa sposa', 'Lucia'];
  for (const [i, t] of cells.entries()) { await page.keyboard.type(t); if (i < cells.length - 1) await page.keyboard.press('Tab'); }
  await page.waitForTimeout(600);
  const c = await page.locator('main.center').boundingBox();
  const at = () => page.evaluate(() => { const s = getSelection(); return s.rangeCount ? s.getRangeAt(0).getBoundingClientRect().y || 400 : 400; });
  const y0 = Math.max(c.y + 140, (await at()) - 150);
  await clip(page, S+'tabella-modifica.png', c.x, y0, c.width, 270);
  await page.getByRole('button', { name: /Didascalia/ }).click(); await page.waitForTimeout(200);
  await page.keyboard.type('I personaggi del capitolo');
  await page.locator('.cm-line', { hasText: 'Il primo svegliarsi' }).first().click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(600);
  const tb = await page.locator('.cm-content table').first().boundingBox();
  await clip(page, S+'tabella.png', c.x, tb.y - 30, c.width, tb.height + 90);
  await b.close(); }

if (run('menu')) { const { b, page } = await start();
  await open(page, 'Il latinorum');
  await page.getByText('Il latinorum', { exact: true }).first().click({ button: 'right' }); await page.waitForTimeout(500);
  const mb = await page.locator('.menu[role=menu]').boundingBox(); await clip(page, S+'menu-albero.png', 50, mb.y - 120, mb.x + mb.width - 40, mb.height + 130);
  await b.close(); }

if (run('capitolo')) { const { b, page } = await start();
  await page.locator('aside.tree').getByText('Introduzione', { exact: true }).first().click(); await page.waitForTimeout(800);
  const sb = await page.locator('aside.side').boundingBox(); await clip(page, S+'tipo-capitolo.png', sb.x, sb.y, sb.width, 420);
  await b.close(); }
