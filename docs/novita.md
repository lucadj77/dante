# Novità di Dante

Cosa cambia in ogni versione di Dante, dalla più recente. Le stesse note compaiono nella pagina della versione su GitHub e nell'avviso di aggiornamento dentro Dante. In inglese: [What's new](whats-new.md).

## Prossima versione

### Nuovo

- **Caratteri spazi inclusi in tabelle, esportazione e importazione**: nelle tabelle e bacheche c'è il campo **Caratteri** accanto a **Parole**, e la tabella Scene di un progetto nuovo parte con la misura del progetto. Il frontespizio del manoscritto e il riepilogo dopo l'esportazione usano la stessa misura. L'anteprima dell'importazione mostra parole e caratteri.
- **Menu del Mac nella lingua dell'interfaccia**: le voci della barra dei menu (Cerca aggiornamenti…, Modifica, Finestra, Aiuto di Dante e le altre) seguono la lingua scelta in Dante.
- **Guida completa in inglese**: con l'interfaccia in inglese l'Aiuto apre la guida completa in inglese, capitolo per capitolo come quella in italiano.
- **Note a piè di pagina**: il pulsante **x¹** della barra di formattazione inserisce una nota lì dove la scrivi (`^[testo]`). Nell'esportazione va a piè di pagina in Word e nel PDF, alla fine del capitolo nell'EPUB. Le note di un file Word importato restano note.
- **Un aspetto per ogni romanzo**: in Impostazioni > Aspetto di questo romanzo puoi dare a un romanzo il suo tema, colore d'accento, font e resa del testo. Le scelte restano su questo computer e non nel progetto: chi scrive con te tiene il suo aspetto.
- **Annullare spostamenti, divisioni e fusioni**: dopo aver spostato, diviso o fuso scene e capitoli, in fondo all'albero compare **Annulla** (anche Cmd+Z / Ctrl+Z con l'albero attivo), che rimette tutto com'era, collegamenti compresi.
- **Riprendere una copia di sicurezza da Dante**: in Impostazioni > Copie di sicurezza c'è l'elenco delle copie; **Apri questa copia** la estrae in una cartella nuova accanto al romanzo e la apre, senza toccare il romanzo di adesso.
- **Una proprietà a più scene insieme**: scegli più scene nell'albero (Cmd/Ctrl+clic), poi clic destro > **Imposta una proprietà alle scene…** per dare a tutte lo stesso valore, per esempio lo stato.
- **Indice dei capitoli in Word e PDF**: nell'Esportazione la spunta **Indice dei capitoli** aggiunge l'indice di parti e capitoli con i numeri di pagina, dopo frontespizio, dedica ed esergo.
- **Profili di esportazione salvati**: le scelte dell'Esportazione si salvano sotto un nome («Per l'editore», «Per la stampa») e si riprendono da un elenco, senza rifarle ogni volta.

### Cambiato

- **Impostazioni riordinate**: al posto delle due schede c'è un elenco di pagine a sinistra, diviso tra «Questo romanzo» e «Dante su questo computer», con una casella per cercare un'impostazione. I temi si scelgono da piccoli disegni della finestra, e struttura, colori dell'albero, pagina e testo dell'editor hanno un'anteprima a fianco.
- **Guida più ordinata**: il capitolo sui libri game è diviso in gruppi (preparare, leggere, scrivere, numerare, controllare, esportare) e i dettagli per chi sviluppa Dante sono usciti dalla guida.
- **Barre sopra il testo più compatte**: nel Manoscritto le barre dei comandi occupano meno righe. In una finestra stretta i pulsanti mostrano solo l'icona (il nome resta nel suggerimento), «Dividi in scena» e «Dividi in capitolo» diventano icone e la dimensione del testo passa nel menu **Altro**.
- **Finestre che rispondono subito alla tastiera**: Cestino, Sposta in…, conflitti, confronto delle istantanee, importazione e le finestre dei libri game prendono la tastiera appena si aprono: Esc le chiude senza dover prima fare clic, Tab resta dentro la finestra e alla chiusura si torna dov'eri.
- **Nomi nella barra delle sezioni**: in una finestra larga la barra a sinistra parte con i nomi accanto alle icone; **Nascondi i nomi**, in fondo, la riporta alle sole icone.
- **Parole più chiare**: nelle Statistiche «Citazioni» diventa «Menzioni»; nei progetti nuovi in italiano il tipo «Plotline» si chiama «Trama»; «albero», «scheda», «collegamento» e «Risolto» sono usati allo stesso modo dappertutto.
- **Meno numeri ripetuti**: con una sola scena a schermo il pannello Proprietà e la barra di stato non scrivono due volte lo stesso numero, e «Oggi» sta solo nella barra di stato quando è visibile.
- **Bacheche**: le colonne si dividono lo spazio quando sono poche, e **Elimina questa vista** è dentro le impostazioni della vista invece che sempre in vista.
- **Obiettivi di scene e capitoli convertiti**: cambiando misura tra parole e caratteri, Dante elenca anche gli obiettivi propri di scene e capitoli con il valore che avrebbero e li converte tutti con un clic.
- **Il nome, chiesto subito**: chi apre un progetto senza aver ancora scritto il proprio nome se lo sente chiedere una volta, alla prima apertura, così commenti, revisioni e conteggio del giorno partono subito.

