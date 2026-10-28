// 18. Statistiche e obiettivi: the novel's totals, goals in words or characters with the deadline and
// the writing days, the last 30 days, the length of chapters and scenes, mentions and style.
export const meta = {
  n: 18,
  group: 'export',
  title: { it: 'Statistiche e obiettivi', en: 'Statistics and goals' },
  subtitle: { it: 'Quanto hai scritto, quanto manca', en: 'How much you have written, how much is left' },
};

const D = {
  it: {
    intro: 'Le statistiche dicono quanto è lungo il romanzo, quanto scrivi e dove ripeti le parole',
    s1: 'I totali',
    s1b: 'Il romanzo in numeri',
    totals: 'In cima i totali: parole, caratteri, scene, pagine stimate, tempo di lettura. Tenendo il mouse su un riquadro si legge come è calcolato',
    s2: 'Gli obiettivi',
    s2b: 'In parole o in caratteri',
    unit: 'Parole o caratteri spazi inclusi, come si usa in Italia: si sceglie qui, e Dante converte gli obiettivi',
    other: 'Parole',
    back: 'Caratteri',
    form: 'Quanto deve essere lungo il romanzo, entro quando, quanto al giorno, e in quali giorni scrivi',
    progress: 'La barra mostra a che punto sei; sotto, quanto serve ogni giorno di scrittura per arrivare in tempo',
    day: 'Togliendo un giorno di scrittura, la quota di ogni giorno cresce',
    s3: 'Gli ultimi 30 giorni',
    s3b: 'Giorno per giorno',
    chart: 'Quanto hai scritto ogni giorno; la linea è l’obiettivo giornaliero. Il mouse su una colonna dice il numero',
    people: 'Se scrivete in due, quanto ha scritto ognuno, oggi e negli ultimi sette giorni',
    s4: 'La lunghezza',
    s4b: 'Capitoli e scene a confronto',
    length: 'Ogni capitolo o scena con la sua lunghezza e la sua parte del romanzo: si vede subito cosa è troppo lungo o troppo corto',
    level: 'Scene',
    s5: 'Le citazioni',
    s5b: 'Chi compare, e dove',
    mentions: 'Quante volte ogni scheda della Bibbia è nominata, in quante scene, dalla prima all’ultima',
    s6: 'Lo stile',
    s6b: 'Passi da rileggere',
    style: 'Stime sulle parole: lunghezza delle frasi, avverbi, dialogo, ripetizioni vicine. Indicano cosa rileggere, non sono regole',
    jump: 'Un clic su una ripetizione apre la scena in quel punto, con il passo selezionato',
  },
  en: {
    intro: 'Statistics tell you how long the novel is, how much you write and where you repeat words',
    s1: 'Totals',
    s1b: 'The novel in numbers',
    totals: 'At the top, the totals: words, characters, scenes, estimated pages, reading time. Hold the mouse on a box to read how it is worked out',
    s2: 'Goals',
    s2b: 'In words or characters',
    unit: 'Words, or characters including spaces as in many countries: chosen here, and Dante converts the goals',
    other: 'Characters',
    back: 'Words',
    form: 'How long the novel should be, by when, how much a day, and on which days you write',
    progress: 'The bar shows where you are; below, how much each writing day needs to be on time',
    day: 'Take away a writing day, and each day’s share grows',
    s3: 'The last 30 days',
    s3b: 'Day by day',
    chart: 'How much you wrote each day; the line is the daily goal. The mouse on a column tells the number',
    people: 'If you write together, how much each of you wrote, today and in the last seven days',
    s4: 'Length',
    s4b: 'Chapters and scenes compared',
    length: 'Every chapter or scene with its length and its share of the novel: you see at once what is too long or too short',
    level: 'Scenes',
    s5: 'Mentions',
    s5b: 'Who appears, and where',
    mentions: 'How many times each Story Bible sheet is named, in how many scenes, from the first to the last',
    s6: 'Style',
    s6b: 'Passages to reread',
    style: 'Estimates on the words: sentence length, adverbs, dialogue, close repetitions. They point at what to reread, they are not rules',
    jump: 'A click on a repetition opens the scene at that point, with the passage selected',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const stats = p.locator('.stats').first();
  const section = (key) => stats.locator('section', { has: p.locator('h2', { hasText: L(key) }) }).first();
  const show = async (loc) => { await loc.scrollIntoViewIfNeeded(); await t.wait(0.6); };

  await t.say(d.intro);
  await t.click(t.text(L('welcome.sample')), { after: 1.2 });

  await t.title(d.s1, d.s1b, async () => {
    await t.nav('section.stats');
    await t.wait(1);
  });
  await t.focus(stats.locator('section.tiles').first(), d.totals, { side: 'below' });

  await t.title(d.s2, d.s2b, () => show(section('statsView.goals')));
  const goals = section('statsView.goals');
  const unit = goals.getByRole('group', { name: L('statsView.goalUnit') });
  await t.zoom(unit, () => t.focus(unit, d.unit, { side: 'right' }), 1.6);
  await t.click(unit.getByRole('button', { name: d.other }), { after: 1.2 });
  await t.click(unit.getByRole('button', { name: d.back }), { after: 1 });
  await t.focus(goals.locator('form.goals').first(), d.form, { side: 'right' });
  const bar = goals.locator('.bar').first();
  await t.focus([bar, bar.locator('xpath=following-sibling::p[1]')], d.progress, { side: 'below', pointer: false });
  const days = goals.locator('fieldset.weekdays label.day');
  await t.click(days.nth(5).locator('input'), { after: 1 });
  await t.focus([goals.locator('fieldset.weekdays').first(), bar.locator('xpath=following-sibling::p[1]')], d.day, { side: 'below' });
  await t.click(days.nth(5).locator('input'), { after: 0.8 });

  await t.title(d.s3, d.s3b, () => show(section('statsView.recent')));
  const recent = section('statsView.recent');
  await t.focus(recent.locator('.chart').first(), d.chart, { side: 'below' });
  const people = recent.locator('table').first();
  if (await people.count()) await t.focus(people, d.people, { side: 'right' });

  await t.title(d.s4, d.s4b, () => show(section('statsView.length')));
  const length = section('statsView.length');
  await t.focus(length.locator('table').first(), d.length, { side: 'right', pointer: false });
  const levels = length.getByRole('group', { name: L('statsView.level') });
  if (await levels.count()) {
    await t.click(levels.getByRole('button', { name: d.level }), { after: 1.2 });
    await show(length.locator('table').first());
  }

  await t.title(d.s5, d.s5b, () => show(section('statsView.mentions')));
  await t.focus(section('statsView.mentions').locator('table').first(), d.mentions, { side: 'right', pointer: false });

  await t.title(d.s6, d.s6b, () => show(section('style.title')));
  const style = section('style.title');
  await t.focus(style.locator('.tiles').first(), d.style, { side: 'below' });
  const example = style.locator('ul.examples').first().locator('button.link').first();
  await show(example);
  await t.focus(example, d.jump, { side: 'right' });
  await t.click(example, { after: 2 });
}
