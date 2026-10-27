# Rilasci di Dante

Come escono le versioni di Dante: numeri, canali, rami, novità e i passi per pubblicare, tutti dal sito di GitHub, senza terminale.

## Numeri di versione

Dante segue il [versionamento semantico](https://semver.org/lang/it/), `maggiore.minore.correzione`:

- **Correzione** (1.0.**1**): solo difetti corretti, nessuna funzione nuova. Va direttamente nel canale stabile.
- **Minore** (1.**1**.0): funzioni nuove. Prima esce in beta, `1.1.0-beta.1`, `1.1.0-beta.2`…, poi come `1.1.0`.
- **Maggiore** (**2**.0.0): file dei progetti o comportamenti non più compatibili con le versioni precedenti, per esempio un `dante.yaml` che una 1.x non sa leggere.

Le versioni fino alla 0.1.49 avevano un numero per ogni compilazione di main; dalla 1.0.0 il numero lo decide il workflow Release.

Il numero sta in `package.json`, e da lì lo leggono l'app (`tauri.conf.json` punta a `package.json`) e la versione web. Non si cambia a mano: lo scrive il workflow Release.

## Canali

In **Impostazioni** > **Dante su questo computer** > **Aggiornamenti** c'è il canale:

- **Stabile** (di base) cerca l'ultima release ufficiale di GitHub (`releases/latest/download/latest.json`). Non riceve mai una beta.
- **Beta** legge l'elenco delle release e prende la versione più alta, beta o stabile: chi è in beta riceve anche le correzioni della stabile quando sono più recenti della sua beta.

Senza una scelta, chi ha installato una beta resta in Beta e tutti gli altri sono in Stabile. Passare da Beta a Stabile non torna indietro di versione: si resta sulla beta installata finché non esce una stabile più alta.

La scelta è salvata con le altre impostazioni dell'app, sul computer (non nella cartella del romanzo). Il controllo lo fa `check_update` in `src-tauri/src/updates.rs`, che passa all'updater di Tauri l'indirizzo del `latest.json` della release scelta; scaricamento, verifica della firma e installazione restano quelli del plugin.

La barra dell'aggiornamento ha **Novità**, **Aggiorna e riavvia**, **Salta questa versione** (i controlli automatici non la propongono più; **Cerca aggiornamenti** la mostra comunque) e **Ricordamelo più tardi** (torna al prossimo avvio).

Le copie 0.1.x cercano gli aggiornamenti solo nella vecchia release `preview`: a ogni stabile il workflow Builds vi carica il `latest.json` della nuova versione, così anche quelle copie arrivano all'ultima stabile e da lì scelgono il canale.

## Rami

- **main** porta la prossima versione minore: in `package.json` c'è per esempio `1.1.0`, e da main escono le beta `1.1.0-beta.N` e poi la `1.1.0`.
- **release/x.y** nasce dal tag `vx.y.0` (lo crea il workflow Release quando pubblica la stabile) e riceve solo le correzioni della stabile. Da lì escono `x.y.1`, `x.y.2`…
- Una correzione fatta su `release/x.y` va portata anche in main, con una pull request che contiene la stessa modifica e la sezione `## x.y.z` già scritta nelle novità (non la riga sotto Prossima versione, che la ripeterebbe nella minore successiva). Non si unisce l'intero ramo, perché `package.json` ha numeri diversi.

## Novità

Le novità sono in [`novita.md`](novita.md) (italiano) e [`whats-new.md`](whats-new.md) (inglese), scritte per chi usa l'app, non per chi la programma. Dante le mostra nella barra dell'aggiornamento e in Aiuto > Novità, la release su GitHub le riporta.

Chi unisce una modifica visibile aggiunge una riga in entrambi i file, sotto **Prossima versione** / **Next version**, nel gruppo giusto:

| Italiano | English | Cosa |
| --- | --- | --- |
| `### Nuovo` | `### New` | una funzione nuova |
| `### Cambiato` | `### Changed` | qualcosa che funziona in modo diverso |
| `### Corretto` | `### Fixed` | un difetto corretto |

Ogni riga è `- **Titolo breve**: cosa cambia, detto in modo semplice.`

Quando esce una versione, il workflow Release sposta quelle righe sotto `## 1.1.0-beta.2 · 3 novembre 2026` (e `## 1.1.0-beta.2 · November 3, 2026`). Una minore stabile, `1.1.0`, raccoglie anche le righe di tutte le sue beta, divise in Nuovo, Cambiato e Corretto: chi passa dalla 1.0 alla 1.1 legge tutto in un posto solo. Le sezioni delle beta restano nei file. Una sezione già scritta a mano per la versione viene lasciata com'è. Il lavoro lo fa `.github/news.py`.

## Pubblicare una versione

Tutto da **Actions** > **Release** > **Run workflow** sul sito di GitHub.

1. Controlla che il ramo sia quello giusto e che le modifiche ci siano: su GitHub apri il ramo (main o `release/x.y`) e guarda l'ultimo commit (l'equivalente di `git log -1`). Il workflow scrive lo stesso commit nel riepilogo della sua esecuzione.
2. In **Use workflow from** scegli il ramo:
   - **main** con **beta** pubblica la prossima beta, per esempio `1.1.0-beta.3`;
   - **main** con **stable** pubblica la minore, `1.1.0`, crea il ramo `release/1.1` e porta main a `1.2.0`;
   - **release/1.1** pubblica la prossima correzione, `1.1.1` (la scelta beta/stable non conta).
