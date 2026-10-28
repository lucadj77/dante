// 5. L'area di lavoro: the four zones, the section bar with names, the right panel's tabs, hiding and
// resizing panels, text zoom and the help inside Dante.
export const meta = {
  n: 5,
  group: 'start',
  title: { it: 'L’area di lavoro', en: 'The workspace' },
  subtitle: { it: 'Dove si trova ogni cosa in Dante', en: 'Where everything is in Dante' },
};

const D = {
  it: {
    intro: 'Aperto un romanzo, Dante si divide in quattro zone',
    scene: 'L’incontro',
    s1: 'Le quattro zone',
    s1b: 'Da sinistra a destra',
    nav: 'La barra delle sezioni: manoscritto, Bibbia, note, tabelle, statistiche, esportazione',
    tree: 'Il pannello a sinistra: l’albero della sezione aperta, qui capitoli e scene',
    editor: 'Al centro l’editor, dove scrivi',
    side: 'Il pannello a destra, con le informazioni su quello che hai aperto',
    s2: 'La barra delle sezioni',
    s2b: 'Con i nomi o solo le icone',
    names: 'Mostra i nomi allarga la barra e scrive il nome di ogni sezione',
    wide: 'Ora ogni icona ha il suo nome. Lo stesso pulsante la stringe di nuovo',
    bottom: 'In basso: Aiuto, Cestino, Impostazioni e Chiudi progetto',
    s3: 'Il pannello a destra',
    s3b: 'Proprietà, Collegamenti, Commenti',
    props: 'Proprietà: titolo, sinossi, stato e le altre informazioni della scena',
    links: 'Collegamenti: le schede citate nella scena e le note che la citano',
    comments: 'Commenti: le note a margine e le revisioni proposte',
    s4: 'Fare spazio',
    s4b: 'Nascondere e allargare i pannelli',
    hideLeft: 'Questo pulsante nasconde il pannello a sinistra; quello in alto a destra nasconde l’altro',
    hidden: 'Più spazio per il testo. Un altro clic li riporta',
    border: 'Il bordo di un pannello si trascina per allargarlo',
    reset: 'Un doppio clic sul bordo lo riporta alla larghezza normale',
    s5: 'Ingrandire il testo',
    s5b: '⌘+ e ⌘− (Ctrl+ e Ctrl−)',
    bigger: '⌘+ ingrandisce tutto, ⌘− rimpicciolisce, ⌘0 torna alla misura normale',
    s6: 'L’aiuto',
    s6b: 'Dentro Dante, anche senza connessione',
    help: 'Aiuto apre i primi passi, la guida completa e le novità',
    guide: 'La guida completa, divisa in capitoli: un clic sul titolo porta al capitolo',
    end: 'Ogni pulsante ha un suggerimento: basta tenerci sopra il mouse',
  },
  en: {
    intro: 'Once a novel is open, Dante is split into four zones',
    scene: 'The ball',
    s1: 'The four zones',
    s1b: 'From left to right',
    nav: 'The section bar: manuscript, Story Bible, notes, tables, statistics, export',
    tree: 'The left panel: the tree of the open section, here chapters and scenes',
    editor: 'In the middle, the editor, where you write',
    side: 'The right panel, with information about what you have open',
    s2: 'The section bar',
    s2b: 'With names or icons only',
    names: 'Show names widens the bar and writes each section’s name',
    wide: 'Now every icon has its name. The same button narrows it again',
    bottom: 'At the bottom: Help, Trash, Settings and Close project',
    s3: 'The right panel',
    s3b: 'Properties, Links, Comments',
    props: 'Properties: title, synopsis, status and the scene’s other information',
    links: 'Links: the notes the scene mentions and the notes that mention it',
    comments: 'Comments: margin notes and suggested changes',
    s4: 'Making room',
    s4b: 'Hiding and widening panels',
    hideLeft: 'This button hides the left panel; the one at the top right hides the other',
    hidden: 'More room for the text. Another click brings them back',
    border: 'Drag a panel’s edge to widen it',
    reset: 'A double click on the edge puts it back to its usual width',
    s5: 'Bigger text',
    s5b: '⌘+ and ⌘− (Ctrl+ and Ctrl−)',
    bigger: '⌘+ makes everything bigger, ⌘− smaller, ⌘0 goes back to the usual size',
    s6: 'Help',
    s6b: 'Inside Dante, even offline',
    help: 'Help opens the first steps, the full guide and what’s new',
    guide: 'The full guide, in chapters (for now in Italian only): click a title to go to it',
    end: 'Every button has a tip: just hold the mouse over it',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const nav = p.locator('nav[aria-label="Sections"]').first();
  const navButton = (id) => nav.locator(`[data-section="${id}"]`).first();
  const tree = p.locator('aside.tree').first();
  const side = p.locator('aside.side').first();
  const tab = (key) => side.getByRole('tab', { name: new RegExp(`^${L(key)}`) }).first();

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });
  await t.click(t.text(d.scene), { after: 1 });

  await t.title(d.s1, d.s1b);
  await t.focus(nav, d.nav, { side: 'right' });
  await t.focus(tree, d.tree, { side: 'right' });
  await t.focus(p.locator('main.center').first(), d.editor, { side: 'below' });
  await t.focus(side, d.side, { side: 'left' });

  await t.title(d.s2, d.s2b);
  await t.zoom(navButton('names'), () => t.focus(navButton('names'), d.names, { side: 'right' }), 1.6);
  await t.click(navButton('names'), { after: 1 });
  await t.focus(nav, d.wide, { side: 'right' });
  await t.focus([navButton('help'), navButton('close')], d.bottom, { side: 'right' });
  await t.click(navButton('names'), { after: 1 });

  await t.title(d.s3, d.s3b);
  await t.focus(tab('side.properties'), d.props, { side: 'left' });
  await t.click(tab('side.links'), { after: 1 });
  await t.focus(side, d.links, { side: 'left' });
  await t.click(tab('side.comments'), { after: 1 });
  await t.focus(side, d.comments, { side: 'left' });
  await t.click(tab('side.properties'), { after: 0.8 });

  await t.title(d.s4, d.s4b);
  const left = p.getByRole('button', { name: L('nav.hideLeft') }).first();
  await t.zoom(left, () => t.focus(left, d.hideLeft, { side: 'right' }), 1.6);
  await t.click(left, { after: 0.6 });
  await t.click(p.getByRole('button', { name: L('nav.hideRight') }).first(), { after: 1 });
  await t.focus(p.locator('main.center').first(), d.hidden, { side: 'below', pointer: false });
  await t.click(p.getByRole('button', { name: L('nav.showLeft') }).first(), { after: 0.6 });
  await t.click(p.getByRole('button', { name: L('nav.showRight') }).first(), { after: 1 });
  const edge = p.locator('.resizer.left').first();
  await t.focus(edge, d.border, { side: 'right' });
  let r = await edge.boundingBox();
  await t.moveTo(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  await t.moveTo(r.x + r.width / 2 + 120, r.y + r.height / 2);
  await p.mouse.up();
  await t.wait(1);
  r = await edge.boundingBox();
  await t.moveTo(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2);
  await t.wait(0.8);
  await t.focus(edge, d.reset, { side: 'right' });

  await t.title(d.s5, d.s5b);
  await t.press('ControlOrMeta+=', 0.6);
  await t.press('ControlOrMeta+=', 1);
  await t.focus(p.locator('main.center').first(), d.bigger, { side: 'below', pointer: false });
  await t.press('ControlOrMeta+0', 1);

  await t.title(d.s6, d.s6b);
  await t.focus(navButton('help'), d.help, { side: 'right' });
  await t.click(navButton('help'), { after: 1.2 });
  const dialog = p.locator('.help[role=dialog]').first();
  await t.click(dialog.getByRole('tab', { name: L('help.guide') }), { after: 1.5 });
  await t.focus(dialog.locator('.chapters').first(), d.guide, { side: 'right' });
  await t.click(dialog.locator('.chapters li').nth(3), { after: 1.5 });
  await t.click(dialog.getByRole('button', { name: L('help.close') }), { after: 0.8 });
  await t.point(navButton('views'));
  await t.wait(1.2);
  await t.say(d.end);
}
