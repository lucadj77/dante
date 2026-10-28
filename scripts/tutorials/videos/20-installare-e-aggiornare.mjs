// 20. Installare e aggiornare Dante: the download section of the site, why macOS and Windows warn the
// first time, the steps past the warning on screenshots of the two systems, Linux, then, in the app,
// the update settings with the two channels and the notice of a new version with its news.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { URL as DANTE } from '../lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '../assets/install');
const ROOT = path.join(HERE, '../../..');
const SITE = 'http://127.0.0.1:5174/';

export const meta = {
  n: 20,
  group: 'start',
  title: { it: 'Installare e aggiornare Dante', en: 'Installing and updating Dante' },
  subtitle: { it: 'Dal sito al primo avvio, e poi sempre aggiornato', en: 'From the website to the first start, then always up to date' },
};

// The app answers as if a newer version were out, with its news.
const NEWS = {
  it: ['**Esempio**: questa è la nota di una versione nuova, come compare nell’avviso.', '**Correzioni**: le novità di ogni versione, scritte per chi scrive.'],
  en: ['**Example**: this is the note of a new version, as the notice shows it.', '**Fixes**: what changes in each version, written for writers.'],
};
export const setup = () => ({
  desktop: true,
  answers: {
    updates_supported: true,
    check_update: { rid: 1, currentVersion: '1.0.0', version: '1.1.0', date: '', body: '', rawJson: { version: '1.1.0', news: { it: [{ version: '1.1.0', notes: NEWS.it }], en: [{ version: '1.1.0', notes: NEWS.en }] } } },
  },
});

// The screenshots, at the scale they are shown, and the places that are pointed at or clicked
// (x0, y0, x1, y1 in the screenshot's pixels).
const STAGE = {
  'mac-1-dmg': { scale: 1.6, mac: true, spots: { app: [92, 215, 167, 318], apps: [366, 215, 452, 318] } },
  'mac-2-avviso': { scale: 2, mac: true, spots: { title: [22, 95, 283, 190], trash: [22, 209, 283, 236], done: [22, 240, 283, 272] } },
  'mac-3-menu-apple': { scale: 1.8, mac: true, spots: { apple: [10, 3, 40, 27], settings: [6, 69, 378, 96] } },
  'mac-4-privacy-e-sicurezza': { scale: 1.2, mac: true, spots: { privacy: [15, 309, 272, 349], security: [302, 198, 833, 365], open: [706, 280, 824, 306] } },
  'mac-5-apri-comunque': { scale: 1.9, mac: true, spots: { open: [22, 285, 286, 314] } },
  'windows-1-smartscreen': { scale: 1.5, spots: { more: [20, 144, 170, 168] } },
  'windows-2-esegui-comunque': { scale: 1.5, spots: { file: [20, 158, 245, 205], run: [210, 436, 366, 474] } },
};

// A fake GitHub release, so the site offers its files as it does for real.
const RELEASE = {
  tag_name: 'v1.0.0',
  assets: ['Dante-1.0.0-mac-apple-silicon.dmg', 'Dante-1.0.0-mac-intel.dmg', 'Dante-setup-1.0.0.exe', 'Dante-portable-1.0.0.zip', 'Dante_1.0.0_amd64.AppImage', 'Dante_1.0.0_amd64.deb', 'Dante-1.0.0-1.x86_64.rpm'].map((name) => ({ name, browser_download_url: `https://github.com/lucadj77/dante/releases/download/v1.0.0/${name}` })),
};

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };

/** The site, built as it is published, answers at its own address; the recording starts on it. */
export async function prepare(t) {
  const { page: p } = t;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dante-site-'));
  execFileSync('node', [path.join(ROOT, 'site/build.mjs'), dir]);
  // the site and the screenshots, served from here on their own port
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, SITE);
    let file = url.pathname.startsWith('/__install/') ? path.join(SHOTS, path.basename(url.pathname))
      : url.pathname === '/__icon.png' ? path.join(ROOT, 'src-tauri/icons/icon.png')
      : path.join(dir, decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok) => server.listen(5174, '127.0.0.1', ok));
  server.unref();
  await p.context().route('https://api.github.com/repos/lucadj77/dante/releases/latest', (route) => route.fulfill({ json: RELEASE, headers: { 'access-control-allow-origin': '*' } }));
  // the site picks the file for a Mac, like the visitor of the video
  await p.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
  });
  await p.goto(SITE + (t.lang === 'it' ? 'it/' : ''));
  await p.waitForTimeout(1500);
}