3. Premi **Run workflow**. Il workflow:
   - si ferma se il tag esiste già o se le novità non dicono niente per la versione;
   - scrive le novità sotto il titolo della versione e la versione in `package.json`, fa un commit sul ramo e crea il tag `v<versione>`;
   - avvia il workflow **Builds** su quel tag (un tag creato con il token dell'azione non avvia altri workflow da solo, quindi lo avvia a mano).
4. Builds compila i pacchetti per Mac, Windows e Linux (circa mezz'ora), poi pubblica la release del tag con le novità della versione: una **pre-release** se il numero ha il trattino (`1.1.0-beta.1`), altrimenti la **latest** di GitHub. Nella release mette `latest.json`, che le copie installate leggono. Infine avvia **Web**.
5. Web ricostruisce il sito: l'ultima stabile in `/app`, la versione più alta (beta o stabile) in `/beta`.

Se Builds non riesce (per esempio una compilazione si interrompe), il tag resta: si corregge il problema e si riavvia **Actions** > **Builds** > **Run workflow** scegliendo il tag in **Use workflow from**. Se il problema è nel codice, conviene una nuova versione: correggere, unire e pubblicare di nuovo.

## Provare una compilazione

**Actions** > **Builds** > **Run workflow** su un ramo qualsiasi compila i pacchetti senza pubblicarli: si scaricano dagli artifact dell'esecuzione. Serve per provare una modifica prima di unirla. Il workflow non parte più da solo a ogni modifica di main: i test girano comunque in **CI**.

## File

| File | Cosa fa |
| --- | --- |
| `.github/workflows/release.yml` | calcola la versione, scrive novità e `package.json`, crea il tag, avvia Builds |
| `.github/workflows/builds.yml` | compila, pubblica la release del tag, aggiorna la `preview` per le copie 0.1.x, avvia Web |
| `.github/workflows/web.yml` | sito, `/app` e `/beta` |
| `.github/news.py` | novità: sezione della versione, storico per l'app, testo della release |
| `.github/latest-json.py` | `latest.json` con i file firmati per ogni sistema |
| `src-tauri/src/updates.rs` | quale release legge ciascun canale |
| `src/lib/updates.svelte.ts` | controllo, Salta questa versione, confronto tra versioni |
