// 12. Istantanee e copie di sicurezza: a named snapshot, comparing it with the text, restoring it, and
// where the backups of the whole project go.
export const meta = {
  n: 12,
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
    s4: 'Le copie di sicurezza',
    s4b: 'Tutto il progetto, fuori dalla sua cartella',
    backup: 'Le istantanee proteggono una scena. Le copie di sicurezza proteggono tutto il romanzo',
    where: 'Nell’app, quando chiudi un progetto modificato, Dante salva uno zip in Documenti, cartella Dante backup',
    settings: 'In Impostazioni, Dante su questo computer, si sceglie dove tenerle e quante',
    reopen: 'Per riprendere un progetto da una copia: estrai lo zip e apri la cartella con Apri cartella',
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
    s4: 'Backups',
    s4b: 'The whole project, outside its folder',
    backup: 'Snapshots protect a scene. Backups protect the whole novel',
    where: 'In the app, when you close a project that changed, Dante saves a zip in Documents, in the Dante backup folder',
    settings: 'In Settings, Dante on this computer, you choose where to keep them and how many',
    reopen: 'To pick a project up from a backup: extract the zip and open the folder with Open folder',
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

  await t.title(d.s4, d.s4b);
  await t.say(d.backup);
  await t.say(d.where);
  await t.nav('section.settings');
  await t.wait(0.8);
  await t.click(t.text(L('settings.tabApp')), { after: 1 });
  await t.say(d.settings);
  const nav = p.locator('nav[aria-label="Sections"]').first();
  await t.click(nav.locator('[data-section="close"]'), { after: 1.5 });
  const open = p.getByRole('button', { name: L('welcome.open') }).first();
  await t.focus(open, d.reopen, { side: 'right' });
}