const D = {
  it: {
    intro: 'Dante è gratuito, per Mac, Windows e Linux. Si scarica dal sito dante.lucadj.eu',
    s1: 'Scaricare Dante',
    s1b: 'Il file giusto per il tuo computer',
    main: 'Il sito riconosce il tuo sistema e propone il file adatto',
    mac: 'Per Mac ci sono due versioni: chip Apple, per i Mac dal 2020 in poi, e processore Intel. Quale hai lo dice il menu Apple, Informazioni su questo Mac',
    win: 'Per Windows: l’installatore, oppure la versione portatile, uno zip da scompattare dove vuoi',
    s2: 'La prima volta',
    s2b: 'Perché compare un avviso',
    why: 'Apple e Microsoft chiedono agli sviluppatori un certificato a pagamento. Dante è gratuito e non ce l’ha: la prima volta il sistema chiede di confermare',
    once: 'Si conferma una volta sola. Ecco come, su Mac e su Windows',
    s3: 'Su Mac',
    s3b: 'Apri comunque',
    dmg: 'Si apre il file .dmg scaricato: compare questa finestra',
    drag: 'Si trascina Dante nella cartella Applicazioni',
    first: 'Al primo avvio macOS dice che non può verificare Dante',
    done: 'Premi Fine. Non Sposta nel Cestino',
    apple: 'Poi, dal menu Apple, Impostazioni di Sistema',
    privacy: 'Privacy e sicurezza',
    security: 'Più in basso, sotto Sicurezza, c’è il messaggio su Dante',
    anyway: 'Un clic su Apri comunque',
    confirm: 'Ancora Apri comunque, poi la password del Mac. Da qui in poi Dante si apre come ogni altra app',
    older: 'Su macOS prima di Sequoia è più semplice: clic col tasto destro su Dante in Applicazioni, poi Apri',
    s4: 'Su Windows',
    s4b: 'Esegui comunque',
    smart: 'SmartScreen ferma l’installatore. Premi Ulteriori informazioni',
    file: 'Compare il nome del file: è l’installatore di Dante',
    run: 'Esegui comunque, e l’installazione procede come al solito',
    portable: 'Con la versione portatile si scompatta lo zip e si apre Dante.exe: l’avviso è lo stesso. Non si aggiorna da sola',
    s5: 'Su Linux',
    s5b: 'AppImage, .deb o .rpm',
    linux: 'L’AppImage si rende eseguibile e si avvia; i pacchetti .deb e .rpm si installano come gli altri. Nessun avviso',
    s6: 'Gli aggiornamenti',
    s6b: 'Due canali',
    where: 'Nell’app: Impostazioni, Dante su questo computer, Aggiornamenti',
    channel: 'Stabile riceve solo le versioni ufficiali; Beta le novità prima degli altri, in versioni ancora in prova',
    check: 'Dante cerca da solo all’avvio. Cerca aggiornamenti lo fa subito',
    banner: 'Quando c’è una versione nuova, l’avviso compare qui in basso a destra',
    news: 'Novità mostra cosa cambia',
    install: 'Aggiorna e riavvia salva il romanzo, installa la nuova versione e riapre Dante. Oppure si salta questa versione, o la si rimanda',
  },
  en: {
    intro: 'Dante is free, for Mac, Windows and Linux. You download it from the dante.lucadj.eu website',
    s1: 'Downloading Dante',
    s1b: 'The right file for your computer',
    main: 'The website recognises your system and offers the right file',
    mac: 'For Mac there are two versions: Apple chip, for Macs from 2020 on, and Intel processor. The Apple menu, About This Mac, tells you which one you have',
    win: 'For Windows: the installer, or the portable version, a zip to unpack wherever you like',
    s2: 'The first time',
    s2b: 'Why a warning shows',
    why: 'Apple and Microsoft ask developers for a paid certificate. Dante is free and has none: the first time, the system asks you to confirm',
    once: 'You confirm only once. Here is how, on Mac and on Windows',
    s3: 'On Mac',
    s3b: 'Open Anyway',
    dmg: 'Open the downloaded .dmg file: this window shows',
    drag: 'Drag Dante into the Applications folder',
    first: 'At the first start macOS says it cannot verify Dante',
    done: 'Press Done. Not Move to Trash',
    apple: 'Then, from the Apple menu, System Settings',
    privacy: 'Privacy & Security',
    security: 'Further down, under Security, there is the message about Dante',
    anyway: 'One click on Open Anyway',
    confirm: 'Open Anyway again, then your Mac’s password. From then on Dante opens like any other app',
    older: 'On macOS before Sequoia it is simpler: right-click Dante in Applications, then Open',
    s4: 'On Windows',
    s4b: 'Run anyway',
    smart: 'SmartScreen stops the installer. Press More info',
    file: 'The file name shows: it is Dante’s installer',
    run: 'Run anyway, and the installation goes on as usual',
    portable: 'With the portable version you unpack the zip and open Dante.exe: same warning. It does not update by itself',
    s5: 'On Linux',
    s5b: 'AppImage, .deb or .rpm',
    linux: 'Make the AppImage executable and start it; the .deb and .rpm packages install like any other. No warning',
    s6: 'Updates',
    s6b: 'Two channels',
    where: 'In the app: Settings, Dante on this computer, Updates',
    channel: 'Stable gets only the official versions; Beta gets what’s new earlier, in versions still being tried',
    check: 'Dante looks by itself at start. Check for updates looks right away',
    banner: 'When there is a new version, the notice shows here at the bottom right',
    news: 'What’s new shows what changes',
    install: 'Update and restart saves the novel, installs the new version and reopens Dante. Or you skip this version, or put it off',
  },
};

