// 18. Dante nel browser e gli aggiornamenti: what changes when Dante runs in Chrome, then, in the app,
// the update settings with the two channels and the notice of a new version with its news.
export const meta = {
  n: 18,
  group: 'together',
  title: { it: 'Dante nel browser e gli aggiornamenti', en: 'Dante in the browser and updates' },
  subtitle: { it: 'Lo stesso Dante, ovunque, sempre aggiornato', en: 'The same Dante, anywhere, always up to date' },
};

// The app answers as if a newer version were out, with its news.
const NEWS = {
  it: ['**Esempio**: questa è la nota di una versione nuova, come compare nell’avviso.', '**Correzioni**: le novità di ogni versione, scritte per chi scrive.'],
  en: ['**Example**: this is the note of a new version, as the notice shows it.', '**Fixes**: what changes in each version, written for writers.'],
};
export const setup = () => ({
  answers: {
    updates_supported: true,
    check_update: { rid: 1, currentVersion: '1.0.0', version: '1.1.0', date: '', body: '', rawJson: { version: '1.1.0', news: { it: [{ version: '1.1.0', notes: NEWS.it }], en: [{ version: '1.1.0', notes: NEWS.en }] } } },
  },
});

const D = {
  it: {
    intro: 'Dante è un’app per Mac, Windows e Linux. E funziona anche nel browser',
    s1: 'Dante nel browser',
    s1b: 'Chrome, Edge o Brave',
    site: 'Dal sito dante.lucadj.eu, Usa nel browser apre Dante in una scheda, senza installare niente',
    open: 'Apri cartella chiede al browser il permesso di lavorare su una cartella del computer: il romanzo resta lì, non va su internet',
    install: 'Dal menu del browser si può installare Dante come app: ha la sua finestra e funziona anche senza connessione',
    backup: 'Cosa cambia: le copie di sicurezza non si fanno da sole, si scaricano come zip da Impostazioni, Dante su questo computer',
    pdf: 'E il PDF si crea solo nell’app; Word ed EPUB anche nel browser',
    web: 'La versione nel browser si aggiorna da sola, alla prima apertura dopo una nuova versione',
    s2: 'Gli aggiornamenti dell’app',
    s2b: 'Due canali',
    where: 'Nell’app: Impostazioni, Dante su questo computer, Aggiornamenti',
    channel: 'Stabile riceve solo le versioni ufficiali; Beta le novità prima degli altri, in versioni ancora in prova',
    check: 'Dante cerca da solo all’avvio. Cerca aggiornamenti lo fa subito',
    banner: 'Quando c’è una versione nuova, l’avviso compare qui in basso a destra',
    news: 'Novità mostra cosa cambia',
    install2: 'Aggiorna e riavvia salva il romanzo, installa la nuova versione e riapre Dante. Oppure si salta questa versione, o la si rimanda',
  },
  en: {
    intro: 'Dante is an app for Mac, Windows and Linux. And it also runs in the browser',
    s1: 'Dante in the browser',
    s1b: 'Chrome, Edge or Brave',
    site: 'On the dante.lucadj.eu website, Use in the browser opens Dante in a tab, with nothing to install',
    open: 'Open folder asks the browser for leave to work on a folder of your computer: the novel stays there, it does not go online',
    install: 'From the browser’s menu you can install Dante as an app: it gets its own window and works offline too',
    backup: 'What changes: backups are not made by themselves, you download them as a zip from Settings, Dante on this computer',
    pdf: 'And PDF is made only in the app; Word and EPUB in the browser too',
    web: 'The browser version updates itself, the first time you open it after a new version',
    s2: 'Updating the app',
    s2b: 'Two channels',
    where: 'In the app: Settings, Dante on this computer, Updates',
    channel: 'Stable gets only the official versions; Beta gets what’s new earlier, in versions still being tried',
    check: 'Dante looks by itself at start. Check for updates looks right away',
    banner: 'When there is a new version, the notice shows here at the bottom right',
    news: 'What’s new shows what changes',
    install2: 'Update and restart saves the novel, installs the new version and reopens Dante. Or you skip this version, or put it off',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];

  await t.say(d.intro);

  await t.title(d.s1, d.s1b);
  await t.say(d.site);
  const open = p.getByRole('button', { name: L('welcome.open') }).first();
  await t.focus(open, d.open, { side: 'right' });
  await t.say(d.install);
  await t.say(d.backup);
  await t.say(d.pdf);
  await t.say(d.web);

  // the same page again, now as the app
  await t.title(d.s2, d.s2b, async () => {
    await p.evaluate(() => sessionStorage.setItem('desktop', '1'));
    await p.reload();
    await t.wait(1.5);
    await t.click(t.text(L('welcome.sample')), { after: 1.2 });
    await t.nav('section.settings');
    await t.wait(0.8);
    await t.click(t.text(L('settings.tabApp')), { after: 1 });
  });
  const title = p.locator('h3', { hasText: L('update.title') }).first();
  await title.scrollIntoViewIfNeeded();
  await t.wait(0.6);
  await t.focus(title, d.where, { side: 'right' });
  const channel = p.locator('label', { hasText: L('update.channel') }).locator('select').first();
  await t.zoom(channel, () => t.focus(channel, d.channel, { side: 'right' }), 1.5);
  const check = p.getByRole('button', { name: L('update.check') }).first();
  await t.focus(check, d.check, { side: 'right' });
  await t.click(check, { after: 1.5 });
  const banner = p.locator('.update[role=status]').first();
  // the notice is small at the corner of the window: shown larger while it is explained
  await t.zoom(banner, async () => {
    await t.focus(banner, d.banner, { side: 'above', pointer: false });
    await t.click(banner.getByRole('button', { name: L('update.news') }), { after: 1.2 });
    await t.focus(banner, d.news, { side: 'above', pointer: false });
    await t.focus(banner.getByRole('button', { name: L('update.install') }), d.install2, { side: 'above' });
  }, 1.6);
  await t.click(banner.getByRole('button', { name: L('update.later') }), { after: 1 });
}
