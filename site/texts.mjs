// Texts of the site in English (at the root) and Italian (in it/). The keys are those of template.html.

// Video tutorials: title and description in each language, minutes, YouTube address in each
// language. A video appears only once it has an address; until then the section says they are coming.
// group: one of the keys of tutorial.groups.
export const videos = [
  // {
  //   n: 1,
  //   group: 'start',
  //   minutes: 3,
  //   en: 'Dante in three minutes',
  //   it: 'Dante in tre minuti',
  //   about: { en: '…', it: '…' },
  //   url: { en: 'https://www.youtube.com/watch?v=…', it: 'https://www.youtube.com/watch?v=…' }
  // }
]

// YouTube playlist of the tutorials in each language; empty: no link.
export const playlists = { en: '', it: '' }

export const texts = {
  en: {
    lang: 'en',
    otherLang: 'it',
    otherLangLabel: 'Italiano',
    otherLangHref: 'it/',
    root: '',
    img: 'img/en/',
    title: 'Dante – a writing app for novelists',
    description:
      'Dante is a free writing app for Mac, Windows, Linux and the browser. Your novel is a folder of plain text files, with scenes, chapters, a Story Bible, boards and statistics, in Markdown, a free standard that any text editor can open.',
    nav: {
      download: 'Download',
      web: 'Try in the browser',
      tutorial: 'Tutorials',
      guide: 'Guide',
      news: 'What’s new'
    },
    hero: {
      claim: 'Write your novel. Keep your files.',
      text: 'Dante is a quiet place to write a novel: scenes, chapters and parts on the left, the text in the middle, characters and places beside it. Every scene is a plain Markdown file in a folder of yours, a free standard that any text editor can open, so the same novel and travels in Dropbox or Google Drive. Free, for Mac, Windows, Linux and the browser.',
      download: 'Download for',
      downloadGeneric: 'Download',
      version: 'version',
      web: 'Try in the browser',
      shot: 'Dante with a scene of Pride and Prejudice open, the manuscript on the left and the scene’s properties on the right',
      loading: 'looking for the latest version…',
      install: 'How to install'
    },
    features: {
      title: 'What it does',
      items: [
        [
          'Scenes, chapters and parts',
          'Write one scene at a time or read the whole novel in one go. ⌘ or Ctrl+Enter splits a scene where the cursor is; drag to reorder. Snapshots keep earlier versions of every scene.'
        ],
        [
          'Story Bible',
          'Characters, places, plotlines and anything else, as cards with their properties. Wikilinks join them to the scenes, and the sheets of the people in a scene open beside the text.'
        ],
        [
          'Tables and boards',
          'Scenes by status on a board, a table of point of view and places, a timeline of story time. The properties are yours to choose.'
        ],
        [
          'Goals and statistics',
          'Length of the novel, a deadline and a daily goal, counted in words or in characters with spaces. Writing days, sessions and the most used words.'
        ],
        [
          'Writing together',
          'Signed comments and tracked revisions, with the project shared through Google Drive or Dropbox. Dante sees the changes of the others as they arrive.'
        ],
        [
          'From Word, to Word, PDF and EPUB',
          'Import a novel from Word or Scrivener. Export it as a standard manuscript for agents and publishers, as a PDF to read or print, or as an ebook.'
        ]
      ]
    },
    local: {
      title: 'Your novel stays in your folders',
      intro:
        'A Dante project is an ordinary folder on your computer: one Markdown file per scene, one folder per chapter, a dante.yaml file with the novel’s settings. No account, no cloud of ours, no subscription.',
      items: [
        [
          'Nothing is sent',
          'Dante does not send your text anywhere and keeps no statistics of how you use it. What you write stays yours, even before you show it to anyone.'
        ],
        [
          'Plain text, readable forever',
          'Markdown files open in any text editor, today and in twenty years: Markdown is a free standard, tied to no program.'
        ],
        [
          'The folder goes where you want',
          'In Dropbox, Google Drive or iCloud to write from more computers or with a co-author, in git to keep the whole history. Dante also keeps zip copies in Documents.'
        ]
      ],
      note: 'Dante goes online only to check for updates and, when you ask, to download an image from a web address.'
    },
    shots: {
      title: 'A look',
      items: [
        ['sheets.png', 'The sheets of the characters and places named in the scene, beside the text'],
        ['bible.png', 'The Story Bible: characters and places as cards'],
        ['board.png', 'A board of the scenes by status'],
        ['stats.png', 'Goals and the words written each day'],
        ['night.png', 'The Night theme; Sepia, light and dark too']
      ]
    },
    download: {
      title: 'Download',
      intro:
        'The latest version is {version}. Dante is not signed with an Apple or Microsoft certificate: the first time, macOS and Windows ask for confirmation. Installed copies then update themselves.',
      mac: 'Mac',
      macArm: 'Apple chip (M1 and later)',
      macIntel: 'Intel processor',
      macNote:
        'Open the .dmg and drag Dante to Applications. The first time: System Settings → Privacy & Security → Open Anyway. macOS 10.15 or later.',
      win: 'Windows',
      winSetup: 'Installer',
      winPortable: 'Portable (zip, nothing to install)',
      winNote: 'If SmartScreen says “Windows protected your PC”: More info → Run anyway.',
      linux: 'Linux',
      linuxAppImage: 'AppImage',
      linuxDeb: '.deb package (Debian, Ubuntu)',
      linuxRpm: '.rpm package (Fedora, openSUSE)',
      linuxNote: 'Make the AppImage executable (chmod +x) and start it.',
      install: 'Installing step by step, and getting past the warning of macOS and Windows',
      all: 'All versions on GitHub',
      beta: 'Betas, with the new features before the official version, are the releases marked Pre-release. Once installed, Dante can follow them: Settings > Updates > Beta channel.',
      support: 'Dante is free: if you find it useful, you can buy me a coffee with PayPal.',
      failed: 'The latest version could not be read: download it from the releases page.'
    },
    web: {
      title: 'Try Dante in the browser',
      text: 'The web version is the same program, with nothing to install: it works in Chrome, Edge or Brave on the folders of your computer, and offline after the first visit. Useful to try Dante, or where an app cannot be installed.',
      limits:
        'Compared with the app it has a few limits: no PDF export yet, moving chapters is slower, changes made by other programs show after a few seconds. Safari and Firefox open only the sample project. If you can, install the app.',
      download: 'Download the app',
      open: 'Open the web version',
      beta: 'beta version',
      more: 'What is different from the app (Italian guide)',
      moreHref: 'https://github.com/lucadj77/dante/blob/main/docs/guida.md#18-dante-nel-browser'
    },
    tutorial: {
      title: 'Tutorials',
      text: 'Short videos to start writing with Dante.',
      soon: 'The first videos are coming soon.',
      playlist: 'All the videos in the YouTube playlist',
      // the groups of the section, in the order they appear
      groups: {
        start: ['Start here', 'The suggested path to begin, importing included.'],
        write: ['Writing', 'Scenes, chapters, snapshots and the editor.'],
        bible: ['Story Bible and boards', 'Characters, places, links, tables and boards.'],
        together: ['Together and elsewhere', 'Co-authors, sharing and backups.'],
        export: ['Goals and exporting', 'Goals, statistics and exporting.']
      }
    },
    guide: {
      title: 'Guide and news',
      guideTitle: 'User guide',
      guideText:
        'Every feature, chapter by chapter, with screenshots, and a short first steps page. The full guide is in Italian; the same pages are in Dante’s Help.',
      guideLink: 'First steps (English)',
      guideHref: 'https://github.com/lucadj77/dante/blob/main/docs/first-steps.md',
      guideLinkOther: 'Guida completa (italiano)',
      guideHrefOther: 'https://github.com/lucadj77/dante/blob/main/docs/guida.md',
      newsTitle: 'What’s new',
      newsText: 'What changes in each version.',
      newsLink: 'Read what’s new',
      newsHref: 'https://github.com/lucadj77/dante/blob/main/docs/whats-new.md'
    },
    footer: {
      free: 'Free, with its source code on GitHub.',
      source: 'Source code',
      support: 'Buy me a coffee',
      by: 'A project by Luca Di Gialleonardo'
    }
  },

  it: {
    lang: 'it',
    otherLang: 'en',
    otherLangLabel: 'English',
    otherLangHref: '../',
    root: '../',
    img: '../img/it/',
    title: 'Dante – un programma di scrittura per romanzieri',
    description:
      'Dante è un programma gratuito per scrivere romanzi, per Mac, Windows, Linux e il browser. Il romanzo è una cartella di semplici file di testo, con scene, capitoli, Bibbia, bacheche e statistiche, in Markdown, uno standard libero che si apre con qualsiasi editor di testo.',
    nav: {
      download: 'Scarica',
      web: 'Prova nel browser',
      tutorial: 'Tutorial',
      guide: 'Guida',
      news: 'Novità'
    },
    hero: {
      claim: 'Scrivi il tuo romanzo. I file restano tuoi.',
      text: 'Dante è un posto tranquillo per scrivere un romanzo: scene, capitoli e parti a sinistra, il testo al centro, personaggi e luoghi accanto. Ogni scena è un semplice file Markdown in una tua cartella, uno standard libero che si apre con qualsiasi editor di testo, quindi lo stesso romanzo viaggia in Dropbox o Google Drive. Gratuito, per Mac, Windows, Linux e il browser.',
      download: 'Scarica per',
      downloadGeneric: 'Scarica',
      version: 'versione',
      web: 'Prova nel browser',
      shot: 'Dante con una scena dei Promessi sposi aperta, il manoscritto a sinistra e le proprietà della scena a destra',
      loading: 'cerco l’ultima versione…',
      install: 'Come si installa'
    },
    features: {
      title: 'Cosa fa',
      items: [
        [
          'Scene, capitoli e parti',
          'Scrivi una scena alla volta o leggi tutto il romanzo di fila. ⌘ o Ctrl+Invio divide la scena dove sta il cursore; trascini per riordinare. Le istantanee conservano le versioni precedenti di ogni scena.'
        ],
        [
          'Bibbia',
          'Personaggi, luoghi, trame e tutto ciò che serve alla storia, in schede con le loro proprietà. I collegamenti le legano alle scene, e le schede di chi compare in una scena si aprono accanto al testo.'
        ],
        [
          'Tabelle e bacheche',
          'Le scene per stato in una bacheca, una tabella con punto di vista e luoghi, una linea del tempo della storia. Le proprietà le scegli tu.'
        ],
        [
          'Obiettivi e statistiche',
          'Lunghezza del romanzo, scadenza e obiettivo del giorno, in parole o in caratteri spazi inclusi. Giorni di scrittura, sessioni e parole più usate.'
        ],
        [
          'Scrivere in più persone',
          'Commenti firmati e revisioni da accettare, con il progetto condiviso in Google Drive o Dropbox. Dante vede le modifiche degli altri appena arrivano.'
        ],
        [
          'Da Word, a Word, PDF ed EPUB',
          'Importa un romanzo da Word o da Scrivener. Esportalo come manoscritto standard per agenti ed editori, in PDF da leggere o stampare, o come ebook.'
        ]
      ]
    },
    local: {
      title: 'Il romanzo resta nelle tue cartelle',
      intro:
        'Un progetto di Dante è una normale cartella sul tuo computer: un file Markdown per scena, una cartella per capitolo, un file dante.yaml con le impostazioni del romanzo. Niente account, niente cloud nostro, niente abbonamenti.',
      items: [
        [
          'Nessun dato inviato',
          'Dante non manda il tuo testo da nessuna parte e non raccoglie statistiche su come lo usi. Quello che scrivi resta tuo, anche prima di farlo leggere a qualcuno.'
        ],
        [
          'Testo semplice, leggibile per sempre',
          'I file Markdown si aprono con qualsiasi editor di testo, oggi e tra vent’anni: il Markdown è uno standard libero, non legato a nessun programma.'
        ],
        [
          'La cartella va dove vuoi',
          'In Dropbox, Google Drive o iCloud per scrivere da più computer o con un coautore, in git per tenere tutta la storia. Dante tiene anche copie zip in Documenti.'
        ]
      ],
      note: 'Dante si collega a internet solo per controllare gli aggiornamenti e, quando lo chiedi tu, per scaricare un’immagine da un indirizzo web.'
    },
    shots: {
      title: 'Uno sguardo',
      items: [
        ['sheets.png', 'Accanto al testo, le schede dei personaggi e dei luoghi nominati nella scena'],
        ['bible.png', 'La Bibbia: personaggi e luoghi in schede'],
        ['board.png', 'Una bacheca delle scene per stato'],
        ['stats.png', 'Obiettivi e caratteri scritti ogni giorno'],
        ['night.png', 'Il tema Notte; ci sono anche Seppia, chiaro e scuro']
      ]
    },
    download: {
      title: 'Scarica',
      intro:
        'L’ultima versione è la {version}. Dante non è firmato con un certificato Apple o Microsoft: la prima volta macOS e Windows chiedono conferma. Poi le copie installate si aggiornano da sole.',
      mac: 'Mac',
      macArm: 'Chip Apple (M1 e successivi)',
      macIntel: 'Processore Intel',
      macNote:
        'Apri il .dmg e trascina Dante in Applicazioni. La prima volta: Impostazioni di Sistema → Privacy e sicurezza → Apri comunque. Serve macOS 10.15 o successivo.',
      win: 'Windows',
      winSetup: 'Installatore',
      winPortable: 'Versione portatile (zip, non si installa)',
      winNote: 'Se SmartScreen mostra «Windows ha protetto il PC»: Ulteriori informazioni → Esegui comunque.',
      linux: 'Linux',
      linuxAppImage: 'AppImage',
      linuxDeb: 'Pacchetto .deb (Debian, Ubuntu)',
      linuxRpm: 'Pacchetto .rpm (Fedora, openSUSE)',
      linuxNote: 'Rendi eseguibile l’AppImage (chmod +x) e avvialo.',
      install: 'Come si installa e come si supera l’avviso di macOS e Windows, passo per passo',
      all: 'Tutte le versioni su GitHub',
      beta: 'Le beta, con le novità prima della versione ufficiale, sono le release segnate Pre-release. Dante installato può seguirle: Impostazioni > Aggiornamenti > canale Beta.',
      support: 'Dante è gratuito: se ti è utile, puoi offrirmi un caffè con PayPal.',
      failed: 'Non riesco a leggere l’ultima versione: scaricala dalla pagina delle release.'
    },
    web: {
      title: 'Provare Dante nel browser',
      text: 'La versione web è lo stesso programma, senza installare nulla: funziona in Chrome, Edge o Brave sulle cartelle del tuo computer, e senza connessione dopo la prima apertura. Serve a provare Dante, o dove non si può installare un’app.',
      limits:
        'Rispetto all’app ha qualche limite: per ora niente PDF, spostare i capitoli è più lento, le modifiche fatte da altri programmi compaiono dopo qualche secondo. Safari e Firefox aprono solo il progetto di esempio. Se puoi, installa l’app.',
      download: 'Scarica l’app',
      open: 'Apri la versione web',
      beta: 'versione beta',
      more: 'Cosa cambia rispetto all’app',
      moreHref: 'https://github.com/lucadj77/dante/blob/main/docs/guida.md#18-dante-nel-browser'
    },
    tutorial: {
      title: 'Tutorial',
      text: 'Video brevi per cominciare a scrivere con Dante.',
      soon: 'I primi video arrivano a breve.',
      playlist: 'Tutti i video nella playlist di YouTube',
      groups: {
        start: ['Inizia qui', 'Il percorso consigliato per cominciare, importazione compresa.'],
        write: ['Scrivere', 'Scene, capitoli, istantanee e l’editor.'],
        bible: ['Bibbia e bacheche', 'Personaggi, luoghi, collegamenti, tabelle e bacheche.'],
        together: ['Insieme e altrove', 'Coautori, condivisione e copie di sicurezza.'],
        export: ['Obiettivi ed esportazione', 'Obiettivi, statistiche ed esportazione.']
      }
    },
    guide: {
      title: 'Guida e novità',
      guideTitle: 'Guida all’uso',
      guideText:
        'Tutte le funzioni, capitolo per capitolo, con gli screenshot, e una pagina breve di primi passi. Le stesse pagine sono nell’Aiuto di Dante.',
      guideLink: 'Apri la guida',
      guideHref: 'https://github.com/lucadj77/dante/blob/main/docs/guida.md',
      guideLinkOther: 'Primi passi',
      guideHrefOther: 'https://github.com/lucadj77/dante/blob/main/docs/primi-passi.md',
      newsTitle: 'Novità',
      newsText: 'Cosa cambia a ogni versione.',
      newsLink: 'Leggi le novità',
      newsHref: 'https://github.com/lucadj77/dante/blob/main/docs/novita.md'
    },
    footer: {
      free: 'Gratuito, con il codice sorgente su GitHub.',
      source: 'Codice sorgente',
      support: 'Offrimi un caffè',
      by: 'Un progetto di Luca Di Gialleonardo'
    }
  }
}
