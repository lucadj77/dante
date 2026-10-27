// 3. Importare da Word o Scrivener: the preview, title levels, blank lines, a misread line, a second
// Word file added to the project, then a Scrivener project.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets');

export const meta = {
  n: 3,
  group: 'start',
  title: { it: 'Importare da Word o Scrivener', en: 'Importing from Word or Scrivener' },
  subtitle: { it: 'Portare in Dante un romanzo già scritto', en: 'Bring a novel you have already written into Dante' },
};

export const setup = (lang) => ({ folder: lang === 'it' ? 'Romanzi' : 'Novels' });

const D = {
  it: {
    word: 'Hai già scritto in Word? Comincia da qui',
    file: 'Il faro.docx', more: 'Il faro, terza parte.docx', scriv: 'La casa del sale.zip',
    pick: 'Scegli il file .docx: Dante ne legge una copia, il file Word non viene toccato',
    counts: 'In alto, quello che Dante ha trovato: parti, capitoli, scene e parole',
    doc: 'A sinistra il documento come lo legge Dante, con un’etichetta sulle righe che diventano parti, capitoli e scene',
    result: 'A destra il romanzo che ne esce',
    levels: 'Per ogni livello di titolo del documento scegli cosa diventa: parti, capitoli, scene con titolo, oppure titoli lasciati nel testo',
    blanks: 'Qui una riga vuota separa le scene. Puoi scegliere due righe di fila, oppure nessuna',
    s1: 'Una riga letta male',
    s1b: 'Basta un clic per correggerla',
    numbers: 'In questo file ogni scena comincia con il suo numero. Dante lo legge come testo',
    mark: 'Fai clic sulla riga e scegli cos’è. Con «Anche le righe simili» la scelta vale per tutti i numeri',
    fixed: 'Ora il primo capitolo ha due scene',
    go: 'Continua: titolo, autori e dove creare il progetto',
    tree: 'Il romanzo è in Dante: parti, capitoli e scene, ognuna nel suo file',
    s2: 'Un romanzo in più file Word',
    s2b: 'Aggiungili uno alla volta',
    addNote: 'Nel manoscritto, Importa da Word aggiunge un altro file al progetto',
    added: 'La terza parte si aggiunge in fondo al romanzo',
    s3: 'Da Scrivener',
    s3b: 'Cartelle, testi e sinossi',
    scrivNote: 'Nel browser scegli uno zip del progetto .scriv. Sul Mac, nell’app, scegli direttamente il progetto',
    scrivPreview: 'La stessa anteprima: le cartelle della Bozza diventano capitoli, i testi scene',
    synopsis: 'Le sinossi di Scrivener diventano le sinossi delle scene',
    scene: 'La salina',
  },
  en: {
    word: 'Already writing in Word? Start here',
    file: 'The Lighthouse.docx', more: 'The Lighthouse, part three.docx', scriv: 'The Salt House.zip',
    pick: 'Choose the .docx file: Dante reads a copy, the Word file is not touched',
    counts: 'At the top, what Dante found: parts, chapters, scenes and words',
    doc: 'On the left, the document as Dante reads it, with a label on the lines that become parts, chapters and scenes',
    result: 'On the right, the novel that comes out of it',
    levels: 'For each heading level of the document, choose what it becomes: parts, chapters, titled scenes, or headings left in the text',
    blanks: 'Here a blank line separates scenes. You can choose two in a row, or none',
    s1: 'A line read wrong',
    s1b: 'One click puts it right',
    numbers: 'In this file every scene starts with its number. Dante reads it as text',
    mark: 'Click the line and say what it is. With “Also the similar lines” the choice holds for every number',
    fixed: 'Now the first chapter has two scenes',
    go: 'Continue: title, authors and where to create the project',
    tree: 'The novel is in Dante: parts, chapters and scenes, each in its own file',
    s2: 'A novel in several Word files',
    s2b: 'Add them one at a time',
    addNote: 'In the manuscript, Import from Word adds another file to the project',
    added: 'Part three goes at the end of the novel',
    s3: 'From Scrivener',
    s3b: 'Folders, texts and synopses',
    scrivNote: 'In the browser, choose a zip of the .scriv project. On a Mac, in the app, choose the project itself',
    scrivPreview: 'The same preview: the Draft’s folders become chapters, its texts scenes',
    synopsis: 'Scrivener’s synopses become the scenes’ synopses',
    scene: 'The salt pans',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const dir = path.join(ASSETS, t.lang);
  const choose = async (button, file) => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), t.click(button, { after: 0.2 })]);
    await fc.setFiles(path.join(dir, file));
    await t.wait(1.5);
  };

  await t.zoom([p.locator('main h1').first(), p.locator('main .actions').first()], async () => {
    await t.focus(t.button(L('import.word')), d.word, { side: 'below' });
  }, 1.6);
  await t.say(d.pick);
  await choose(t.button(L('import.word')), d.file);

  await t.focus(p.getByText(/\d+ parti|\d+ parts/).first(), d.counts, { side: 'below' });
  await t.focus(p.getByText(L('import.preview.document'), { exact: true }).first().locator('xpath=..'), d.doc, { side: 'right' });
  await t.focus(p.getByText(L('import.preview.result'), { exact: true }).first().locator('xpath=..'), d.result, { side: 'left' });
  await t.focus([p.locator('select').nth(0), p.locator('select').nth(1)], d.levels, { side: 'below' });
  await t.focus(p.locator('select').nth(2), d.blanks, { side: 'below' });

  await t.title(d.s1, d.s1b);
  const one = p.locator('text=/^1$/').first();
  await t.focus(one, d.numbers, { side: 'right' });
  await t.click(one, { after: 0.8 });
  await t.focus(t.button(L('import.mark.break')).locator('xpath=../..'), d.mark, { side: 'right' });
  await t.click(t.button(L('import.mark.break')), { after: 1 });
  await t.focus(p.getByText(L('import.preview.result'), { exact: true }).first().locator('xpath=..'), d.fixed, { side: 'left', hold: 3 });

  await t.focus(t.button(L('import.continue')), d.go, { side: 'right' });
  await t.click(t.button(L('import.continue')), { after: 1 });
  await t.wait(1);
  await t.click(t.button(L('welcome.choose')), { after: 1 });
  await t.click(t.button(L('import.create')), { after: 2 });
  await t.focus(p.locator('aside.tree'), d.tree);

  await t.title(d.s2, d.s2b);
  const add = p.locator('aside.tree').getByRole('button', { name: L('import.word') }).first();
  await t.focus(add, d.addNote, { side: 'right' });
  await choose(add, d.more);
  await t.wait(1.5);
  await t.click(t.button(L('import.into')).last(), { after: 2 });
  await t.focus(p.locator('aside.tree'), d.added);

  await t.title(d.s3, d.s3b, () => t.click(p.locator('nav[aria-label]').first().getByRole('button', { name: L('app.close'), exact: true }), { after: 1 }));
  await t.zoom([p.locator('main h1').first(), p.locator('main .actions').first()], async () => {
    await t.focus(t.button(L('import.scrivener')), d.scrivNote, { side: 'below' });
  }, 1.6);
  await choose(t.button(L('import.scrivener')), d.scriv);
  await t.focus(p.getByText(L('import.preview.result'), { exact: true }).first().locator('xpath=..'), d.scrivPreview, { side: 'left' });
  await t.click(t.button(L('import.continue')), { after: 1 });
  await t.click(t.button(L('welcome.choose')), { after: 1 });
  await t.click(t.button(L('import.create')), { after: 2 });
  await t.click(t.text(d.scene), { after: 1 });
  await t.focus(p.locator('aside.side textarea').first(), d.synopsis, { side: 'left' });
}