### Corretto

- **Lo stesso numero dappertutto**: con revisioni in sospeso il pannello Proprietà, le tabelle e il registro di scrittura contavano anche il testo cancellato e i segni delle revisioni. Ora contano come le Statistiche: il testo aggiunto vale, quello cancellato no.
- **Spostamenti interrotti**: se Dante si chiudeva mentre riordinava scene o capitoli, alcuni file restavano con un nome provvisorio e non comparivano più nell'albero. Ora alla riapertura Dante rimette i file dov'erano o porta a termine lo spostamento, e lo dice con un avviso.
- **Guida**: corretti il capitolo sull'installazione, il nome dell'impostazione «Invio singolo per iniziare un nuovo paragrafo» e i nomi delle voci di menu del Mac.

## 1.2.0-beta.3 · 10 novembre 2026

### Corretto

- **Spostare più volte con la tastiera**: nell'albero del manoscritto Ctrl+Alt+freccia (Cmd+Opz+freccia su Mac) sposta la scena di un posto a ogni pressione, senza doverci cliccare sopra ogni volta.

## 1.2.0-beta.2 · 10 novembre 2026

### Nuovo

- **Sposta in… e Copia in…**: con il clic destro su una scena, un capitolo, una nota o una cartella (anche sulle schede della Bibbia) puoi spostarla o copiarla in un'altra sezione o in un punto preciso del manoscritto, scegliendo da una finestra con l'albero e una casella di ricerca, senza trascinare.
- **Skill per agenti IA aggiornata**: la skill in `skills/dante` ora spiega anche libri game, viste, proprietà per tutte le scene, cestino, righe vuote, callout e tutte le impostazioni del romanzo, e il suo script conta parole e caratteri spazi inclusi come Dante.
- **Libri game in inglese**: in un libro game in inglese Dante legge lo stato di gioco anche da frasi come «Note the keyword…» e «If you have…», trova i numeri scritti a mano come «turn to 12», dà ai box proprietà con nomi inglesi (traits, keywords, encounters), chiama la nota del grafo «Gamebook graph» e non tocca più le parole prima dei rimandi (gli articoli si correggono solo nei libri in italiano).

### Corretto

- **Callout nell'esportazione**: i blocchi che cominciano con `> [!note] Titolo` diventano in Word, PDF ed EPUB un riquadro colorato con il titolo in grassetto; prima uscivano come citazioni che cominciavano con «!note». Nel Markdown esportato restano callout.

## 1.2.0-beta.1 · 9 novembre 2026

### Nuovo

