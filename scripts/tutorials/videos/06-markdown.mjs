// 6. Cos'è il Markdown: the format Dante keeps the novel in, its few marks, and why it is a good one.
export const meta = {
  n: 6,
  group: 'start',
  title: { it: 'Cos’è il Markdown', en: 'What is Markdown' },
  subtitle: { it: 'Il formato in cui Dante salva il tuo romanzo', en: 'The format Dante saves your novel in' },
};

const D = {
  it: {
    intro: 'Dante salva ogni scena in un file di testo, in formato Markdown. Ma cos’è il Markdown?',
    scene: 'L’incontro',
    seen: 'Così vedi la scena in Dante',
    rawNote: 'Dal menu Altro: il testo com’è nel file',
    raw: 'Ed ecco il file: testo semplice, con qualche segno qua e là',
    props: 'In cima, tra due righe di trattini, le proprietà: sinossi, stato, punto di vista, luogo, data',
    s1: 'I segni di marcatura',
    s1b: 'Dicono come formattare il testo',
    lines: ['Era *davvero* stanco, e **molto** spaventato.', '- Un elenco comincia con un trattino.', '> Una citazione comincia con il segno di maggiore.'],
    marks: 'Il Markdown indica la formattazione con pochi segni: un asterisco intorno alle parole per il corsivo, due per il grassetto, un trattino per un elenco, il maggiore per una citazione',
    s2: 'I paragrafi',
    s2b: 'Una riga bianca tra l’uno e l’altro',
    paragraphs: 'Nel file ogni paragrafo è separato dal successivo da una riga bianca. Un solo a capo, per il Markdown, resta dentro lo stesso paragrafo',
    s3: 'Uno standard',
    s3b: 'I tuoi file restano tuoi',
    why: [
      'Proprio perché è così semplice, il Markdown è diventato uno standard: moltissimi programmi lo sanno leggere',
      'Così i tuoi file restano tuoi: li apri con qualsiasi editor di testo, anche senza Dante, oggi e tra trent’anni',
      'Sono piccoli, si sincronizzano bene con Dropbox o Google Drive e si confrontano riga per riga',
    ],
    s4: 'Non serve conoscerlo',
    s4b: 'Dante lo legge per te',
    back: 'Dante legge il Markdown e ti mostra il testo formattato e impaginato, senza i segni',
    line: 'I segni compaiono solo sulla riga che stai scrivendo: puoi scriverli a mano, se ti è comodo',
    toolbar: 'Oppure usare la barra di formattazione, che li scrive per te: il risultato è lo stesso',
    s5: 'Commenti e revisioni',
    s5b: 'Anche loro dentro il testo',
    commentAt: 'in tono solenne di comando',
    comment: 'Commenti e modifiche proposte restano nel testo, tra parentesi graffe: se apri il file con un altro programma, non cancellarli',
  },
  en: {
    intro: 'Dante saves every scene in a text file, in Markdown format. But what is Markdown?',
    scene: 'The ball',
    seen: 'This is the scene as you see it in Dante',
    rawNote: 'From the More menu: the text as it is in the file',
    raw: 'And here is the file: plain text, with a few marks here and there',
    props: 'At the top, between two lines of dashes, the properties: synopsis, status, point of view, place, date',
    s1: 'Markup signs',
    s1b: 'They say how the text is formatted',
    lines: ['He was *truly* tired, and **very** frightened.', '- A list starts with a dash.', '> A quotation starts with a greater-than sign.'],
    marks: 'Markdown marks formatting with a few signs: one asterisk around words for italics, two for bold, a dash for a list, greater-than for a quotation',
    s2: 'Paragraphs',
    s2b: 'A blank line between one and the next',
    paragraphs: 'In the file each paragraph is separated from the next by a blank line. A single line break, for Markdown, stays inside the same paragraph',
    s3: 'A standard',
    s3b: 'Your files stay yours',
    why: [
      'Because it is so simple, Markdown has become a standard: a great many programs can read it',
      'So your files stay yours: any text editor opens them, even without Dante, today and thirty years from now',
      'They are small, sync well with Dropbox or Google Drive, and can be compared line by line',
    ],
    s4: 'No need to learn it',
    s4b: 'Dante reads it for you',
    back: 'Dante reads Markdown and shows you the text formatted and laid out, without the marks',
    line: 'The marks show only on the line you are writing: you can type them by hand, if you like',
    toolbar: 'Or use the formatting bar, which writes them for you: the result is the same',
    s5: 'Comments and revisions',
    s5b: 'They live in the text too',
    commentAt: 'in general circulation within',
    comment: 'Comments and suggested changes stay in the text, between curly brackets: if you open the file in another program, do not delete them',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const raw = async () => {
    await t.click(p.locator('.more > button').first(), { after: 0.6 });
    await t.click(p.getByText(L('more.raw')).first(), { after: 1 });
  };

  // the end of the scene: CodeMirror draws only the lines on screen
  const toEnd = async () => {
    for (let i = 0; i < 3; i++) {
      await p.locator('main.center').first().evaluate((m) => { for (const e of [m, ...m.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight; });
      await t.wait(0.4);
    }
    await t.click(p.locator('main.center .cm-line').last(), { dx: 0.98, after: 0.2 });
    await t.press('End', 0.2);
  };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });
  await t.click(t.text(d.scene), { after: 0.8 });
  await t.click(p.locator('main.center').getByRole('button', { name: L('level.scene'), exact: true }).first(), { after: 1 });
  await t.focus(p.locator('main.center .cm-content').first(), d.seen, { side: 'below', hold: 3 });
  await t.focus(p.locator('.more > button').first(), d.rawNote, { side: 'left' });
  await raw();
  await t.focus(p.locator('main.center .cm-content').first(), d.raw, { side: 'below' });
  await t.focus([t.line('synopsis:'), t.line('data:').or(t.line('date:')).first()], d.props, { side: 'right' });

  await t.title(d.s1, d.s1b);
  await toEnd();
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.3);
  for (const [i, line] of d.lines.entries()) {
    if (i) {
      await t.press('Enter', 0.1);
      // Enter continues a list or a quotation: its mark goes before the blank line
      if (/^[->]/.test(d.lines[i - 1])) { await t.press('Shift+Home', 0.1); await t.press('Backspace', 0.1); }
      await t.press('Enter', 0.3);
    }
    await t.type(line, 60);
  }
  await t.wait(0.8);
  await t.zoom(t.line(d.lines[1]), async () => {
    await t.focus([t.line(d.lines[0]), t.line(d.lines[2])], d.marks, { side: 'above', pointer: false });
  }, 1.4);

  await t.title(d.s2, d.s2b);
  await t.zoom(t.line(d.lines[1]), async () => {
    await t.focus([t.line(d.lines[0]), t.line(d.lines[2])], d.paragraphs, { side: 'above', pointer: false });
  }, 1.4);

  await t.title(d.s3, d.s3b);
  for (const w of d.why) await t.say(w);

  await t.title(d.s4, d.s4b, async () => {
    await t.click(p.getByRole('button', { name: /^Markdown/ }).first(), { after: 1 });
    await toEnd();
  });
  await t.wait(0.5);
  const first = p.locator('.cm-line', { hasText: d.lines[0].replace(/\*/g, '').slice(0, 12) }).first();
  const shown = p.locator('.cm-line', { hasText: d.lines[2].slice(2) }).first();
  await t.focus([first, shown], d.back, { side: 'above' });
  // on the line being written the marks come back
  const marked = p.locator('.cm-line', { hasText: d.lines[0].replace(/\*/g, '').slice(-12) }).last();
  await t.click(marked, { dx: 0.3, after: 0.8 });
  await t.zoom(marked, () => t.focus(marked, d.line, { side: 'above', pointer: false }), 1.6);
  await t.focus(p.locator('.format-row').first(), d.toolbar, { side: 'below' });

  await t.title(d.s5, d.s5b, raw);
  // scroll down until CodeMirror draws the line
  const c = t.line(d.commentAt);
  await p.locator('main.center').first().evaluate((m) => { for (const e of [m, ...m.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = 0; });
  for (let i = 0; i < 60 && !(await c.count()); i++) {
    await p.locator('main.center').first().evaluate((m) => { for (const e of [m, ...m.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop += 300; });
    await p.waitForTimeout(120);
  }
  await c.scrollIntoViewIfNeeded();
  await t.wait(0.6);
  await t.zoom(c, () => t.focus(c, d.comment, { side: 'below', pointer: false }), 1.3);
}
