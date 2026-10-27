// 6. Scrivere una scena: how much of the novel to show, formatting from the selection and from the
// bar, blank lines, typography while typing, find in the scene and the status bar.
export const meta = {
  n: 6,
  group: 'write',
  title: { it: 'Scrivere una scena', en: 'Writing a scene' },
  subtitle: { it: 'Formattare, cercare e contare mentre scrivi', en: 'Formatting, finding and counting as you write' },
};

// The fixed formatting bar starts hidden, so the video can show where it is turned on.
export const setup = () => ({ settings: { formatBar: false } });

const D = {
  it: {
    intro: 'Una scena del progetto di esempio, per vedere gli strumenti di scrittura',
    scene: 'Perpetua',
    s1: 'Cosa vedere',
    s1b: 'Una scena o tutto il capitolo',
    levels: 'Scena mostra solo la scena scelta; Capitolo, Parte e Romanzo mostrano tutte le scene una dopo l’altra',
    chapter: 'Si scrive di seguito, come in un unico documento: le frecce portano da una scena alla successiva',
    s2: 'Corsivo e grassetto',
    s2b: 'Dalla barra sopra la selezione',
    line: 'Misericordia! cos’ha, signor padrone?',
    select: 'Seleziona il testo: sopra compare una piccola barra',
    italic: 'Corsivo, oppure ⌘I (Ctrl+I su Windows e Linux)',
    s3: 'La barra di formattazione',
    s3b: 'Sempre a portata di mano',
    bar: 'Dal menu Altro, Barra di formattazione la tiene fissa sopra il testo',
    row: 'Grassetto, corsivo, titoli, elenchi, citazioni, allineamento e altro',
    center: 'Allinea al centro, per esempio per una lettera o un biglietto. Un altro clic la riporta a sinistra',
    blank: 'Una riga vuota tra due paragrafi, senza aprire una nuova scena: ⌥Invio (Alt+Invio su Windows e Linux)',
    s4: 'Correzione mentre scrivi',
    s4b: 'Virgolette, apostrofi, puntini',
    quotes: 'In Esportazione scegli come scrivi i dialoghi: la stessa scelta vale mentre scrivi',
    style: 'guillemets',
    typing: 'Questa casella corregge anche mentre scrivi',
    typed: '"Ma l\'ho sempre detto io..." brontolò Perpetua.',
    result: 'Le virgolette dritte diventano caporali, l’apostrofo e i puntini quelli tipografici. Con le lineette, anche la lineetta del dialogo',
    undo: '⌘Z subito dopo annulla la correzione',
    s5: 'Cercare nella scena',
    s5b: '⌘F (Ctrl+F)',
    word: 'padrone',
    find: 'Scrivi la parola: tutte le occorrenze si colorano',
    next: 'Invio passa alla successiva',
    s6: 'La barra di stato',
    s6b: 'Quanto hai scritto',
    status: 'Sotto il testo: quanto è lunga la scena e quanto hai scritto oggi. Con il capitolo intero, anche la lunghezza del capitolo',
    chars: 'Qui si conta in caratteri spazi inclusi; per contare le parole si sceglie in Statistiche',
  },
  en: {
    intro: 'A scene from the sample project, to see the writing tools',
    scene: 'Jane and Elizabeth',
    s1: 'What to see',
    s1b: 'One scene or the whole chapter',
    levels: 'Scene shows only the chosen scene; Chapter, Part and Novel show every scene one after the other',
    chapter: 'You write straight on, as in a single document: the arrow keys take you from one scene to the next',
    s2: 'Italics and bold',
    s2b: 'From the bar over the selection',
    line: 'He is just what a young man ought to be',
    select: 'Select the text: a small bar appears above it',
    italic: 'Italics, or ⌘I (Ctrl+I on Windows and Linux)',
    s3: 'The formatting bar',
    s3b: 'Always at hand',
    bar: 'From the More menu, Formatting bar keeps it above the text',
    row: 'Bold, italics, headings, lists, quotations, alignment and more',
    center: 'Center, for a letter or a note for instance. Another click puts it back on the left',
    blank: 'A blank line between two paragraphs, without starting a new scene: ⌥Return (Alt+Enter on Windows and Linux)',
    s4: 'Corrections as you type',
    s4b: 'Quotation marks, apostrophes, ellipses',
    quotes: 'In Export, choose how you write dialogue: the same choice holds as you type',
    style: 'curly',
    typing: 'This box corrects while you type too',
    typed: '"I\'m sure he likes you..." said Elizabeth.',
    result: 'Straight quotes become curly ones, and the apostrophe and the dots become typographic. With dashes, the dialogue dash too',
    undo: '⌘Z straight after undoes the correction',
    s5: 'Finding in the scene',
    s5b: '⌘F (Ctrl+F)',
    word: 'Bingley',
    find: 'Type the word: every match lights up',
    next: 'Return goes to the next one',
    s6: 'The status bar',
    s6b: 'How much you have written',
    status: 'Below the text: how long the scene is and how much you wrote today. With the whole chapter shown, the chapter’s length too',
    chars: 'You can count words or characters including spaces: choose it in Statistics',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const main = p.locator('main.center').first();
  const level = (key) => main.getByRole('button', { name: L(key), exact: true }).first();

  // the end of the scene: CodeMirror draws only the lines on screen
  const toEnd = async () => {
    for (let i = 0; i < 3; i++) {
      await main.evaluate((m) => { for (const e of [m, ...m.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight; });
      await t.wait(0.4);
    }
    await t.click(main.locator('.cm-line').last(), { dx: 0.98, after: 0.2 });
    await t.press('End', 0.2);
  };

  const top = async () => {
    await main.evaluate((m) => { for (const e of [m, ...m.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = 0; });
    await t.wait(0.5);
  };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });
  await t.click(t.text(d.scene), { after: 1 });

  await t.title(d.s1, d.s1b);
  await t.focus(p.locator(`[role=group][aria-label="${L('toolbar.show')}"]`).first(), d.levels, { side: 'below' });
  await t.click(level('level.chapter'), { after: 1.2 });
  await t.focus(main.locator('.cm-content').first(), d.chapter, { side: 'below' });
  await t.click(level('level.scene'), { after: 1 });
  await top();

  await t.title(d.s2, d.s2b);
  const line = t.line(d.line);
  await t.click(line, { dx: 0.02, after: 0.2 });
  await t.press('Home', 0.2);
  await t.press('Shift+End', 0.8);
  const bubble = p.locator('.cm-format-bar').first();
  await t.focus([line, bubble], d.select, { side: 'below' });
  const italic = bubble.getByRole('button', { name: L('format.italic') });
  await t.zoom([line, bubble], async () => {
    await t.focus(italic, d.italic, { side: 'right' });
    await t.click(italic, { after: 1.2 });
  }, 1.5);

  await t.title(d.s3, d.s3b);
  await t.click(p.locator('.more > button').first(), { after: 0.6 });
  await t.focus(p.getByText(L('more.formatBar')).first(), d.bar, { side: 'left' });
  await t.click(p.getByText(L('more.formatBar')).first(), { after: 0.6 });
  await t.press('Escape', 0.3);
  if (await p.locator('.more-menu').count()) await t.click(p.locator('.more > button').first(), { after: 0.4 });
  await t.focus(p.locator('.format-row').first(), d.row, { side: 'below' });
  const center = p.locator('.format-row').getByRole('button', { name: L('format.alignCenter') }).first();
  await t.click(line, { dx: 0.5, after: 0.3 });
  await t.click(center, { after: 1 });
  await t.focus([center, line], d.center, { side: 'below' });
  await t.click(center, { after: 1 });
  await t.click(line, { dx: 0.98, after: 0.2 });
  await t.press('End', 0.3);
  await t.press('Alt+Enter', 1);
  await t.focus(line, d.blank, { side: 'below', hold: 3 });

  await t.title(d.s4, d.s4b, () => t.nav('section.export'));
  const quotes = p.locator('label', { hasText: L('export.quotes') }).locator('select').first();
  await quotes.scrollIntoViewIfNeeded();
  await t.wait(0.6);
  await t.click(quotes, { after: 0.3 });
  await quotes.selectOption(d.style);
  await t.wait(0.8);
  await t.focus(quotes, d.quotes, { side: 'below' });
  const typing = p.locator('label', { hasText: L('export.whileTyping') }).first();
  await typing.scrollIntoViewIfNeeded();
  await t.focus(typing, d.typing, { side: 'below' });
  await t.nav('section.manuscript');
  await t.wait(1);
  await t.click(level('level.scene'), { after: 0.8 });
  await toEnd();
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.4);
  await t.type(d.typed, 80);
  await t.wait(0.8);
  const typed = t.line(d.typed.split(' ').slice(-1)[0]);
  await t.zoom(typed, async () => {
    await t.focus(typed, d.result, { side: 'above', pointer: false });
  }, 1.6);
  await t.say(d.undo);

  await t.title(d.s5, d.s5b);
  await top();
  await t.click(main.locator('.cm-line').first(), { after: 0.3 });
  await t.press('ControlOrMeta+F', 0.8);
  await t.type(d.word, 110);
  await t.wait(1);
  const panel = p.locator('.cm-search').first();
  await t.focus([panel, main.locator('.cm-searchMatch').first()], d.find, { side: 'above' });
  await t.press('Enter', 0.8);
  await t.focus(main.locator('.cm-searchMatch-selected').first(), d.next, { side: 'below', pointer: false });
  await t.press('Enter', 0.8);
  await t.press('Escape', 0.6);

  await t.title(d.s6, d.s6b);
  await t.focus(p.locator('footer.status-bar').first(), d.status, { side: 'above' });
  await t.click(level('level.chapter'), { after: 1.2 });
  await t.focus(p.locator('footer.status-bar').first(), d.chars, { side: 'above' });
}
