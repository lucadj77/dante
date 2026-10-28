// 1. Dante in tre minuti: a tour for those who do not know Dante yet.
export const meta = {
  n: 1,
  group: 'start',
  title: { it: 'Dante in tre minuti', en: 'Dante in three minutes' },
  subtitle: { it: 'Un giro veloce per chi comincia', en: 'A quick tour to get started' },
};

const RECENT = {
  it: [
    ['Il faro', '2026-10-17'], ['Strade d’inverno', '2026-10-12'], ['La casa del sale', '2026-09-28'], ['Lettere da Roma', '2026-09-02'],
  ],
  en: [
    ['The Lighthouse', '2026-10-17'], ['Winter Roads', '2026-10-12'], ['The Salt House', '2026-09-28'], ['Letters from Rome', '2026-09-02'],
  ],
};

export const setup = (lang) => ({
  desktop: true,
  recent: RECENT[lang].map(([title, day]) => ({ path: `/Users/luca/Romanzi/${title}`, title, author: 'Luca Di Gialleonardo', language: lang, opened: `${day}T09:00:00Z` })),
});

const D = {
  it: {
    welcome: 'Dante è un’app di scrittura per romanzieri. Si apre con i tuoi romanzi.',
    recent: 'I progetti recenti, ciascuno con la sua copertina',
    new: 'Comincia un romanzo nuovo…',
    word: '…oppure importa quello che hai già scritto in Word o in Scrivener',
    sample: 'Proviamo il progetto di esempio: i primi capitoli dei Promessi sposi',
    s1: 'Il manoscritto',
    s1b: 'Scene, capitoli e parti, dentro un unico libro',
    tree: 'A sinistra l’albero: parti, capitoli e scene',
    editor: 'Al centro il testo, che scrivi come in un normale programma di videoscrittura',
    side: 'A destra le proprietà della scena: sinossi, stato, punto di vista…',
    scene: 'Perpetua',
    lineAt: 'Oh, per amor del cielo',
    typed: ' Don Abbondio si asciugò la fronte.',
    saved: 'Non c’è un pulsante Salva: Dante salva da solo, mentre scrivi',
    drag: 'Per riordinare il libro basta trascinare una scena',
    from: 'Un vaso di terra cotta', to: 'L’incontro',
    s2: 'La Bibbia del romanzo',
    s2b: 'Personaggi, luoghi e trame, collegati al testo',
    card: 'Lucia Mondella',
    cardNote: 'Ogni personaggio ha la sua scheda',
    link: 'La casa di Lucia',
    linkNote: 'I collegamenti portano da una scheda all’altra: un clic e la leggi al volo',
    s3: 'Il libro a colpo d’occhio',
    s3b: 'Tabelle, bacheche e linea del tempo',
    board: 'Bacheca', moved: 'Perpetua', target: 'rivista',
    boardNote: 'Nella bacheca le scene sono divise per stato: trascinata in «rivista», la scena cambia stato',
    s4: 'Quando il libro è pronto',
    s4b: 'Word, PDF ed EPUB, con la copertina',
    formats: 'Esporta in Word per un editore, in PDF da stampare, in EPUB per gli ebook',
    end: 'Ogni romanzo è una cartella di file Markdown, un formato libero che si apre con qualsiasi editor di testo',
  },
  en: {
    welcome: 'Dante is a writing app for novelists. It opens with your novels.',
    recent: 'Your recent projects, each with its own cover',
    new: 'Start a new novel…',
    word: '…or import what you have already written in Word or Scrivener',
    sample: 'Let’s try the sample project: the first chapters of Pride and Prejudice',
    s1: 'The manuscript',
    s1b: 'Scenes, chapters and parts, in one book',
    tree: 'On the left, the tree: parts, chapters and scenes',
    editor: 'In the middle, the text: you write as in any word processor',
    side: 'On the right, the scene’s properties: synopsis, status, point of view…',
    scene: 'A truth universally acknowledged',
    lineAt: 'Mr. Bennet made no answer.',
    typed: ' He went on reading his newspaper.',
    saved: 'There is no Save button: Dante saves as you write',
    drag: 'To reorder the book, just drag a scene',
    from: 'After the ball', to: 'The ball',
    s2: 'The Story Bible',
    s2b: 'Characters, places and plotlines, linked to the text',
    card: 'Elizabeth Bennet',
    cardNote: 'Every character has a sheet of their own',
    link: 'Longbourn',
    linkNote: 'Links lead from one sheet to another: one click and you read it in place',
    s3: 'The book at a glance',
    s3b: 'Tables, boards and a timeline',
    board: 'Board', moved: 'After the ball', target: 'revised',
    boardNote: 'On the board, scenes are grouped by status: dragged to “revised”, the scene changes status',
    s4: 'When the book is ready',
    s4b: 'Word, PDF and EPUB, with the cover',
    formats: 'Export to Word for a publisher, to PDF to print, to EPUB for e-readers',
    end: 'Every novel is a folder of Markdown files, a free format any text editor can open',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];

  await t.say(d.welcome);
  await t.zoom([p.locator('main h1').first(), p.locator('.recent')], async () => {
    await t.focus(p.locator('.recent'), d.recent, { side: 'below' });
    await t.focus(t.button(L('welcome.new')), d.new, { side: 'right' });
    await t.focus(t.button(L('import.word')), d.word, { side: 'right' });
  }, 1.5);
  await t.browserApp();
  await t.focus(t.text(L('welcome.sample')), d.sample);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b, () => t.click(t.text(d.scene), { after: 1 }));
  await t.focus(p.locator('aside.tree'), d.tree);
  await t.focus(p.locator('main.center'), d.editor, { side: 'below' });
  await t.focus(p.locator('aside.side'), d.side, { side: 'left' });
  await t.click(t.line(d.lineAt), { dx: 0.98, after: 0.3 });
  await t.press('End', 0.3);
  await t.type(d.typed);
  await t.wait(0.8);
  await t.say(d.saved);
  await t.say(d.drag, { hold: 2.5 });
  const tree = p.locator('aside.tree');
  await t.drag(tree.getByText(d.from, { exact: true }).first(), tree.getByText(d.to, { exact: true }).first(), { dy: 0.2 });
  await t.wait(1);

  await t.title(d.s2, d.s2b, async () => {
    await t.nav('section.codex');
    await t.click(t.text(d.card), { after: 1 });
  });
  await t.focus(p.locator('main.center'), d.cardNote, { side: 'below' });
  await t.click(p.locator('.cm-content .md-wikilink', { hasText: d.link }).first(), { after: 0.8 });
  await t.click(t.text(L('linkMenu.preview')), { after: 0.6 });
  await t.say(d.linkNote);
  await t.press('Escape', 0.6);

  await t.title(d.s3, d.s3b, async () => {
    await t.nav('section.views');
    await t.click(p.locator(`:text-is("${d.board}"):visible`).first(), { after: 1 });
  });
  await t.say(d.boardNote, { hold: 3 });
  const col = (s) => p.locator(`main :text-is("${s}"):visible`).first();
  await t.drag(col(d.moved), col(d.target), { dy: 2.5 });
  await t.wait(1.5);

  await t.title(d.s4, d.s4b, () => t.nav('section.export'));
  await t.focus(p.locator('.formats').first(), d.formats, { side: 'below' });

  await t.title('Dante', d.end);
}
