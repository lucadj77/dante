// 15. La Bibbia e i collegamenti: the story bible's types and sheets, a new type, the notes, links
// typed with [[, the link menu, a link to a sheet that does not exist yet, the Links tab, and find and
// replace across the project.
export const meta = {
  n: 15,
  group: 'bible',
  title: { it: 'La Bibbia e i collegamenti', en: 'The Story Bible and links' },
  subtitle: { it: 'Personaggi, luoghi e trame, legati al testo', en: 'Characters, places and plotlines, tied to the text' },
};

const D = {
  it: {
    intro: 'La Bibbia raccoglie personaggi, luoghi e trame del romanzo; i collegamenti la legano al testo',
    s1: 'La Bibbia',
    s1b: 'Le schede del romanzo',
    types: 'A sinistra i tipi di scheda: personaggi, luoghi, oggetti, eventi, gruppi, trame. Accanto, quante schede ha ognuno',
    characters: 'Personaggio',
    cards: 'Ogni scheda mostra le sue proprietà principali. Filtra cerca tra i nomi',
    card: 'Lucia Mondella',
    sheet: 'La scheda: un testo libero, come una scena',
    props: 'A destra le sue proprietà, con gli altri nomi con cui compare nel testo. I pulsanti + aggiungono quelle suggerite dal tipo',
    s2: 'Un nuovo tipo',
    s2b: 'Per esempio, gli animali',
    type: 'Animale',
    add: 'In fondo all’elenco dei tipi: un nome e Aggiungi',
    edit: 'Modifica il tipo: l’icona e le proprietà che ogni scheda di questo tipo dovrebbe avere',
    icon: '🐓',
    fields: 'padrone, dove si trova',
    newItem: 'I capponi di Renzo',
    create: 'Nuovo: Animale crea una scheda nella cartella del tipo',
    suggested: 'La nuova scheda ha già le proprietà del tipo, da riempire',
    owner: 'Renzo',
    s3: 'Le note',
    s3b: 'Ricerca e Laboratorio',
    notes: 'In Note, Ricerca raccoglie il materiale raccolto: appunti, immagini, pagine salvate. Laboratorio le scalette e le prove',
    s4: 'Collegare',
    s4b: 'Due parentesi quadre',
    scene: 'Perpetua',
    before: 'Più tardi ne parlò con ',
    partial: '[[Luc',
    suggest: 'Dopo [[ Dante suggerisce le schede che cominciano così: Invio sceglie',
    after: '.',
    linked: 'Il nome diventa un collegamento alla scheda',
    s5: 'Seguire un collegamento',
    s5b: 'Anteprima o pannello',
    target: 'Lucia',
    menu: 'Un clic sul collegamento: aprire la scheda, aprirla nel pannello accanto o guardarne l’anteprima',
    preview: 'L’anteprima si chiude con Esc e lascia il testo dov’era',
    beside: 'Nel pannello, la scheda resta accanto alla scena mentre scrivi',
    s6: 'Una scheda che non c’è',
    s6b: 'Si crea dal collegamento',
    missing: ' Poi andò da [[Fra Cristoforo]].',
    missingName: 'Fra Cristoforo',
    create2: 'Il collegamento porta a una scheda che non esiste ancora: Dante chiede di che tipo crearla',
    created: 'Fatto: la scheda di fra Cristoforo è nella Bibbia, dal modello dei personaggi',
    s7: 'Chi collega chi',
    s7b: 'La scheda Collegamenti',
    links: 'Nel pannello a destra, Collegamenti: le schede che la scena collega e le note che collegano lei',
    s8: 'Trova e sostituisci',
    s8b: 'In tutto il progetto',
    replaceKey: '⌥⌘F (Alt+Ctrl+F) apre Trova e sostituisci in tutto il progetto',
    find: 'Renzo',
    with: 'Lorenzo',
    results: 'Ogni occorrenza con il suo contesto: le caselle scelgono quali cambiare',
    safe: 'Cambia solo il testo, non i nomi dentro i collegamenti. Prima, ogni scena va in un’istantanea',
    undo: 'E Annulla la sostituzione rimette tutto com’era',
  },
  en: {
    intro: 'The Story Bible gathers the novel’s characters, places and plotlines; links tie it to the text',
    s1: 'The Story Bible',
    s1b: 'The novel’s sheets',
    types: 'On the left, the kinds of sheet: characters, places, objects, events, groups, plotlines. Next to each, how many sheets it has',
    characters: 'Character',
    cards: 'Each sheet shows its main properties. Filter searches the names',
    card: 'Elizabeth Bennet',
    sheet: 'The sheet: free text, like a scene',
    props: 'On the right, its properties, with the other names it goes by in the text. The + buttons add the ones the type suggests',
    s2: 'A new type',
    s2b: 'Animals, for instance',
    type: 'Animal',
    add: 'At the bottom of the list of types: a name and Add',
    edit: 'Edit type: the icon and the properties every sheet of this type should have',
    icon: '🐴',
    fields: 'owner, whereabouts',
    newItem: 'The carriage horses',
    create: 'New: Animal creates a sheet in the type’s folder',
    suggested: 'The new sheet already has the type’s properties, ready to fill in',
    owner: 'Mr. Bennet',
    s3: 'Notes',
    s3b: 'Research and Laboratory',
    notes: 'In Notes, Research holds the material you gather: notes, images, saved pages. Laboratory holds outlines and tries',
    s4: 'Linking',
    s4b: 'Two square brackets',
    scene: 'Jane and Elizabeth',
    before: 'Later she told ',
    partial: '[[Eliz',
    suggest: 'After [[ Dante suggests the sheets that start that way: Return picks one',
    after: '.',
    linked: 'The name becomes a link to the sheet',
    s5: 'Following a link',
    s5b: 'Preview or side pane',
    target: 'Eliza',
    menu: 'One click on the link: open the sheet, open it in the pane alongside, or just preview it',
    preview: 'The preview closes with Esc and leaves the text where it was',
    beside: 'In the pane, the sheet stays next to the scene while you write',
    s6: 'A sheet that does not exist',
    s6b: 'Created from the link',
    missing: ' Then she called on [[Charlotte Lucas]].',
    missingName: 'Charlotte Lucas',
    create2: 'The link leads to a sheet that does not exist yet: Dante asks which kind to create',
    created: 'Done: Charlotte Lucas has a sheet in the Story Bible, made from the characters’ template',
    s7: 'Who links to whom',
    s7b: 'The Links tab',
    links: 'In the right panel, Links: the sheets the scene links to and the notes that link to it',
    s8: 'Find and replace',
    s8b: 'Across the project',
    replaceKey: '⌥⌘F (Alt+Ctrl+F) opens find and replace across the whole project',
    find: 'Bingley',
    with: 'Bingham',
    results: 'Every match with its context: the boxes choose which to change',
    safe: 'It changes only the text, not the names inside links. First, every scene goes into a snapshot',
    undo: 'And Undo the replacement puts everything back',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const main = p.locator('main.center').first();
  const side = p.locator('aside.side').first();
  const codex = p.locator('.codex').first();

  // the end of the scene: CodeMirror draws only the lines on screen
  const toEnd = async () => {
    for (let i = 0; i < 3; i++) {
      await main.evaluate((m) => { for (const e of [m, ...m.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight; });
      await t.wait(0.4);
    }
    await t.click(main.locator('.cm-line').last(), { dx: 0.98, after: 0.2 });
    await main.locator('.cm-content').first().focus();
    await t.press('ControlOrMeta+End', 0.2);
  };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b, () => t.nav('section.codex'));
  const types = codex.locator('aside.types').first();
  await t.focus(types.locator('ul').first(), d.types, { side: 'right' });
  await t.click(types.locator('button.type', { hasText: d.characters }).first(), { after: 1 });
  await t.focus(codex.locator('.cards').first(), d.cards, { side: 'below' });
  await t.click(codex.locator('button.card', { hasText: d.card }).first(), { after: 1.2 });
  await t.focus(codex.locator('.editor').first(), d.sheet, { side: 'below', pointer: false });
  await t.focus(side, d.props, { side: 'left' });

  await t.title(d.s2, d.s2b);
  const name = types.getByPlaceholder(L('codex.newTypeName'));
  await t.click(name, { after: 0.2 });
  await t.type(d.type, 90);
  const add = types.getByRole('button', { name: L('codex.addType') });
  await t.zoom([name, add], () => t.focus([name, add], d.add, { side: 'right' }), 1.5);
  await t.click(add, { after: 0.8 });
  await t.click(types.locator('button.type', { hasText: d.type }).first(), { after: 0.8 });
  await t.click(codex.getByRole('button', { name: L('codex.editType') }), { after: 0.8 });
  const form = codex.locator('form.type-form').first();
  await t.focus(form, d.edit, { side: 'below' });
  const icon = form.locator('label', { hasText: L('codex.typeIcon') }).locator('input');
  await t.click(icon, { after: 0.2 });
  await t.type(d.icon, 120);
  const fields = form.locator('label', { hasText: L('codex.typeProperties') }).locator('input, textarea').first();
  await t.click(fields, { after: 0.2 });
  await t.type(d.fields, 70);
  await t.wait(0.6);
  await t.click(form.getByRole('button', { name: L('settings.save') }), { after: 1 });
  const create = codex.getByRole('button', { name: L('codex.new', { type: d.type }) });
  await t.focus(create, d.create, { side: 'below' });
  await t.click(create, { after: 0.5 });
  await t.type(d.newItem, 70);
  await t.click(codex.getByRole('button', { name: L('codex.create') }), { after: 1.5 });
  await t.focus(side, d.suggested, { side: 'left' });
  const owner = side.locator('input').nth(1);
  await t.click(owner, { after: 0.2 });
  await t.type(d.owner, 90);
  await t.press('Tab', 0.8);

  await t.title(d.s3, d.s3b, () => t.nav('section.notes'));
  await t.focus(p.locator('aside.tree').first(), d.notes, { side: 'right' });

  await t.title(d.s4, d.s4b, async () => {
    await t.nav('section.manuscript');
    await t.wait(0.8);
    await t.click(t.text(d.scene), { after: 1 });
    await t.click(main.getByRole('button', { name: L('level.scene'), exact: true }).first(), { after: 1 });
    await toEnd();
  });
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.3);
  await t.type(d.before, 70);
  await t.type(d.partial, 160);
  await t.wait(0.8);
  const popup = p.locator('.cm-tooltip-autocomplete').first();
  await t.focus(popup, d.suggest, { side: 'below', pointer: false });
  await t.press('Enter', 0.4);
  await t.type(d.after, 70);
  // with the cursor elsewhere the link shows as a link, not as its text
  await t.press('ArrowUp', 0.6);
  const link = main.locator('.md-wikilink', { hasText: d.target }).last();
  await t.zoom(link, () => t.focus(link, d.linked, { side: 'above', pointer: false }), 1.6);

  await t.title(d.s5, d.s5b);
  await link.scrollIntoViewIfNeeded();
  await t.wait(0.5);
  await t.click(link, { after: 0.8 });
  const menu = p.locator('.float[role=menu]').first();
  await t.focus(menu, d.menu, { side: 'right' });
  await t.click(menu.getByRole('menuitem', { name: L('linkMenu.preview') }), { after: 1.2 });
  await t.focus(p.locator('.float.preview').first(), d.preview, { side: 'right', pointer: false });
  await t.press('Escape', 0.4);
  // the cursor off the link's line again, so it shows as a link
  await main.locator('.cm-content').first().focus();
  await t.press('ControlOrMeta+End', 0.1);
  await t.press('ArrowUp', 0.6);
  await t.click(link, { after: 0.8 });
  await t.click(menu.getByRole('menuitem', { name: new RegExp(L('linkMenu.beside')) }), { after: 1.5 });
  const pane = p.getByRole('button', { name: L('panes.close') }).first();
  await t.focus(p.locator('section.pane, .pane').first(), d.beside, { side: 'left', pointer: false });
  await t.click(pane, { after: 0.8 });

  await t.title(d.s6, d.s6b, async () => {
    await main.locator('.cm-content').first().focus();
    await t.press('ControlOrMeta+End', 0.2);
  });
  await t.type(d.missing, 70);
  await p.keyboard.press('Escape');
  await t.press('ArrowUp', 0.8);
  const ghost = main.locator('.md-wikilink', { hasText: d.missingName }).last();
  await t.click(ghost, { after: 0.8 });
  const create3 = p.locator('.float[role=menu]').first();
  await t.focus(create3, d.create2, { side: 'right' });
  await t.click(create3.getByRole('menuitem').first(), { after: 1.5 });
  await t.say(d.created);

  await t.title(d.s7, d.s7b, async () => {
    await t.nav('section.manuscript');
    await t.wait(0.8);
    await t.click(t.text(d.scene), { after: 1 });
  });
  await t.click(side.getByRole('tab', { name: new RegExp(`^${L('side.links')}`) }).first(), { after: 1 });
  await t.focus(side, d.links, { side: 'left' });
  await t.click(side.getByRole('tab', { name: new RegExp(`^${L('side.properties')}`) }).first(), { after: 0.6 });

  await t.title(d.s8, d.s8b, () => t.press('Alt+ControlOrMeta+f', 1));
  const drawer = p.locator('.search-drawer').first();
  await t.focus(drawer, d.replaceKey, { side: 'right' });
  await t.type(d.find, 110);
  const withBox = drawer.locator('label', { hasText: L('replace.with') }).locator('input');
  await t.click(withBox, { after: 0.2 });
  await t.type(d.with, 110);
  await t.wait(1);
  await t.focus(drawer, d.results, { side: 'right' });
  await t.focus(drawer, d.safe, { side: 'right', pointer: false });
  await t.click(drawer.locator('button.run'), { after: 1.5 });
  const undo = drawer.getByRole('button', { name: L('replace.undo') });
  await t.focus(undo, d.undo, { side: 'right' });
  await t.click(undo, { after: 1.2 });
  await t.press('Escape', 0.6);
}
