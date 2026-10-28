// 11. Le proprietà delle scene: what they are for, where a scene's are changed, adding one, and
// where the novel keeps their type and allowed values.
export const meta = {
  n: 11,
  group: 'write',
  title: { it: 'Le proprietà delle scene', en: 'Scene properties' },
  subtitle: { it: 'A cosa servono, dove si cambiano', en: 'What they are for, where to change them' },
};

const D = {
  it: {
    intro: 'Le proprietà sono le informazioni su una scena: stato, punto di vista, luogo, data. Servono a te, non finiscono nel libro',
    s1: 'A cosa servono',
    s1b: 'Ritrovare e mettere in ordine',
    board: 'Bacheca',
    boardSay: 'In una bacheca, le scene divise per stato: dall’idea alla scena finita',
    time: 'Tempo della storia',
    timeSay: 'Sulla linea del tempo, le scene in ordine di data nella storia',
    dots: 'E nell’albero, il pallino colorato accanto a ogni scena mostra lo stato',
    s2: 'Il pannello Proprietà',
    s2b: 'A destra, per la scena scelta',
    scene: 'L’incontro',
    panel: 'Le proprietà della scena aperta: titolo, sinossi e poi le altre',
    status: 'stato', statusValue: 'finita',
    statusSay: 'Lo stato ha dei valori fissi: si sceglie da un menu',
    pov: 'pov',
    povSay: 'Il punto di vista è un collegamento alla scheda del personaggio nella Bibbia',
    s3: 'Una proprietà nuova',
    s3b: 'Per esempio la stagione',
    name: 'stagione',
    addSay: 'Scrivi il nome e premi Aggiungi proprietà',
    kindSay: 'Il segno prima del nome dice che tipo è: testo, numero, data, casella, elenco o collegamento',
    values: 'primavera, estate, autunno, inverno',
    valuesSay: 'Con i valori ammessi, separati da virgole, la proprietà diventa un menu',
    value: 'autunno',
    allSay: 'Tipo e valori valgono per tutte le scene del romanzo; il valore scelto, solo per questa',
    removeSay: 'La × toglie la proprietà da questa scena',
    s4: 'Per tutto il romanzo',
    s4b: 'Impostazioni, Questo romanzo',
    defined: 'In Proprietà delle note, tutte le proprietà con il loro tipo e i valori ammessi',
    free: 'Qui si cambiano i valori per tutte le scene. Con Testo libero la proprietà torna senza tipo',
    dot: 'Il pallino dell’albero può mostrare un’altra proprietà, per esempio il punto di vista',
    template: 'E qui il modello delle nuove scene: le proprietà con cui parte ogni scena nuova',
    after: 'Ora i colori dei pallini sono i punti di vista: passa col mouse per leggerli',
  },
  en: {
    intro: 'Properties are the facts about a scene: status, point of view, place, date. They are for you, not for the book',
    s1: 'What they are for',
    s1b: 'Finding and sorting',
    board: 'Board',
    boardSay: 'On a board, the scenes sorted by status: from idea to done',
    time: 'Story time',
    timeSay: 'On the timeline, the scenes in the order of their date in the story',
    dots: 'And in the tree, the colored dot beside each scene shows its status',
    s2: 'The Properties panel',
    s2b: 'On the right, for the chosen scene',
    scene: 'The ball',
    panel: 'The open scene’s properties: title, synopsis and then the others',
    status: 'status', statusValue: 'done',
    statusSay: 'Status has fixed values: you choose from a menu',
    pov: 'pov',
    povSay: 'The point of view is a link to the character’s note in the Story Bible',
    s3: 'A new property',
    s3b: 'The season, for instance',
    name: 'season',
    addSay: 'Type the name and press Add property',
    kindSay: 'The sign before the name tells its type: text, number, date, checkbox, list or link',
    values: 'spring, summer, autumn, winter',
    valuesSay: 'With allowed values, separated by commas, the property becomes a menu',
    value: 'autumn',
    allSay: 'Type and values hold for every scene of the novel; the chosen value, only for this one',
    removeSay: 'The × removes the property from this scene',
    s4: 'For the whole novel',
    s4b: 'Settings, This novel',
    defined: 'In Note properties, every property with its type and allowed values',
    free: 'Here the values change for every scene. Free text takes the type away',
    dot: 'The tree’s dot can show another property, the point of view for instance',
    template: 'And here the template for new scenes: the properties every new scene starts with',
    after: 'Now the dots’ colors are the points of view: hover to read them',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const tree = p.locator('aside.tree').first();
  const side = p.locator('aside.side').first();
  const prop = (name) => side.locator('.prop').filter({ has: p.locator('dt', { hasText: new RegExp(`${name}$`) }) }).first();
  const choose = async (sel, value) => {
    await t.click(sel, { after: 0.3 });
    await sel.selectOption(value);
    await t.wait(0.8);
  };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b, () => t.nav('section.views'));
  const view = (name) => p.locator('.view-link', { hasText: name }).first();
  await t.click(view(d.board), { after: 1.2 });
  await t.focus(p.locator('.board').first(), d.boardSay, { side: 'below' });
  await t.click(view(d.time), { after: 1.2 });
  await t.focus(p.locator('ol.timeline').first(), d.timeSay, { side: 'below' });
  await t.nav('section.manuscript');
  await t.wait(1);
  await t.zoom(tree, () => t.focus(tree.locator('.status').first(), d.dots, { side: 'right' }), 1.5);

  await t.title(d.s2, d.s2b, () => t.click(t.text(d.scene), { after: 1 }));
  await t.focus(side, d.panel, { side: 'left' });
  const status = prop(d.status).locator('dd select').first();
  await choose(status, d.statusValue);
  await t.zoom(status, () => t.focus(status, d.statusSay, { side: 'left' }), 1.4);
  await t.focus(prop(d.pov).locator('dd').first(), d.povSay, { side: 'left' });

  await t.title(d.s3, d.s3b);
  const newName = side.getByPlaceholder(L('panel.propertyName'), { exact: true });
  await newName.scrollIntoViewIfNeeded();
  await t.click(newName, { after: 0.2 });
  await t.type(d.name, 100);
  const add = side.getByRole('button', { name: L('panel.addProperty') });
  await t.focus([newName, add], d.addSay, { side: 'left' });
  await t.click(add, { after: 1 });
  const fresh = prop(d.name);
  const kind = fresh.locator('button.kind').first();
  await t.zoom(kind, () => t.focus(kind, d.kindSay, { side: 'left' }), 1.6);
  await t.click(kind, { after: 0.8 });
  await choose(fresh.locator('.def select').first(), 'text');
  const values = fresh.locator('.def input').first();
  await t.click(values, { after: 0.2 });
  await t.type(d.values, 70);
  await t.press('Enter', 1);
  await t.focus(values, d.valuesSay, { side: 'left' });
  await t.click(kind, { after: 0.8 });
  const menu = fresh.locator('dd select').first();
  await choose(menu, d.value);
  await t.zoom(menu, () => t.focus(menu, d.allSay, { side: 'left' }), 1.4);
  await t.focus(fresh.locator('button.remove').first(), d.removeSay, { side: 'left' });

  await t.title(d.s4, d.s4b, async () => {
    await t.nav('section.settings');
    await t.wait(0.8);
    await t.click(t.text(L('settings.tabNovel')), { after: 0.6 });
  });
  const heading = p.getByRole('heading', { name: L('property.defined'), exact: true }).first();
  await heading.scrollIntoViewIfNeeded();
  await t.wait(0.6);
  await t.focus(heading, d.defined, { side: 'right' });
  const def = p.locator('fieldset.property', { has: p.locator('legend', { hasText: new RegExp(`^${d.name}$`) }) }).first();
  await t.focus(def, d.free, { side: 'right' });
  const dot = p.locator('label', { hasText: L('settings.treeDot') }).locator('select').first();
  await choose(dot, 'pov');
  await t.focus(dot, d.dot, { side: 'right' });
  await t.focus(p.getByRole('button', { name: L('settings.sceneTemplateEdit') }).first(), d.template, { side: 'right' });
  await t.nav('section.manuscript');
  await t.wait(1);
  await t.zoom(tree, () => t.focus(tree.locator('.status').first(), d.after, { side: 'right' }), 1.5);
}
