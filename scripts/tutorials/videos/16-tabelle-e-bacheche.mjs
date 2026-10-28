// 16. Tabelle e bacheche: what views are for, the board and the table, the five kinds of view on the
// same scenes, every setting of a view one by one, and a new view of the places as cards.
export const meta = {
  n: 16,
  group: 'bible',
  title: { it: 'Tabelle e bacheche', en: 'Tables and boards' },
  subtitle: { it: 'Il romanzo visto dall’alto', en: 'The novel from above' },
};

const D = {
  it: {
    intro: 'Le viste mostrano scene e schede tutte insieme, ordinate come serve: il romanzo visto dall’alto',
    s1: 'A cosa servono',
    s1b: 'Domande sul romanzo',
    why: [
      'Quali scene sono ancora in bozza? Quale personaggio racconta di più? In che ordine avvengono i fatti?',
      'Una vista risponde a colpo d’occhio, senza aprire le scene una per una',
    ],
    list: 'A sinistra le viste del progetto: ognuna è una domanda, salvata',
    board: 'Bacheca',
    s2: 'La bacheca',
    s2b: 'Per seguire il lavoro',
    columns: 'Una colonna per ogni stato: si vede subito cosa è finito e cosa resta da rivedere',
    card: 'La notte',
    to: 'rivista',
    dragged: 'Trascinata in un’altra colonna, la scena cambia stato: anche nelle sue proprietà',
    s3: 'La tabella',
    s3b: 'Per confrontare',
    table: 'Scene',
    tableSay: 'Tutte le proprietà in colonna, come in un foglio di calcolo',
    sort: 'Un clic sull’intestazione ordina per quella colonna; un altro clic al contrario',
    sortBy: 'Data',
    row: 'Il nome',
    statusCol: 'stato',
    value: 'bozza',
    edit: 'Un clic su una cella la modifica: Invio salva, e la scena cambia davvero',
    s4: 'Cinque modi di guardare',
    s4b: 'Le stesse scene, in forme diverse',
    kindsSay: 'Ogni vista può cambiare forma da qui, senza perdere le impostazioni',
    kinds: {
      list: 'Lista: una riga per scena con la sinossi, da leggere come una scaletta',
      cards: 'Schede: un riquadro per scena con le proprietà principali, per avere tutto sott’occhio',
      kanban: 'Bacheca: una colonna per valore. Trascinare una scena da una colonna all’altra cambia il valore',
      timeline: 'Linea del tempo: le scene in ordine di data nella storia, non di capitolo',
      table: 'E di nuovo Tabella',
    },
    date: 'data',
    s5: 'Le impostazioni',
    s5b: 'Una per una',
    items: 'Mostra: le scene, i capitoli, tutte le note o le schede di un tipo della Bibbia',
    source: 'Dalle cartelle: solo una parte del progetto, per esempio un capitolo. Vuoto, tutto',
    field: 'pov',
    who: 'Renzo',
    filter: 'Solo se: una condizione. Qui solo le scene con il punto di vista di Renzo',
    sortField: 'data',
    sortSay: 'Ordina per una proprietà, anche al contrario',
    group: 'stato',
    groupSay: 'Raggruppa per: le scene divise in gruppi, qui per stato',
    fields: 'Campi mostrati: le colonne da vedere',
    fieldOff: 'luogo',
    result: 'Il risultato: le scene di Renzo, per stato, in ordine di data',
    s6: 'Una nuova vista',
    s6b: 'I luoghi come schede',
    newName: 'Luoghi',
    create: 'Nuova vista: un nome, poi si sceglie cosa mostrare e come',
    itemsValue: 'place',
    kind: 'Schede',
    region: 'regione',
    done: 'Ecco i luoghi del romanzo, come schede. Ogni vista è un file del progetto',
  },
  en: {
    intro: 'Views show scenes and sheets all together, arranged as you need: the novel from above',
    s1: 'What they are for',
    s1b: 'Questions about the novel',
    why: [
      'Which scenes are still drafts? Which character tells the most? In what order do things happen?',
      'A view answers at a glance, without opening the scenes one by one',
    ],
    list: 'On the left, the project’s views: each one a question, saved',
    board: 'Board',
    s2: 'The board',
    s2b: 'To follow the work',
    columns: 'One column per status: you see at once what is done and what still needs revising',
    card: 'After the ball',
    to: 'revised',
    dragged: 'Dragged into another column, the scene changes status: in its properties too',
    s3: 'The table',
    s3b: 'To compare',
    table: 'Scenes',
    tableSay: 'Every property in a column, as in a spreadsheet',
    sort: 'A click on the heading sorts by that column; another click reverses it',
    sortBy: 'Date',
    row: 'Talking over the ball',
    statusCol: 'status',
    value: 'draft',
    edit: 'A click on a cell edits it: Return saves, and the scene really changes',
    s4: 'Five ways of looking',
    s4b: 'The same scenes, in different shapes',
    kindsSay: 'Any view can change shape from here, keeping its settings',
    kinds: {
      list: 'List: one row per scene with its synopsis, to read like an outline',
      cards: 'Cards: one box per scene with its main properties, to see everything at once',
      kanban: 'Board: one column per value. Dragging a scene to another column changes the value',
      timeline: 'Timeline: the scenes in the order of their date in the story, not of chapters',
      table: 'And back to Table',
    },
    date: 'date',
    s5: 'The settings',
    s5b: 'One by one',
    items: 'Show: scenes, chapters, every note, or the sheets of a Story Bible type',
    source: 'From folders: only part of the project, a chapter for instance. Empty, everything',
    field: 'pov',
    who: 'Elizabeth',
    filter: 'Only if: a condition. Here only the scenes told by Elizabeth',
    sortField: 'date',
    sortSay: 'Sort by a property, in reverse too',
    group: 'status',
    groupSay: 'Group by: the scenes divided into groups, by status here',
    fields: 'Fields shown: the columns to see',
    fieldOff: 'place',
    result: 'The result: Elizabeth’s scenes, by status, in date order',
    s6: 'A new view',
    s6b: 'Places as cards',
    newName: 'Places',
    create: 'New view: a name, then you choose what to show and how',
    itemsValue: 'place',
    kind: 'Cards',
    region: 'region',
    done: 'Here are the novel’s places, as cards. Every view is a file in the project',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const views = p.locator('.views').first();
  const open = (name) => t.click(views.locator('.view-link', { hasText: new RegExp(`^${name}`) }).first(), { after: 1.2 });
  const body = views.locator('.body').first();
  const toggleSettings = () => t.click(views.getByRole('button', { name: new RegExp(L('views.settings')) }).first(), { after: 0.8 });
  const settings = views.locator('section.settings').first();
  const setting = (key) => settings.locator('label', { hasText: L(key) }).first();
  const choose = async (sel, value) => {
    await t.click(sel, { after: 0.3 });
    await sel.selectOption(value);
    await t.wait(0.8);
  };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b, () => t.nav('section.views'));
  for (const w of d.why) await t.say(w);
  await t.focus(p.locator('.views aside, .views nav').first(), d.list, { side: 'right' });

  await t.title(d.s2, d.s2b, () => open(d.board));
  await t.focus(body.locator('.board').first(), d.columns, { side: 'below', pointer: false });
  const card = body.locator('article.card', { hasText: d.card }).first();
  const column = body.locator('section.column', { has: p.locator('h3', { hasText: d.to }) }).first();
  await t.drag(card, column, { dy: 0.6 });
  await t.wait(0.6);
  await t.focus(body.locator('article.card', { hasText: d.card }).first(), d.dragged, { side: 'below', pointer: false });

  await t.title(d.s3, d.s3b, () => open(d.table));
  await t.focus(body.locator('table').first(), d.tableSay, { side: 'below', pointer: false });
  const header = body.locator('th button', { hasText: d.sortBy }).first();
  await t.focus(header, d.sort, { side: 'below' });
  await t.click(header, { after: 1.2 });
  await t.click(header, { after: 1.2 });
  const columns = await body.locator('thead th').allInnerTexts();
  const col = columns.findIndex((f) => f.trim().toLowerCase().startsWith(d.statusCol));
  const row = body.locator('tbody tr', { hasText: d.row }).first();
  const cell = row.locator('td').nth(col);
  await t.click(cell.locator('button.cell'), { after: 0.4 });
  await p.keyboard.press('ControlOrMeta+A');
  await t.type(d.value, 100);
  await t.press('Enter', 0.8);
  await t.zoom(row, () => t.focus(row, d.edit, { side: 'below', pointer: false }), 1.4);

  await t.title(d.s4, d.s4b);
  const kinds = views.locator('.kinds').first();
  await t.zoom(kinds, () => t.focus(kinds, d.kindsSay, { side: 'below' }), 1.6);
  for (const kind of ['list', 'cards', 'kanban', 'timeline', 'table']) {
    await t.click(kinds.locator('button', { hasText: L(`views.kind.${kind}`) }).first(), { after: 1.2 });
    if (kind === 'timeline' && (await body.getByText(L('views.needDate'), { exact: false }).count())) {
      await toggleSettings();
      await choose(setting('views.date').locator('select'), d.date);
      await toggleSettings();
    }
    await t.focus(body, d.kinds[kind], { side: 'right', pointer: false });
  }

  await t.title(d.s5, d.s5b, toggleSettings);
  await t.focus(setting('views.items'), d.items, { side: 'right' });
  await t.focus(setting('views.source'), d.source, { side: 'right' });
  await t.click(settings.getByRole('button', { name: new RegExp(L('views.addFilter')) }), { after: 0.6 });
  const filter = settings.locator('select[aria-label]').filter({ has: p.locator('option') }).first();
  await choose(filter, d.field);
  const values = settings.getByPlaceholder(L('views.filterValues')).first();
  await t.click(values, { after: 0.2 });
  await t.type(d.who, 100);
  await t.press('Tab', 1);
  await t.focus(settings.locator('.filters').first(), d.filter, { side: 'right' });
  await choose(setting('views.sort').locator('select'), d.sortField);
  await t.focus(setting('views.sort'), d.sortSay, { side: 'right' });
  await choose(setting('views.groupBy').locator('select'), d.group);
  await t.focus(setting('views.groupBy'), d.groupSay, { side: 'right' });
  const fields = settings.locator('fieldset', { has: p.locator('legend', { hasText: L('views.fields') }) }).first();
  await fields.scrollIntoViewIfNeeded();
  const off = fields.locator('label.check', { hasText: new RegExp(`^\\s*${d.fieldOff}\\s*$`) }).locator('input').first();
  if (await off.count()) await t.click(off, { after: 0.8 });
  await t.focus(fields, d.fields, { side: 'right' });
  await toggleSettings();
  await t.focus(body, d.result, { side: 'below', pointer: false });

  await t.title(d.s6, d.s6b);
  const add = views.getByRole('button', { name: new RegExp(L('views.new')) }).first();
  await t.click(add, { after: 0.4 });
  const name = views.getByPlaceholder(L('views.newName'));
  await t.type(d.newName, 90);
  await t.focus([name], d.create, { side: 'right' });
  await t.click(views.getByRole('button', { name: L('views.create'), exact: true }), { after: 1.2 });
  const items = setting('views.items').locator('select');
  await choose(items, d.itemsValue);
  await t.click(views.locator('.kinds button', { hasText: d.kind }).first(), { after: 1 });
  const region = settings.locator('label.check', { hasText: d.region }).locator('input');
  if (await region.count()) await t.click(region, { after: 0.8 });
  await toggleSettings();
  await t.focus(body, d.done, { side: 'below', pointer: false });
}
