// The gamebook of video 21, written for it: «La torre del mago» in Italian, «The Wizard's Tower» in
// English. Fifteen paragraphs and a page of rules, with a few things left wrong on purpose so the
// checks have something to show: an orphan (14), a dead end with a number written by hand (9), a
// keyword asked and never given (sigillo / seal), a keyword spelled two ways (lanterna / lanterma,
// lantern / lanturn). The English book uses the English properties (traits, keywords, encounters).
// The module is off: the video turns it on.

const par = (number, body, extra = '') => `---\nnumero: ${number}\naliases:\n  - "${number}"\n${extra}note:\n---\n${body}`;
const box = (content) => `::: {custom-style="box"}\n${content}\n:::`;
const L = (title, n) => `**[[${title}|${n}]]**`;

const it = {
  title: 'La torre del mago',
  folder: 'Paragrafi',
  yaml: 'title: La torre del mago\nauthor: Luca Di Gialleonardo\nlanguage: it\nfolders:\n  manuscript: Paragrafi\n',
  pages: {
    Regole: `---\nnote:\n---\nIn questo libro sei tu il protagonista. Non leggerlo dall'inizio alla fine: ogni paragrafo ti dice a quale andare dopo.\n\nTieni accanto un foglio, la **scheda**: quando il testo ti chiede di segnare una parola chiave o di cerchiare una caratteristica, scrivila lì.`,
  },
  paragraphs: {
    'Il cancello': par(1, `La torre del mago si alza nera contro il cielo. Il cancello è socchiuso e cigola nel vento; lungo le mura corre un fossato pieno d'acqua scura.\n\n${box(`🤔 **Devi decidere!**\n\nSe entri dal cancello vai al ${L('Il cortile', 2)}. Se preferisci girare intorno alle mura vai al ${L('Il fossato', 5)}.`)}`, 'numero_tipo: fisso\n'),
    'Il cortile': par(2, `Il cortile è vuoto. Accanto al pozzo trovi una vecchia lanterna, ancora piena d'olio.\n\n${box(`✏️ **Oggetto**\n\nSegna la parola chiave **lanterna**.`)}\n\nDue porte: quella della torre, al ${L('La scala', 3)}, e quella bassa della cucina, al ${L('La cucina', 4)}.`, 'parole chiave:\n  - lanterna\n'),
    'La scala': par(3, `Una scala a chiocciola sale nel buio. Senza luce non si vede nemmeno il primo gradino.\n\nSe hai la parola chiave **lanterna** vai al ${L('La biblioteca', 7)}. Altrimenti sali a tentoni: vai al ${L('Il buio', 6)}.`),
    'La cucina': par(4, `Nella cucina c'è un gatto nero che ti fissa senza muoversi. Lo lasci in pace ed esci in silenzio.\n\n${box(`❤️ **Carattere**\n\nCerchia la caratteristica **prudente**.`)}\n\nTorna alla torre: vai al ${L('La scala', 3)}.`, 'carattere:\n  - prudente\n'),
    'Il fossato': par(5, `L'acqua del fossato è ferma e fredda. Più avanti vedi una grata nel muro e, oltre, un ponte di legno mezzo crollato.\n\nSe esamini la grata vai al ${L('La grata', 8)}. Se provi il ponte vai al ${L('Il ponte crollato', 9)}.`),
    'Il buio': par(6, `Al terzo gradino il piede non trova niente. Cadi a lungo, poi più nulla.\n\n${box(`😢 **Fine**\n\nLa tua avventura finisce qui.`)}`, 'finale: true\n'),
    'La biblioteca': par(7, `Alla luce della lanterna compaiono scaffali fino al soffitto. Su un leggio c'è un libro chiuso da un lucchetto.\n\nSe hai la parola chiave **sigillo** vai al ${L('Lo studio del mago', 10)}. Altrimenti apri la finestra: vai al ${L('La finestra', 11)}.`, 'parole chiave:\n  - sigillo?\n'),
    'La grata': par(8, `La grata cede al primo strattone. Dietro, su una mensola, c'è una lanterna arrugginita.\n\n${box(`✏️ **Oggetto**\n\nSegna la parola chiave **lanterma**.`)}\n\nUn cunicolo scende verso il basso: vai al ${L('Il pozzo', 15)}.`, 'parole chiave:\n  - lanterma\n'),
    'Il ponte crollato': par(9, `Il ponte trema sotto i tuoi piedi e una tavola si spezza. Non c'è altra via: torna al paragrafo 5.`),
    'Lo studio del mago': par(10, `Il mago alza gli occhi dal suo libro e sorride, come se ti aspettasse da tempo.\n\n${box(`✅ **Incontro memorabile**\n\nHai conosciuto il mago della torre.`)}\n\nSe accetti di diventare il suo apprendista vai al ${L('Il patto', 12)}.`, 'incontri:\n  - mago\n'),
    'La finestra': par(11, `Dalla finestra vedi il cortile e, sotto il davanzale, una fila di gradini scavati nella pietra.\n\nSe torni indietro vai al ${L('La scala', 3)}. Se vuoi scendere i gradini, contali e vai al paragrafo con quel numero.`, 'rimandi nascosti:\n  - "[[Il passaggio segreto|13]]"\n'),
    'Il patto': par(12, `Il mago ti mette in mano una piccola chiave d'argento. Da oggi la torre è anche tua.\n\n${box(`😢 **Fine**\n\nHai vinto: sei l'apprendista del mago.`)}`, 'finale: true\n'),
    'Il passaggio segreto': par(13, `I gradini finiscono davanti a una porta di quercia. Dall'altra parte senti voltare le pagine di un libro: vai al ${L('Lo studio del mago', 10)}.`, 'numero_tipo: relativo\nancora: "[[La finestra]]"\nscarto: 2\n'),
    "L'eremita": par(14, `Un vecchio seduto su un sasso ti indica la torre senza dire una parola. Vai al ${L('Il cortile', 2)}.`),
    'Il pozzo': par(15, ''),
  },
};

const en = {
  title: "The Wizard's Tower",
  folder: 'Sections',
  yaml: "title: The Wizard's Tower\nauthor: Luca Di Gialleonardo\nlanguage: en\nfolders:\n  manuscript: Sections\n",
  pages: {
    Rules: `---\nnote:\n---\nIn this book you are the hero. Do not read it from start to end: each section tells you which one to read next.\n\nKeep a sheet of paper beside you, your **adventure sheet**: when the text asks you to note a keyword or circle a trait, write it there.`,
  },
  paragraphs: {
    'The gate': par(1, `The wizard's tower rises black against the sky. The gate stands ajar and creaks in the wind; a moat of dark water runs along the walls.\n\n${box(`🤔 **You must act fast!**\n\nIf you go through the gate turn to ${L('The courtyard', 2)}. If you walk around the walls turn to ${L('The moat', 5)}.`)}`, 'numero_tipo: fisso\n'),
    'The courtyard': par(2, `The courtyard is empty. By the well you find an old lantern, still full of oil.\n\n${box(`✏️ **Item**\n\nNote the keyword **lantern**.`)}\n\nTwo doors: the tower's, at ${L('The stairs', 3)}, and the low kitchen door, at ${L('The kitchen', 4)}.`, 'keywords:\n  - lantern\n'),
    'The stairs': par(3, `A spiral staircase climbs into the dark. Without a light you cannot even see the first step.\n\nIf you have the keyword **lantern** turn to ${L('The library', 7)}. Otherwise feel your way up: turn to ${L('The dark', 6)}.`),
    'The kitchen': par(4, `In the kitchen a black cat stares at you without moving. You leave it alone and slip out quietly.\n\n${box(`❤️ **Trait**\n\nCircle the trait **careful**.`)}\n\nBack to the tower: turn to ${L('The stairs', 3)}.`, 'traits:\n  - careful\n'),
    'The moat': par(5, `The water of the moat is still and cold. Further on you see a grate in the wall and, beyond it, a half-fallen wooden bridge.\n\nIf you look at the grate turn to ${L('The grate', 8)}. If you try the bridge turn to ${L('The broken bridge', 9)}.`),
    'The dark': par(6, `On the third step your foot finds nothing. You fall for a long time, then nothing more.\n\n${box(`😢 **The end**\n\nYour adventure ends here.`)}`, 'finale: true\n'),
    'The library': par(7, `In the lantern's light shelves appear, up to the ceiling. On a lectern lies a book closed with a padlock.\n\nIf you have the keyword **seal** turn to ${L("The wizard's study", 10)}. Otherwise open the window: turn to ${L('The window', 11)}.`, 'keywords:\n  - seal?\n'),
    'The grate': par(8, `The grate gives way at the first pull. Behind it, on a shelf, there is a rusty lantern.\n\n${box(`✏️ **Item**\n\nNote the keyword **lanturn**.`)}\n\nA tunnel goes down: turn to ${L('The well', 15)}.`, 'keywords:\n  - lanturn\n'),
    'The broken bridge': par(9, `The bridge shakes under your feet and a plank snaps. There is no other way: go back to section 5.`),
    "The wizard's study": par(10, `The wizard looks up from his book and smiles, as if he had been waiting for you for a long time.\n\n${box(`✅ **Memorable encounter**\n\nYou have met the wizard of the tower.`)}\n\nIf you agree to become his apprentice turn to ${L('The pact', 12)}.`, 'encounters:\n  - wizard\n'),
    'The window': par(11, `From the window you see the courtyard and, below the sill, a row of steps cut into the stone.\n\nIf you go back turn to ${L('The stairs', 3)}. If you want to climb down, count the steps and turn to the section with that number.`, 'rimandi nascosti:\n  - "[[The secret passage|13]]"\n'),
    'The pact': par(12, `The wizard puts a small silver key in your hand. From today the tower is yours too.\n\n${box(`😢 **The end**\n\nYou won: you are the wizard's apprentice.`)}`, 'finale: true\n'),
    'The secret passage': par(13, `The steps end at an oak door. On the other side you hear the pages of a book being turned: turn to ${L("The wizard's study", 10)}.`, 'numero_tipo: relativo\nancora: "[[The window]]"\nscarto: 2\n'),
    'The hermit': par(14, `An old man sitting on a stone points at the tower without a word. Turn to ${L('The courtyard', 2)}.`),
    'The well': par(15, ''),
  },
};

export const BOOKS = { it, en };

/** The files of the book, by their path inside its folder. */
export function bookFiles(lang) {
  const b = BOOKS[lang];
  const files = { 'dante.yaml': b.yaml };
  for (const [name, text] of Object.entries(b.pages)) files[`${b.folder}/${name}.md`] = text;
  for (const [name, text] of Object.entries(b.paragraphs)) files[`${b.folder}/${name}.md`] = text;
  return files;
}