/** A screenshot of the system over the whole page, on a plain desktop, with its places marked. */
function stage([name, shot]) {
  let s = document.getElementById('st');
  if (!name) { if (s) { s.style.opacity = 0; setTimeout(() => s.remove(), 600); } return; }
  if (!s) {
    s = document.createElement('div');
    s.id = 'st';
    s.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .6s,background .6s';
    document.body.appendChild(s);
    requestAnimationFrame(() => { s.style.opacity = 1; });
  }
  s.style.background = shot.mac ? 'linear-gradient(160deg,#d9c7b8,#a9b8cc 55%,#7f93ad)' : 'linear-gradient(160deg,#2f6fb4,#1a3f73)';
  const old = s.firstChild;
  const w = document.createElement('div');
  w.style.cssText = 'position:absolute;opacity:0;transition:opacity .5s;box-shadow:0 18px 50px rgba(0,0,0,.35);border-radius:' + (shot.mac ? '14px' : '0');
  const img = new Image();
  img.src = '/__install/' + name + '.png';
  img.onload = () => {
    w.style.width = img.naturalWidth * shot.scale + 'px';
    w.style.height = img.naturalHeight * shot.scale + 'px';
    img.style.cssText = 'width:100%;height:100%;display:block;border-radius:inherit';
    for (const [id, [x0, y0, x1, y1]] of Object.entries(shot.spots)) {
      const a = document.createElement('div');
      a.dataset.spot = id;
      a.style.cssText = `position:absolute;left:${x0 * shot.scale}px;top:${y0 * shot.scale}px;width:${(x1 - x0) * shot.scale}px;height:${(y1 - y0) * shot.scale}px`;
      w.appendChild(a);
    }
    requestAnimationFrame(() => { w.style.opacity = 1; if (old) { old.style.opacity = 0; setTimeout(() => old.remove(), 500); } });
  };
  w.appendChild(img);
  s.appendChild(w);
  // dragging the app: its icon follows the pointer
  const app = () => w.querySelector('[data-spot=app]');
  w.addEventListener('mousedown', (e) => {
    if (!app() || !app().contains(e.target)) return;
    const g = document.createElement('img');
    g.src = '/__icon.png';
    const size = 64 * shot.scale;
    g.style.cssText = `position:fixed;width:${size}px;height:${size}px;opacity:.75;pointer-events:none;z-index:2147483001`;
    const move = (m) => { g.style.left = m.clientX - size / 2 + 'px'; g.style.top = m.clientY - size / 2 + 'px'; };
    move(e);
    document.body.appendChild(g);
    addEventListener('mousemove', move);
    addEventListener('mouseup', () => { removeEventListener('mousemove', move); g.remove(); }, { once: true });
  });
}

