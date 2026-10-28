// 7. Scrivere una scena: how much of the novel to show, formatting from the selection and from the
// bar, blank lines, typography while typing and how to keep straight quotes, the dialogue marks of the export, find in the scene and the status bar.
export const meta = {
  n: 7,
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
    s4: 'I segni del dialogo',
    s4b: 'Si scelgono in Esportazione',
    where: 'In Esportazione, sezione Tipografia',
    quotes: 'Dialoghi: all’inizio è Come scritti nel testo, e Dante lascia le virgolette come le scrivi',
    style: 'guillemets',
    change: 'Scelto un segno, per esempio i caporali, il libro esportato usa quello in tutte le battute, qualunque segno tu abbia usato nel testo. Si può cambiare anche all’ultimo',
    files: 'I file del romanzo non cambiano: la conversione avviene nel libro esportato. Mentre scrivi, Dante segue la stessa scelta',
    s5: 'Virgolette e caratteri tipografici',
    s5b: 'Corretti mentre scrivi',
    open: 'La tastiera ha solo la virgoletta dritta. Appena la scrivi, Dante la trasforma nel caporale di apertura',
    typed: 'Ma l\'ho sempre detto io..." brontolò Perpetua.',
    result: 'Dopo una lettera la virgoletta chiude. L’apostrofo dritto diventa quello tipografico, i tre punti un unico carattere',
    rule: 'Dante guarda il carattere prima: a inizio riga o dopo uno spazio apre, dopo una lettera o un segno chiude',
    s6: 'Tenere le virgolette dritte',
    s6b: 'Una volta sola, o sempre',
    once: 'Per una volta sola: ⌘Z (Ctrl+Z su Windows e Linux) subito dopo la correzione rimette la virgoletta dritta',
    typing: 'Sempre: in Esportazione, togli questa spunta e Dante non corregge niente mentre scrivi',
    straight: '"Vieni qui"',
    kept: 'Le virgolette restano dritte nel testo. Nel libro esportato diventano comunque i segni scelti per i dialoghi',
    s7: 'Cercare nella scena',
    s7b: '⌘F (Ctrl+F)',
    word: 'padrone',
    find: 'Scrivi la parola: tutte le occorrenze si colorano',
    next: 'Invio passa alla successiva',
    s8: 'La barra di stato',
    s8b: 'Quanto hai scritto',
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
    line: 'Dear Lizzy!',
    select: 'Select the text: a small bar appears above it',
    italic: 'Italics, or ⌘I (Ctrl+I on Windows and Linux)',
    s3: 'The formatting bar',
    s3b: 'Always at hand',
    bar: 'From the More menu, Formatting bar keeps it above the text',
    row: 'Bold, italics, headings, lists, quotations, alignment and more',
    center: 'Center, for a letter or a note for instance. Another click puts it back on the left',
    blank: 'A blank line between two paragraphs, without starting a new scene: ⌥Return (Alt+Enter on Windows and Linux)',
    s4: 'Dialogue marks',
    s4b: 'Chosen in Export',
    where: 'In Export, Typography section',
    quotes: 'Dialogue: at first it is As typed in the text, and Dante leaves quotes as you type them',
    style: 'curly',
    change: 'Once you choose a mark, curly quotes for instance, the exported book uses it for every line of dialogue, whatever mark you used in the text. You can change it even at the last minute',
    files: 'Your novel’s files do not change: the conversion happens in the exported book. As you type, Dante follows the same choice',
    s5: 'Quotes and typographic characters',
    s5b: 'Corrected as you type',
    open: 'The keyboard only has the straight quote. As soon as you type it, Dante turns it into an opening curly quote',
    typed: 'I\'m sure he likes you..." said Elizabeth.',
    result: 'After a letter the quote closes. The straight apostrophe becomes the typographic one, the three dots a single character',
    rule: 'Dante looks at the character before: at the start of a line or after a space it opens, after a letter or a sign it closes',
    s6: 'Keeping straight quotes',
    s6b: 'Just once, or always',
    once: 'Just once: ⌘Z (Ctrl+Z on Windows and Linux) straight after the correction puts the straight quote back',
    typing: 'Always: in Export, untick this box and Dante corrects nothing as you type',
    straight: '"Come here"',
    kept: 'The quotes stay straight in the text. In the exported book they still become the marks chosen for dialogue',
    s7: 'Finding in the scene',
    s7b: '⌘F (Ctrl+F)',
    word: 'Bingley',
    find: 'Type the word: every match lights up',
    next: 'Return goes to the next one',
    s8: 'The status bar',
    s8b: 'How much you have written',
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
  await t.say(d.where);
  await t.zoom(quotes, () => t.focus(quotes, d.quotes, { side: 'below' }), 1.5);
  await t.click(quotes, { after: 0.3 });
  await quotes.selectOption(d.style);
  await t.wait(1);
  await t.focus(quotes, d.change, { side: 'below', pointer: false });
  await t.focus(quotes, d.files, { side: 'below', pointer: false });

  await t.title(d.s5, d.s5b, async () => {
    await t.nav('section.manuscript');
    await t.wait(1);
    await t.click(level('level.scene'), { after: 0.8 });
    await toEnd();
  });
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.4);
  await t.type('"', 80);
  await t.wait(0.8);
  const said = main.locator('.cm-line').last();
  await t.zoom(said, () => t.focus(said, d.open, { side: 'above', pointer: false }), 2);
  await t.type(d.typed, 90);
  await t.wait(0.8);
  await t.zoom(said, async () => {
    await t.focus(said, d.result, { side: 'above', pointer: false });
    await t.focus(said, d.rule, { side: 'above', pointer: false });
  }, 1.6);

  await t.title(d.s6, d.s6b);
  await t.press('End', 0.2);
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.4);
  await t.type('"', 80);
  await t.wait(0.6);
  const last = main.locator('.cm-line').last();
  await t.zoom(last, async () => {
    await t.wait(0.8);
    await t.press('ControlOrMeta+z', 1);
    await t.focus(last, d.once, { side: 'above', pointer: false });
  }, 2);
  await t.press('Backspace', 0.2);
  await t.press('Backspace', 0.2);
  await t.press('Backspace', 0.4);
  await t.nav('section.export');
  await t.wait(1);
  const typing = p.locator('label', { hasText: L('export.whileTyping') }).first();
  await typing.scrollIntoViewIfNeeded();
  await t.wait(0.4);
  await t.zoom(typing, () => t.focus(typing, d.typing, { side: 'below' }), 1.5);
  await t.click(typing.locator('input'), { after: 0.8 });
  await t.nav('section.manuscript');
  await t.wait(1);
  await t.click(level('level.scene'), { after: 0.8 });
  await toEnd();
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.4);
  await t.type(d.straight, 90);
  await t.wait(0.8);
  const plain = main.locator('.cm-line').last();
  await t.zoom(plain, () => t.focus(plain, d.kept, { side: 'above', pointer: false }), 2);

  await t.title(d.s7, d.s7b);
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

  await t.title(d.s8, d.s8b);
  await t.focus(p.locator('footer.status-bar').first(), d.status, { side: 'above' });
  await t.click(level('level.chapter'), { after: 1.2 });
  await t.focus(p.locator('footer.status-bar').first(), d.chars, { side: 'above' });
}
