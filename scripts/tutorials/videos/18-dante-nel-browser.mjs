// 18. Dante nel browser: Dante in Chrome, Edge or Brave, the same novel, and what changes.
// The updates of the app are in video 2.
export const meta = {
  n: 18,
  group: 'together',
  title: { it: 'Dante nel browser', en: 'Dante in the browser' },
  subtitle: { it: 'Lo stesso Dante, senza installare niente', en: 'The same Dante, with nothing to install' },
};

const D = {
  it: {
    intro: 'Dante è un’app per Mac, Windows e Linux. E funziona anche nel browser',
    s1: 'Aprire Dante nel browser',
    s1b: 'Chrome, Edge o Brave',
    site: 'Dal sito dante.lucadj.eu, Usa nel browser apre Dante in una scheda, senza installare niente',
    open: 'Apri cartella chiede al browser il permesso di lavorare su una cartella del computer: il romanzo resta lì, non va su internet',
    install: 'Dal menu del browser si può installare Dante come app: ha la sua finestra e funziona anche senza connessione',
    s2: 'Lo stesso Dante',
    s2b: 'Gli stessi file',
    same: 'Si scrive come nell’app: scene, capitoli, proprietà, Bibbia, viste ed esportazione',
    files: 'I file sono gli stessi: un romanzo iniziato nel browser si apre con l’app, e viceversa',
    s3: 'Cosa cambia',
    s3b: 'Copie di sicurezza e PDF',
    backup: 'Le copie di sicurezza non si fanno da sole: in Impostazioni, Dante su questo computer, si scarica uno zip da conservare',
    pdf: 'Il PDF si crea solo nell’app. Word ed EPUB anche nel browser',
    web: 'La versione nel browser si aggiorna da sola, alla prima apertura dopo una nuova versione',
  },
  en: {
    intro: 'Dante is an app for Mac, Windows and Linux. And it also runs in the browser',
    s1: 'Opening Dante in the browser',
    s1b: 'Chrome, Edge or Brave',
    site: 'On the dante.lucadj.eu website, Use in the browser opens Dante in a tab, with nothing to install',
    open: 'Open folder asks the browser for leave to work on a folder of your computer: the novel stays there, it does not go online',
    install: 'From the browser’s menu you can install Dante as an app: it gets its own window and works offline too',
    s2: 'The same Dante',
    s2b: 'The same files',
    same: 'You write as in the app: scenes, chapters, properties, Story Bible, views and export',
    files: 'The files are the same: a novel started in the browser opens in the app, and the other way round',
    s3: 'What changes',
    s3b: 'Backups and PDF',
    backup: 'Backups are not made by themselves: in Settings, Dante on this computer, you download a zip to keep',
    pdf: 'PDF is made only in the app. Word and EPUB in the browser too',
    web: 'The browser version updates itself, the first time you open it after a new version',
  },
};

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];

  await t.say(d.intro);

  await t.title(d.s1, d.s1b);
  await t.say(d.site);
  const open = p.getByRole('button', { name: L('welcome.open') }).first();
  await t.zoom(open, () => t.focus(open, d.open, { side: 'right' }), 1.5);
  await t.say(d.install);

  await t.title(d.s2, d.s2b, () => t.click(t.text(L('welcome.sample')), { after: 1.2 }));
  await t.focus(p.locator('main.center').first(), d.same, { side: 'below', pointer: false });
  await t.focus(p.locator('aside.tree').first(), d.files, { side: 'right' });

  await t.title(d.s3, d.s3b, async () => {
    await t.nav('section.settings');
    await t.wait(0.8);
    await t.click(t.text(L('settings.tabApp')), { after: 1 });
  });
  // the sample lives in memory: the download button shows only for a novel opened from a folder
  await t.say(d.backup);
  await t.say(d.pdf);
  await t.say(d.web);
}
