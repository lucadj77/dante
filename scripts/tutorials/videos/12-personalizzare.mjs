// 12. Personalizzare l'aspetto: how the text looks in the editor (only on screen, not in the book),
// the theme, the accent colour and the spelling checker.
export const meta = {
  n: 12,
  group: 'write',
  title: { it: 'Personalizzare l’aspetto', en: 'Customizing the look' },
  subtitle: { it: 'Il testo nell’editor, il tema, il colore d’accento', en: 'The text in the editor, the theme, the accent color' },
};

const D = {
  it: {
    intro: 'Font, interlinea, colori: Dante si adatta a come ti piace leggere mentre scrivi',
    scene: 'Perpetua',
    before: 'Il testo come appare di solito',
    s1: 'Dove si trova',
    s1b: 'Impostazioni, Dante su questo computer',
    tab: 'L’aspetto è nella scheda Dante su questo computer: vale per tutti i romanzi aperti su questo computer',
    own: 'Se scrivi con qualcuno, ognuno ha il suo aspetto: le tue scelte non cambiano lo schermo dell’altro',
    s2: 'Solo quello che vedi',
    s2b: 'Non il libro',
    only: 'Queste scelte cambiano come vedi il testo mentre scrivi. Il libro esportato non cambia: ha le sue impostazioni, in Esportazione',
    s3: 'Il testo nell’editor',
    s3b: 'Font, corpo, interlinea, rientro',
    font: 'Il font: alcuni pronti, oppure uno qualsiasi tra quelli installati sul computer',
    fontValue: 'Palatino',
    size: 'La dimensione e la larghezza della riga, in caratteri',
    lines: 'Interlinea, spazio tra i paragrafi e rientro della prima riga, come in un libro',
    justify: 'Il testo giustificato, allineato sui due lati',
    sample: 'L’esempio mostra subito il risultato',
    after: 'Lo stesso testo, con le nuove scelte',
    s4: 'Il tema',
    s4b: 'Chiaro, seppia, scuro, notte',
    theme: 'Di sistema segue il Mac o Windows; poi Chiaro, Seppia, Scuro e Notte',
    sepia: 'Seppia: carta calda, meno bianco negli occhi',
    night: 'Notte: quasi nero, per scrivere al buio',
    s5: 'Il colore d’accento',
    s5b: 'Pulsanti, selezioni, collegamenti',
    accent: 'Il colore di pulsanti, selezioni e collegamenti: quello del tema, o uno a scelta',
    s6: 'Ortografia',
    s6b: 'Il correttore del sistema',
    spell: 'Il correttore sottolinea le parole che non conosce, nella lingua del romanzo. Si può spegnere',
    s7: 'E nel libro?',
    s7b: 'Decide l’Esportazione',
    export: 'Il font, il corpo e l’interlinea del libro si scelgono qui, per ogni formato',
    end: 'Il manoscritto resta com’era: è cambiato solo lo schermo',
  },
  en: {
    intro: 'Font, line spacing, colors: Dante adapts to how you like to read while you write',
    scene: 'Jane and Elizabeth',
    before: 'The text as it usually looks',
    s1: 'Where it is',
    s1b: 'Settings, Dante on this computer',
    tab: 'The look is in the Dante on this computer tab: it holds for every novel opened on this computer',
    own: 'If you write with someone, each of you has your own look: your choices do not change their screen',
    s2: 'Only what you see',
    s2b: 'Not the book',
    only: 'These choices change how you see the text while you write. The exported book does not change: it has its own settings, in Export',
    s3: 'The text in the editor',
    s3b: 'Font, size, spacing, indent',
    font: 'The font: a few ready ones, or any font installed on the computer',
    fontValue: 'Palatino',
    size: 'The size, and the line width in characters',
    lines: 'Line spacing, space between paragraphs and first-line indent, as in a book',
    justify: 'Justified text, aligned on both sides',
    sample: 'The sample shows the result straight away',
    after: 'The same text, with the new choices',
    s4: 'The theme',
    s4b: 'Light, sepia, dark, night',
    theme: 'System follows the Mac or Windows; then Light, Sepia, Dark and Night',
    sepia: 'Sepia: warm paper, less glare',
    night: 'Night: almost black, for writing in the dark',
    s5: 'The accent color',
    s5b: 'Buttons, selections, links',
    accent: 'The color of buttons, selections and links: the theme’s own, or one you choose',
    s6: 'Spelling',
    s6b: 'The system’s checker',
    spell: 'The checker underlines the words it does not know, in the novel’s language. You can turn it off',
    s7: 'And in the book?',
    s7b: 'Export decides',
    export: 'The book’s font, size and line spacing are chosen here, for each format',
    end: 'The manuscript is as it was: only the screen changed',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const main = p.locator('main.center').first();
  const text = () => main.locator('.cm-content').first();
  const select = (key) => p.locator('label', { hasText: L(key) }).locator('select').first();
  const input = (key) => p.locator('label', { hasText: L(key) }).locator('input').first();
  const sample = p.locator('.sample').first();
  const choose = async (sel, value) => {
    await t.click(sel, { after: 0.3 });
    await sel.selectOption(value);
    await t.wait(0.8);
  };
  const retype = async (field, value) => {
    await t.click(field, { after: 0.2 });
    await p.keyboard.press('ControlOrMeta+A');
    await t.type(value, 120);
    await t.press('Tab', 0.8);
  };
  const appearance = async () => {
    await t.nav('section.settings');
    await t.wait(0.8);
    await t.click(t.text(L('settings.tabApp')), { after: 0.6 });
    await p.getByRole('heading', { name: L('appearance.title'), exact: true }).first().scrollIntoViewIfNeeded();
    await t.wait(0.6);
  };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });
  await t.click(t.text(d.scene), { after: 1 });
  await t.click(main.getByRole('button', { name: L('level.scene'), exact: true }).first(), { after: 1 });
  await t.focus(text(), d.before, { side: 'below', pointer: false });

  await t.title(d.s1, d.s1b, appearance);
  const tab = t.text(L('settings.tabApp'));
  await t.focus(tab, d.tab, { side: 'below' });
  await t.say(d.own);

  await t.title(d.s2, d.s2b);
  await t.focus(p.getByRole('heading', { name: L('appearance.page'), exact: true }).first(), d.only, { side: 'right', hold: 4 });

  await t.title(d.s3, d.s3b);
  const font = select('settings.font');
  await font.scrollIntoViewIfNeeded();
  await t.click(font, { after: 0.3 });
  await font.selectOption({ label: d.fontValue });
  await t.wait(0.8);
  await t.focus([font, sample], d.font, { side: 'right' });
  await retype(input('settings.fontSize'), '20');
  await t.focus([input('settings.fontSize'), input('settings.lineWidth')], d.size, { side: 'right' });
  await choose(select('appearance.lineHeight'), '2');
  await choose(select('appearance.gap'), '0.5');
  await choose(select('appearance.indent'), '1.5');
  await t.zoom([select('appearance.lineHeight'), select('appearance.indent')], () =>
    t.focus([select('appearance.lineHeight'), select('appearance.indent')], d.lines, { side: 'below' }), 1.4);
  const justify = p.locator('label', { hasText: L('appearance.justify') }).first();
  await t.click(justify.locator('input'), { after: 0.8 });
  await t.focus(justify, d.justify, { side: 'right' });
  await sample.scrollIntoViewIfNeeded();
  await t.focus(sample, d.sample, { side: 'right', pointer: false });
  await t.nav('section.manuscript');
  await t.wait(1.2);
  await t.focus(text(), d.after, { side: 'below', pointer: false });

  await t.title(d.s4, d.s4b, appearance);
  const theme = select('settings.theme');
  await t.focus(theme, d.theme, { side: 'right' });
  await choose(theme, 'sepia');
  await t.focus(theme, d.sepia, { side: 'right' });
  await choose(theme, 'night');
  await t.focus(theme, d.night, { side: 'right' });

  await t.title(d.s5, d.s5b);
  const swatches = p.getByRole('radiogroup', { name: L('appearance.accent') }).first();
  await t.click(swatches.getByRole('radio', { name: L('appearance.accent.teal') }), { after: 1 });
  await t.zoom(swatches, () => t.focus(swatches, d.accent, { side: 'right' }), 1.6);

  await t.title(d.s6, d.s6b, async () => {
    await p.locator('label', { hasText: L('appearance.spellcheck') }).first().scrollIntoViewIfNeeded();
    await t.wait(0.6);
  });
  await t.focus(p.locator('label', { hasText: L('appearance.spellcheck') }).first(), d.spell, { side: 'below' });

  await t.title(d.s7, d.s7b, () => t.nav('section.export'));
  const bookFont = p.locator('label', { hasText: L('export.lineSpacing') }).first();
  await bookFont.scrollIntoViewIfNeeded();
  await t.wait(0.6);
  await t.focus(bookFont, d.export, { side: 'right' });
  await t.nav('section.manuscript');
  await t.wait(1.2);
  await t.focus(text(), d.end, { side: 'below', pointer: false });
}