- **Callout**: i blocchi `> [!note]`, `> [!warning]` e simili si vedono con il nome in una pillola colorata; elenchi e tabelle al loro interno si vedono come nel resto del testo.
- **Libri game**: un progetto può diventare un libro game (Impostazioni > Libro game). L'albero mostra i paragrafi in ordine di numero, con avvisi, lunghezze e da dove si arriva e dove si va; i rimandi si vedono come numeri e i box come riquadri colorati; il pannello Paragrafo riassume ogni paragrafo e permette di cambiarne numero, tipo e finale, aggiornando i rimandi; regole e altre pagine senza numero (pulsante Pagina in cima all'albero) stanno prima o dopo i paragrafi. Si scrive in fretta: `[[` cerca o crea un paragrafo (le due voci per crearlo sono in cima all'elenco) e mette il rimando con l'articolo giusto, Cmd/Ctrl+Invio apre la finestra del nuovo paragrafo (numero libero, fisso o relativo, rimando nel testo o nascosto), il pulsante Paragrafo della barra apre la stessa finestra, il pulsante Box inserisce i box del libro e ne scrive il valore nelle proprietà. L'esportazione mette i paragrafi in ordine con il numero come titolo e i box come riquadri colorati, e avvisa dei rimandi rotti. Il pulsante Riordina numera i paragrafi in sequenza nell'ordine in cui si leggono; il pulsante Paragrafo nell'albero crea un paragrafo senza rimando. Il pulsante Rimescola dà nuovi numeri a caso con un'anteprima, tenendo fermi i fissi e spostando i relativi con la loro ancora, aggiorna rimandi e articoli e si può annullare, anche solo nella numerazione; il pulsante Grafo scrive una nota con lo schema del libro, da guardare anche a tutto schermo. La sezione Libro game ha la tabella dei paragrafi, ordinabile e filtrabile, i controlli di tutto il libro (orfani, vicoli ciechi, rimandi rotti e stato di gioco: valori chiesti con il punto interrogativo che il lettore non può ancora avere) e il registro di caratteri, parole chiave e incontri con i possibili doppioni; la barra di stato dice quanti problemi ci sono. Nell'esportazione la sezione Libro game sostituisce parti, capitoli e scene: titolo del paragrafo, separazione tra paragrafi, box a colori, grigi o senza riquadro, e rimandi cliccabili nel Word, nel PDF e nell'EPUB. Il testo dei paragrafi si personalizza: giustificato o a sinistra, rientro, spazio tra i capoversi, dimensione del testo nei box, numero in grassetto o in corsivo e con un font suo.
- **Dimensione dell'interfaccia**: in Impostazioni > Dante su questo computer > Aspetto puoi ingrandire tutta la finestra di Dante, da 80% a 200%: menu, pannelli, pulsanti e il loro testo, non solo il testo dell'editor.

### Cambiato

- **Diagrammi Mermaid**: i blocchi ```` ```mermaid ```` nelle note e nelle scene si vedono disegnati, con un pulsante per guardarli a tutto schermo.

### Corretto

- **Menu del tasto destro**: sugli ultimi elementi del pannello il menu si apre più in alto e resta visibile per intero.
- **Suggerimenti**: i suggerimenti che compaiono passando sopra un elemento si aprono sopra di esso, così il puntatore non li copre.

## 1.1.4 · 28 ottobre 2026

### Corretto

- **Immagine nelle schede della Bibbia**: aggiungendo un'immagine a una scheda, ora compare subito anche nella sua card, senza riaprire la Bibbia.

## 1.1.3 · 28 ottobre 2026

### Nuovo

- **Larghezza delle colonne nelle viste**: nelle tabelle trascina il bordo destro di un'intestazione per cambiare la larghezza della colonna; nella linea del tempo raggruppata fai lo stesso sul titolo di una colonna. Doppio clic sul bordo torna alle larghezze automatiche. Le larghezze sono salvate con la vista.

### Corretto

- **Linea del tempo troppo larga**: nella 1.1.2 le colonne della linea del tempo raggruppata si allargavano quanto il testo più lungo; ora stanno nella finestra come prima.

## 1.1.2 · 28 ottobre 2026

### Corretto

- **Intestazione fissa in Tabelle e bacheche**: scorrendo una vista restano in alto il nome, i pulsanti e le impostazioni, e anche i nomi delle colonne della tabella e delle colonne della bacheca.

## 1.1.1 · 28 ottobre 2026

### Corretto

- **Fine paragrafo con le righe vuote nascoste**: il tasto Fine (Cmd+→ su Mac) e un clic dopo la fine di un paragrafo portano il cursore alla fine del paragrafo, e non più nella riga vuota invisibile o all'inizio del paragrafo dopo.

## 1.1.0 · 28 ottobre 2026

### Nuovo

- **Aspetto delle immagini nella Bibbia**: nella bacheca della Bibbia, **Aspetto** accanto a Immagini sceglie se l'immagine sta in cima alla scheda o accanto al titolo, se è ritagliata o intera, quale parte tenere (in alto per i ritratti) e quanto è grande.
- **Copertina e sottotitolo già alla creazione**: creando un nuovo romanzo puoi scrivere il sottotitolo e scegliere un'immagine tua per la copertina, senza passare dalle Impostazioni.
- **Rinominare una proprietà ovunque**: nel pannello Proprietà, aprendo la definizione di una proprietà, **Rinomina** cambia il nome in tutte le scene e le note, nelle viste e nelle impostazioni.
- **Proprietà per tutte le scene**: creando una proprietà scegli se vale solo per la scena aperta o per tutte le scene del romanzo; nelle altre scene compare pronta da compilare.
- **Colori dei pallini**: se una proprietà colora i pallini dell'albero (per esempio il punto di vista), nella sua definizione vedi il colore di ogni valore e puoi cambiarlo.
- **Richiami alla Bibbia**: i nomi e gli alias delle schede della Bibbia scritti nel testo sono sottolineati a puntini. Col tasto destro vedi la scheda e puoi aprirla o trasformare il nome in collegamento. Il pulsante **Richiami** nella barra li accende e li spegne; il pannello Collegamenti li elenca a parte.
- **Cronologia di commenti e revisioni**: nella scheda Commenti, **Cronologia** mostra chi ha accettato, rifiutato o chiuso cosa e quando, con il testo prima e dopo, per la scena o per tutto il romanzo, filtrabile per persona e date.
- **Domanda sulle righe vuote**: se lasci tra due paragrafi più righe vuote del solito, Dante chiede se vuoi una riga vuota vera, che si vede anche nel libro. Si spegne con **Non chiedere più** o in Impostazioni > Aspetto.
- **Immagini nelle schede della Bibbia**: nella bacheca della Bibbia le schede mostrano la loro prima immagine; la casella **Immagini** le nasconde.
- **Separatore di scena su più righe**: in esportazione, tra le scene, c'è anche **Due righe vuote**, e nel separatore scritto da te ogni `\n` va a capo: `\n* * *\n` mette tre asterischi fra due righe vuote.
- **Cmd+W chiude il progetto**: se il cursore non è in un pannello a fianco, Cmd+W (Ctrl+W su Windows e Linux) chiude il progetto e torna alla schermata iniziale; con il cursore in un pannello chiude il pannello, come prima. Nella versione web usa Alt+Cmd+W, perché Cmd+W chiude la scheda del browser.

### Cambiato

- **Invio singolo per un nuovo paragrafo**: Invio inizia un nuovo paragrafo e la riga vuota che nel file separa i paragrafi non si vede più: tra un paragrafo e l'altro resta solo lo spazio, le frecce lo saltano e Backspace all'inizio di un paragrafo lo unisce a quello prima. Invio due volte di seguito lascia una riga bianca che si vede anche nel libro (¶); Maiusc+Invio va a capo nello stesso paragrafo. Si spegne in Impostazioni > Aspetto.
- **Pulsante Richiami**: ha un'icona nuova, una persona sopra una riga a puntini, che non si confonde con le altre; il menu di un nome riconosciuto ricorda che i richiami si spengono da quel pulsante.
- **Pannello Proprietà più ordinato**: il pannello è diviso in sezioni che si chiudono e si aprono con un clic; **+ Nuova** sotto l'intestazione apre l'aggiunta di una proprietà, e il simbolo prima del nome, più visibile, apre la sua definizione.
- **Pulsanti Aggiungi su una riga**: Scena, Capitolo, Parte e Importa stanno sempre su una riga sola.

### Corretto

- **Anteprima delle schede**: un'immagine all'inizio del testo non compare più come «!» seguito dal nome del file.
- **Allegati subito visibili**: la prima immagine aggiunta a un romanzo crea la cartella Allegati dentro Ricerca, e ora la cartella compare subito nella sezione Note, senza riaprire il progetto.
- **Avviso di aggiornamento leggibile**: nell’avviso di una nuova versione il testo e le novità occupano tutta la larghezza, con i tre pulsanti sotto; prima erano schiacciati in una colonna stretta.

## 1.1.0-beta.3 · 28 ottobre 2026

### Cambiato

- **Invio singolo per un nuovo paragrafo**: Invio inizia un nuovo paragrafo e la riga vuota che nel file separa i paragrafi non si vede più: tra un paragrafo e l'altro resta solo lo spazio, le frecce lo saltano e Backspace all'inizio di un paragrafo lo unisce a quello prima. Invio due volte di seguito lascia una riga bianca che si vede anche nel libro (¶); Maiusc+Invio va a capo nello stesso paragrafo. Si spegne in Impostazioni > Aspetto.

## 1.1.0-beta.2 · 28 ottobre 2026

### Nuovo

- **Aspetto delle immagini nella Bibbia**: nella bacheca della Bibbia, **Aspetto** accanto a Immagini sceglie se l'immagine sta in cima alla scheda o accanto al titolo, se è ritagliata o intera, quale parte tenere (in alto per i ritratti) e quanto è grande.

### Cambiato

- **Pulsante Richiami**: ha un'icona nuova, una persona sopra una riga a puntini, che non si confonde con le altre; il menu di un nome riconosciuto ricorda che i richiami si spengono da quel pulsante.

## 1.1.0-beta.1 · 28 ottobre 2026

### Nuovo

- **Copertina e sottotitolo già alla creazione**: creando un nuovo romanzo puoi scrivere il sottotitolo e scegliere un'immagine tua per la copertina, senza passare dalle Impostazioni.
- **Rinominare una proprietà ovunque**: nel pannello Proprietà, aprendo la definizione di una proprietà, **Rinomina** cambia il nome in tutte le scene e le note, nelle viste e nelle impostazioni.
- **Proprietà per tutte le scene**: creando una proprietà scegli se vale solo per la scena aperta o per tutte le scene del romanzo; nelle altre scene compare pronta da compilare.
- **Colori dei pallini**: se una proprietà colora i pallini dell'albero (per esempio il punto di vista), nella sua definizione vedi il colore di ogni valore e puoi cambiarlo.
- **Richiami alla Bibbia**: i nomi e gli alias delle schede della Bibbia scritti nel testo sono sottolineati a puntini. Col tasto destro vedi la scheda e puoi aprirla o trasformare il nome in collegamento. Il pulsante **Richiami** nella barra li accende e li spegne; il pannello Collegamenti li elenca a parte.
- **Cronologia di commenti e revisioni**: nella scheda Commenti, **Cronologia** mostra chi ha accettato, rifiutato o chiuso cosa e quando, con il testo prima e dopo, per la scena o per tutto il romanzo, filtrabile per persona e date.
- **Domanda sulle righe vuote**: se lasci tra due paragrafi più righe vuote del solito, Dante chiede se vuoi una riga vuota vera, che si vede anche nel libro. Si spegne con **Non chiedere più** o in Impostazioni > Aspetto.
- **Immagini nelle schede della Bibbia**: nella bacheca della Bibbia le schede mostrano la loro prima immagine; la casella **Immagini** le nasconde.
- **Separatore di scena su più righe**: in esportazione, tra le scene, c'è anche **Due righe vuote**, e nel separatore scritto da te ogni `\n` va a capo: `\n* * *\n` mette tre asterischi fra due righe vuote.

### Cambiato

- **Pannello Proprietà più ordinato**: il pannello è diviso in sezioni che si chiudono e si aprono con un clic; **+ Nuova** sotto l'intestazione apre l'aggiunta di una proprietà, e il simbolo prima del nome, più visibile, apre la sua definizione.
- **Pulsanti Aggiungi su una riga**: Scena, Capitolo, Parte e Importa stanno sempre su una riga sola.

### Corretto

- **Anteprima delle schede**: un'immagine all'inizio del testo non compare più come «!» seguito dal nome del file.

## 1.0.0 · 27 ottobre 2026

### Nuovo

- **Dante 1.0 e due canali di aggiornamento**: Dante passa alla numerazione 1.0, 1.1, 1.2... In Impostazioni > Dante su questo computer > Aggiornamenti scegli il canale: **Stabile** (di base) riceve solo le versioni ufficiali, **Beta** riceve prima le novità, in versioni ancora in prova. Chi installa una beta resta sul canale Beta finché non lo cambia.
- **Salta questa versione**: l'avviso di aggiornamento ha anche **Salta questa versione**, che non la propone più ai controlli automatici (Cerca aggiornamenti la mostra comunque). **Più tardi** si chiama ora **Ricordamelo più tardi**.
- **Scrivener: anche ricerca e personaggi**: importando da Scrivener, oltre al romanzo entrano anche le altre cartelle. Per ogni cartella scegli se va nella Bibbia (personaggi, luoghi…) o tra le note, in Ricerca o in Laboratorio; Dante propone già la scelta più probabile. I testi diventano note con la loro sinossi, PDF e immagini vengono copiati.

## 0.1.49 · 27 ottobre 2026

- **Sito di Dante e nuovo indirizzo della versione web**: Dante ha un sito, https://dante.lucadj.eu, con screenshot, download per ogni sistema e, presto, video tutorial. La versione web si sposta su https://dante.lucadj.eu/app/ (l'ultima versione ufficiale) e https://dante.lucadj.eu/beta/ (l'ultima di prova). Chi usava il vecchio indirizzo deve aprire quello nuovo, reinstallare Dante dal browser se l'aveva installato e riaprire le cartelle dei romanzi: i testi non cambiano, l'elenco dei recenti e le impostazioni sì.

## 0.1.46 · 26 ottobre 2026

- **Copertina con una tua immagine**: in Impostazioni > Copertina puoi usare una foto o un disegno tuo al posto delle forme, scegliere se mostrare titolo, sottotitolo e autori, e cambiare il colore del testo e del suo contorno. La copertina compare tra i progetti recenti e all'inizio di Word, PDF ed EPUB.
- **Pallini dell'albero**: passando col mouse sul pallino accanto a una scena si legge lo stato, per esempio «Stato: bozza». In Impostazioni > Albero delle scene puoi far colorare i pallini da un'altra proprietà, come il punto di vista.
- **Statistiche al punto giusto**: un clic su una ripetizione o su una frase lunga apre la scena in quel punto e seleziona il passo.
- **Scorciatoie per Windows e Linux**: la guida e i primi passi danno ogni scorciatoia sia per Mac sia per Windows e Linux (per esempio Cmd+F / Ctrl+F). Su Windows e Linux i suggerimenti dei pulsanti scrivono correttamente Ctrl+clic e Ctrl+Invio.
- **Importazione da Scrivener più chiara**: se il `.scriv` scelto è un file vuoto o non è un progetto Scrivener, Dante lo dice e spiega cosa scegliere, invece di un errore tecnico come «Not a directory». Un `.scriv` compresso in un unico file si importa come uno zip.
- **Nuovo progetto: dice cosa manca**: se premi Crea o Importa senza aver scelto dove salvare il progetto, Dante te lo dice invece di lasciare il pulsante grigio; gli errori compaiono accanto al pulsante, e mentre lavora il pulsante scrive «Importo…».
- **Scrivener senza segni strani**: i segni degli stili di Scrivener, come `<$Scr_Ps::0>`, non compaiono più all'inizio delle scene importate.
- **Dialoghi come nel testo nei nuovi progetti**: un nuovo romanzo esporta i dialoghi con i segni con cui sono scritti, anche se per un altro romanzo avevi scelto i caporali. Le altre scelte dell'ultima esportazione restano il punto di partenza.

## 0.1.45 · 26 ottobre 2026

- **Cercare nella scena**: Cmd+F apre una barra per trovare una parola nella scena o nella nota aperta, con Invio per passare alla successiva.
- **Trova e sostituisci in tutto il romanzo**: Alt+Cmd+F, o la scheda **Sostituisci** della ricerca, cambia una parola in tutte le note, per esempio il nome di un personaggio. Vedi prima ogni occorrenza, scegli quali cambiare e puoi annullare. Proprietà, collegamenti, immagini e commenti non vengono toccati, e ogni scena viene salvata in un'istantanea prima della modifica.
- **Cestino**: dall'icona in basso nella barra a sinistra vedi cosa hai eliminato, lo rimetti dov'era o lo elimini per sempre.
- **Copie di sicurezza**: quando chiudi un progetto Dante ne salva una copia zip in Documenti/Dante backup, fuori dalla cartella del romanzo, e tiene le 10 più recenti. Cartella e numero si cambiano in Impostazioni; nel browser c'è un pulsante per scaricare lo zip.
- **Finestra ricordata**: Dante si riapre con la dimensione e la posizione che aveva.
- **Correzione**: gli obiettivi di parole salvati in Statistiche non cancellano più quelli cambiati nel frattempo da un coautore.
- **Aiuto dentro Dante**: l'icona con il punto di domanda nella barra a sinistra apre i primi passi, la guida completa e le novità, da leggere anche senza connessione. Sul Mac c'è anche il menu Help (Cmd+?).
- **Progetti nuovi pronti all'uso**: ogni nuovo romanzo ha già lo stato delle scene (idea, bozza, rivista, finita), il punto di vista e una bacheca e una tabella delle scene. La prima scena vuota spiega in tre righe come cominciare.
- **Impostazioni più semplici**: due schede, Questo romanzo e Dante su questo computer, e niente pulsante Salva: ogni modifica si salva da sola. La lingua del romanzo si sceglie da un menu.
- **Barra del manoscritto più ordinata**: sta su una riga; barra di formattazione, schede della scena, revisioni e testo Markdown sono nel menu Altro.
- **Sezione Note**: Ricerca e Laboratorio sono ora una sezione sola, con le due cartelle una sotto l'altra. Viste si chiama Tabelle e bacheche.
- **Errori più chiari**: quando qualcosa non riesce Dante lo spiega con una frase semplice; il messaggio tecnico è dietro Dettagli.
- **Correzione**: con la tastiera italiana Cmd+Maiusc+7 inseriva un commento invece di iniziare un elenco numerato; ora Cmd+Maiusc+7, 8, 9 e . fanno quello che devono.
- **Stato e obiettivi nell'albero**: accanto a ogni scena un pallino colorato mostra lo stato (idea, bozza, rivista, finita). Una scena o un capitolo può avere un obiettivo di parole, nel pannello Proprietà: l'albero mostra una piccola barra che diventa verde quando lo raggiungi.
- **Barra di stato**: sotto il testo le parole della scena, della selezione, del capitolo e di oggi, sempre in vista. Si nasconde dal menu Altro.
- **Sessioni di scrittura**: dalla barra di stato, un timer da 10 a 90 minuti con un numero di parole da raggiungere, se vuoi. Alla fine Dante dice quante parole hai scritto.
- **Modello delle nuove scene**: in Impostazioni scegli con quali proprietà e quale testo nasce ogni scena nuova, per esempio con lo stato «idea» e qualche domanda.
- **Stile nelle statistiche**: lunghezza media delle frasi, frasi lunghe, avverbi, parte di dialogo e parole ripetute a poca distanza, con gli esempi che aprono la scena.
- **Importazione da Scrivener**: dalla schermata iniziale, un progetto Scrivener diventa un progetto Dante con capitoli, scene e sinossi, dopo la stessa anteprima del Word.
- **Misure in caratteri**: in Statistiche > Obiettivi scegli se contare in parole o in caratteri spazi inclusi. La scelta vale per obiettivi, barra di stato, albero, pannello, sessioni di scrittura e grafico, e gli obiettivi già impostati vengono convertiti. I nuovi progetti in italiano partono dai caratteri.
- **Temi e colore d'accento**: oltre a chiaro e scuro ci sono Seppia e Notte, e si può scegliere il colore di pulsanti e collegamenti. Il tema di sistema ora cambia insieme al computer.
- **Il testo come in un libro**: in Impostazioni > Dante su questo computer scegli interlinea, spazio tra i paragrafi, rientro della prima riga, testo giustificato e qualsiasi font installato, con un esempio sotto.
- **Correttore**: si può spegnere, e riceve la lingua del romanzo.

## 0.1.44 · 21 ottobre 2026

- **Correzione**: la versione 0.1.43 (e la 0.1.42) si apriva con la finestra vuota dopo l'aggiornamento. Chi l'ha installata deve scaricare una volta a mano la nuova versione, perché quella rotta non può aggiornarsi da sola.

## 0.1.43 · 21 ottobre 2026

- **Righe vuote tra i paragrafi**: il pulsante **¶** della barra di formattazione, o Alt+Invio, lascia una riga vuota dopo il paragrafo senza aprire una nuova scena. Nell'editor si vede come un **¶** chiaro; in Word, PDF, EPUB e in Obsidian è una riga vuota. Nel file è un paragrafo con solo `&nbsp;`. Importando da Word puoi scegliere che le righe vuote restino tali, oppure tenerne una sola facendo clic su di essa nell'anteprima e segnandola come testo. Una riga vuota che lascerebbe una scena di uno o due paragrafi resta una riga vuota invece di aprire una scena.

## 0.1.42 · 21 ottobre 2026

- **Dante nel browser**: Dante si può usare anche da Chrome, Edge o Brave, senza installare nulla, all'indirizzo https://lucadj77.github.io/dante/. Lavora sui file della cartella del romanzo, funziona senza connessione dopo la prima apertura e non manda online i tuoi testi. Niente PDF, e qualche altro limite descritto nel capitolo 18 della guida.
- **Importare da Word con anteprima**: prima di importare vedi il documento accanto al risultato e puoi dire riga per riga cos'è (titolo di parte, capitolo o scena, separatore, testo, da omettere), anche per tutte le righe simili in un colpo. Le sezioni divise solo da un numero su una riga ("1", "2", "3"…) diventano capitoli invece di scene con il solo numero. Con il pulsante **Importa** nel manoscritto puoi aggiungere un file Word a un progetto già iniziato, per esempio un romanzo diviso in più file.
- **Controllo degli aggiornamenti visibile**: all'avvio Dante dice per qualche secondo che è aggiornato, o che non è riuscito a controllare, invece di restare in silenzio. Se resta aperto controlla di nuovo ogni sei ore, e sul Mac c'è la voce **Dante > Check for Updates…**.
- **Dialoghi in esportazione**: le battute scritte con lineette o trattini a inizio paragrafo prendono le virgolette dello stile scelto (— Vieni — disse diventa «Vieni» disse). I nuovi progetti lasciano i dialoghi come sono scritti, finché non scegli uno stile in Esportazione > Tipografia.
- **Skill per agenti IA**: un file di istruzioni in inglese, nella cartella `skills/dante` del repository, insegna a un assistente di intelligenza artificiale come leggere e modificare un progetto di Dante senza rovinarlo (ordine delle scene, note cartella, collegamenti, commenti e revisioni).

## 0.1.38 · 20 ottobre 2026

- **Salvataggio più sicuro**: chiudendo la finestra o uscendo con Cmd+Q subito dopo aver scritto, le ultime parole vengono salvate prima di uscire. Se un file non si può scrivere, Dante lo dice e riprova invece di perdere il testo.
- **Correzioni**: le virgolette automatiche non si raddoppiano più in modalità revisione e non rompono i paragrafi centrati; dividere una scena non lascia il testo intero nella prima; unire scene subito dopo aver scritto non perde le ultime parole; le copie in conflitto di Dropbox o Drive seguono la scena rinominata o cestinata; una cartella chiamata "export" dentro Ricerca o Bibbia non sparisce più; i link scritti come `<https://…>` restano nell'esportazione; il CSS dell'EPUB si salva da solo; Esc mentre si rinomina una scheda annulla davvero.

## 0.1.37 · 20 ottobre 2026

- **Importare da Word**: i capitoli scritti come un numero centrato con il titolo sotto diventano capitoli con il loro titolo. Le righe vuote dentro un paragrafo non fanno più comparire codice come `<span style=…>`, e quando le scene sono separate da `***` le righe vuote non le dividono più.

## 0.1.36 · 20 ottobre 2026

- **macOS 10.15 Catalina**: Dante usa il motore di Safari aggiornato invece di quello di Safari 13 che Catalina dà alle app e con cui la finestra non si apriva. È una soluzione in prova: se Dante non parte, il rapporto di avvio dice cosa manca.

## 0.1.35 · 20 ottobre 2026

- **Importare da Word su macOS Catalina**: l'importazione di un file .docx funziona anche con Safari 15, mentre prima dava errore.
- **Rapporto per segnalare un problema**: se Dante non riesce ad avviarsi mostra un rapporto da copiare invece della finestra vuota; lo stesso rapporto si copia da Impostazioni > Segnalare un problema.

## 0.1.34 · 18 ottobre 2026

- **macOS 10.15 Catalina**: Dante si apre anche sui Mac Intel con Catalina, purché Safari sia aggiornato alla versione 15.6. Prima la finestra restava bianca. Sui sistemi più recenti non cambia nulla.

## 0.1.32 · 17 ottobre 2026

- **Elenchi**: il testo delle voci di un elenco puntato, numerato o di caselle rientra dopo il punto, il numero o la casella, e le righe che vanno a capo si allineano sotto il testo. Le voci annidate rientrano di un livello. Lo stesso rientro c'è in Word, PDF ed EPUB; l'esportazione Markdown scrive elenchi Markdown.
- **Novità**: a ogni versione, l'avviso di aggiornamento elenca cosa cambia (questa pagina, in italiano o in inglese secondo la lingua di Dante).
