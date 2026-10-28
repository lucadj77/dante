// 10. Parti, capitoli e scene: how to divide the novel, the titles of its pieces and how chapter and
// part headings look in the book. Starts from a novel imported from Word, which has parts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets');

export const meta = {
  n: 10,
  group: 'write',
  title: { it: 'Parti, capitoli e scene', en: 'Parts, chapters and scenes' },
  subtitle: { it: 'Come dividere il romanzo e come appaiono i titoli nel libro', en: 'How to divide the novel and how headings look in the book' },
};

export const setup = (lang) => ({ folder: lang === 'it' ? 'Romanzi' : 'Novels' });

/** The novel of the import video, already in Dante when the recording starts. */
export async function prepare(t) {
  const { page: p, L } = t;
  const button = (key) => p.getByRole('button', { name: L(key), exact: true }).first();
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), button('import.word').click()]);
  await fc.setFiles(path.join(ASSETS, t.lang, t.lang === 'it' ? 'Il faro.docx' : 'The Lighthouse.docx'));
  await p.waitForTimeout(1500);
  // the numbers that open the scenes of part one separate scenes
  await p.locator('text=/^1$/').first().click();
  await p.waitForTimeout(500);
  await button('import.mark.break').click();
  await p.waitForTimeout(800);
  for (const key of ['import.continue', 'welcome.choose', 'import.create']) {
    await button(key).click();
    await p.waitForTimeout(1200);
  }
  await p.waitForTimeout(1500);
}

