// 3. Il primo progetto: a new project, what it already has, your name, the novel's settings, the first scene.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets');

export const meta = {
  n: 3,
  group: 'start',
  title: { it: 'Il primo progetto', en: 'Your first project' },
  subtitle: { it: 'Creare un romanzo e scrivere la prima scena', en: 'Create a novel and write the first scene' },
};

// No name yet: the first author of the new project becomes the writer's name.
export const setup = (lang) => ({ settings: { userName: '' }, folder: lang === 'it' ? 'Romanzi' : 'Novels' });

const D = {
  it: {
    new: 'Per cominciare un romanzo: Nuovo progetto',
    title: 'Il faro',
    author: 'Luca Di Gialleonardo',
    subtitle: 'Una storia di mare',
    titleNote: 'Titolo, sottotitolo e autori',
    lang: 'La lingua del romanzo decide la sillabazione e i nomi delle cartelle',
    cover: 'La copertina può essere un disegno semplice: una forma e dei colori',
    picture: 'Oppure una tua immagine: Scegli un’immagine, e titolo e autori ci vanno sopra',
    folder: 'Ora scegli una cartella del computer dove tenere i tuoi romanzi, per esempio Documenti/Romanzi',
    where: 'Dentro la cartella scelta Dante crea la cartella del romanzo, con il suo titolo: lì finiscono tutti i suoi file',
    s1: 'Il progetto è pronto',
    s1b: 'Vuoto, ma con qualche scelta già fatta',
    tree: 'Un capitolo e una scena, ancora senza testo',
    views: 'Due viste pronte: la bacheca delle scene per stato e la tabella delle scene',
    propsWhere: 'Le proprietà delle scene si impostano in Impostazioni, alla pagina Scene e proprietà',
    props: 'Lo stato ha già le sue voci: idea, bozza, rivista, finita. Qui ne aggiungi o ne togli una alla volta',
    pov: 'Il punto di vista (pov) è un collegamento a una scheda della Bibbia di tipo Personaggio',
    s2: 'Le impostazioni',
    s2b: 'Quelle di Dante e quelle del romanzo',
    pages: 'Le impostazioni sono divise in pagine: quelle di Questo romanzo vanno con il progetto, quelle di Dante su questo computer valgono per tutti i romanzi',
    search: 'Non sai dove sta un’impostazione? Scrivila qui e restano solo le pagine che ne parlano',
    app: 'Nella pagina Tu c’è il tuo nome',
    name: 'Il tuo nome firma commenti e revisioni e conta le parole scritte ogni giorno',
    novel: 'Titolo, sottotitolo, autori e lingua del romanzo si cambiano qui, quando vuoi',
    searchWord: 'copertina',
    s3: 'La prima scena',
    s3b: 'Un titolo e le prime righe',
    sceneTitle: 'Il guardiano',
    sceneTitleNote: 'Il titolo della scena compare nell’albero e nel libro esportato',
    text: 'Il faro si accendeva ogni sera alle sei, anche quando nessuno guardava il mare.',
    text2: 'Quella sera, per la prima volta in trent’anni, rimase spento.',
    paragraphs: 'Invio inizia un nuovo paragrafo. Tra i paragrafi vedi solo un po’ di spazio, come in un libro',
    gap: 'Quanto spazio lo decidi tu: in Impostazioni, Il testo nell’editor, Spazio tra i paragrafi',
    gapShow: 'Una riga vuota, mezza riga o poco: l’esempio a destra cambia subito. Vale solo per lo schermo, il file e l’esportazione non cambiano',
    text3: 'Nessuno, in paese, se ne accorse.',
    poem1: 'Il mare chiama,',
    poem2: 'e il faro tace.',
    blank: 'Invio due volte lascia una riga vuota vera, che resta anche nel libro: il segno ¶ la indica',
    soft: 'Maiusc+Invio va a capo restando nello stesso paragrafo, per esempio in una poesia',
    s4: 'Tornare ai propri romanzi',
    s4b: 'Chiudi progetto, o ⌘W (Ctrl+W)',
    recent: 'Il romanzo ora è tra i progetti recenti, con la sua copertina',
    launcher: 'Nella cartella del romanzo c’è anche il file «Il faro.dante»: un doppio clic apre Dante con il romanzo già caricato',
  },
  en: {
    new: 'To start a novel: New project',
    title: 'The Lighthouse',
    author: 'Luca Di Gialleonardo',
    subtitle: 'A story of the sea',
    titleNote: 'Title, subtitle and authors',
    lang: 'The novel’s language sets hyphenation and the names of the folders',
    cover: 'The cover can be a simple drawing: a shape and colours',
    picture: 'Or a picture of your own: Choose a picture, and title and authors go over it',
    folder: 'Now choose a folder on your computer to keep your novels in, for instance Documents/Novels',
    where: 'Inside the chosen folder Dante makes the novel’s own folder, with its title: all its files go there',
    s1: 'The project is ready',
    s1b: 'Empty, with a few choices already made',
    tree: 'One chapter and one scene, with no text yet',
    views: 'Two views ready: a board of scenes by status and a table of scenes',
    propsWhere: 'Scene properties are set in Settings, on the Scenes and properties page',
    props: 'Status already has its values: idea, draft, revised, done. Add or remove them here, one at a time',
    pov: 'The point of view (pov) is a link to a Story Bible sheet of the Character type',
    s2: 'Settings',
    s2b: 'Dante’s and the novel’s',
    pages: 'Settings are split into pages: those of This novel travel with the project, those of Dante on this computer hold for every novel',
    search: 'Not sure where a setting is? Type it here and only the pages that mention it stay',
    app: 'The You page holds your name',
    name: 'Your name signs comments and revisions, and counts the words you write each day',
    novel: 'Title, subtitle, authors and the novel’s language can be changed here, whenever you like',
    searchWord: 'cover',
    s3: 'The first scene',
    s3b: 'A title and the first lines',
    sceneTitle: 'The keeper',
    sceneTitleNote: 'The scene’s title shows in the tree and in the exported book',
    text: 'The lighthouse came on every evening at six, even when nobody was watching the sea.',
    text2: 'That evening, for the first time in thirty years, it stayed dark.',
    paragraphs: 'Enter starts a new paragraph. Between paragraphs you only see a little space, as in a book',
    gap: 'How much space is up to you: in Settings, The text in the editor, Space between paragraphs',
    gapShow: 'A blank line, half a line or a little: the sample on the right changes at once. It only affects the screen, not the file or the export',
    text3: 'Nobody in the village noticed.',
    poem1: 'The sea is calling,',
    poem2: 'the light is still.',
    blank: 'Enter twice leaves a real blank line, one that stays in the book too: the ¶ mark shows it',
    soft: 'Shift+Enter starts a new line within the same paragraph, for instance in a poem',
    s4: 'Back to your novels',
    s4b: 'Close project, or ⌘W (Ctrl+W)',
    recent: 'The novel is now among the recent projects, with its cover',
    launcher: 'The novel’s folder also holds “The Lighthouse.dante”: double-click it and Dante opens with the novel loaded',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];

  await t.focus(t.button(L('welcome.new')), d.new);
  await t.click(t.button(L('welcome.new')), { after: 1 });
  const form = p.locator('main form');
  await t.click(form.locator('input').first(), { after: 0.3 });
  await t.type(d.title);
  await t.click(form.locator('input').nth(1), { after: 0.3 });
  await t.type(d.subtitle);
  await t.click(form.locator('.authors input').first(), { after: 0.3 });
  await t.type(d.author, 50);
  await t.zoom([form.locator('input').first(), form.locator('.authors')], () =>
    t.focus([form.locator('input').first(), form.locator('.authors')], d.titleNote, { hold: 2.5 }), 1.4);
  await t.focus(form.locator('select').first(), d.lang);
  await t.click(form.locator('.templates button').nth(6), { after: 0.6 });
  await t.click(form.locator('.palettes .swatch').nth(3), { after: 0.6 });
  await t.focus(form.locator('.cover-picker'), d.cover, { side: 'right' });
  const choose = form.locator('.cover-picker').getByRole('button', { name: L('cover.imageChoose'), exact: true });
  await t.point(choose);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), t.click(choose, { after: 0.2 })]);
  await fc.setFiles(path.join(ASSETS, t.lang, `${d.title}.png`));
  await t.wait(1.5);
  await t.focus(form.locator('.cover-picker'), d.picture, { side: 'right' });
  const where = form.locator('.where');
  await t.focus(t.button(L('welcome.choose')), d.folder, { side: 'right' });
  await t.click(t.button(L('welcome.choose')), { after: 1 });
  await t.zoom(where, () => t.focus(where, d.where, { side: 'below', pointer: false }), 1.5);
  await t.click(t.button(L('welcome.create')), { after: 1.5 });

  await t.title(d.s1, d.s1b);
  await t.focus(p.locator('aside.tree'), d.tree);
  await t.nav('section.views');
  await t.wait(0.8);
  await t.focus(p.locator('aside:visible', { has: p.getByRole('button', { name: L('views.new'), exact: false }) }).first(), d.views);
  await t.settings('scenes');
  await t.focus(t.settingsItem('scenes'), d.propsWhere, { side: 'right' });
  const field = (name) => p.locator('fieldset', { has: p.locator('legend', { hasText: new RegExp(`^${name}$`) }) }).first();
  const status = field(t.lang === 'it' ? 'stato' : 'status');
  const values = status.locator('.chips').first();
  await t.zoom(status, () => t.focus(values, d.props, { side: 'below' }), 1.4);
  await t.focus(field('pov'), d.pov, { side: 'right' });

  await t.title(d.s2, d.s2b, () => p.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; scrollTo(0, 0); }));
  await t.focus(p.locator('.settings nav.sections'), d.pages, { side: 'right' });
  const search = p.locator('.settings nav.sections input[type=search]');
  await t.click(search, { after: 0.3 });
  await t.type(d.searchWord, 90);
  await t.wait(0.8);
  await t.focus(p.locator('.settings nav.sections'), d.search, { side: 'right', pointer: false });
  await t.press('ControlOrMeta+a', 0.2);
  await t.press('Backspace', 0.6);
  await t.settings('you');
  await t.focus(t.settingsItem('you'), d.app, { side: 'right' });
  await t.zoom(p.locator('label', { hasText: L('settings.userName') }).first(), () =>
    t.focus(p.locator('label', { hasText: L('settings.userName') }).first(), d.name), 1.4);
  await t.settings('book');
  await t.focus(p.locator('.settings .page .fields').first(), d.novel, { side: 'right' });

  await t.title(d.s3, d.s3b, () => t.nav('section.manuscript'));
  await t.wait(0.8);
  const titleField = p.locator('aside.side input').first();
  await t.click(titleField, { after: 0.2 });
  await p.keyboard.press('ControlOrMeta+A');
  await t.type(d.sceneTitle);
  await t.press('Enter', 0.6);
  await t.focus(titleField, d.sceneTitleNote, { side: 'left' });
  const text = p.locator('.cm-content').first();
  await t.click(text, { after: 0.4 });
  await t.type(d.text, 45);
  await t.press('Enter', 0.3);
  await t.type(d.text2, 45);
  await t.wait(0.8);
  await t.zoom(text, () => t.focus(text, d.paragraphs, { side: 'below', pointer: false }), 1.4);
  await t.settings('text', 1);
  const gap = p.locator('.settings label', { hasText: L('appearance.gap') }).first();
  await t.zoom(gap, () => t.focus(gap, d.gap, { side: 'below' }), 1.5);
  const gapSelect = gap.locator('select');
  const gapBefore = await gapSelect.inputValue();
  await t.click(gapSelect, { after: 0.3 });
  await gapSelect.selectOption('1');
  await t.wait(0.8);
  await t.focus(p.locator('.settings aside.preview').first(), d.gapShow, { side: 'left' });
  await gapSelect.selectOption(gapBefore);
  await t.wait(0.8);
  await t.nav('section.manuscript');
  await t.wait(0.8);
  await t.click(text.locator('.cm-line').last(), { dx: 0.98, after: 0.2 });
  await t.press('ControlOrMeta+End', 0.3);
  await t.press('Enter', 0.4);
  await t.press('Enter', 0.6);
  await t.type(d.text3, 45);
  await t.wait(0.8);
  await t.zoom(text, () => t.focus(text, d.blank, { side: 'below', pointer: false }), 1.4);
  await t.press('Enter', 0.4);
  await t.type(d.poem1, 60);
  await t.press('Shift+Enter', 0.4);
  await t.type(d.poem2, 60);
  await t.wait(0.8);
  await t.zoom(text, () => t.focus(text, d.soft, { side: 'below', pointer: false }), 1.4);

  await t.title(d.s4, d.s4b);
  await t.click(p.locator('nav[aria-label]').first().getByRole('button', { name: L('app.close'), exact: true }), { after: 1.2 });
  await t.zoom([p.locator('main h1').first(), p.locator('.recent')], async () => {
    await t.focus(p.locator('.recent li').first(), d.recent, { side: 'right' });
  }, 1.5);
  await t.say(d.launcher);
}
