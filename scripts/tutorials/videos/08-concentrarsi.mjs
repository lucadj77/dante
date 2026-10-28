// 8. Concentrarsi sulla pagina: typewriter, focus and line modes, full screen, and a timed writing
// session (the clock runs faster in the video).
export const meta = {
  n: 8,
  group: 'write',
  title: { it: 'Concentrarsi sulla pagina', en: 'Focus on the page' },
  subtitle: { it: 'Meno distrazioni, una sessione a tempo', en: 'Fewer distractions, a timed session' },
};

const D = {
  it: {
    intro: 'Quando si scrive conta solo la pagina: Dante aiuta a togliere il resto',
    scene: 'Perpetua',
    modes: 'Sopra il testo, quattro modi per scrivere: si accendono e si spengono con un clic',
    s1: 'Macchina da scrivere',
    s1b: 'La riga resta al centro',
    typewriter: 'La riga che scrivi resta a metà della finestra: lo sguardo non deve scendere in fondo',
    typed: ' Perpetua alzò le spalle e tornò al suo fiasco.',
    s2: 'Focus',
    s2b: 'Solo il paragrafo che scrivi',
    focus: 'Il resto si attenua: in nero resta solo il paragrafo su cui lavori',
    s3: 'Riga',
    s3b: 'La riga del cursore ombreggiata',
    line: 'Una leggera ombra sulla riga del cursore: l’occhio la ritrova subito',
    s4: 'Schermo intero',
    s4b: 'Solo il testo',
    full: 'Restano solo le parole. Le barre tornano portando il mouse ai bordi; Esc per uscire',
    edge: 'In alto, le barre; a sinistra, l’indice; a destra, il pannello',
    s5: 'Una sessione di scrittura',
    s5b: 'Tempo e obiettivo',
    sprint: 'Nella barra di stato, Sessione: quanto tempo scrivere e, se vuoi, quanto',
    minutes: '25',
    target: '150',
    targetSay: 'Qui 25 minuti e 150 caratteri. Contano quelli che aggiungi, meno quelli che cancelli',
    running: 'La barra conta il tempo che resta e quanto hai scritto',
    write: ' Fuori, il vento portava l’odore del lago.',
    faster: 'Nel video il tempo scorre più veloce',
    done: 'Allo scadere, il messaggio finale con il risultato. Termina chiude prima la sessione',
  },
  en: {
    intro: 'When you write, only the page matters: Dante helps you put the rest aside',
    scene: 'Jane and Elizabeth',
    modes: 'Above the text, four ways to write: one click turns each on or off',
    s1: 'Typewriter',
    s1b: 'The line stays in the middle',
    typewriter: 'The line you write stays halfway down the window: your eyes need not drop to the bottom',
    typed: ' Jane smiled and said nothing more.',
    s2: 'Focus',
    s2b: 'Only the paragraph you write',
    focus: 'Everything else fades: only the paragraph you are working on stays black',
    s3: 'Line',
    s3b: 'The cursor’s line shaded',
    line: 'A light shade on the cursor’s line: your eye finds it straight away',
    s4: 'Full screen',
    s4b: 'Only the text',
    full: 'Only the words are left. The bars come back when the mouse reaches the edges; Esc to leave',
    edge: 'At the top, the bars; on the left, the outline; on the right, the panel',
    s5: 'A writing session',
    s5b: 'Time and goal',
    sprint: 'In the status bar, Session: how long to write and, if you like, how much',
    minutes: '25',
    target: '25',
    targetSay: 'Here 25 minutes and 25 words. The words you add count, minus the ones you delete',
    running: 'The bar counts the time left and how much you have written',
    write: ' Outside, the wind carried the smell of the fields.',
    faster: 'In the video the time runs faster',
    done: 'When time is up, the final message with the result. Stop ends the session early',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const main = p.locator('main.center').first();
  const modes = p.getByRole('group', { name: L('toolbar.modes') }).first();
  // the buttons show only their icons: focus, typewriter, line, full screen
  const ORDER = ['mode.focus', 'mode.typewriter', 'mode.lineHighlight', 'mode.fullscreen'];
  const mode = (key) => modes.locator('button').nth(ORDER.indexOf(key));

  // the end of the scene: CodeMirror draws only the lines on screen
  const toEnd = async () => {
    for (let i = 0; i < 3; i++) {
      await main.evaluate((m) => { for (const e of [m, ...m.querySelectorAll('*')]) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight; });
      await t.wait(0.4);
    }
    await t.click(main.locator('.cm-line').last(), { dx: 0.98, after: 0.2 });
    await t.press('End', 0.2);
  };
  const middle = () => main.locator('.cm-line').filter({ hasText: /\S/ }).nth(4);

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });
  await t.click(t.text(d.scene), { after: 1 });
  await t.click(main.getByRole('button', { name: L('level.chapter'), exact: true }).first(), { after: 1 });
  await t.zoom(modes, () => t.focus(modes, d.modes, { side: 'below' }), 1.6);

  await t.title(d.s1, d.s1b, () => t.click(mode('mode.typewriter'), { after: 1 }));
  await t.click(middle(), { dx: 0.98, after: 0.2 });
  await t.press('End', 0.6);
  await t.type(d.typed, 70);
  await t.wait(0.8);
  await t.focus(t.line(d.typed.trim().slice(0, 18)), d.typewriter, { side: 'below', pointer: false });
  await t.click(mode('mode.typewriter'), { after: 0.8 });

  await t.title(d.s2, d.s2b, () => t.click(mode('mode.focus'), { after: 1 }));
  await t.click(middle(), { dx: 0.5, after: 0.8 });
  await t.focus(main.locator('.cm-line:not(.cm-dimmed)').filter({ hasText: /\S/ }).first(), d.focus, { side: 'below', pointer: false });
  await t.click(mode('mode.focus'), { after: 0.8 });

  await t.title(d.s3, d.s3b, () => t.click(mode('mode.lineHighlight'), { after: 1 }));
  await t.click(middle(), { dx: 0.3, after: 0.8 });
  const shaded = main.locator('.cm-cursorLineLayer').first();
  await t.zoom(shaded, () => t.focus(shaded, d.line, { side: 'below', pointer: false }), 1.5);
  await t.click(mode('mode.lineHighlight'), { after: 0.8 });

  await t.title(d.s4, d.s4b, () => t.click(mode('mode.fullscreen'), { after: 1.5 }));
  await t.say(d.full);
  await t.moveTo(700, 4, 20);
  await t.wait(1.2);
  await t.say(d.edge);
  await t.moveTo(700, 400, 20);
  await t.press('Escape', 1.2);

  await t.title(d.s5, d.s5b);
  // a clock that can be moved forward, so 25 minutes pass in a few seconds
  await p.evaluate(() => {
    const real = Date.now;
    let ahead = 0;
    Date.now = () => real() + ahead;
    window.__forward = (ms) => { ahead += ms; };
  });
  const bar = p.locator('footer.status-bar').first();
  const open = bar.getByRole('button', { name: L('sprint.title') }).first();
  await t.focus(open, d.sprint, { side: 'above' });
  await t.click(open, { after: 0.8 });
  const form = bar.locator('form.popover').first();
  const minutes = form.locator('select').first();
  await t.click(minutes, { after: 0.3 });
  await minutes.selectOption(d.minutes);
  await t.wait(0.5);
  const target = form.locator('input[type=number]').first();
  await t.click(target, { after: 0.2 });
  await p.keyboard.press('ControlOrMeta+A');
  await t.type(d.target, 120);
  await t.wait(0.6);
  await t.focus(form, d.targetSay, { side: 'above' });
  await t.click(form.getByRole('button', { name: L('sprint.start') }), { after: 1 });
  await toEnd();
  await t.press('Enter', 0.1);
  await t.press('Enter', 0.4);
  await t.type(d.write, 70);
  await t.wait(1);
  await t.focus(bar.locator('.sprint.running').first(), d.running, { side: 'above', pointer: false });
  await t.say(d.faster, { hold: 1 });
  for (let i = 0; i < 25; i++) {
    await p.evaluate(() => window.__forward(60_000));
    await t.wait(0.25);
  }
  await t.wait(1.5);
  await t.focus(bar.locator('.sprint.done').first(), d.done, { side: 'above', pointer: false });
}