const D = {
  it: {
    intro: 'Come dividere il romanzo, e come appaiono nel libro i titoli di parti, capitoli e scene',
    s1: 'Come dividere',
    s1b: 'Quanto, lo decidi tu',
    tree: 'Nell’albero, il romanzo diviso in parti, capitoli e scene',
    part: 'Le parti raggruppano i capitoli. Sono facoltative',
    chapter: 'Ogni capitolo contiene una o più scene',
    scene: 'La scena è un pezzo di racconto: un luogo, un momento, un punto di vista. Ogni scena è un file',
    free: 'Quanto dividere lo decidi tu: un capitolo può avere anche una sola scena',
    inside: 'Dentro una scena, per staccare due momenti senza farne due scene: una riga vuota con ⌥Invio, o il separatore *** dalla barra',
    s2: 'Le parti',
    s2b: 'Si accendono nelle impostazioni',
    parts: 'In Impostazioni, Questo romanzo, Struttura: con questa casella i capitoli si raggruppano in parti. Spenta, il romanzo ha solo capitoli',
    restart: 'La numerazione dei capitoli può ricominciare in ogni parte',
    partButton: 'Con le parti, nell’albero compare anche il pulsante Parte',
    s3: 'Il titolo di ogni elemento',
    s3b: 'Ti ricorda cosa succede',
    sceneRow: 'Scena 1',
    sceneTitle: 'Al molo',
    title: 'Scene, capitoli e parti hanno un titolo: ti serve per ritrovarli. Si scrive qui, o con un doppio clic nell’albero',
    s4: 'Come appare nel libro',
    s4b: 'Etichetta, numero, titolo',
    settings: 'Sempre in Struttura, l’aspetto dei titoli di parti e capitoli. L’anteprima mostra il risultato',
    numbering: 'La numerazione: nessuna, 1 2 3, I II III, in lettere',
    label: 'L’etichetta prima del numero si scrive come vuoi: per esempio «Libro» al posto di «Parte»',
    labelText: 'Libro',
    numbers: 'words',
    showTitle: 'Senza il titolo, nel libro resta solo «Capitolo uno»',
    separator: 'Tra numero e titolo: due punti, punto, lineetta, oppure a capo',
    sepPreview: 'Con «a capo» il titolo va sotto il numero',
    s5: 'In esportazione',
    s5b: 'Cosa finisce nel libro',
    breaks: 'Prima di una parte o di un capitolo, di solito una pagina nuova. Tra le scene: una riga vuota, un separatore o niente',
    sepField: 'Il separatore tra le scene si scrive qui',
    sepText: '* * *',
    sceneBox: 'Le scene di solito non hanno titolo nel libro. Se lo vuoi, accendi numero o titolo; si può togliere dove il capitolo ha una sola scena',
    same: 'Parti e capitoli hanno qui le stesse scelte della Struttura: sono le stesse impostazioni',
    s6: 'Un titolo per il libro',
    s6b: 'Diverso da quello di lavoro',
    chapterRow: 'Arrivo',
    published: 'Il molo',
    property: 'Il titolo di lavoro resta nell’albero; nel libro esportato va quello della proprietà published_title',
    end: 'Il testo mostra i titoli come saranno nel libro',
  },
  en: {
    intro: 'How to divide the novel, and how the headings of parts, chapters and scenes look in the book',
    s1: 'How to divide',
    s1b: 'How much is up to you',
    tree: 'In the tree, the novel divided into parts, chapters and scenes',
    part: 'Parts group chapters. They are optional',
    chapter: 'Each chapter holds one or more scenes',
    scene: 'A scene is a piece of the story: one place, one moment, one point of view. Each scene is a file',
    free: 'How much to divide is up to you: a chapter can have just one scene',
    inside: 'Inside a scene, to set two moments apart without making two scenes: a blank line with ⌥Return, or the *** separator from the bar',
    s2: 'Parts',
    s2b: 'Turned on in Settings',
    parts: 'In Settings, This novel, Structure: with this box chapters are grouped into parts. Off, the novel has only chapters',
    restart: 'Chapter numbers can start again in each part',
    partButton: 'With parts, the tree also has a Part button',
    s3: 'Every item’s title',
    s3b: 'It reminds you what happens',
    sceneRow: 'Scene 1',
    sceneTitle: 'The quay',
    title: 'Scenes, chapters and parts have a title, to find them again. Type it here, or double-click it in the tree',
    s4: 'How it looks in the book',
    s4b: 'Label, number, title',
    settings: 'Still in Structure, how part and chapter headings look. The preview shows the result',
    numbering: 'Numbering: none, 1 2 3, I II III, in words',
    label: 'The label before the number is yours to write: for instance “Book” instead of “Part”',
    labelText: 'Book',
    numbers: 'words',
    showTitle: 'Without the title, the book shows only “Chapter One”',
    separator: 'Between number and title: colon, full stop, dash, or a new line',
    sepPreview: 'With a new line, the title goes below the number',
    s5: 'When exporting',
    s5b: 'What goes into the book',
    breaks: 'Before a part or a chapter, usually a new page. Between scenes: a blank line, a separator or nothing',
    sepField: 'The separator between scenes is typed here',
    sepText: '* * *',
    sceneBox: 'Scenes usually have no heading in the book. If you want one, turn on the number or the title; it can be left out where a chapter has one scene',
    same: 'Parts and chapters have the same choices here as in Structure: they are the same settings',
    s6: 'A title for the book',
    s6b: 'Different from the working one',
    chapterRow: 'Arrival',
    published: 'The quay at six',
    property: 'The working title stays in the tree; the exported book uses the published_title property',
    end: 'The text shows the headings as they will be in the book',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const tree = p.locator('aside.tree').first();
  const row = (re) => tree.getByText(re).first();
  const field = (legend) => p.locator('fieldset', { has: p.locator('legend', { hasText: new RegExp(`^${legend}$`) }) }).first();
  const select = (box, key) => box.locator('label', { hasText: L(key) }).locator('select').first();
  const choose = async (sel, value) => {
    await t.click(sel, { after: 0.3 });
    await sel.selectOption(value);
    await t.wait(0.8);
  };
  const retype = async (input, text) => {
    await t.click(input, { after: 0.2 });
    await p.keyboard.press('ControlOrMeta+A');
    await t.type(text, 90);
    await t.wait(0.6);
  };

  await t.say(d.intro);

  await t.title(d.s1, d.s1b);
  await t.focus(tree, d.tree, { side: 'right' });
  await t.focus(row(/^Parte I:|^Part I:/), d.part, { side: 'right' });
  await t.focus(row(/^Capitolo 1:|^Chapter 1:/), d.chapter, { side: 'right' });
  await t.focus(row(new RegExp(`^${d.sceneRow}$`)), d.scene, { side: 'right' });
  await t.say(d.free);
  const separator = p.locator('.format-row').getByRole('button', { name: L('format.separator') }).first();
  const blank = p.locator('.format-row').getByRole('button', { name: L('format.blankLine') }).first();
  await t.zoom([separator, blank], () => t.focus([separator, blank], d.inside, { side: 'below' }), 1.6);

  await t.title(d.s2, d.s2b, async () => {
    await t.nav('section.settings');
    await t.wait(0.8);
    await t.click(t.text(L('settings.tabNovel')), { after: 0.6 });
  });
  const parts = p.locator('label', { hasText: L('settings.parts') }).first();
  await t.zoom(parts, () => t.focus(parts, d.parts, { side: 'right' }), 1.4);
  const restart = p.locator('label', { hasText: L('settings.restart') }).first();
  await t.focus(restart, d.restart, { side: 'right' });
  await t.nav('section.manuscript');
  await t.wait(0.8);
  await t.focus(tree.getByRole('button', { name: L('tree.newPart') }).first(), d.partButton, { side: 'right' });

  await t.title(d.s3, d.s3b);
  await t.click(row(new RegExp(`^${d.sceneRow}$`)), { after: 0.8 });
  const titleField = p.locator('aside.side input').first();
  await retype(titleField, d.sceneTitle);
  await t.press('Enter', 0.8);
  await t.focus([titleField, row(new RegExp(`^${d.sceneTitle}$`))], d.title, { side: 'below' });

  await t.title(d.s4, d.s4b, async () => {
    await t.nav('section.settings');
    await t.wait(0.8);
  });
  const part = field(L('kind.part'));
  const chapter = field(L('kind.chapter'));
  await t.focus(part, d.settings, { side: 'right' });
  const preview = (box) => box.getByText(L('settings.preview'), { exact: true }).first().locator('xpath=following-sibling::*[1]');
  await choose(select(chapter, 'settings.numbering'), d.numbers);
  await t.focus([select(chapter, 'settings.numbering'), preview(chapter)], d.numbering, { side: 'right' });
  const label = part.getByRole('textbox', { name: L('settings.label') }).first();
  await retype(label, d.labelText);
  await t.zoom([label, preview(part)], () => t.focus([label, preview(part)], d.label, { side: 'right' }), 1.3);
  const showTitle = chapter.locator('label', { hasText: L('heading.showTitle') }).locator('input').first();
  await t.click(showTitle, { after: 0.8 });
  await t.focus([showTitle, preview(chapter)], d.showTitle, { side: 'right' });
  await t.click(showTitle, { after: 0.8 });
  await choose(select(chapter, 'heading.separator'), '\n');
  await t.focus(select(chapter, 'heading.separator'), d.separator, { side: 'right' });
  await t.zoom(preview(chapter), () => t.focus(preview(chapter), d.sepPreview, { side: 'right', pointer: false }), 1.4);

  await t.title(d.s5, d.s5b, async () => {
    await t.nav('section.export');
    await t.wait(0.8);
  });
  const structure = p.getByText(L('export.structure'), { exact: true }).first();
  const row1 = structure.locator('xpath=following-sibling::*[1]');
  await t.focus([structure, row1], d.breaks, { side: 'right' });
  const sep = p.locator('label', { hasText: L('export.separator') }).locator('input').first();
  await retype(sep, d.sepText);
  await t.zoom(sep, () => t.focus(sep, d.sepField, { side: 'right' }), 1.4);
  await t.focus(field(L('kind.scene')), d.sceneBox, { side: 'right' });
  await t.focus([field(L('kind.part')), field(L('kind.chapter'))], d.same, { side: 'right' });

  await t.title(d.s6, d.s6b, async () => {
    await t.nav('section.manuscript');
    await t.wait(0.8);
    await t.click(row(new RegExp(`${d.chapterRow}$`)), { after: 0.8 });
  });
  const side = p.locator('aside.side').first();
  const name = side.getByPlaceholder(L('panel.propertyName')).first();
  await t.click(name, { after: 0.2 });
  await t.type('published_title', 80);
  await t.click(side.getByRole('button', { name: L('panel.addProperty') }).first(), { after: 0.8 });
  const value = side.locator('label, div', { hasText: /^published_title/ }).locator('input').first()
    .or(side.locator('input').last()).first();
  await t.click(value, { after: 0.2 });
  await t.type(d.published, 80);
  await t.press('Tab', 0.8);
  await t.zoom(value, () => t.focus(value, d.property, { side: 'left' }), 1.4);
  await t.click(p.locator('main.center').getByRole('button', { name: L('level.novel'), exact: true }).first(), { after: 1 });
  await t.focus(p.locator('main.center .cm-content').first(), d.end, { side: 'below' });
}
