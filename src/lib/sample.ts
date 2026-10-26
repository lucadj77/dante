import { MemoryFs } from "./core/fs";
import { dayKey, type DayLog } from "./core/sessions";
import { prideAndPrejudice } from "./samples/pride-and-prejudice";
import { promessiSposi } from "./samples/promessi-sposi";

/** The first chapters of a novel in the public domain, to try the app without a folder, for example in a browser. */
export function sampleProject(language = "en"): MemoryFs {
  const now = new Date().toISOString();
  // Anna's writing over the last two weeks, for the statistics.
  const days: Record<string, DayLog> = {};
  for (let i = 13; i >= 1; i--) {
    if (i % 4 === 0) continue;
    const d = new Date();
    d.setDate(d.getDate() - i);
    const added = 300 + ((i * 137) % 500);
    const removed = (i * 53) % 120;
    days[dayKey(d)] = { added, removed, charactersAdded: added * 6, charactersRemoved: removed * 6, minutes: 25 + ((i * 17) % 60) };
  }
  if (language === "it") return italianSample(days, now);
  return new MemoryFs({
    // Anna, on another computer, is writing the Lucas Lodge scene (for the next three minutes).
    ".dante/presence/anna.json": JSON.stringify({ user: "Anna", path: "Manuscript/050 At Lucas Lodge/010 Talking over the ball.md", since: now, updated: now }),
    ".dante/sessions/anna.json": JSON.stringify({ user: "Anna", days }),
    "dante.yaml":
      "title: Pride and Prejudice\nauthor: Jane Austen\nlanguage: en\ngoals:\n  words: 120000\n  deadline: 2027-06-30\n  daily: 500\nproperties:\n  status:\n    kind: text\n    values: [idea, draft, revised, done]\n  pov:\n    kind: link\n    note_type: character\n  place:\n    kind: link\n    note_type: place\n  date: date\n  age: number\n",
    ...prideAndPrejudice,
    "Story Bible/Characters/Elizabeth Bennet.md":
      "---\ntype: character\nrole: protagonist\nage: 20\naliases: [Elizabeth, Lizzy, Eliza]\n---\nThe second of the five Bennet sisters, quick and clever, and her father's favourite. Lives at [[Longbourn]]. Her first opinion of [[Fitzwilliam Darcy|Mr. Darcy]] is formed at the [[Meryton]] assembly.\n",
    "Story Bible/Characters/Jane Bennet.md":
      "---\ntype: character\nrole: sister\nage: 22\naliases: [Jane]\n---\nThe eldest Bennet sister, the beauty of the family, slow to think ill of anyone. Admires [[Charles Bingley|Mr. Bingley]].\n",
    "Story Bible/Characters/Fitzwilliam Darcy.md":
      "---\ntype: character\nrole: hero\nage: 28\naliases: [Darcy, Mr. Darcy]\n---\nBingley's friend, with ten thousand a year and an estate in Derbyshire. Proud, or thought so after the ball.\n",
    "Story Bible/Characters/Charles Bingley.md":
      "---\ntype: character\nrole: neighbour\nage: 22\naliases: [Bingley, Mr. Bingley]\n---\nThe young man of large fortune who takes [[Netherfield Park]]. Lively, open, fond of dancing.\n",
    "Story Bible/Characters/Mrs. Bennet.md":
      "---\ntype: character\nrole: mother\n---\nHer business in life is to get her daughters married; its solace is visiting and news.\n",
    "Story Bible/Characters/Mr. Bennet.md":
      "---\ntype: character\nrole: father\n---\nSarcastic, reserved, happiest in his library. Teases his wife for sport.\n",
    "Story Bible/Places/Longbourn.md": "---\ntype: place\nregion: Hertfordshire\n---\nThe Bennets' estate, a short walk from [[Meryton]]. Entailed away from the daughters.\n",
    "Story Bible/Places/Netherfield Park.md": "---\ntype: place\nregion: Hertfordshire\naliases: [Netherfield]\n---\nThe large house near [[Longbourn]], let at last to [[Charles Bingley|Mr. Bingley]].\n",
    "Story Bible/Places/Meryton.md": "---\ntype: place\nregion: Hertfordshire\n---\nThe market town where the assembly is held. See [[Assembly balls]].\n",
    "Story Bible/Plotlines/Elizabeth and Darcy.md": "---\ntype: plotline\nstatus: open\n---\nFrom the slight at the ball to... we know how it ends.\n",
    "Story Bible/Plotlines/Jane and Bingley.md": "---\ntype: plotline\nstatus: open\n---\nTwo dances at the assembly, and everyone in Meryton takes notice.\n",
    "Templates/Character.md": "---\nrole:\nage:\naliases: []\n---\n## Who {{title}} is\n\n## What {{title}} wants\n",
    // Views: the same notes as a board, a table, cards and a timeline.
    "Views/Board.yaml": "type: kanban\nitems: scene\ngroup_by: status\ngroups: [idea, draft, revised, done]\nfields: [pov]\n",
    "Views/Scenes.yaml": "type: table\nitems: scene\nfields: [chapter, status, pov, date, words]\n",
    "Views/Characters.yaml": "type: cards\nitems: character\nfields: [role, age]\n",
    "Views/Story time.yaml": "type: timeline\nitems: scene\ndate: date\nfields: [pov, status]\n",
    "Research/Assembly balls.md": "Notes on country assemblies: held in the rooms of an inn, open to anyone who paid the subscription. Two dances with the same partner were noticed.\n",
    "Research/Images/Longbourn sketch.svg": HOUSE_SKETCH,
    "Research/Saved page.html":
      "<!doctype html><html><body style=\"font-family: Georgia; padding: 24px\"><h1>Regency dances</h1><p>A page saved from the web. Its scripts do not run in Dante.</p><script>document.body.innerHTML = 'scripts ran';</script></body></html>",
    "Research/Timeline.csv": "date,event\n1811-09-23,Netherfield is let\n1811-10-15,The Meryton assembly\n",
    "Laboratory/Outline.md":
      "## Volume one\n\n1. [[Charles Bingley|Bingley]] takes [[Netherfield Park]].\n2. The assembly: [[Fitzwilliam Darcy|Darcy]] slights [[Elizabeth Bennet|Elizabeth]].\n3. [[Jane and Bingley]] begins.\n\n- [ ] Decide when Elizabeth first changes her mind\n- [x] Fix the date of the assembly\n",
  });
}