export default async function (t) {
  const { page: p, L } = t;
  const d = D[t.lang];
  const show = async (name) => { await p.evaluate(stage, [name, name && STAGE[name]]); await t.wait(1.2); };
  const spot = (id) => p.locator(`#st [data-spot=${id}]`).last();
  const section = p.locator('#download');

  await t.say(d.intro);

  await t.title(d.s1, d.s1b);
  await t.focus(p.locator('#dl-main'), d.main, { side: 'below' });
  await section.evaluate((e) => e.scrollIntoView({ behavior: 'smooth' }));
  await t.wait(1.5);
  const card = (id) => p.locator(`#dl-${id}`).locator('xpath=..');
  await t.focus(card('macArm'), d.mac, { side: 'right' });
  await t.focus(card('winSetup'), d.win, { side: 'right' });

  await t.title(d.s2, d.s2b);
  await t.focus(p.locator('#dl-intro'), d.why, { side: 'below', pointer: false });
  await t.say(d.once);

  await show('mac-1-dmg');
  await t.title(d.s3, d.s3b);
  await t.say(d.dmg);
  await t.focus(spot('app'), d.drag, { side: 'below' });
  await t.drag(spot('app'), spot('apps'));
  await show('mac-2-avviso');
  await t.focus(spot('title'), d.first, { side: 'right', pointer: false });
  await t.focus(spot('done'), d.done, { side: 'right' });
  await t.click(spot('done'), { after: 0.3 });
  await show('mac-3-menu-apple');
  await t.click(spot('apple'), { after: 0.3 });
  await t.focus(spot('settings'), d.apple, { side: 'right' });
  await t.click(spot('settings'), { after: 0.3 });
  await show('mac-4-privacy-e-sicurezza');
  await t.focus(spot('privacy'), d.privacy, { side: 'right', hold: 2.5 });
  await t.focus(spot('security'), d.security, { side: 'below', pointer: false });
  await t.zoom(spot('open'), async () => {
    await t.focus(spot('open'), d.anyway, { side: 'below' });
    await t.click(spot('open'), { after: 0.3 });
  }, 1.5);
  await show('mac-5-apri-comunque');
  await t.focus(spot('open'), d.confirm, { side: 'right' });
  await t.click(spot('open'), { after: 0.5 });
  await t.say(d.older);

  await show('windows-1-smartscreen');
  await t.title(d.s4, d.s4b);
  await t.focus(spot('more'), d.smart, { side: 'below' });
  await t.click(spot('more'), { after: 0.3 });
  await show('windows-2-esegui-comunque');
  await t.focus(spot('file'), d.file, { side: 'right', pointer: false });
  await t.focus(spot('run'), d.run, { side: 'above' });
  await t.click(spot('run'), { after: 0.5 });
  await t.say(d.portable);

  await show(null);
  await t.title(d.s5, d.s5b);
  await t.focus(card('linuxAppImage'), d.linux, { side: 'left' });

  // the app itself, in another window
  await p.goto(DANTE);
  await p.waitForTimeout(1500);
  await t.title(d.s6, d.s6b, async () => {
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
    await t.focus(banner.getByRole('button', { name: L('update.install') }), d.install, { side: 'above' });
  }, 1.6);
  await t.click(banner.getByRole('button', { name: L('update.later') }), { after: 1 });
}
