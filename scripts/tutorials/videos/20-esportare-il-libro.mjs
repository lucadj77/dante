// 20. Esportare il libro: the four formats, the standard manuscript and the typeset book, the structure,
// dedication and epigraph, the cover, pending revisions, and the file in the export folder.
export const meta = {
  n: 20,
  group: 'export',
  title: { it: 'Esportare il libro', en: 'Exporting the book' },
  subtitle: { it: 'Word, PDF ed EPUB dallo stesso romanzo', en: 'Word, PDF and EPUB from the same novel' },
};

// In the app: PDF is made only there.
export const setup = () => ({ desktop: true });

const D = {
  it: {
    intro: 'Quando il romanzo è pronto, Dante lo trasforma in un file da mandare, stampare o leggere',
    s1: 'Il formato',
    s1b: 'Word, PDF, EPUB o Markdown',
    where: 'Tutto è in Esportazione, nella barra a sinistra',
    formats: 'Word per agenti ed editori, PDF da leggere o stampare, EPUB per gli ebook, Markdown per qualsiasi editor di testo',
    s2: 'Manoscritto o libro',
    s2b: 'Due impaginazioni pronte',
    manuscript: 'Manoscritto standard: Times 12, doppia interlinea, intestazione con autore, titolo e pagina. È come lo chiedono agenti ed editori',
    typeset: 'Libro impaginato: Garamond 11, interlinea più stretta, rientri piccoli. Ogni valore si può poi cambiare',
    page: 'Formato della pagina, carattere, corpo, interlinea e rientro dei paragrafi',
    s3: 'La struttura',
    s3b: 'Parti, capitoli e scene',
    breaks: 'Cosa mettere prima di una parte, prima di un capitolo e tra le scene: una nuova pagina, una riga vuota o un separatore',
    two: 'Tra le scene si può lasciare anche Due righe vuote: più spazio, senza segni',
    chars: 'Con Caratteri separatori, il segno si scrive qui',
    sign: 'Ogni \\n va a capo: «\\n* * *\\n» mette i tre asterischi fra due righe vuote. Il segno a capo si cambia nel campo accanto',
    headings: 'Come si scrivono i titoli: Capitolo primo, Capitolo 1, solo il numero, con o senza il titolo',
    s4: 'Prima e dopo il romanzo',
    s4b: 'Dedica, esergo, ringraziamenti',
    dedication: 'A Lucia, che ha aspettato.',
    paratext: 'La dedica e l’esergo vanno prima del romanzo; nota dell’autore, ringraziamenti e colophon dopo. Quelli vuoti non compaiono',
    s5: 'Copertina e tipografia',
    s5b: 'Il libro come deve uscire',
    cover: 'Spuntata questa casella, il libro si apre con la copertina che vedi tra i progetti recenti. Immagine, testi e colori si cambiano in Impostazioni, Questo romanzo',
    typography: 'Qui i segni del dialogo, gli apostrofi e i puntini: valgono nel file esportato, comunque tu abbia scritto',
    s6: 'Le revisioni in sospeso',
    s6b: 'Proposte non ancora decise',
    revisions: 'Le modifiche proposte e non ancora accettate: si possono accettare tutte o lasciare fuori. I commenti non finiscono mai nel libro',
    s7: 'Esportare',
    s7b: 'Il file pronto',
    pdf: 'PDF',
    run: 'Un clic su Esporta',
    done: 'Il file va nella cartella export del progetto, con autore, titolo, data e ora nel nome: le versioni precedenti restano',
    open: 'Apri il file lo apre subito; Salva in un’altra posizione chiede dove metterlo',
  },
  en: {
    intro: 'When the novel is ready, Dante turns it into a file to send, print or read',
    s1: 'The format',
    s1b: 'Word, PDF, EPUB or Markdown',
    where: 'It is all in Export, in the bar on the left',
    formats: 'Word for agents and publishers, PDF to read or print, EPUB for ebooks, Markdown for any text editor',
    s2: 'Manuscript or book',
    s2b: 'Two layouts ready to use',
    manuscript: 'Standard manuscript: Times 12, double spacing, a header with author, title and page. As agents and publishers ask for it',
    typeset: 'Typeset book: Garamond 11, tighter spacing, small indents. Every value can then be changed',
    page: 'Page size, font, size, line spacing and paragraph indent',
    s3: 'The structure',
    s3b: 'Parts, chapters and scenes',
    breaks: 'What goes before a part, before a chapter and between scenes: a new page, a blank line or a separator',
    two: 'Between scenes you can also leave Two blank lines: more space, no signs',
    chars: 'With Separator characters, the sign is written here',
    sign: 'Each \\n starts a new line: “\\n* * *\\n” puts the three asterisks between two blank lines. The line sign can be changed in the field beside it',
    headings: 'How headings are written: Chapter One, Chapter 1, the number only, with or without the title',
    s4: 'Before and after the novel',
    s4b: 'Dedication, epigraph, acknowledgements',
    dedication: 'To Jane, who waited.',
    paratext: 'Dedication and epigraph go before the novel; author’s note, acknowledgements and colophon after. Empty ones do not appear',
    s5: 'Cover and typography',
    s5b: 'The book as it should come out',
    cover: 'With this box ticked, the book opens with the cover you see among recent projects. Picture, texts and colours are changed in Settings, This novel',
    typography: 'Here the dialogue marks, apostrophes and ellipses: they apply in the exported file, however you typed',
    s6: 'Pending revisions',
    s6b: 'Suggestions not yet decided',
    revisions: 'Suggested changes not yet accepted: you can accept them all or leave them out. Comments never end up in the book',
    s7: 'Exporting',
    s7b: 'The file, ready',
    pdf: 'PDF',
    run: 'One click on Export',
    done: 'The file goes in the project’s export folder, with author, title, date and time in its name: earlier versions stay',
    open: 'Open file opens it at once; Save elsewhere asks where to put it',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const form = p.locator('.export form').first();
  const show = async (loc) => { await loc.scrollIntoViewIfNeeded(); await t.wait(0.6); };
  const field = (key) => form.locator('label', { hasText: L(key) }).first();
  const select = (key) => field(key).locator('select').first();

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b, async () => {
    await t.nav('section.export');
    await t.wait(1);
  });
  const nav = p.locator('nav[aria-label]').first().getByRole('button', { name: L('section.export'), exact: true });
  await t.focus(nav, d.where, { side: 'right' });
  const formats = form.locator('.formats').first();
  await t.zoom(formats, () => t.focus(formats, d.formats, { side: 'below', pointer: false }), 1.4);
  await t.click(formats.locator('label.format').first(), { after: 1 });

  await t.title(d.s2, d.s2b);
  const profile = select('export.profile');
  await t.click(profile, { after: 0.3 });
  await profile.selectOption('manuscript');
  await t.wait(1);
  await t.zoom(profile, () => t.focus(profile, d.manuscript, { side: 'below', pointer: false }), 1.5);
  await t.click(profile, { after: 0.3 });
  await profile.selectOption('typeset');
  await t.wait(1);
  await t.focus(profile, d.typeset, { side: 'below', pointer: false });
  const pageRows = form.locator('.row');
  await t.focus([pageRows.nth(0), pageRows.nth(1)], d.page, { side: 'right', pointer: false });

  await t.title(d.s3, d.s3b, () => show(form.locator('h4', { hasText: L('export.structure') }).first()));
  const breaks = form.locator('h4', { hasText: L('export.structure') }).locator('xpath=following-sibling::div[contains(@class,"row")][1]');
  await t.focus(breaks, d.breaks, { side: 'below', pointer: false });
  const scenes = breaks.locator('label', { hasText: L('export.sceneBreak') }).locator('select').first();
  await t.click(scenes, { after: 0.3 });
  await scenes.selectOption('twoBlankLines');
  await t.wait(0.8);
  await t.zoom(scenes, () => t.focus(scenes, d.two, { side: 'below', pointer: false }), 1.5);
  await t.click(scenes, { after: 0.3 });
  await scenes.selectOption('characters');
  await t.wait(0.8);
  const separator = form.locator('.separator').first();
  const sep = separator.locator('input').first();
  await t.focus(sep, d.chars, { side: 'below' });
  await t.click(sep, { after: 0.2 });
  await t.press('ControlOrMeta+a', 0.2);
  await t.type('\\n* * *\\n', 120);
  await t.wait(0.8);
  await t.zoom(separator, () => t.focus([separator, separator.locator('xpath=following-sibling::p[1]')], d.sign, { side: 'below', pointer: false }), 1.4);
  const chapter = form.locator('fieldset', { has: p.locator('legend', { hasText: L('kind.chapter') }) }).first();
  await show(chapter);
  await t.focus(chapter, d.headings, { side: 'right', pointer: false });

  await t.title(d.s4, d.s4b, () => show(field('export.dedication')));
  const dedication = field('export.dedication').locator('textarea');
  await t.click(dedication, { after: 0.3 });
  await t.type(d.dedication, 80);
  await t.wait(0.6);
  await t.focus([field('export.dedication'), field('export.epigraph')], d.paratext, { side: 'right', pointer: false });

  await t.title(d.s5, d.s5b, () => show(form.locator('.cover').first()));
  const cover = form.locator('.cover').first();
  await t.click(cover.locator('input[type=checkbox]'), { after: 0.8 });
  await t.focus(cover, d.cover, { side: 'right' });
  const typo = form.locator('h4', { hasText: L('export.typography') }).first();
  await show(select('export.quotes'));
  await t.focus([typo, select('export.quotes')], d.typography, { side: 'right', pointer: false });

  await t.title(d.s6, d.s6b, () => show(select('export.revisions')));
  const revisions = select('export.revisions');
  await t.zoom(revisions, () => t.focus(revisions, d.revisions, { side: 'right' }), 1.5);

  await t.title(d.s7, d.s7b, () => show(formats));
  await t.click(formats.locator('label.format', { hasText: d.pdf }).first(), { after: 1 });
  const run = form.locator('.actions .primary').first();
  await show(run);
  await t.focus(run, d.run, { side: 'right' });
  await t.click(run, { after: 2 });
  const success = form.locator('.success').first();
  await show(success);
  await t.focus(success, d.done, { side: 'right', pointer: false });
  await t.focus([success.locator('.buttons').first(), form.locator('.actions .link').first()], d.open, { side: 'right' });
}