const HOUSE_SKETCH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220"><rect width="400" height="220" fill="#e4ecf2"/><rect y="170" width="400" height="50" fill="#8fb27a"/><rect x="110" y="80" width="180" height="95" fill="#e9dcc3" stroke="#7a6a52"/><path d="M100 82 L200 35 L300 82 Z" fill="#8a5a44"/><rect x="185" y="130" width="30" height="45" fill="#5b4632"/><rect x="130" y="100" width="25" height="25" fill="#bcd4e6"/><rect x="245" y="100" width="25" height="25" fill="#bcd4e6"/><circle cx="340" cy="45" r="22" fill="#f2c94c"/></svg>';

/** The same, from I promessi sposi, for an interface in Italian. */
function italianSample(days: Record<string, DayLog>, now: string): MemoryFs {
  return new MemoryFs({
    // Anna, su un altro computer, sta scrivendo la scena di Lucia (per i prossimi tre minuti).
    ".dante/presence/anna.json": JSON.stringify({ user: "Anna", path: "Manoscritto/020 Renzo/040 Lucia.md", since: now, updated: now }),
    ".dante/sessions/anna.json": JSON.stringify({ user: "Anna", days }),
    "dante.yaml":
      "title: I promessi sposi\nauthor: Alessandro Manzoni\nlanguage: it\ngoals:\n  unit: characters\n  words: 1300000\n  deadline: 2027-06-30\n  daily: 3000\nproperties:\n  stato:\n    kind: text\n    values: [idea, bozza, rivista, finita]\n  pov:\n    kind: link\n    note_type: character\n  luogo:\n    kind: link\n    note_type: place\n  data: date\n  età: number\n",
    ...promessiSposi,
    "Bibbia/Personaggi/Renzo Tramaglino.md":
      "---\ntype: character\nruolo: protagonista\netà: 20\naliases: [Renzo, Lorenzo]\n---\nFilatore di seta, orfano, con un poderetto. Deve sposare [[Lucia Mondella|Lucia]] e non capisce perché [[Don Abbondio]] rimandi.\n",
    "Bibbia/Personaggi/Lucia Mondella.md":
      "---\ntype: character\nruolo: protagonista\naliases: [Lucia]\n---\nPromessa sposa di [[Renzo Tramaglino|Renzo]]. Vive con la madre [[Agnese]] in [[La casa di Lucia]]. Sa qualcosa di [[Don Rodrigo]] che non ha detto a nessuno.\n",
    "Bibbia/Personaggi/Don Abbondio.md":
      "---\ntype: character\nruolo: curato\netà: 60\naliases: [don Abbondio, curato, signor curato]\n---\nIl curato del [[Il paese|paese]]. Non nato con un cuor di leone: un vaso di terra cotta costretto a viaggiare in compagnia di molti vasi di ferro.\n",
    "Bibbia/Personaggi/Perpetua.md":
      "---\ntype: character\nruolo: serva\netà: 40\n---\nServa di [[Don Abbondio]], affezionata e fedele, che sa ubbidire e comandare. Non sa tenere un segreto.\n",
    "Bibbia/Personaggi/Don Rodrigo.md":
      "---\ntype: character\nruolo: antagonista\naliases: [don Rodrigo]\n---\nSignorotto del luogo. Manda i bravi a fermare il matrimonio.\n",
    "Bibbia/Personaggi/Agnese.md": "---\ntype: character\nruolo: madre\n---\nLa madre di [[Lucia Mondella|Lucia]].\n",
    "Bibbia/Luoghi/Il paese.md": "---\ntype: place\nregione: Lombardia\n---\nUn paesetto sulla costiera del lago di Como, vicino a [[Lecco]]. Vedi [[Il lago di Como]].\n",
    "Bibbia/Luoghi/Lecco.md": "---\ntype: place\nregione: Lombardia\n---\nBorgo e castello con una guarnigione di soldati spagnoli.\n",
    "Bibbia/Luoghi/La casa di don Abbondio.md": "---\ntype: place\nregione: Lombardia\naliases: [canonica]\n---\nDove [[Perpetua]] apparecchia la cena e [[Renzo Tramaglino|Renzo]] viene a chiedere le nozze.\n",
    "Bibbia/Luoghi/La casa di Lucia.md": "---\ntype: place\nregione: Lombardia\n---\nIn fondo al paese, con un piccolo cortile davanti.\n",
    "Bibbia/Plotline/Il matrimonio impedito.md": "---\ntype: plotline\nstato: aperta\n---\nI bravi di [[Don Rodrigo]] fermano il curato: le nozze non si faranno.\n",
    "Modelli/Personaggio.md": "---\nruolo:\netà:\naliases: []\n---\n## Chi è {{title}}\n\n## Cosa vuole {{title}}\n",
    // Viste: le stesse note come bacheca, tabella, schede e linea del tempo.
    "Viste/Bacheca.yaml": "type: kanban\nitems: scene\ngroup_by: stato\ngroups: [idea, bozza, rivista, finita]\nfields: [pov]\n",
    "Viste/Scene.yaml": "type: table\nitems: scene\nfields: [chapter, stato, pov, data, words]\n",
    "Viste/Personaggi.yaml": "type: cards\nitems: character\nfields: [ruolo, età]\n",
    "Viste/Tempo della storia.yaml": "type: timeline\nitems: scene\ndate: data\nfields: [pov, stato]\n",
    "Ricerca/Il lago di Como.md": "Appunti sul ramo di Lecco: il ponte, l’Adda, il Resegone con i suoi cocuzzoli in fila.\n",
    "Ricerca/Immagini/Il Resegone.svg": MOUNTAIN_SKETCH,
    "Ricerca/Pagina salvata.html":
      "<!doctype html><html><body style=\"font-family: Georgia; padding: 24px\"><h1>Le gride del Seicento</h1><p>Una pagina salvata dal web. I suoi script non vengono eseguiti in Dante.</p><script>document.body.innerHTML = 'script eseguiti';</script></body></html>",
    "Ricerca/Cronologia.csv": "data,evento\n1628-11-07,I bravi fermano don Abbondio\n1628-11-08,Il giorno delle nozze mancate\n",
    "Laboratorio/Scaletta.md":
      "## Primi capitoli\n\n1. I bravi fermano [[Don Abbondio]].\n2. [[Renzo Tramaglino|Renzo]] scopre il nome di [[Don Rodrigo]].\n3. Comincia [[Il matrimonio impedito]].\n\n- [ ] Decidere quando entra in scena fra Cristoforo\n- [x] Fissare la data delle nozze\n",
  });
}

const MOUNTAIN_SKETCH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220"><rect width="400" height="220" fill="#e4ecf2"/><path d="M0 150 L60 90 L80 110 L100 70 L120 100 L140 60 L160 95 L180 55 L200 90 L220 65 L245 100 L270 80 L330 150 Z" fill="#7d8b99"/><rect y="150" width="400" height="70" fill="#4b7aa6"/><path d="M290 175 L340 175 L332 186 L298 186 Z" fill="#7a4b2a"/><circle cx="350" cy="45" r="20" fill="#f2c94c"/></svg>';
