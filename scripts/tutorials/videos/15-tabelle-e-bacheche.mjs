// 15. Tabelle e bacheche: the views of the sample project (board, table, timeline), a condition that
// keeps only some scenes, and a new view of the places as cards.
export const meta = {
  n: 15,
  group: 'bible',
  title: { it: 'Tabelle e bacheche', en: 'Tables and boards' },
  subtitle: { it: 'Il romanzo visto dall’alto', en: 'The novel from above' },
};

const D = {
  it: {
    intro: 'Tabelle e bacheche mostrano scene e schede tutte insieme, ordinate come serve',
    s1: 'Le viste',
    s1b: 'Ognuna è un modo di guardare il romanzo',
    list: 'A sinistra le viste del progetto di esempio: bacheca, tabella, schede, linea del tempo',
    board: 'Bacheca',
    s2: 'La bacheca',
    s2b: 'Le scene divise per stato',
    columns: 'Una colonna per ogni stato, con le scene che lo hanno',
    card: 'La notte',
    to: 'rivista',
    dragged: 'Trascinata in un’altra colonna, la scena cambia stato: anche nelle sue proprietà',
    s3: 'La tabella',
    s3b: 'Ordinare e cambiare',
    table: 'Scene',
    sort: 'Un clic sull’intestazione ordina per quella colonna; un altro clic al contrario',
    sortBy: 'Data',
    row: 'Il nome',
    statusCol: 'stato',
    value: 'bozza',
    edit: 'Un clic su una cella la modifica: Invio salva, e la scena cambia davvero',
    s4: 'Solo alcune scene',
    s4b: 'Una condizione',
    settings: 'Impostazioni della vista: cosa mostrare, condizioni, ordine, gruppi, campi',
    field: 'pov',
    who: 'Renzo',
    filtered: 'Solo se pov è Renzo: restano le sue scene',
    s5: 'La linea del tempo',
    s5b: 'Le scene in ordine di data',
    timeline: 'Tempo della storia',
    time: 'Le scene in ordine di data della storia, non di capitolo. Trascinare una scena su un altro giorno le cambia la data',
    s6: 'Una nuova vista',
    s6b: 'I luoghi come schede',
    newName: 'Luoghi',
    create: 'Nuova vista: un nome, poi si sceglie cosa mostrare e come',
    items: 'place',
    kind: 'Schede',
    region: 'regione',
    done: 'Ecco i luoghi del romanzo, come schede. Ogni vista è un file del progetto',
  },
  en: {
    intro: 'Tables and boards show scenes and sheets all together, arranged as you need',
    s1: 'Views',
    s1b: 'Each one a way of looking at the novel',
    list: 'On the left, the sample project’s views: board, table, cards, timeline',
    board: 'Board',
    s2: 'The board',
    s2b: 'Scenes by status',
    columns: 'One column per status, with the scenes that have it',
    card: 'After the ball',
    to: 'revised',
    dragged: 'Dragged into another column, the scene changes status: in its properties too',
    s3: 'The table',
    s3b: 'Sorting and changing',
    table: 'Scenes',
    sort: 'A click on the heading sorts by that column; another click reverses it',
    sortBy: 'Date',
    row: 'Talking over the ball',
    statusCol: 'status',
    value: 'draft',
    edit: 'A click on a cell edits it: Return saves, and the scene really changes',
    s4: 'Only some scenes',
    s4b: 'A condition',
    settings: 'The view’s settings: what to show, conditions, order, groups, fields',
    field: 'pov',
    who: 'Elizabeth',
    filtered: 'Only if pov is Elizabeth: her scenes remain',
    s5: 'The timeline',
    s5b: 'Scenes in date order',
    timeline: 'Story time',
    time: 'Scenes in the order of the story’s dates, not of chapters. Dragging a scene onto another day changes its date',
    s6: 'A new view',
    s6b: 'Places as cards',
    newName: 'Places',
    create: 'New view: a name, then you choose what to show and how',
    items: 'place',
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

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b, () => t.nav('section.views'));
  await t.focus(p.locator('.views aside, .views nav').first(), d.list, { side: 'right' });

  await t.title(d.s2, d.s2b, () => open(d.board));
  await t.focus(body.locator('.board').first(), d.columns, { side: 'below', pointer: false });
  const card = body.locator('article.card', { hasText: d.card }).first();
  const column = body.locator('section.column', { has: p.locator('h3', { hasText: d.to }) }).first();
  await t.drag(card, column, { dy: 0.6 });
  await t.wait(0.6);
  await t.focus(body.locator('article.card', { hasText: d.card }).first(), d.dragged, { side: 'below', pointer: false });

  await t.title(d.s3, d.s3b, () => open(d.table));
  const header = body.locator('th button', { hasText: d.sortBy }).first();
  await t.focus(header, d.sort, { side: 'below' });
  await t.click(header, { after: 1.2 });
  await t.click(header, { after: 1.2 });
  const fields = await body.locator('thead th').allInnerTexts();
  const col = fields.findIndex((f) => f.trim().toLowerCase().startsWith(d.statusCol));
  const row = body.locator('tbody tr', { hasText: d.row }).first();
  const cell = row.locator('td').nth(col);
  await t.click(cell.locator('button.cell'), { after: 0.4 });
  await p.keyboard.press('ControlOrMeta+A');
  await t.type(d.value, 100);
  await t.press('Enter', 0.8);
  await t.zoom(row, () => t.focus(row, d.edit, { side: 'below', pointer: false }), 1.4);

  await t.title(d.s4, d.s4b);
  await t.click(views.getByRole('button', { name: new RegExp(L('views.settings')) }).first(), { after: 0.8 });
  const settings = views.locator('section.settings').first();
  await t.focus(settings, d.settings, { side: 'below' });
  await t.click(settings.getByRole('button', { name: new RegExp(L('views.addFilter')) }), { after: 0.6 });
  const filter = settings.locator('select[aria-label]').filter({ has: p.locator('option') }).first();
  await t.click(filter, { after: 0.3 });
  await filter.selectOption(d.field);
  await t.wait(0.5);
  const values = settings.getByPlaceholder(L('views.filterValues')).first();
  await t.click(values, { after: 0.2 });
  await t.type(d.who, 100);
  await t.press('Tab', 1);
  await t.click(views.getByRole('button', { name: new RegExp(L('views.settings')) }).first(), { after: 0.8 });
  await t.focus(body.locator('table').first(), d.filtered, { side: 'below', pointer: false });

  await t.title(d.s5, d.s5b, () => open(d.timeline));
  await t.focus(body, d.time, { side: 'right', pointer: false });

  await t.title(d.s6, d.s6b);
  const add = views.getByRole('button', { name: new RegExp(L('views.new')) }).first();
  await t.click(add, { after: 0.4 });
  const name = views.getByPlaceholder(L('views.newName'));
  await t.type(d.newName, 90);
  await t.focus([name], d.create, { side: 'right' });
  await t.click(views.getByRole('button', { name: L('views.create'), exact: true }), { after: 1.2 });
  const settings2 = views.locator('section.settings').first();
  const items = settings2.locator('label', { hasText: L('views.items') }).locator('select');
  await t.click(items, { after: 0.3 });
  await items.selectOption(d.items);
  await t.wait(0.8);
  await t.click(views.locator('.kinds button', { hasText: d.kind }).first(), { after: 1 });
  const region = settings2.locator('label.check', { hasText: d.region }).locator('input');
  if (await region.count()) await t.click(region, { after: 0.8 });
  await t.click(views.getByRole('button', { name: new RegExp(L('views.settings')) }).first(), { after: 1 });
  await t.focus(body, d.done, { side: 'below', pointer: false });
}
