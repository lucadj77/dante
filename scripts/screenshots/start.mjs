import { start, badges, clip, P, SHOTS } from './lib.mjs';
// Raw shots; finalize.py crops them into docs/img.
const S = SHOTS;
const open = async (page, t) => { await page.getByText(t, { exact: true }).first().click(); await page.waitForTimeout(800); };
const only = process.argv[2];
const run = (n) => !only || only.split(',').includes(n);

if (run('benvenuto')) { const { b, page } = await start({ fakeTauri: true });
  await page.waitForTimeout(800);
  await page.locator('main').first().screenshot({ path: S+'benvenuto.png' });
  await page.getByText(P('Nuovo progetto', 'New project')).first().click(); await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: P('Titolo', 'Title'), exact: true }).fill(P('Il mio romanzo', 'My novel')); await page.waitForTimeout(400);
  await page.locator('main').first().screenshot({ path: S+'nuovo-progetto.png' });
  await b.close(); }

if (run('aggiornamento')) { const { b, page } = await start({ fakeTauri: true, updates: true, settings: { checkUpdates: true } });
  await page.waitForTimeout(1500);
  await page.locator('.update').first().screenshot({ path: S+'aggiornamento.png' });
  await b.close(); }

if (run('word')) { const { b, page } = await start({ sample: false });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), (async () => { await page.getByText(P('Importa da altro formato…', 'Import from another format…')).click(); await page.getByRole('button', { name: /Word, OpenDocument/ }).click(); })()]);
  await chooser.setFiles(P('shots/Il faro.docx', '../tutorials/assets/en/The Lighthouse.docx')); await page.waitForTimeout(1500);
  await page.locator('.blocks button', { hasText: P('Il guardiano del faro', 'The lighthouse keeper had not spoken') }).click(); await page.waitForTimeout(400);
  await page.locator('[role=dialog]').screenshot({ path: S+'importa-word.png' });
  await b.close(); }

if (run('area')) { const { b, page } = await start();
  await open(page, P('L’incontro', 'The ball'));
  await badges(page, [['nav[aria-label=Sections]', 1, { nobox: true, top: true, dy: 600 }], ['aside.tree', 2, { top: true, dy: 520 }], ['main.center', 3, { top: true, dy: 650 }], ['aside.side', 4, { top: true, dy: 620 }]]);
  await page.screenshot({ path: S+'area-di-lavoro.png' });
  await b.close(); }

if (run('selezione')) { const { b, page } = await start();
  await open(page, P('Perpetua', 'The ball'));
  const p = page.locator('.cm-line', { hasText: P('Misericordia! cos’ha', '“Come, Darcy,” said he') }).first();
  await p.click(); await page.keyboard.press('Home'); await page.keyboard.press('Shift+End'); await page.waitForTimeout(500);
  const c = await page.locator('main.center').boundingBox();
  await clip(page, S+'barra-selezione.png', c.x, c.y + 130, c.width, 340);
  await b.close(); }

if (run('focus')) { const { b, page } = await start();
  await open(page, P('Perpetua', 'The ball'));
  await page.locator('button', { has: page.locator('.label', { hasText: 'Focus' }) }).first().click();
  const p = page.locator('.cm-line', { hasText: P('«Niente, niente,»', '“I certainly shall not.') }).first(); await p.click(); await page.waitForTimeout(600);
  const c = await page.locator('main.center').boundingBox();
  await clip(page, S+'focus.png', c.x, c.y + 140, c.width, 420);
  await b.close(); }

if (run('tabella')) { const { b, page } = await start();
  await open(page, P('La notte', 'The invitation'));
  await page.locator('.cm-line', { hasText: P('Si racconta che il principe', 'An invitation to dinner was soon') }).first().click(); await page.keyboard.press('Control+End'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: P(/^Tabella:/, /^Table:/) }).click(); await page.waitForTimeout(300);
  const cells = P(['Personaggio', 'Chi è', 'Prima scena', 'Renzo', 'filatore di seta', 'Il latinorum', 'Lucia', 'promessa sposa', 'Lucia'], ['Character', 'Who', 'First scene', 'Bingley', 'the new neighbour', 'The invitation', 'Darcy', 'his friend', 'The ball']);
  for (const [i, t] of cells.entries()) { await page.keyboard.type(t); if (i < cells.length - 1) await page.keyboard.press('Tab'); }
  await page.waitForTimeout(600);
  const c = await page.locator('main.center').boundingBox();
  const at = () => page.evaluate(() => { const s = getSelection(); return s.rangeCount ? s.getRangeAt(0).getBoundingClientRect().y || 400 : 400; });
  const y0 = Math.max(c.y + 140, (await at()) - 150);
  await clip(page, S+'tabella-modifica.png', c.x, y0, c.width, 270);
  await page.getByRole('button', { name: P(/Didascalia/, /Caption/) }).click(); await page.waitForTimeout(200);
  await page.keyboard.type(P('I personaggi del capitolo', 'The characters of the chapter'));
  await page.locator('.cm-line', { hasText: P('Il primo svegliarsi', 'An invitation to dinner was soon') }).first().click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(600);
  await page.locator('.cm-content table').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const tb = await page.locator('.cm-content table').first().boundingBox();
  await clip(page, S+'tabella.png', c.x, tb.y - 30, c.width, tb.height + 90);
  await b.close(); }

if (run('menu')) { const { b, page } = await start();
  await open(page, P('Il latinorum', 'Mr. Bennet’s visit'));
  await page.getByText(P('Il latinorum', 'Mr. Bennet’s visit'), { exact: true }).first().click({ button: 'right' }); await page.waitForTimeout(500);
  const mb = await page.locator('.menu[role=menu]').boundingBox(); await clip(page, S+'menu-albero.png', 50, mb.y - 120, mb.x + mb.width - 40, mb.height + 130);
  await b.close(); }

if (run('capitolo')) { const { b, page } = await start();
  await page.locator('aside.tree').getByText(P('Introduzione', 'Chapter 1: Netherfield is let'), { exact: true }).first().click(); await page.waitForTimeout(800);
  const sb = await page.locator('aside.side').boundingBox(); await clip(page, S+'tipo-capitolo.png', sb.x, sb.y, sb.width, 420);
  await b.close(); }
