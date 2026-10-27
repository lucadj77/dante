// 5. Cos'è il Markdown: the format Dante keeps the novel in, its few marks, and why it is a good one.
export const meta = {
  n: 5,
  group: 'start',
  title: { it: 'Cos’è il Markdown', en: 'What is Markdown' },
  subtitle: { it: 'Il formato in cui Dante salva il tuo romanzo', en: 'The format Dante saves your novel in' },
};

const D = {
  it: {
    intro: 'Dante salva ogni scena in un file di testo semplice, in formato Markdown',
    scene: 'L’incontro',
    seen: 'Così vedi la scena in Dante',
    rawNote: 'Dal menu Altro: il testo com’è nel file',
    raw: 'Ed ecco il file: semplice testo, che si apre con qualsiasi editor',
    props: 'In cima, tra due righe di trattini, le proprietà: sinossi, stato, punto di vista, luogo, data',
    s1: 'I segni di base',
    s1b: 'Pochi segni, al posto dei pulsanti',
    lines: ['Era *davvero* stanco, e **molto** spaventato.', '> Una citazione comincia con il segno di maggiore.', '- Un elenco comincia con un trattino.'],
    marks: 'Un asterisco intorno alle parole per il corsivo, due per il grassetto; il maggiore per una citazione, il trattino per un elenco',
    back: 'Tornando alla vista normale, Dante mostra il risultato e nasconde i segni',
    toolbar: 'Non serve impararli: la barra di formattazione li scrive per te',
    s2: 'Commenti e revisioni',
    s2b: 'Anche loro dentro il testo',
    commentAt: 'in tono solenne di comando',
    comment: 'Commenti e modifiche proposte restano nel testo, tra parentesi graffe: se apri il file con un altro programma, non cancellarli',
    s3: 'Perché conviene',
    s3b: 'Un formato libero',
    why: [
      'Nessun programma ne è padrone: i tuoi file restano tuoi, anche senza Dante',
      'Si leggono con qualsiasi editor di testo, oggi e tra trent’anni',
      'Sono piccoli, si sincronizzano bene con Dropbox o Google Drive e si confrontano riga per riga',
    ],
  },
  en: {
    intro: 'Dante saves every scene in a plain text file, in Markdown format',
    scene: 'The ball',
    seen: 'This is the scene as you see it in Dante',
    rawNote: 'From the More menu: the text as it is in the file',
    raw: 'And here is the file: plain text, which any text editor can open',
    props: 'At the top, between two lines of dashes, the properties: synopsis, status, point of view, place, date',
    s1: 'The basic marks',
    s1b: 'A few marks instead of buttons',
    lines: ['He was *truly* tired, and **very** frightened.', '> A quotation starts with a greater-than sign.', '- A list starts with a dash.'],
    marks: 'One asterisk around words for italics, two for bold; greater-than for a quotation, a dash for a list',
    back: 'Back in the normal view, Dante shows the result and hides the marks',
    toolbar: 'No need to learn them: the formatting bar writes them for you',
    s2: 'Comments and revisions',
    s2b: 'They live in the text too',
    commentAt: 'in general circulation within',
    comment: 'Comments and suggested changes stay in the text, between curly brackets: if you open the file in another program, do not delete them',
    s3: 'Why it is a good choice',
    s3b: 'A free format',
    why: [
      'No program owns it: your files stay yours, even without Dante',
      'Any text editor can read them, today and thirty years from now',
      'They are small, sync well with Dropbox or Google Drive, and can be compared line by line',
    ],
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
    if (i) { await t.press('Enter', 0.1); await t.press('Enter', 0.3); }
    await t.type(line, 60);
  }
  await t.wait(0.8);
  await t.zoom(t.line(d.lines[1]), async () => {
    await t.focus([t.line(d.lines[0]), t.line(d.lines[2])], d.marks, { side: 'above', pointer: false });
  }, 1.4);
  await t.click(p.getByRole('button', { name: /^Markdown/ }).first(), { after: 1 });
  await toEnd();
  await t.wait(0.8);
  const shown = p.locator('.cm-line', { hasText: d.lines[2].slice(2) }).first();
  await t.focus([p.locator('.cm-line', { hasText: d.lines[0].replace(/\*/g, '').slice(0, 12) }).first(), shown], d.back, { side: 'above' });
  await t.focus(p.locator('.format-row').first(), d.toolbar, { side: 'below' });

  await t.title(d.s2, d.s2b, raw);
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

  await t.title(d.s3, d.s3b);
  for (const w of d.why) await t.say(w);
}
