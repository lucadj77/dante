# Provare Dante

Grazie di aver accettato di provare Dante. Questa pagina spiega come scaricarlo, installarlo, tenerlo aggiornato e segnalare i problemi.

Dante è un programma per scrivere romanzi. Il romanzo è una normale cartella di file di testo (Markdown), che si apre anche in Obsidian o in qualsiasi editor. Come si usa è spiegato nella [guida all'uso](guida.md).

## Prima di cominciare

Questa è una versione di prova: funziona, ma può contenere errori.

- **Lavora su una copia.** Se vuoi provare Dante su un romanzo a cui tieni, duplica prima la cartella (o il file Word da importare) e apri la copia. Dante salva da solo mentre scrivi, quindi un errore del programma può finire subito nei file.
- Per fare pratica senza rischi c'è il **progetto di esempio**, nella schermata iniziale.
- Le istantanee (capitolo 7 della guida) conservano versioni precedenti delle scene, ma non sostituiscono una copia di sicurezza.

## Scaricare Dante

Tutti i file sono nella pagina delle [versioni](https://github.com/lucadj77/dante/releases), sotto **Assets**: l'[ultima versione stabile](https://github.com/lucadj77/dante/releases/latest), oppure la beta più recente (le versioni con *beta* nel nome, segnate **Pre-release**). Scarica solo il file del tuo sistema:

| Sistema | File da scaricare |
| --- | --- |
| Mac con chip Apple (M1 o successivi, dal 2020) | `Dante-…-mac-apple-silicon.dmg` |
| Mac con processore Intel | `Dante-…-mac-intel.dmg` |
| Windows 10 o 11 | `Dante-setup-….exe` |
| Windows, senza installare | `Dante-portable-….zip` |
| Linux (quasi tutte le distribuzioni) | `Dante-…-x86_64.AppImage` |
| Ubuntu, Debian | `Dante-…-amd64.deb` |
| Fedora, openSUSE | `Dante-…-x86_64.rpm` |

Gli altri file della pagina (quelli che finiscono con `.sig`, `.app.tar.gz` e `latest.json`) servono all'aggiornamento automatico: non vanno scaricati.

Per sapere che Mac hai, apri il menu Apple (la mela in alto a sinistra) > **Informazioni su questo Mac**: se compare "Chip Apple M…" scegli apple-silicon, se compare "Intel" scegli intel.

## Installare Dante

Dante non è ancora firmato da Apple né da Microsoft. Per questo, la prima volta, il sistema mostra un avviso: è normale e si supera una volta sola.

### Mac

1. Apri il file .dmg con un doppio clic.
2. Trascina l'icona di Dante sulla cartella **Applicazioni**.
3. Apri Dante dalla cartella Applicazioni. macOS lo blocca dicendo che non può verificarne lo sviluppatore: premi **Fine** (o **OK**).
4. Apri **Impostazioni di Sistema** > **Privacy e sicurezza**, scorri in basso fino al messaggio su Dante e premi **Apri comunque**. Conferma con la password del Mac.
5. Riapri Dante: da qui in poi si apre normalmente.

Sulle versioni di macOS precedenti a Sequoia (15) basta anche fare clic con il tasto destro su Dante in Applicazioni e scegliere **Apri**.

### Windows

1. Apri `Dante-setup-….exe` con un doppio clic.
2. Compare la finestra blu "Windows ha protetto il PC": premi **Ulteriori informazioni**, poi **Esegui comunque**.
3. Segui l'installazione. Dante compare nel menu Start.

La versione portatile non si installa: estrai lo zip dove vuoi (anche su una chiavetta) e avvia `Dante.exe` nella cartella estratta. Anche qui può comparire l'avviso di SmartScreen.

### Linux

- **AppImage**: rendi il file eseguibile (tasto destro > Proprietà > Permessi, oppure `chmod +x` nel terminale) e aprilo.
- **.deb** e **.rpm**: aprili con il gestore dei pacchetti della tua distribuzione.

## Senza installare

Se non puoi installare Dante (per esempio su un Mac con Catalina), aprilo con Chrome, Edge o Brave all'indirizzo https://dante.lucadj.eu/app/ (in https://dante.lucadj.eu/beta/ c'è l'ultima versione di prova). È lo stesso programma, senza PDF e con alcuni limiti descritti nel capitolo 18 della [guida](guida.md#18-dante-nel-browser).

## Primo avvio

1. Nella schermata iniziale scegli **Prova il progetto di esempio**, oppure crea un nuovo progetto, apri una cartella o importa un romanzo da Word (sempre una copia).
2. Apri le **Impostazioni** (l'ingranaggio nella barra a sinistra) e scrivi **il tuo nome**.
3. I primi cinque capitoli della [guida](guida.md) bastano per cominciare.

## Aggiornamenti

Quando esce una nuova versione, Dante lo dice all'avvio con un riquadro in basso a destra: premi **Novità** per leggere cosa cambia, poi **Aggiorna e riavvia**. Dante salva il testo, scarica la nuova versione, la installa e si riapre. Con **Ricordamelo più tardi** il riquadro torna all'avvio successivo; con **Salta questa versione** aspetta la prossima.

Per provare le novità prima che escano, in **Impostazioni** > **Aggiornamenti** scegli il canale **Beta**: riceverai le versioni ancora in prova, che sono quelle su cui le tue segnalazioni servono di più. Con **Stabile** ricevi solo le versioni ufficiali.

Tutte le novità, versione per versione, sono nella pagina [Novità](novita.md) ([What's new](whats-new.md) in inglese).

Puoi controllare anche a mano: **Impostazioni** > **Aggiornamenti** > **Cerca aggiornamenti**. Lì trovi anche il numero della versione installata.

La versione portatile per Windows non si aggiorna da sola: scarica il nuovo zip dalla pagina delle [versioni](https://github.com/lucadj77/dante/releases) e sostituisci la cartella, tenendo la sottocartella `dante-data` con le tue impostazioni.

## Segnalare problemi e idee

Scrivi a Luca, all'indirizzo email con cui ti ha invitato a provare Dante. Per ogni problema sono utili:

- il sistema (Mac, Windows o Linux) e la **versione di Dante** (Impostazioni > Aggiornamenti);
- il **rapporto di Dante**: in Impostazioni > Segnalare un problema premi **Copia il rapporto** e incollalo nel messaggio. Contiene la versione, le funzioni del motore che disegna la finestra e gli errori avvenuti, niente dei tuoi testi. Se Dante non riesce ad avviarsi, dopo qualche secondo mostra lui stesso il rapporto con lo stesso pulsante;
- cosa stavi facendo, passo per passo, e cosa ti aspettavi che succedesse;
- cosa è successo invece, con una schermata se possibile;
- se il problema riguarda un romanzo in particolare e puoi condividerlo, la cartella del progetto compressa in uno zip (o il file Word, se il problema è nell'importazione).

Sono benvenute anche le impressioni generali: cosa è scomodo, cosa manca, cosa non si capisce.
