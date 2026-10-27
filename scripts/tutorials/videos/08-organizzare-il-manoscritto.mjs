// 8. Organizzare il manoscritto: new scenes and chapters, splitting, moving, merging, the trash,
// the prologue and how chapter headings are written.
export const meta = {
  n: 8,
  group: 'write',
  title: { it: 'Organizzare il manoscritto', en: 'Organizing the manuscript' },
  subtitle: { it: 'Scene e capitoli: aggiungere, dividere, spostare, fondere', en: 'Scenes and chapters: add, split, move, merge' },
};

const D = {
  it: {
    intro: 'Il manoscritto è fatto di capitoli e scene: si organizza nell’albero a sinistra',
    last: 'Lucia',
    s1: 'Scene e capitoli',
    s1b: 'Dall’albero',
    addScene: 'Scena aggiunge una scena dopo quella scelta',
    sceneName: 'Il commiato',
    rename: 'Doppio clic sul nome per rinominarla',
    chapterName: 'La fuga',
    addChapter: 'Capitolo aggiunge un capitolo dopo quello scelto, con la sua prima scena. Con i capitoli raggruppati in parti compare anche Parte',
    s2: 'Dividere una scena',
    s2b: '⌘Invio (Ctrl+Invio)',
    splitScene: 'Perpetua',
    splitAt: '«Niente, niente,» rispose don Abbondio',
    cursor: 'Il cursore dove deve cominciare la scena nuova',
    split: 'Il testo dopo il cursore è diventato una scena a sé. ⌘Maiusc+Invio, invece, apre un capitolo nuovo',
    s3: 'Spostare',
    s3b: 'Trascinando nell’albero',
    moved: 'Trascinata sul capitolo, la scena ci entra. I file si rinumerano da soli',
    s4: 'Fondere due scene',
    s4b: '⌘clic (Ctrl+clic) per sceglierle',
    first: 'Il nome', second: 'Lucia',
    choose: 'Con ⌘ premuto, il clic aggiunge una scena alle scelte',
    merge: 'Fondi le unisce nella prima, nell’ordine di lettura',
    s5: 'Il cestino',
    s5b: 'Niente si perde per sbaglio',
    menu: 'Con il tasto destro su una scena: Elimina',
    confirm: 'Dante chiede conferma, poi la scena va nel cestino',
    trash: 'Il cestino è in basso nella barra a sinistra',
    restore: 'Rimetti a posto la riporta dov’era',
    s6: 'Prologo ed epilogo',
    s6b: 'Il tipo del capitolo',
    intro2: 'Introduzione',
    kind: 'L’introduzione è un prologo: lo dice il Tipo nelle proprietà del capitolo. Un prologo non prende il numero dei capitoli',
    s7: 'I titoli dei capitoli',
    s7b: 'Impostazioni, Struttura',
    numbering: 'Numerazione: Primo, secondo, terzo',
    separator: 'Tra numero e titolo: a capo',
    preview: 'L’anteprima mostra il risultato: «Capitolo primo» e il titolo sotto',
    after: 'Lo stesso titolo nell’albero, nel testo e nel libro esportato',
  },
  en: {
    intro: 'The manuscript is made of chapters and scenes: you organize it in the tree on the left',
    last: 'Talking over the ball',
    s1: 'Scenes and chapters',
    s1b: 'From the tree',
    addScene: 'Scene adds a scene after the chosen one',
    sceneName: 'The farewell',
    rename: 'Double-click the name to rename it',
    chapterName: 'The journey',
    addChapter: 'Chapter adds a chapter after the chosen one, with its first scene. When chapters are grouped in parts, Part shows too',
    s2: 'Splitting a scene',
    s2b: '⌘Return (Ctrl+Enter)',
    splitScene: 'Jane and Elizabeth',
    splitAt: '“He is also handsome,”',
    cursor: 'The cursor where the new scene should start',
    split: 'The text after the cursor is now a scene of its own. ⌘Shift+Return starts a new chapter instead',
    s3: 'Moving',
    s3b: 'By dragging in the tree',
    moved: 'Dropped on the chapter, the scene goes into it. The files renumber themselves',
    s4: 'Merging two scenes',
    s4b: '⌘-click (Ctrl+click) to choose them',
    first: 'The ball', second: 'After the ball',
    choose: 'With ⌘ held down, a click adds a scene to the chosen ones',
    merge: 'Merge joins them into the first, in reading order',
    s5: 'The trash',
    s5b: 'Nothing gets lost by mistake',
    menu: 'Right-click a scene: Delete',
    confirm: 'Dante asks first, then the scene goes to the trash',
    trash: 'The trash is at the bottom of the bar on the left',
    restore: 'Put back returns it where it was',
    s6: 'Prologue and epilogue',
    s6b: 'The chapter’s type',
    intro2: 'Netherfield is let',
    kind: 'A chapter can be a prologue or an epilogue: choose it in Type, among the chapter’s properties. A prologue takes no chapter number',
    s7: 'Chapter headings',
    s7b: 'Settings, Structure',
    numbering: 'Numbering: First, second, third',
    separator: 'Between number and title: new line',
    preview: 'The preview shows the result: “Chapter the first” with the title below',
    after: 'The same heading in the tree, in the text and in the exported book',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const tree = p.locator('aside.tree').first();
  const row = (name) => tree.getByText(name, { exact: true }).first();
  const add = (key) => tree.getByRole('button', { name: L(key) }).first();
  const chapterRow = () => tree.getByText(new RegExp(`${d.chapterName}$`)).first();

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b);
  await t.click(row(d.last), { after: 0.6 });
  await t.focus(add('tree.newScene'), d.addScene, { side: 'right' });
  await t.click(add('tree.newScene'), { after: 1.2 });
  const fresh = row(L('untitledScene'));
  await t.focus(fresh, d.rename, { side: 'right' });
  await dblclick(t, fresh);
  await p.keyboard.press('ControlOrMeta+A');
  await t.type(d.sceneName);
  await t.press('Enter', 0.8);
  await t.focus(add('tree.newChapter'), d.addChapter, { side: 'right' });
  await t.click(add('tree.newChapter'), { after: 1.2 });
  const chapter = tree.getByText(new RegExp(`: ${L('untitled')}$`)).first();
  await dblclick(t, chapter);
  await p.keyboard.press('ControlOrMeta+A');
  await t.type(d.chapterName);
  await t.press('Enter', 1);

  await t.title(d.s2, d.s2b, () => t.click(row(d.splitScene), { after: 1 }));
  const at = t.line(d.splitAt);
  await t.click(at, { dx: 0.02, after: 0.2 });
  await t.press('Home', 0.3);
  await t.focus(at, d.cursor, { side: 'below', hold: 2.5 });
  await t.press('ControlOrMeta+Enter', 1.5);
  await t.focus(tree, d.split, { side: 'right' });

  await t.title(d.s3, d.s3b);
  const moving = tree.locator('[aria-selected="true"], [aria-current="true"], .selected').first();
  await t.drag(moving, chapterRow());
  await t.focus(chapterRow(), d.moved, { side: 'right' });

  await t.title(d.s4, d.s4b);
  await t.click(row(d.first), { after: 0.6 });
  await p.keyboard.down('ControlOrMeta');
  await t.click(row(d.second), { after: 0.4 });
  await p.keyboard.up('ControlOrMeta');
  await t.focus([row(d.first), row(d.second)], d.choose, { side: 'right' });
  const merge = tree.getByRole('button', { name: L('tree.merge'), exact: true }).first();
  await t.focus(merge, d.merge, { side: 'right' });
  await t.click(merge, { after: 1.5 });

  await t.title(d.s5, d.s5b);
  const gone = row(d.sceneName);
  await t.point(gone);
  await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' });
  await t.wait(0.8);
  const del = p.getByRole('menuitem', { name: L('tree.deleteItem') }).first();
  await t.focus(del, d.menu, { side: 'right' });
  p.once('dialog', (dialog) => dialog.accept());
  await t.click(del, { after: 0.5 });
  await t.say(d.confirm);
  const bin = p.locator('nav[aria-label]').first().getByRole('button', { name: L('trash.title'), exact: true });
  await t.focus(bin, d.trash, { side: 'right' });
  await t.click(bin, { after: 1 });
  const item = p.locator('[role=dialog] li', { hasText: d.sceneName }).first();
  await t.focus(item.getByRole('button', { name: L('trash.restore') }), d.restore, { side: 'below' });
  await t.click(item.getByRole('button', { name: L('trash.restore') }), { after: 1.2 });
  await t.click(p.locator('[role=dialog]').getByRole('button', { name: L('trash.close') }), { after: 0.8 });

  await t.title(d.s6, d.s6b, () => t.click(tree.getByText(new RegExp(`${d.intro2}$`)).first(), { after: 1 }));
  const kind = p.locator('label', { hasText: L('panel.kind') }).locator('select').first();
  await t.focus(kind, d.kind, { side: 'left' });

  await t.title(d.s7, d.s7b, async () => {
    await t.nav('section.settings');
    await t.wait(0.8);
    await p.locator('fieldset', { has: p.locator('legend', { hasText: L('kind.chapter') }) }).first().scrollIntoViewIfNeeded();
  });
  const box = p.locator('fieldset', { has: p.locator('legend', { hasText: L('kind.chapter') }) }).first();
  const numbering = box.locator('label', { hasText: L('settings.numbering') }).locator('select').first();
  await t.click(numbering, { after: 0.3 });
  await numbering.selectOption('ordinal');
  await t.wait(0.8);
  await t.focus(numbering, d.numbering, { side: 'right' });
  const sep = box.locator('label', { hasText: L('heading.separator') }).locator('select').first();
  await t.click(sep, { after: 0.3 });
  await sep.selectOption('\n');
  await t.wait(0.8);
  await t.focus(sep, d.separator, { side: 'right' });
  const preview = box.getByText(L('settings.preview'), { exact: true }).first().locator('xpath=following-sibling::*[1]');
  await t.focus(preview, d.preview, { side: 'right', pointer: false });
  await t.nav('section.manuscript');
  await t.wait(1);
  await t.focus(tree, d.after, { side: 'right' });
}

/** A double click where the pretend cursor is. */
async function dblclick(t, loc) {
  const r = await loc.boundingBox();
  await t.moveTo(r.x + Math.min(r.width / 2, 60), r.y + r.height / 2);
  await t.wait(0.3);
  await t.page.mouse.dblclick(r.x + Math.min(r.width / 2, 60), r.y + r.height / 2);
  await t.wait(0.6);
}
