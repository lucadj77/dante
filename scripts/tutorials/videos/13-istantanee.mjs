// 13. Istantanee e copie di sicurezza: a named snapshot, comparing it with the text, restoring it, and
// where the backups of the whole project go.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const meta = {
  n: 13,
  group: 'write',
  title: { it: 'Istantanee e copie di sicurezza', en: 'Snapshots and backups' },
  subtitle: { it: 'Tornare indietro senza paura', en: 'Going back without fear' },
};

const D = {
  it: {
    intro: 'Prima di riscrivere una scena, conviene fotografarla: un’istantanea',
    scene: 'Perpetua',
    s1: 'Un’istantanea',
    s1b: 'La scena com’è adesso',
    panel: 'Le istantanee sono nel pannello a destra, sotto le proprietà della scena',
    name: 'Prima stesura',
    take: 'Un nome, se vuoi, e Crea istantanea',
    taken: 'Eccola, con la data. Dante ne crea anche da solo, prima della prima modifica di ogni sessione',
    s2: 'Riscrivere',
    s2b: 'E confrontare',
    lineAt: 'Misericordia!',
    typed: ' Perpetua posò il lume sul tavolo e lo guardò fisso.',
    compare: 'Confronta mostra cosa è cambiato rispetto all’istantanea',
    diff: 'Barrato ciò che c’era solo nell’istantanea, in verde ciò che c’è solo adesso',
    s3: 'Ripristinare',
    s3b: 'Tornare alla versione di prima',
    restore: 'Ripristina rimette l’istantanea al posto del testo',
    restored: 'Il testo di prima è tornato. Quello appena sostituito non si perde: diventa a sua volta un’istantanea',
    sw: 'Tutto il manoscritto',
    swb: 'Un punto fermo per tutte le scene',
    wholeWhere: 'In Impostazioni, Manutenzione: un’istantanea di tutte le scene insieme',
    wholeName: 'Seconda stesura',
    wholeTaken: 'Ogni scena la ritrova tra le sue istantanee. Da qui si riporta tutto il manoscritto a quel punto',
    s4: 'Le copie di sicurezza',
    s4b: 'Tutto il progetto, fuori dalla sua cartella',
    backup: 'Le istantanee proteggono una scena. Le copie di sicurezza proteggono tutto il romanzo',
    where: 'Nell’app, quando chiudi un progetto modificato, Dante salva uno zip in Documenti, cartella Dante backup',
    settings: 'In Impostazioni, Copie di sicurezza, si sceglie dove tenerle e quante, e se ne crea una quando vuoi',
    reopen: 'Sotto, l’elenco delle copie: Apri questa copia la estrae in una cartella nuova accanto al romanzo e la apre. Il romanzo di adesso resta com’è',
  },
  en: {
    intro: 'Before rewriting a scene, it pays to take a picture of it: a snapshot',
    scene: 'Jane and Elizabeth',
    s1: 'A snapshot',
    s1b: 'The scene as it is now',
    panel: 'Snapshots are in the right panel, below the scene’s properties',
    name: 'First draft',
    take: 'A name, if you like, and Take snapshot',
    taken: 'Here it is, with its date. Dante takes some by itself too, before the first change of each session',
    s2: 'Rewriting',
    s2b: 'And comparing',
    lineAt: 'such perfect good breeding',
    typed: ' Jane laughed and looked away.',
    compare: 'Compare shows what changed since the snapshot',
    diff: 'Struck through what was only in the snapshot, in green what is only there now',
    s3: 'Restoring',
    s3b: 'Back to the earlier version',
    restore: 'Restore puts the snapshot back in place of the text',
    restored: 'The earlier text is back. The text it replaced is not lost: it becomes a snapshot in turn',
    sw: 'The whole manuscript',
    swb: 'A fixed point for every scene',
    wholeWhere: 'In Settings, Upkeep: a snapshot of all the scenes together',
    wholeName: 'Second draft',
    wholeTaken: 'Every scene finds it among its snapshots. From here the whole manuscript goes back to that point',
    s4: 'Backups',
    s4b: 'The whole project, outside its folder',
    backup: 'Snapshots protect a scene. Backups protect the whole novel',
    where: 'In the app, when you close a project that changed, Dante saves a zip in Documents, in the Dante backup folder',
    settings: 'In Settings, Backups, you choose where to keep them and how many, and make one whenever you like',
    reopen: 'Below, the list of backups: Open this backup extracts it into a new folder next to the novel and opens it. The novel as it is now stays untouched',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const side = p.locator('aside.side').first();
  const snaps = side.locator('section', { has: p.locator('h3', { hasText: L('snap.title') }) }).first();
  const item = (name) => snaps.locator('li', { hasText: name }).first();

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });
  await t.click(t.text(d.scene), { after: 1 });
  await t.click(p.locator('main.center').getByRole('button', { name: L('level.scene'), exact: true }).first(), { after: 1 });

  await t.title(d.s1, d.s1b, async () => {
    await snaps.scrollIntoViewIfNeeded();
    await t.wait(0.5);
  });
  await t.focus(snaps, d.panel, { side: 'left' });
  const name = snaps.getByPlaceholder(L('snap.namePlaceholder'));
  await t.click(name, { after: 0.2 });
  await t.type(d.name, 90);
  const take = snaps.getByRole('button', { name: L('snap.take') });
  await t.zoom([name, take], () => t.focus([name, take], d.take, { side: 'left' }), 1.5);
  await t.click(take, { after: 1.2 });
  await t.focus(item(d.name), d.taken, { side: 'left' });

  await t.title(d.s2, d.s2b);
  const line = t.line(d.lineAt);
  await t.click(line, { dx: 0.98, dy: 0.85, after: 0.2 });
  await t.press('End', 0.4);
  await t.type(d.typed, 70);
  await t.wait(1);
  await snaps.scrollIntoViewIfNeeded();
  const compare = item(d.name).getByRole('button', { name: L('snap.compare') });
  await t.focus(compare, d.compare, { side: 'left' });
  await t.click(compare, { after: 1.2 });
  const dialog = p.locator('[role=dialog]').first();
  const ins = dialog.locator('ins').last();
  await ins.scrollIntoViewIfNeeded();
  await t.wait(0.6);
  await t.zoom(ins, () => t.focus(ins, d.diff, { side: 'below', pointer: false }), 1.4);
  await t.click(dialog.getByRole('button', { name: L('snap.close') }), { after: 0.8 });

  await t.title(d.s3, d.s3b);
  const restore = item(d.name).getByRole('button', { name: L('snap.restore') });
  await t.focus(restore, d.restore, { side: 'left' });
  p.once('dialog', (dialog) => dialog.accept());
  await t.click(restore, { after: 1.5 });
  await t.focus([line, snaps.locator('ul').first()], d.restored, { side: 'below' });

  await t.title(d.sw, d.swb, () => t.settings('upkeep', 1));
  const whole = p.locator('.settings .page section, .settings .page .fields').first();
  const wholeName = p.getByPlaceholder(L('whole.name')).first();
  await t.focus(p.getByRole('heading', { name: L('whole.title') }).first(), d.wholeWhere, { side: 'right' });
  await t.click(wholeName, { after: 0.2 });
  await t.type(d.wholeName, 90);
  await t.click(p.getByRole('button', { name: L('whole.take'), exact: true }).first(), { after: 1.5 });
  await t.focus(p.locator('.settings .page form').first(), d.wholeTaken, { side: 'right', pointer: false });

  await t.title(d.s4, d.s4b);
  await t.say(d.backup);
  await t.say(d.where);
  // the Backups page is only in the desktop app: its picture from the guide
  await p.evaluate((src) => {
    const f = document.createElement('div');
    f.id = 'tu-figure';
    f.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#faf9f6;display:flex;align-items:center;justify-content:center';
    f.innerHTML = `<img src="${src}" style="height:760px;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.18)">`;
    document.documentElement.append(f);
  }, 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, `docs/img/${t.lang === 'en' ? 'en/' : ''}copie.png`)).toString('base64'));
  await t.wait(1);
  const img = p.locator('#tu-figure img');
  const part = async (y0, y1, text) => {
    const r = await img.boundingBox();
    await p.evaluate(([r, text]) => window.__tu.box(r, text, 'right'), [{ x: r.x, y: r.y + r.height * y0, width: r.width, height: r.height * (y1 - y0) }, text]);
    await t.wait(4 + text.length * 0.05);
    await p.evaluate(() => window.__tu.box(null));
    await t.wait(0.5);
  };
  await part(0.22, 0.6, d.settings);
  await part(0.63, 0.97, d.reopen);
  await p.evaluate(() => document.getElementById('tu-figure').remove());
}
