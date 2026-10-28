// 17. Scrivere in due: a shared folder, your name, comments with replies, revisions proposed and
// accepted, a scene someone else is writing, and a conflicted copy.
export const meta = {
  n: 17,
  group: 'together',
  title: { it: 'Scrivere in due', en: 'Writing together' },
  subtitle: { it: 'Commenti, revisioni e una cartella condivisa', en: 'Comments, revisions and a shared folder' },
};

const D = {
  it: {
    intro: 'Un romanzo a quattro mani, o con un editor che legge e commenta: Dante lo permette',
    s1: 'Condividere il romanzo',
    s1b: 'Una cartella sincronizzata',
    share: 'Mettete la cartella del romanzo in Dropbox, Google Drive o iCloud Drive: ognuno la apre con Dante sul suo computer',
    name: 'Ognuno scrive il suo nome in Impostazioni, Dante su questo computer: firma i commenti e le revisioni',
    scene: 'L’incontro',
    s2: 'I commenti',
    s2b: 'Note a margine',
    tab: 'I commenti della scena sono nel pannello a destra, scheda Commenti',
    anna: 'Il commento di Anna, con la frase a cui si riferisce',
    marked: 'questo matrimonio non',
    inText: 'Nel testo, la frase commentata è evidenziata',
    reply: 'Sì, la teniamo dov’è.',
    replied: 'Rispondi aggiunge la risposta, con il tuo nome',
    resolve: 'Risolvi chiude la discussione e toglie il commento dal testo',
    lineAt: 'servitori del comune',
    newComment: 'Per commentare: seleziona il testo e ⌘⌥M (Ctrl+Alt+M), oppure il fumetto nella barra',
    selectAt: 'Cosa comanda?',
    comment: 'Risponde troppo in fretta, per uno spaventato?',
    s3: 'Le revisioni',
    s3b: 'Modifiche proposte',
    mode: 'Con Modalità revisione accesa, quello che scrivi diventa una proposta firmata',
    typed: ' Ma il bravo non rispose.',
    proposed: 'In verde quello che aggiungi, barrato quello che togli: il testo vero cambia solo quando qualcuno accetta',
    anna2: 'Anna aveva proposto di correggere «nè» in «né»: una parola tolta, una aggiunta',
    accept: 'Accetta applica la modifica, Rifiuta la scarta. In alto, Accetta tutte e Rifiuta tutte',
    s4: 'Una scena alla volta',
    s4b: 'Chi la apre per primo la tiene',
    busy: 'Lucia',
    banner: 'Anna sta scrivendo questa scena: qui è in sola lettura, così le modifiche non si sovrappongono. Torna libera tre minuti dopo che lei smette',
    s5: 'Copie in conflitto',
    s5b: 'Quando due versioni si incrociano',
    conflict: 'Se due persone cambiano lo stesso file insieme, il servizio di sincronizzazione ne tiene due copie. Dante lo segnala qui',
    diff: 'Le due versioni a confronto: barrato ciò che c’è solo nel file, in verde ciò che c’è solo nella copia',
    choose: 'Si tiene il file, si usa la copia, oppure si uniscono le differenze come revisioni, da accettare una per una',
  },
  en: {
    intro: 'A novel written by two, or with an editor who reads and comments: Dante allows it',
    s1: 'Sharing the novel',
    s1b: 'A synced folder',
    share: 'Put the novel’s folder in Dropbox, Google Drive or iCloud Drive: each of you opens it with Dante on your own computer',
    name: 'Each of you writes your name in Settings, Dante on this computer: it signs comments and revisions',
    scene: 'The ball',
    s2: 'Comments',
    s2b: 'Notes in the margin',
    tab: 'The scene’s comments are in the right panel, Comments tab',
    anna: 'Anna’s comment, with the sentence it refers to',
    marked: 'She is tolerable',
    inText: 'In the text, the sentence commented on is highlighted',
    reply: 'Yes, let’s make it louder.',
    replied: 'Reply adds your answer, with your name',
    resolve: 'Resolve closes the discussion and takes the comment out of the text',
    lineAt: 'Do let me ask my partner',
    newComment: 'To comment: select the text and press ⌘⌥M (Ctrl+Alt+M), or the speech bubble in the bar',
    selectAt: 'Which do you mean?',
    comment: 'Is Darcy too cold here?',
    s3: 'Revisions',
    s3b: 'Suggested changes',
    mode: 'With Revision mode on, what you type becomes a signed suggestion',
    typed: ' Darcy did not answer.',
    proposed: 'In green what you add, struck through what you remove: the real text changes only when someone accepts',
    anna2: 'Anna had suggested “a few” for “five”: one word removed, one added',
    accept: 'Accept applies the change, Reject discards it. At the top, Accept all and Reject all',
    s4: 'One scene at a time',
    s4b: 'Whoever opens it first keeps it',
    busy: 'Talking over the ball',
    banner: 'Anna is writing this scene: here it is read-only, so changes do not overlap. It is free again three minutes after she stops',
    s5: 'Conflicted copies',
    s5b: 'When two versions cross',
    conflict: 'If two people change the same file at once, the sync service keeps two copies. Dante points it out here',
    diff: 'The two versions side by side: struck through what is only in the file, in green what is only in the copy',
    choose: 'You keep the file, use the copy, or merge the differences as revisions to accept one by one',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const main = p.locator('main.center').first();
  const side = p.locator('aside.side').first();
  const tab = (key) => side.getByRole('tab', { name: new RegExp(`^${L(key)}`) }).first();
  const item = (kind) => side.locator('li', { has: p.locator('.kind', { hasText: L(`comments.kind.${kind}`) }) }).first();

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b);
  await t.say(d.share);
  await t.nav('section.settings');
  await t.wait(0.8);
  await t.click(t.text(L('settings.tabApp')), { after: 1 });
  const name = p.locator('label', { hasText: L('settings.userName') }).first();
  await t.zoom(name, () => t.focus(name, d.name, { side: 'right' }), 1.5);

  await t.title(d.s2, d.s2b, async () => {
    await t.nav('section.manuscript');
    await t.wait(0.8);
    await t.click(t.text(d.scene), { after: 1 });
    await t.click(main.getByRole('button', { name: L('level.scene'), exact: true }).first(), { after: 1 });
  });
  await t.focus(tab('side.comments'), d.tab, { side: 'left' });
  await t.click(tab('side.comments'), { after: 1 });
  const anna = item('comment');
  await t.focus(anna, d.anna, { side: 'left' });
  // a click on the comment shows its place in the text
  await t.click(anna.locator('button.text, button.said').first(), { after: 1 });
  const marked = t.line(d.marked);
  await t.focus(marked, d.inText, { side: 'below', pointer: false });
  await t.click(anna.getByRole('button', { name: L('comments.reply') }), { after: 0.5 });
  await t.type(d.reply, 70);
  await t.click(anna.locator('.buttons .primary'), { after: 1 });
  await t.focus(anna, d.replied, { side: 'left' });
  const resolve = anna.getByRole('button', { name: L('comments.resolve') });
  await t.focus(resolve, d.resolve, { side: 'left' });
  await t.click(resolve, { after: 1.2 });
  const line = t.line(d.lineAt);
  // three clicks select the whole paragraph
  const said = t.line(d.selectAt);
  await t.click(said, { dx: 0.3, dy: 0.2, after: 0.1 });
  const r = await said.boundingBox();
  await p.mouse.click(r.x + r.width * 0.3, r.y + r.height * 0.2, { clickCount: 3 });
  await t.wait(0.8);
  await t.say(d.newComment);
  await t.press('ControlOrMeta+Alt+m', 0.8);
  await t.type(d.comment, 70);
  await t.click(side.getByRole('button', { name: L('comments.add') }), { after: 1.2 });

  await t.title(d.s3, d.s3b);
  const mode = side.locator('label.mode').first();
  await t.zoom(mode, () => t.focus(mode, d.mode, { side: 'left' }), 1.5);
  await t.click(mode.locator('input'), { after: 0.8 });
  await t.click(line, { dx: 0.98, after: 0.2 });
  await t.press('End', 0.4);
  await t.type(d.typed, 80);
  await t.wait(0.8);
  await t.zoom(line, () => t.focus(line, d.proposed, { side: 'below', pointer: false }), 1.4);
  const removal = item('deletion');
  await removal.scrollIntoViewIfNeeded();
  await t.focus([removal, item('addition')], d.anna2, { side: 'left' });
  await t.focus(removal.getByRole('button', { name: new RegExp(L('comments.accept')) }), d.accept, { side: 'left' });
  await t.click(removal.getByRole('button', { name: new RegExp(L('comments.accept')) }), { after: 1 });
  await t.click(item('addition').getByRole('button', { name: new RegExp(L('comments.accept')) }), { after: 1.2 });
  await t.click(mode.locator('input'), { after: 0.8 });

  await t.title(d.s4, d.s4b, () => t.click(t.text(d.busy), { after: 1.2 }));
  const banner = p.getByText(L('presence.editing', { user: 'Anna' })).first();
  await t.focus(banner, d.banner, { side: 'below' });

  await t.title(d.s5, d.s5b);
  const button = p.getByRole('button', { name: new RegExp(L('conflicts.one')) }).first();
  await t.zoom(button, () => t.focus(button, d.conflict, { side: 'below' }), 1.5);
  await t.click(button, { after: 1.2 });
  const dialog = p.getByRole('dialog', { name: L('conflicts.title') });
  await t.focus(dialog.locator('.diff').first(), d.diff, { side: 'right', pointer: false });
  await t.focus(dialog.locator('.actions').first(), d.choose, { side: 'above' });
  await t.click(dialog.getByRole('button', { name: L('snap.close') }), { after: 0.8 });
}
