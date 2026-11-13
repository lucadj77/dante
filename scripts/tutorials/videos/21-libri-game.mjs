// 21. Libri game: the module turned on, the tree by number, the Paragraph panel, references typed
// with [[ and new paragraphs, boxes and their types, pages without a number, the checks and the game
// state, the graph, reordering and shuffling with undo, and the export. The book is «La torre del
// mago» / «The Wizard's Tower», written for this video (assets/gamebook.mjs).
import JSZip from 'jszip';
import { BOOKS, bookFiles } from '../assets/gamebook.mjs';

export const meta = {
  n: 21,
  group: 'gamebook',
  title: { it: 'Scrivere un libro game', en: 'Writing a gamebook' },
  subtitle: { it: 'Paragrafi, scelte e rimandi, dal primo all’ultimo', en: 'Sections, choices and references, from first to last' },
};

// The book is opened from its folder, in the browser app.
export const setup = (lang) => ({ folder: BOOKS[lang].title, settings: { formatBar: true } });

/** Writes the book in the page's private storage, where the folder picker finds it. */
export async function prepare(t) {
  const files = bookFiles(t.lang);
  await t.page.evaluate(async ({ files, name }) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
    for (const [path, text] of Object.entries(files)) {
      const parts = path.split('/');
      let dir = root;
      for (const x of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(x, { create: true });
      const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable();
      await w.write(text);
      await w.close();
    }
  }, { files, name: BOOKS[t.lang].title });
}

