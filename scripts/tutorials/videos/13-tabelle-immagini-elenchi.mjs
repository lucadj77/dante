// 13. Tabelle, immagini ed elenchi nel testo: lists with their levels, a table with its bar and caption,
// and an image that lands among the attachments, with a width and a description.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets');

export const meta = {
  n: 13,
  group: 'write',
  title: { it: 'Tabelle, immagini ed elenchi nel testo', en: 'Tables, images and lists' },
  subtitle: { it: 'Quando il romanzo ha bisogno di più del semplice testo', en: 'When a novel needs more than plain text' },
};

const D = {
  it: {
    intro: 'Un elenco, una tabella, un’immagine: anche questi stanno nel testo, e arrivano nel libro esportato',
    scene: 'Il nome',
    s1: 'Gli elenchi',
    s1b: 'Puntati e numerati',
    bullet: 'Elenco puntato dalla barra; Invio aggiunge una voce',
    items: ['La lista di Agnese:', 'per l’avvocato', 'i capponi, quattro', 'una lettera'],
    tab: 'Quattro spazi prima di una voce la portano un livello più in dentro',
    ordered: 'Lo stesso con l’elenco numerato: i numeri si aggiornano da soli',
    steps: ['andare a Lecco', 'trovare l’Azzeccagarbugli', 'tornare prima di sera'],
    book: 'Nel libro esportato gli elenchi hanno il rientro sospeso, come in tipografia',
    s2: 'Le tabelle',
    s2b: 'Senza contare trattini e barre',
    table: 'Tabella dalla barra: Dante la disegna con le sue celle',
    cells: [['Personaggio', 'Dove', 'Quando'], ['Renzo', 'In paese', 'Sera'], ['Lucia', 'A casa', 'Sera'], ['Perpetua', 'In canonica', 'Notte']],
    move: 'Tab passa alla cella successiva, Invio aggiunge una riga',
    bar: 'Sopra la tabella, la sua barra: righe, colonne, allineamento e didascalia',
    caption: 'Chi c’è e dove, la sera del 7 novembre',
    captionSay: 'La didascalia va sotto la tabella, anche nel libro',
    done: 'Uscendo dalla tabella, la si vede come sarà nel libro',
    s3: 'Le immagini',
    s3b: 'Una mappa, un ritratto, una lettera',
    image: 'Immagine dalla barra, oppure incolla o trascina un’immagine nel testo',
    file: 'Il lago.png',
    sizes: 'Sopra l’immagine: la larghezza, 200, 400, 600 pixel o quella originale, e l’allineamento',
    desc: 'Il ramo del lago di Como',
    descSay: 'Nel testo l’immagine è una riga: dopo il nome, una barra e la descrizione',
    caption2: 'La descrizione diventa la didascalia sotto l’immagine',
    s4: 'Dove finiscono',
    s4b: 'Note, Ricerca, Allegati',
    attachments: 'Allegati',
    stored: 'L’immagine è stata copiata nel progetto, in Ricerca, cartella Allegati, che trovi nella sezione Note: viaggia con il romanzo',
  },
  en: {
    intro: 'A list, a table, an image: these live in the text too, and reach the exported book',
    scene: 'Jane and Elizabeth',
    s1: 'Lists',
    s1b: 'Bulleted and numbered',
    bullet: 'Bulleted list from the bar; Return adds an item',
    items: ['Mrs. Bennet’s list:', 'the dinner', 'two courses', 'the fish'],
    tab: 'Four spaces before an item move it one level further in',
    ordered: 'The same with a numbered list: the numbers update by themselves',
    steps: ['call on Mr. Bingley', 'invite him to dinner', 'mind the seating'],
    book: 'In the exported book, lists have a hanging indent, as typesetters do',
    s2: 'Tables',
    s2b: 'Without counting dashes and bars',
    table: 'Table from the bar: Dante draws it with its cells',
    cells: [['Character', 'Where', 'When'], ['Jane', 'Longbourn', 'Morning'], ['Bingley', 'Netherfield', 'Evening'], ['Darcy', 'Netherfield', 'Evening']],
    move: 'Tab goes to the next cell, Return adds a row',
    bar: 'Above the table, its bar: rows, columns, alignment and caption',
    caption: 'Who is where, after the ball',
    captionSay: 'The caption goes below the table, in the book too',
    done: 'Leaving the table, you see it as it will be in the book',
    s3: 'Images',
    s3b: 'A map, a portrait, a letter',
    image: 'Image from the bar, or paste or drag an image into the text',
    file: 'The fields.png',
    sizes: 'Above the image: the width, 200, 400, 600 pixels or the original one, and the alignment',
    desc: 'The fields near Longbourn',
    descSay: 'In the text the image is one line: after the name, a bar and the description',
    caption2: 'The description becomes the caption below the image',
    s4: 'Where they go',
    s4b: 'Notes, Research, Attachments',
    attachments: 'Attachments',
    stored: 'The image was copied into the project, in Research, Attachments folder, which you find in the Notes section: it travels with the novel',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const main = p.locator('main.center').first();
  const row = p.locator('.format-row').first();
  const fmt = (key) => row.getByRole('button', { name: L(key) }).first();

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
  // a fresh paragraph after a blank line, out of any list
  const newParagraph = async () => {
    await t.press('Enter', 0.1);
    await t.press('Shift+Home', 0.1);
    await t.press('Backspace', 0.1);
    await t.press('Enter', 0.4);
  };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });
  await t.click(t.text(d.scene), { after: 1 });
  await t.click(main.getByRole('button', { name: L('level.scene'), exact: true }).first(), { after: 1 });

  await t.title(d.s1, d.s1b, toEnd);
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.3);
  await t.type(d.items[0], 60);
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.3);
  await t.focus(fmt('format.bullet'), d.bullet, { side: 'below' });
  await t.click(fmt('format.bullet'), { after: 0.4 });
  await t.type(d.items[1], 60);
  await t.press('Enter', 0.3);
  await t.press('Home', 0.2);
  await t.type('    ', 80);
  await t.press('End', 0.2);
  await t.type(d.items[2], 60);
  await t.press('Enter', 0.3);
  await t.type(d.items[3], 60);
  await t.wait(0.6);
  await t.focus(t.line(d.items[2]), d.tab, { side: 'above', pointer: false });
  await newParagraph();
  await t.click(fmt('format.ordered'), { after: 0.4 });
  for (const [i, step] of d.steps.entries()) {
    if (i) await t.press('Enter', 0.3);
    await t.type(step, 60);
  }
  await t.wait(0.6);
  await t.focus([main.locator('.cm-line', { hasText: d.steps[0] }).last(), main.locator('.cm-line', { hasText: d.steps[2] }).last()], d.ordered, { side: 'above', pointer: false });
  await t.say(d.book);

  await t.title(d.s2, d.s2b, newParagraph);
  await t.focus(fmt('format.table'), d.table, { side: 'below' });
  await t.click(fmt('format.table'), { after: 0.8 });
  for (const [r, cells] of d.cells.entries()) {
    // a new table has a heading row and two rows; Return adds the third
    if (r) await t.press(r < 3 ? 'Tab' : 'Enter', 0.4);
    for (const [c, cell] of cells.entries()) {
      if (c) await t.press('Tab', 0.3);
      await t.type(cell, 70);
    }
  }
  await t.wait(0.6);
  const bar = main.locator('.md-table-bar').first();
  await t.focus(main.locator('.cm-line', { hasText: d.cells[3][0] }).last(), d.move, { side: 'above', pointer: false });
  await t.zoom(bar, () => t.focus(bar, d.bar, { side: 'above' }), 1.4);
  await t.click(bar.locator('button[data-action="caption"]'), { after: 0.6 });
  await t.type(d.caption, 70);
  await t.wait(0.6);
  await t.focus(t.line(d.caption), d.captionSay, { side: 'below', pointer: false });
  await t.press('ArrowDown', 0.2);
  await t.press('ControlOrMeta+End', 0.2);
  await newParagraph();
  await t.wait(1);
  const table = main.locator('table').first();
  await t.focus(table, d.done, { side: 'above', pointer: false });

  await t.title(d.s3, d.s3b);
  await t.focus(fmt('format.image'), d.image, { side: 'below' });
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), t.click(fmt('format.image'), { after: 0.2 })]);
  await fc.setFiles(path.join(ASSETS, t.lang, d.file));
  await t.wait(1.2);
  // right after the insert the image's own text shows: the description goes after the name
  // Dante writes ![[name]]: two steps back from the end of the line
  await t.press('End', 0.2);
  for (let i = 0; i < 2; i++) await t.press('ArrowLeft', 0.15);
  await t.type(`|${d.desc}`, 70);
  await t.wait(0.6);
  const described = main.locator('.cm-line', { hasText: d.desc }).first();
  await t.zoom(described, () => t.focus(described, d.descSay, { side: 'below', pointer: false }), 1.4);
  await t.press('End', 0.2);
  await newParagraph();
  await t.wait(1.2);
  const image = main.locator('.md-image').first();
  await image.scrollIntoViewIfNeeded();
  await t.wait(0.5);
  // the bar shows while the mouse is on the image: kept in view for the video
  await p.addStyleTag({ content: '.md-image .md-image-bar { display: flex }' });
  await t.wait(0.4);
  const sizes = image.locator('.md-image-bar').first();
  await t.click(sizes.locator('button').nth(2), { after: 1.2 });
  await t.focus(sizes, d.sizes, { side: 'above' });
  await t.focus(image, d.caption2, { side: 'above', pointer: false });

  await t.title(d.s4, d.s4b, async () => {
    await t.nav('section.notes');
    await t.wait(1);
  });
  const tree = p.locator('aside.tree').first();
  const folder = tree.getByText(d.attachments, { exact: true }).first();
  await t.click(folder, { after: 0.8 });
  const file = tree.getByText(new RegExp(d.file.replace('.png', ''))).first();
  if (await file.count()) await t.click(file, { after: 1.2 });
  await t.focus(tree, d.stored, { side: 'right' });
}
