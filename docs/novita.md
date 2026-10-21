# Novità di Dante

Cosa cambia in ogni versione di Dante, dalla più recente. Le stesse note compaiono nella pagina della versione su GitHub e nell'avviso di aggiornamento dentro Dante. In inglese: [What's new](whats-new.md).

## Prossima versione

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