const D = {
  it: {
    intro: 'Un libro game è fatto di paragrafi numerati: il lettore salta dall’uno all’altro secondo le scelte che fa. Dante sa scriverlo, controllarlo, rimescolarlo ed esportarlo',
    open: 'Apriamo «La torre del mago», un piccolo libro game di esempio: quindici paragrafi e una pagina di regole',
    s1: 'Accendere il modulo',
    s1b: 'Un progetto alla volta',
    settings: 'In Impostazioni, la pagina Libro game',
    enable: 'Basta una spunta. Vale solo per questo progetto: gli altri romanzi restano come sono',
    folder: 'La cartella che contiene i paragrafi. Ogni paragrafo è un file Markdown: il titolo è il nome del file, il numero sta nelle sue proprietà',
    s2: 'L’albero dei paragrafi',
    s2b: 'In ordine di numero',
    tree: 'Al posto di capitoli e scene, i paragrafi in ordine di numero',
    summary: 'In cima, il libro in una riga: paragrafi, vuoti, orfani, vicoli ciechi e pagine',
    fixed: 'Il lucchetto: un numero fisso, che il rimescolamento non tocca',
    relative: 'L’ancora: un numero relativo, legato a un altro paragrafo',
    lengths: 'A destra la lunghezza: in azzurro i paragrafi corti, in rosso quelli che superano una pagina',
    empty: 'Un paragrafo ancora da scrivere ha il titolo in corsivo grigio',
    warning: 'Il triangolo segnala qualcosa da controllare: passandoci sopra si legge cosa',
    thresholds: 'Le soglie si cambiano qui: sotto quale lunghezza un paragrafo è corto, in parole o in caratteri come il resto del romanzo. La pagina è quella di Impostazioni, Pagine',
    onePage: 'Con questa spunta ogni paragrafo conta come una pagina nuova; senza, i paragrafi vanno di seguito',
    showLinks: 'E questa mostra nell’albero da dove si arriva e dove porta ogni paragrafo',
    links: 'Sotto ogni paragrafo: a sinistra i numeri da cui si arriva, a destra quelli a cui porta. Un clic apre il paragrafo',
    s3: 'Il pannello Paragrafo',
    s3b: 'Numero, tipo, collegamenti',
    paragraph: 'La scala',
    panel: 'In Proprietà, il pannello Paragrafo: tutto quello che serve sul paragrafo aperto',
    number: 'Il numero si cambia scrivendone un altro: Dante aggiorna tutti i rimandi che portano qui e rifiuta un numero già usato',
    type: 'Il numero può essere di tre tipi. Libero: il rimescolamento può cambiarlo',
    typeFixed: 'Fisso, con il lucchetto: resta sempre quello, per esempio un paragrafo che il libro cita con il suo numero',
    typeRelative: 'Relativo, con l’ancora: segue un altro paragrafo più uno scarto, per esempio «la risposta giusta è il numero dell’indovinello più 2», e si sposta con lui',
    ending: 'E qui si segna che il paragrafo è un finale',
    refs: 'Da dove si arriva e dove si va: ogni numero si apre con un clic',
    synopsis: 'La nota del paragrafo, per chi scrive: non finisce nel libro',
    note: 'Serve la lanterna: tenerla prima',
    divider: 'Sopra il testo, il divisore con numero e titolo',
    s4: 'Scrivere e collegare',
    s4b: 'Rimandi e nuovi paragrafi',
    bridge: 'Il ponte crollato',
    deadEnd: 'Questo paragrafo è un vicolo cieco: «torna al paragrafo 5» è scritto a mano, non è un rimando',
    typeBefore: ' Oppure, se ci riesci, vai al ',
    query: 'gra',
    suggest: 'Due parentesi quadre e una parte del titolo o il numero: l’elenco mostra i paragrafi che corrispondono',
    linked: 'Il rimando entra in grassetto e si vede come numero. E Dante ha corretto l’articolo: «al» è diventato «all’8»',
    typeNew: ' Oppure scendi in cantina: vai al ',
    newTitle: 'La cantina',
    create: 'Un titolo che non esiste: Invio crea il paragrafo al primo numero libero e ci mette il rimando',
    created: 'Il nuovo paragrafo è già nell’albero, vuoto, e il ponte non è più un vicolo cieco',
    hiddenSay: 'Con Alt+Invio invece di Invio il rimando è nascosto: il paragrafo porta lì, ma il numero non compare nel testo. Serve quando il lettore deve trovarlo da solo, per esempio risolvendo un enigma: Dante sa comunque che il collegamento c’è e non segnala il paragrafo come orfano',
    shortcut: '⌘Invio (Ctrl+Invio su Windows e Linux), o il pulsante ＋ Paragrafo, apre la finestra Nuovo paragrafo',
    dialogTitle: 'Il tesoro',
    dialog: 'Il titolo, il numero (primo libero, fisso o relativo a un altro paragrafo) e se il rimando va nel testo o tra quelli nascosti',
    fixedNumber: '40',
    hiddenList: 'Il rimando nascosto è nel pannello: × lo toglie, l’elenco qui sotto ne aggiunge altri',
    s5: 'I box',
    s5b: 'Scelte, parole chiave, finali',
    cellar: 'La cantina',
    cellarText: 'La cantina è umida e buia. Su una botte c’è un rotolo di corda.',
    boxButton: 'Il pulsante Box, nella barra di formattazione',
    boxMenu: 'I tipi di box del libro: scelta, carattere, parola chiave, incontro, finale, conferma',
    boxAsk: 'Un box legato a una proprietà chiede il valore e propone quelli già usati. Lo scrive anche nelle proprietà del paragrafo',
    value: 'corda',
    boxDone: 'Nel testo il box è un riquadro colorato. Le righe ::: che lo aprono e lo chiudono ricompaiono solo quando il cursore ci passa sopra',
    boxEnding: 'Un box di fine segna il paragrafo come finale',
    boxTypes: 'I tipi di box non sono fissi: ogni libro ha i suoi. Qui si cambiano emoji, nome, colore, testo proposto e proprietà, e se ne aggiungono altri',
    s6: 'Regole e altre pagine',
    s6b: 'Senza numero',
    rules: 'Regole',
    rulesSay: 'Una pagina senza numero, con 📄: regole, introduzione, ringraziamenti. Di base va prima dei paragrafi',
    callout: 'Nelle pagine come nei paragrafi, un blocco che comincia con > [!note] diventa un riquadro con il nome in una pillola colorata',
    page: 'Il pulsante Pagina ne crea una nuova e chiede il titolo; con il clic destro si mette dopo i paragrafi',
    after: 'Ora la pagina va dopo i paragrafi, ed è così che l’esportazione la metterà',
    s7: 'Controllare il libro',
    s7b: 'Avvisi e stato di gioco',
    status: 'Sotto il testo, la barra di stato dice quanti problemi trovano i controlli. Un clic li apre',
    view: 'La sezione Libro game, con l’icona del dado: tre schede',
    table: 'Paragrafi: tutti in una tabella. Un clic sul nome di una colonna ordina, la ricerca filtra, Mostra tiene solo quelli che interessano',
    filter: 'Per esempio solo i paragrafi con avvisi',
    checks: 'Controlli: gli avvisi di tutto il libro, raggruppati. Un orfano, a cui non porta nessuno; un paragrafo vuoto che non porta da nessuna parte',
    state: 'Lo stato di gioco: «Se hai la parola chiave sigillo» chiede qualcosa che nessun paragrafo dà. Dante legge le proprietà e le frasi del testo',
    register: 'Registro: ogni valore dei box, con i paragrafi dove compare. E i possibili doppioni: lanterna e lanterma, forse un errore di battitura',
    s8: 'Il grafo',
    s8b: 'Il libro in uno schema',
    graph: 'Il pulsante Grafo scrive una nota con lo schema del libro e la apre',
    diagram: 'Frecce piene per i rimandi nel testo, tratteggiate per quelli nascosti. In blu l’inizio, in rosso i finali, in arancione i paragrafi che non si raggiungono',
    full: 'A tutto schermo: la rotella ingrandisce, trascinando ci si sposta, un clic apre il paragrafo, Esc chiude',
    again: 'Premendo di nuovo Grafo lo schema si aggiorna, e quello che hai scritto intorno resta',
    s9: 'Riordinare e rimescolare',
    s9b: 'Numeri nuovi, rimandi aggiornati',
    reorder: 'Riordina numera i paragrafi nell’ordine in cui il lettore li incontra: comodo mentre si scrive',
    preview: 'L’anteprima: per ogni paragrafo il numero nuovo e quello di prima. I fissi restano, i relativi seguono la loro ancora',
    shuffle: 'Rimescola sorteggia i numeri, cercando di tenere lontani un paragrafo e quelli a cui rimanda. Nuova proposta rifà il sorteggio',
    prose: 'Qui i numeri scritti a mano nel testo: il rimescolamento non li tocca, conviene trasformarli in rimandi prima',
    apply: 'Rimescola: prima un’istantanea di ogni file, poi numeri, rimandi, alias e articoli aggiornati in tutto il libro',
    shuffled: 'Fatto: i numeri sono cambiati, il paragrafo 1 e i fissi no',
    undo: 'Tornare indietro: Operazioni precedenti. Solo la numerazione rimette i numeri e lascia il testo scritto dopo; Tutto riporta i file com’erano',
    s10: 'Esportare',
    s10b: 'Il libro pronto da stampare',
    export: 'In Esportazione, la pagina Libro game prende il posto di Parti, capitoli e scene',
    heading: 'Il titolo del paragrafo: solo il numero, oppure numero e titolo per una copia di lavoro. Un segno prima del numero, allineamento e dimensione',
    separator: 'Tra un paragrafo e l’altro: una pagina nuova, una riga vuota o un simbolo',
    boxes: 'I box a colori, in grigio per la stampa in bianco e nero, o come testo normale',
    clickable: 'Rimandi cliccabili: nel Word, nel PDF e nell’EPUB un clic sul numero porta al paragrafo',
    problems: 'E se il libro ha rimandi rotti o numeri doppi, sono elencati qui, prima di esportare',
    epub: 'Il libro esportato in EPUB, aperto in un lettore: un paragrafo per pagina, i box a colori',
    jump: 'Un clic sul numero porta dritto al paragrafo',
    end: 'Ogni paragrafo resta un file Markdown, apribile con qualsiasi editor di testo',
  },
  en: {
    intro: 'A gamebook is made of numbered sections: the reader jumps from one to another according to the choices they make. Dante can write it, check it, shuffle it and export it',
    open: 'Let’s open “The Wizard’s Tower”, a small sample gamebook: fifteen sections and a page of rules',
    s1: 'Turning the module on',
    s1b: 'One project at a time',
    settings: 'In Settings, the Gamebook page',
    enable: 'One tick is enough. It applies only to this project: your other novels stay as they are',
    folder: 'The folder that holds the sections. Each one is a Markdown file: its title is the file name, its number is in its properties',
    s2: 'The tree of sections',
    s2b: 'In order of number',
    tree: 'Instead of chapters and scenes, the sections in order of number',
    summary: 'At the top, the book in one line: sections, empty ones, orphans, dead ends and pages',
    fixed: 'The padlock: a fixed number, which shuffling never changes',
    relative: 'The anchor: a relative number, tied to another section',
    lengths: 'On the right, the length: blue for short sections, red for those longer than a page',
    empty: 'A section still to write has its title in grey italics',
    warning: 'The triangle flags something to check: hover over it to read what',
    thresholds: 'The limits are set here: below which length a section is short, in words or characters like the rest of the novel. The page is the one in Settings, Pages',
    onePage: 'With this tick each section counts as a new page; without it, sections run on one after another',
    showLinks: 'And this one shows in the tree where each section comes from and where it leads',
    links: 'Under each section: on the left the numbers that lead here, on the right those it leads to. A click opens the section',
    s3: 'The Paragraph panel',
    s3b: 'Number, type, references',
    paragraph: 'The stairs',
    panel: 'In Properties, the Paragraph panel: all you need about the open section',
    number: 'Change the number by typing another: Dante updates every reference that leads here, and refuses a number already taken',
    type: 'There are three kinds of number. Free: shuffling may change it',
    typeFixed: 'Fixed, with the padlock: it always stays the same, for instance a section the book quotes by its number',
    typeRelative: 'Relative, with the anchor: it follows another section plus an offset, for instance “the right answer is the riddle’s number plus 2”, and moves with it',
    ending: 'And here you mark the section as an ending',
    refs: 'Where it comes from and where it goes: each number opens with a click',
    synopsis: 'The section’s note, for the writer: it never goes into the book',
    note: 'Needs the lantern: give it earlier',
    divider: 'Above the text, the divider with number and title',
    s4: 'Writing and linking',
    s4b: 'References and new sections',
    bridge: 'The broken bridge',
    deadEnd: 'This section is a dead end: “go back to section 5” is typed by hand, it is not a reference',
    typeBefore: ' Or, if you can, turn to ',
    query: 'gra',
    suggest: 'Two square brackets and part of the title or the number: the list shows the sections that match',
    linked: 'The reference goes in, in bold, and shows as its number',
    typeNew: ' Or climb down to the cellar: turn to ',
    newTitle: 'The cellar',
    create: 'A title that does not exist: Return creates the section with the first free number and writes the reference',
    created: 'The new section is already in the tree, empty, and the bridge is no longer a dead end',
    hiddenSay: 'With Alt+Return instead of Return the reference is hidden: the section leads there, but the number does not appear in the text. Use it when readers must find the number themselves, for instance by solving a puzzle: Dante still knows the link exists and does not report the section as an orphan',
    shortcut: '⌘Return (Ctrl+Enter on Windows and Linux), or the ＋ Paragraph button, opens the New paragraph window',
    dialogTitle: 'The treasure',
    dialog: 'The title, the number (first free, fixed or relative to another section) and whether the reference goes in the text or among the hidden ones',
    fixedNumber: '40',
    hiddenList: 'The hidden reference is in the panel: × removes it, the list below adds more',
    s5: 'Boxes',
    s5b: 'Choices, keywords, endings',
    cellar: 'The cellar',
    cellarText: 'The cellar is damp and dark. On a barrel lies a coil of rope.',
    boxButton: 'The Box button, on the formatting bar',
    boxMenu: 'The book’s box types: choice, trait, item, encounter, ending, confirmed',
    boxAsk: 'A box tied to a property asks for the value and suggests those already used. It also writes it in the section’s properties',
    value: 'rope',
    boxDone: 'In the text the box is a coloured frame. The ::: lines that open and close it show again only when the cursor goes over them',
    boxEnding: 'An ending box marks the section as an ending',
    boxTypes: 'Box types are not fixed: each book has its own. Here you change emoji, name, colour, starting text and property, and add new ones',
    s6: 'Rules and other pages',
    s6b: 'With no number',
    rules: 'Rules',
    rulesSay: 'A page with no number, marked 📄: rules, introduction, acknowledgements. By default it goes before the sections',
    callout: 'In pages as in sections, a block that starts with > [!note] becomes a frame with its name in a coloured pill',
    page: 'The Page button makes a new one and asks for its title; right-click to put it after the sections',
    after: 'Now the page goes after the sections, and that is where the export will put it',
    s7: 'Checking the book',
    s7b: 'Warnings and game state',
    status: 'Under the text, the status bar says how many problems the checks find. A click opens them',
    view: 'The Gamebook section, with the dice icon: three tabs',
    table: 'Paragraphs: all of them in a table. Click a column name to sort, search to filter, Show keeps only those you need',
    filter: 'For instance only the sections with warnings',
    checks: 'Checks: the warnings of the whole book, grouped. An orphan, which nothing leads to; an empty section that leads nowhere',
    state: 'The game state: “If you have the keyword seal” asks for something no section gives. Dante reads both the properties and the sentences in the text',
    register: 'Register: every box value, with the sections where it appears. And possible duplicates: lantern and lanturn, perhaps a typo',
    s8: 'The graph',
    s8b: 'The book at a glance',
    graph: 'The Graph button writes a note with the map of the book and opens it',
    diagram: 'Solid arrows for references in the text, dotted for hidden ones. Blue for the start, red for endings, orange for sections no one can reach',
    full: 'Full screen: the wheel zooms, dragging moves, a click opens the section, Esc closes',
    again: 'Press Graph again and the map is updated, while what you wrote around it stays',
    s9: 'Reordering and shuffling',
    s9b: 'New numbers, references updated',
    reorder: 'Reorder numbers the sections in the order the reader meets them: handy while you write',
    preview: 'The preview: for each section the new number and the old one. Fixed ones stay, relative ones follow their anchor',
    shuffle: 'Shuffle draws new numbers, keeping a section far from those it leads to. Try again draws again',
    prose: 'Here, numbers typed by hand in the text: shuffling leaves them alone, so it is worth turning them into references first',
    apply: 'Shuffle: first a snapshot of every file, then numbers, references and aliases updated across the book',
    shuffled: 'Done: the numbers have changed, section 1 and the fixed ones have not',
    undo: 'To go back: Earlier operations. Numbers only puts the numbers back and keeps the text written since; Everything brings the files back as they were',
    s10: 'Exporting',
    s10b: 'The book, ready to print',
    export: 'In Export, the Gamebook page takes the place of Parts, chapters and scenes',
    heading: 'The section heading: the number only, or number and title for a working copy. A sign before the number, alignment and size',
    separator: 'Between one section and the next: a new page, a blank line or a symbol',
    boxes: 'Boxes in colour, in grey for black and white printing, or as plain text',
    clickable: 'Clickable references: in Word, PDF and EPUB a click on the number takes you to the section',
    problems: 'And if the book has broken references or duplicate numbers, they are listed here, before you export',
    epub: 'The book exported as EPUB, open in a reader: one section per page, boxes in colour',
    jump: 'A click on the number goes straight to the section',
    end: 'Each section stays a Markdown file, which any text editor can open',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const b = BOOKS[t.lang];
  const titles = Object.keys(b.paragraphs);
  const main = p.locator('main.center').first();
  const side = p.locator('aside.side').first();
  const treePane = p.locator(`.tree[aria-label="${L('section.manuscript')}"]`).first();
  const row = (title) => treePane.locator('.label', { hasText: new RegExp(`^${title.replace(/[’']/g, '.')}$`) }).first();
  const settingsRow = (key) => p.locator('label', { hasText: L(key) }).first();
  const editor = main.locator('.cm-content').first();
  const toEnd = async () => {
    await t.click(main.locator('.cm-line').last(), { dx: 0.98, after: 0.2 });
    await editor.focus();
    await t.press('ControlOrMeta+End', 0.2);
  };
  const openSettings = async () => {
    await t.settings('gamebook', 0.6);
  };

  await t.say(d.intro);
  await t.click(t.button(L('welcome.open')), { after: 2 });
  await t.say(d.open);

  // 1. turning it on
  await t.title(d.s1, d.s1b, openSettings);
  const heading = t.settingsItem('gamebook');
  await t.focus(heading, d.settings, { side: 'right' });
  const enable = settingsRow('gamebook.enable');
  await t.click(enable.locator('input'), { after: 1.2 });
  await t.zoom(enable, () => t.focus(enable, d.enable, { side: 'right' }), 1.6);
  const folder = settingsRow('gamebook.folder');
  await t.focus(folder, d.folder, { side: 'right' });

  // 2. the tree
  await t.title(d.s2, d.s2b, () => t.nav('section.manuscript'));
  await t.focus(treePane, d.tree, { side: 'right' });
  const summary = p.locator('.gamebook-summary').first();
  await t.zoom(summary, () => t.focus(summary, d.summary, { side: 'right' }), 1.8);
  await t.zoom(row(titles[0]), async () => {
    await t.focus(row(titles[0]).locator('xpath=..'), d.fixed, { side: 'right' });
    await t.focus(row(titles[12]).locator('xpath=..'), d.relative, { side: 'right' });
  }, 1.4);
  await t.focus(treePane.locator('.length').first(), d.lengths, { side: 'right' });
  await t.focus(row(titles[14]), d.empty, { side: 'right' });
  await t.point(treePane.locator('.warning').first());
  await t.wait(1.2);
  await t.focus(treePane.locator('.warning').first(), d.warning, { side: 'right' });
  await openSettings();
  const short = settingsRow(t.lang === 'it' ? 'gamebook.shortCharacters' : 'gamebook.shortCharacters');
  await t.focus(short, d.thresholds, { side: 'right' });
  await t.focus(settingsRow('gamebook.onePerPage'), d.onePage, { side: 'right' });
  const showLinks = settingsRow('gamebook.showLinks');
  await t.click(showLinks.locator('input'), { after: 0.8 });
  await t.focus(showLinks, d.showLinks, { side: 'right' });
  await t.nav('section.manuscript');
  await t.wait(1);
  await t.focus(row(titles[2]).locator('xpath=../..'), d.links, { side: 'right' });
  await openSettings();
  await t.click(settingsRow('gamebook.showLinks').locator('input'), { after: 0.5 });
  await t.nav('section.manuscript');

  // 3. the Paragraph panel
  await t.title(d.s3, d.s3b, () => t.click(row(d.paragraph), { after: 1.2 }));
  const panel = side.locator('.paragraph').first();
  await t.focus(panel, d.panel, { side: 'left' });
  await t.zoom(panel.locator('.head'), async () => {
    await t.focus(panel.locator('input.number'), d.number, { side: 'left' });
    await t.focus(panel.locator('.head select').first(), d.type, { side: 'left' });
    await t.focus(panel.locator('.head select').first(), d.typeFixed, { side: 'left' });
    await t.focus(panel.locator('.head select').first(), d.typeRelative, { side: 'left' });
  }, 1.5);
  await t.focus(panel.locator('label.check').first(), d.ending, { side: 'left' });
  await t.focus([panel.locator('.refs').first(), panel.locator('.refs').last()], d.refs, { side: 'left' });
  const synopsis = side.getByPlaceholder(L('panel.synopsisHint')).first();
  await t.click(synopsis, { after: 0.2 });
  await t.type(d.note, 50);
  await t.focus(synopsis, d.synopsis, { side: 'left' });
  await t.focus(main.locator('section.scene button.title').first(), d.divider, { side: 'below' });

  // 4. writing and linking
  await t.title(d.s4, d.s4b, () => t.click(row(d.bridge), { after: 1.2 }));
  await t.focus(main.locator('.cm-line').first(), d.deadEnd, { side: 'below' });
  await toEnd();
  await t.type(d.typeBefore + '[[' + d.query, 80);
  await t.wait(0.8);
  await t.focus(p.locator('.cm-tooltip-autocomplete').first(), d.suggest, { side: 'right' });
  await t.press('ArrowDown', 0.3);
  await t.press('ArrowDown', 0.3);
  await t.press('Enter', 0.8);
  await t.focus(main.locator('.cm-line').last(), d.linked, { side: 'below' });
  await t.type('.' + d.typeNew + '[[' + d.newTitle, 80);
  await t.wait(0.8);
  await t.focus(p.locator('.cm-tooltip-autocomplete').first(), d.create, { side: 'right' });
  await t.press('Enter', 1.2);
  await t.type('.', 80);
  await t.focus(treePane, d.created, { side: 'right' });
  await t.say(d.hiddenSay);
  await toEnd();
  await t.press('Enter', 0.3);
  const plus = main.locator('.format-row, .format-bar').first().getByRole('button', { name: new RegExp(L('gamebook.paragraphButton')) }).first();
  await t.focus(plus, d.shortcut, { side: 'below' });
  await t.press('Meta+Enter', 1);
  const dialog = p.locator('.dialog').first();
  await t.type(d.dialogTitle, 80);
  await t.click(dialog.locator('input.num').first(), { after: 0.2 });
  await t.press('ControlOrMeta+A', 0.1);
  await t.type(d.fixedNumber, 100);
  await t.click(dialog.locator('label.row', { hasText: L('gamebook.new.hidden') }).locator('input'), { after: 0.5 });
  await t.focus(dialog, d.dialog, { side: 'right' });
  await t.click(dialog.getByRole('button', { name: L('gamebook.new.create') }), { after: 1.2 });
  await t.focus(side.locator('.hidden-list').first(), d.hiddenList, { side: 'left' });

  // 5. boxes
  await t.title(d.s5, d.s5b, () => t.click(row(d.cellar), { after: 1.2 }));
  await t.click(main.locator('.cm-line').last(), { after: 0.2 });
  await t.type(d.cellarText, 40);
  await t.press('Enter', 0.3);
  const boxButton = main.getByRole('button', { name: new RegExp(`^▣ ?${L('gamebook.box')}$`) }).first();
  await t.focus(boxButton, d.boxButton, { side: 'below' });
  await t.click(boxButton, { after: 0.6 });
  await t.focus(p.locator('.box-menu').first(), d.boxMenu, { side: 'right' });
  await t.click(p.locator('.box-menu [role=menuitem]').nth(2), { after: 0.6 });
  const ask = p.locator('form.box-value').first();
  await t.type(d.value, 90);
  await t.focus(ask, d.boxAsk, { side: 'right' });
  await t.press('Enter', 1.2);
  await t.click(main.locator('.cm-line').first(), { after: 0.6 });
  await t.focus(main.locator('.cm-content').first(), d.boxDone, { side: 'left', pointer: false });
  await t.say(d.boxEnding);
  await openSettings();
  const types = p.locator('fieldset.box-type').first();
  await t.focus([p.locator('.settings h3', { hasText: L('gamebook.boxes') }).first(), types], d.boxTypes, { side: 'right' });
  await t.nav('section.manuscript');

  // 6. pages without a number
  await t.title(d.s6, d.s6b, () => t.click(row(d.rules), { after: 1.2 }));
  await t.focus(row(d.rules).locator('xpath=..'), d.rulesSay, { side: 'right' });
  const pageButton = treePane.getByRole('button', { name: L('gamebook.newPage') });
  await t.focus(pageButton, d.page, { side: 'right' });
  await t.click(pageButton, { after: 1 });
  const pageTitle = t.lang === 'it' ? 'Ringraziamenti' : 'Acknowledgements';
  const pageDialog = p.locator('.dialog').first();
  await t.click(pageDialog.locator('input').first(), { after: 0.2 });
  await t.type(pageTitle, 80);
  await t.click(pageDialog.locator('button.primary').first(), { after: 1.2 });
  const newPage = row(pageTitle);
  await newPage.click({ button: 'right' });
  await t.wait(0.6);
  await t.click(p.getByRole('menuitem', { name: L('gamebook.moveAfter') }).first(), { after: 1 });
  await t.focus(newPage.locator('xpath=..'), d.after, { side: 'right' });
  await t.click(row(d.rules), { after: 1.2 });
  await t.focus(main.locator('.cm-callout, .callout').first(), d.callout, { side: 'below' });

  // 7. the checks
  await t.title(d.s7, d.s7b);
  const status = p.locator('button.item.gamebook').first();
  await t.zoom(status, () => t.focus(status, d.status, { side: 'above' }), 1.6);
  await t.click(status, { after: 1.2 });
  await t.focus(p.getByRole('tablist').first(), d.view, { side: 'below' });
  await t.click(p.getByRole('tab', { name: new RegExp(`^${L('gamebookView.table', { n: '' }).replace(/[()]/g, '')}`) }).first(), { after: 0.8 });
  await t.focus(p.locator('table').first(), d.table, { side: 'below', pointer: false });
  await p.locator('select[aria-label="' + L('gamebookView.filter') + '"]').selectOption('warnings');
  await t.wait(0.8);
  await t.focus(p.locator('table').first(), d.filter, { side: 'below', pointer: false });
  await t.click(p.getByRole('tab', { name: new RegExp(`^${L('gamebookView.checks', { n: '' }).replace(/[()]/g, '')}`) }).first(), { after: 0.8 });
  const content = p.locator('.gamebook-view, main').last();
  await t.focus(content.locator('h3, h4').first(), d.checks, { side: 'right' });
  await t.focus(content.getByText(L('gamebookView.state'), { exact: true }).first(), d.state, { side: 'right' });
  await t.click(p.getByRole('tab', { name: L('gamebookView.register') }), { after: 0.8 });
  await t.focus(content.getByText(L('gamebookView.duplicates')).first(), d.register, { side: 'right' });

  // 8. the graph
  await t.title(d.s8, d.s8b, () => t.nav('section.manuscript'));
  const graphButton = treePane.getByRole('button', { name: L('gamebook.graph.title') });
  await t.focus(graphButton, d.graph, { side: 'right' });
  await t.click(graphButton, { after: 3 });
  const drawing = p.locator('.md-mermaid').first();
  await t.focus(drawing, d.diagram, { side: 'left', pointer: false });
  await t.click(p.getByRole('button', { name: new RegExp(L('mermaid.fullscreen')) }).first(), { after: 1.5 });
  await t.say(d.full);
  await t.press('Escape', 0.8);
  await t.say(d.again);

  // 9. reorder and shuffle
  await t.title(d.s9, d.s9b, () => t.nav('section.manuscript'));
  const reorder = treePane.getByRole('button', { name: L('gamebook.reorder.title') });
  await t.focus(reorder, d.reorder, { side: 'right' });
  await t.click(reorder, { after: 1 });
  await t.focus(p.locator('.dialog .table').first(), d.preview, { side: 'right' });
  await t.click(p.locator('.dialog').getByRole('button', { name: L('tree.cancel') }), { after: 0.6 });
  const shuffle = treePane.getByRole('button', { name: L('gamebook.shuffle.title') });
  await t.click(shuffle, { after: 1 });
  const sd = p.locator('.dialog').first();
  await t.focus(sd.locator('.head'), d.shuffle, { side: 'right' });
  await t.click(sd.locator('summary').first(), { after: 0.6 });
  await t.focus(sd.locator('details').first(), d.prose, { side: 'right' });
  const apply = sd.locator('.actions .primary');
  await t.focus(apply, d.apply, { side: 'above' });
  await t.click(apply, { after: 2 });
  await t.focus(treePane, d.shuffled, { side: 'right' });
  await t.click(shuffle, { after: 1 });
  const ops = p.locator('.dialog details').last();
  await t.click(ops.locator('summary'), { after: 0.6 });
  await t.focus(ops, d.undo, { side: 'right' });
  await t.click(ops.getByRole('button', { name: L('gamebook.shuffle.undoNumbers') }).first(), { after: 1.5 });
  if (await p.locator('.dialog').count()) await t.click(p.locator('.dialog').getByRole('button', { name: L('tree.cancel') }), { after: 0.6 });

  // 10. export
  await t.title(d.s10, d.s10b, () => t.nav('section.export'));
  const gb = t.exportItem('gamebook');
  await t.click(gb, { after: 1 });
  await t.focus(gb, d.export, { side: 'right' });
  const rows = p.locator('.export .row');
  await t.focus(rows.nth(0), d.heading, { side: 'below' });
  await t.focus(rows.nth(1), d.separator, { side: 'below' });
  await t.say(d.boxes);
  await t.say(d.clickable);
  const problems = p.locator('.export .problems');
  if (await problems.count()) await t.focus(problems.first(), d.problems, { side: 'above' });
  else await t.say(d.problems);
  const frame = await showEpub(t, b.title);
  await t.focus(frame.locator('.box').first(), d.epub, { side: 'below' });
  await t.click(frame.locator('.box a').first(), { after: 1.5 });
  await t.say(d.jump);
  await t.say(d.end);
}

/** Exports the book as EPUB in the project's export folder and returns its bytes. */
async function exportEpub(t, folder) {
  const p = t.page;
  await t.click(t.exportItem('format'), { after: 0.6 });
  await t.click(p.locator('label.format').filter({ has: p.locator('input[value="epub"]') }), { after: 0.6 });
  const run = p.locator('.export footer .actions .primary').first();
  await t.click(run, { after: 0.2 });
  await p.locator('.export .success').first().waitFor({ timeout: 60000 });
  const b64 = await p.evaluate(async (folder) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle(folder)).getDirectoryHandle('export');
    let file;
    for await (const [name, h] of dir.entries()) if (name.endsWith('.epub')) file = h;
    const bytes = new Uint8Array(await (await file.getFile()).arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, folder);
  return Buffer.from(b64, 'base64');
}

/** Shows the EPUB as a reader would: two pages side by side, a section per page, numbers that jump. */
async function showEpub(t, folder) {
  const p = t.page;
  const zip = await JSZip.loadAsync(await exportEpub(t, folder));
  if (process.env.EPUB) (await import('node:fs')).writeFileSync(process.env.EPUB, await zip.generateAsync({ type: 'nodebuffer' }));
  const css = await zip.file('OEBPS/style.css').async('string');
  let html = '';
  for (const name of Object.keys(zip.files).filter((n) => /text\d+\.xhtml$/.test(n)).sort()) {
    const x = await zip.file(name).async('string');
    if (x.includes('class="number"')) { html = x; break; }
  }
  const GAP = 128;
  const page = `html,body{height:100%;margin:0;overflow:hidden;background:#fffdf8}#book{position:absolute;top:56px;bottom:56px;left:64px;width:1052px;overflow:hidden;columns:2;column-gap:${GAP}px;column-fill:auto;font-size:18px}h2.number{margin-top:0}.pagebreak{break-before:column}`;
  html = html.replace(/<\?xml[^>]*>\s*/, '')
    .replace(/<link[^>]*style\.css"\/>/, `<style>${css}${page}</style>`)
    .replace('<body>', '<body><div id="book">')
    .replace('</body>', '</div></body>');
  // The app's content security policy blocks scripts inside the frame, so the page wires it from outside.
  await p.evaluate(({ html, GAP }) => {
    const shade = document.createElement('div');
    shade.id = 'tu-reader';
    shade.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#3a3a3c;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .6s';
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1180px;height:720px;border:0;background:#fffdf8;box-shadow:0 10px 40px rgba(0,0,0,.5);border-radius:6px';
    frame.onload = () => {
      const w = frame.contentWindow;
      const doc = frame.contentDocument;
      doc.addEventListener('click', (e) => {
        const a = e.target.closest('a[href*="#"]');
        if (!a) return;
        e.preventDefault();
        const b = doc.getElementById('book');
        const x = doc.getElementById(a.getAttribute('href').split('#')[1]);
        if (!x) return;
        const step = (b.clientWidth + GAP) / 2;
        const left = x.getBoundingClientRect().left - b.getBoundingClientRect().left + b.scrollLeft;
        b.scrollTo({ left: Math.floor((left + 10) / step) * step });
      });
      for (const ev of ['mousemove', 'mousedown'])
        w.addEventListener(ev, (e) => {
          const r = frame.getBoundingClientRect();
          window.dispatchEvent(new MouseEvent(ev, { clientX: e.clientX + r.left, clientY: e.clientY + r.top }));
        }, true);
    };
    frame.srcdoc = html;
    shade.append(frame);
    document.body.append(shade);
    requestAnimationFrame(() => requestAnimationFrame(() => (shade.style.opacity = '1')));
  }, { html, GAP });
  await t.wait(1.2);
  return p.frameLocator('#tu-reader iframe');
}
