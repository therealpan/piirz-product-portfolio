# Audit UX/UI — PiirZ Product Portfolio

**Versione**: 2.0 — aggiornata il 10 marzo 2026
**Analisi su**: `capabilities.piirz.eu` (index.html) + Admin Panel (`/admin/`)
**Verificato su**: Desktop (1280×800), Mobile (390×844)
**Novità in v2**: Sezione 9 — analisi completa della nuova area Dettagli Prodotto (contenuto B2B arricchito)

---

## 1. Performance & Loading

### 🔴 Criticità alta
- **Il sito carica `products.json` (93KB) dal file statico locale, non dal Worker API.** La riga 348 fa `fetch('data/products.json')` — il `API_BASE` è configurato ma usato solo per il logging, non per il fetch dei prodotti. Il sito funziona ma non beneficia della possibilità di aggiornamento dinamico via admin: i cambiamenti fatti nell'admin panel (che scrive su KV) non si riflettono sul sito pubblico finché non si aggiorna manualmente il file statico.
  - **Fix**: Aggiungere fallback: provare prima `API_BASE + '/api/products'`, poi fallback a `data/products.json`
- **Nessun loading state**: Se il JSON tarda a caricare, l'utente vede una pagina vuota senza feedback. Serve uno skeleton loader o spinner.

### 🟡 Criticità media
- **Font Awesome caricato integralmente** (250KB+ CSS): si usano circa 30 icone. Valutare un subset o il passaggio a Lucide/Phosphor (tree-shakable).
- **Google Fonts caricato senza `font-display: swap`**: rischio di FOIT (Flash of Invisible Text). Il `display=swap` è nel URL ma andrebbe verificato che il rendering non blocchi.
- **Nessun lazy loading per le card**: tutte le 38 card vengono renderizzate nel DOM immediatamente. Con `IntersectionObserver` si potrebbe differire il rendering delle card sotto la piega.

---

## 2. Accessibilità (a11y)

### 🔴 Criticità alta
- **Nessun attributo `aria-label` sui bottoni icona**: i pulsanti "Dettagli", "Richiedi info" hanno testo visibile ma i chip filtro e il bottone di chiusura del modal (`×`) non hanno `aria-label`.
- **Il modal non gestisce il focus trap**: quando si apre il modal, il focus non viene spostato al suo interno, e Tab può navigare elementi dietro l'overlay. Serve `focus-trap` o gestione manuale del focus.
- **Chip filtro non sono `<button>`**: sono `<span>` con click handler — non raggiungibili da tastiera e non annunciati correttamente dagli screen reader. Dovrebbero essere `<button role="option">` o `<button aria-pressed="true/false">`.
- **Contrasto insufficiente**: `--text-muted: #6b7280` su `--bg: #050608` ha un ratio di circa 4.1:1, sotto il minimo WCAG AA di 4.5:1 per testo piccolo. I label dei filtri (`CATEGORIA`, `SETTORE`) sono ancora più dim a `opacity: 0.6`.

### 🟡 Criticità media
- **Manca `<main>` landmark**: il contenuto principale non è wrappato in `<main>`, rendendo difficile la navigazione con screen reader.
- **Manca `<nav>` per i filtri**: la sezione filtri andrebbe marcata come `<nav aria-label="Filtri prodotti">`.
- **Il language selector non è accessibile da tastiera**: il dropdown si apre solo su click, non su Enter/Space quando il bottone ha focus.
- **Manca `skip-to-content` link**: utenti da tastiera devono tabbare attraverso header, lang, search, CTA e tutti i filtri prima di raggiungere i prodotti.

---

## 3. Mobile & Responsive

### 🟡 Criticità media
- **Il titolo H1 "Capacità Progettuali" va a capo in modo sgradevole** su viewport medie (1136px): "Prodotti &" su una riga, "Capacità Progettuali" su un'altra. Il `<span>` con gradiente spezza il flusso visivo. Considerare `white-space: nowrap` sul blocco gradiente o riformulare il titolo più corto.
- **I filtri su mobile occupano molto spazio verticale**: 3 gruppi di chip (categoria, settore, tecnologia) con 21 chip totali richiedono molto scroll. Considerare un filtro collassabile o un drawer/sheet laterale.
- **La CTA email sotto la search bar è troppo vicina**: su mobile, CTA + search + filtri occupano l'intero viewport prima di vedere qualsiasi prodotto. L'utente deve fare 3-4 scroll per raggiungere la prima card.
- **Il badge "PORTAFOGLIO PRODOTTI 2025" è nascosto su mobile** (`display: none` sotto 768px) — va bene, ma il layout shift è visibile.

### 🟢 Funziona bene
- Le card passano a single-column sotto 768px ✓
- Il modal si adatta con padding ridotto ✓
- I chip wrappano correttamente ✓

---

## 4. Interazione & Micro-interazioni

### 🔴 Criticità alta — aggiornata in v2
- **Il modal aveva contenuto duplicato**: la descrizione breve della card e l'assenza di dettagli rendevano il click su "Dettagli" sostanzialmente inutile. Con il nuovo contenuto B2B (descritto in Sezione 9 del report), questo punto è strutturalmente risolto — restano però le criticità CSS di rendering documentate in Sezione 9.

### 🟡 Criticità media
- **Nessuna animazione di apertura/chiusura del modal**: appare/scompare istantaneamente con `display:none/flex`. Serve una transizione CSS (`opacity` + `transform: scale`) per un'esperienza più fluida.
- **Nessun feedback visivo quando si clicca un filtro**: i chip cambiano stato ma non c'è micro-animazione (es. ripple, pulse) che confermi l'azione.
- **Il contatore "Mostrando 38 soluzioni" non anima il cambio**: quando si filtra e il numero scende da 38 a 5, il cambio è istantaneo. Un counter animato darebbe più feedback.
- **Le card non hanno stato hover su mobile**: `transform: translateY(-3px)` funziona solo su desktop. Su touch, le card non danno feedback tattile (es. `:active` con leggera scala).

---

## 5. UX Pattern & Information Architecture

### 🔴 Criticità alta
- **La divisione "Prodotti Esistenti" / "Capacità Progettuali" non è chiara per l'utente**: un visitatore non capisce la differenza senza contesto. Suggerimento: aggiungere una breve frase sotto ciascun divider (es. "Soluzioni già disponibili e deployabili" vs "Competenze attivabili su progetto") oppure usare icone distintive.
- **Nessun modo per condividere o linkare un prodotto specifico**: se un utente vuole mandare il link a "SwarmOS" a un collega, non può. Serve un hash routing (`#swarmOS`) che apra automaticamente il modal del prodotto.

### 🟡 Criticità media
- **I filtri sono AND tra gruppi ma non è comunicato**: se seleziono "Piattaforme" + "Enterprise", vedo solo i prodotti che matchano entrambi — ma l'utente non sa se è un AND o un OR. Aggiungere un indicatore visivo dei filtri attivi (es. "Piattaforme + Enterprise" come breadcrumb).
- **Nessun ordinamento**: i prodotti sono in ordine fisso dal JSON. Aggiungere almeno un sort per nome A-Z / Z-A.
- **La search non evidenzia i risultati**: quando cerco "RAG", le card che matchano appaiono ma il termine non è evidenziato nel testo.
- **Manca un footer**: il sito termina bruscamente dopo l'ultima card. Serve un footer con: link a piirz.com, social, copyright, link admin.

---

## 6. Visual Design

### 🟡 Criticità media
- **Le icone dei prodotti non si distinguono bene tra loro**: con 8 colori e ~30 icone FontAwesome diverse, molte card si assomigliano visivamente. Considerare illustrazioni custom o icone più distintive per i prodotti flagship (SwarmOS, AI Discovery, etc.).
- **I tag tecnologici sono tutti dello stesso stile**: LLM, RAG, Computer Vision, ML — tutti grigi allo stesso modo. Colorare per categoria tecnologica aiuterebbe la scansione visiva.
- **Troppo spazio vuoto tra hero e prima card**: su desktop, l'utente vede hero → search → CTA → filtri → contatore → divider prima della prima card. Sono ~700px di "above the fold" senza prodotti. Valutare di compattare hero + filtri o rendere i filtri sticky.

### 🟢 Punti di forza
- Il design system è coerente (variabili CSS, palette, tipografia) ✓
- Il gradiente arancio-rosa-viola è un forte brand identifier ✓
- Dark mode nativo, ben eseguito ✓
- Le animazioni fadeUp/cardIn danno profondità ✓

---

## 7. Admin Panel

### 🔴 Criticità alta
- **Nessuna conferma prima di navigare via dall'editor**: se l'utente sta modificando un prodotto e clicca "Back" o cambia pagina, perde tutto senza warning. Serve un `beforeunload` handler o un dialog "Hai modifiche non salvate".
- ~~**L'upload degli attachment non funziona**~~ — **✅ Risolto in v2**: R2 bucket `piirz-attachments` ripristinato, endpoint `/api/upload` (POST), `/api/upload/:id` (DELETE) e `/api/file/*` (GET pubblico) sono operativi. Il bottone "Click or drag file to upload" nell'admin funziona correttamente.

### 🟡 Criticità media
- **La tabella prodotti non è paginata**: 38 righe sono gestibili, ma se il catalogo cresce serve paginazione o virtual scrolling.
- **L'editor non ha preview live**: l'utente scrive HTML nel tab "Details" ma non vede come apparirà. Aggiungere un toggle "Preview" che renderizzi l'HTML.
- **Non c'è modo di aggiungere un nuovo prodotto**: l'admin può solo editare prodotti esistenti, non crearne di nuovi. Serve un bottone "+ Add Product".
- **Non c'è modo di riordinare i prodotti**: l'ordine nel JSON determina l'ordine sul sito. Serve drag-and-drop o almeno up/down arrows.
- **La sessione scade silenziosamente**: il token HMAC dura 24h, poi il 401 fa un `location.reload()` che riporta al login senza spiegazione. Meglio mostrare "Sessione scaduta — effettua nuovamente il login".

---

## 8. SEO & Meta

### 🟡 Criticità media
- **`og:url` e `canonical` puntano ancora a GitHub Pages**: `therealpan.github.io/piirz-product-portfolio/` invece di `capabilities.piirz.eu`. Questo penalizza SEO e share social.
- **La `meta description` è solo in italiano**: per un sito multilingua, la description non cambia con la lingua. Considerare tag `hreflang` per le varianti linguistiche.
- **Manca `structured data` (JSON-LD)**: un markup `Organization` + `Product` migliorerebbe la presenza nei risultati Google.
- **Le pagine prodotto non hanno URL propri**: Google non può indicizzare i singoli prodotti perché sono tutti nella stessa pagina. Con hash routing + prerendering SSR si potrebbe migliorare.

---

## 9. Area Dettagli Prodotto — Analisi Post-Arricchimento B2B

*Nuova sezione in v2: analisi del rendering, UX e i18n della sezione `details.it.html` arricchita con contenuto B2B strutturato (4 blocchi per prodotto: descrizione estesa, casi d'uso, target, esclusioni).*

### 🔴 Criticità alta

- **CSS non copre i nuovi elementi HTML nel modal**: `.modal-details` ha regole solo per `a` e `img` figli. Non esistono regole per `p.lead`, `h4`, `ul`, `li`, né per `strong` inline nei `<li>`. Il risultato è che i titoli di sezione (`h4`) appaiono con il font browser di default (serif o size errato), le liste `<ul>` usano bullet e indent di default senza integrazione con il design system dark, e il `p.lead` è visivamente identico al `p` normale — nessuna enfasi tipografica che giustifichi la sua posizione introduttiva.
  - **Fix CSS necessari** (`.modal-details` scope):
    - `h4`: `font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin: 1.2rem 0 0.4rem; font-weight: 600;`
    - `ul`: `padding-left: 1.2rem; margin: 0.4rem 0 0.8rem; list-style: none;`
    - `li`: `position: relative; padding-left: 1rem; margin-bottom: 0.5rem; line-height: 1.5;` + `li::before { content:"–"; position: absolute; left: 0; color: var(--accent); }`
    - `p.lead`: `font-size: 1.05rem; line-height: 1.7; color: var(--text); margin-bottom: 1.2rem; font-weight: 400;`
    - `li strong`: `color: var(--text); font-weight: 600;`

- **Contenuto duplicato tra `modalDesc` e `p.lead`**: Il modal renderizza prima `#modalDesc` (la descrizione breve della card, da `product.description.it`) e poi `#modalDetailsSection` che inizia con `<p class="lead">` — una versione espansa della stessa idea. Un visitatore legge due volte il concetto introduttivo del prodotto in linguaggi diversi ma con lo stesso significato, immediatamente adiacenti. Questo crea friction cognitiva e spreca spazio visivo prezioso.
  - **Fix**: Nascondere `#modalDesc` quando `details.html` non è vuoto, oppure usare `p.lead` come sostituto diretto di `modalDesc` (rendere `modalDesc` visibile solo quando non ci sono dettagli).

- **Titoli di sezione hardcoded in italiano**: Le stringhe "Casi d'uso", "A chi è rivolto", "Cosa non include" sono scritte direttamente nell'HTML dentro `details.it.html`. Quando l'utente cambia lingua (EN/FR/DE/ES), il contenuto `details.it.html` viene mostrato invariato — i titoli restano in italiano anche se l'interfaccia è in inglese. Il sito è B2B multilingua: questo è un problema di coerenza per utenti non italiani.
  - **Fix strutturale**: Separare i titoli di sezione dalla stringa HTML. Due approcci: (a) usare data attributes (`data-section="use-cases"`) che il JS traduce in base alla lingua corrente; (b) standardizzare una struttura JSON per i details (`{ lead, useCases, target, exclusions }`) invece di HTML libero, con titoli gestiti dal template JS.

### 🟡 Criticità media

- **"Cosa non include" non ha affordance visiva negativa**: La sezione delle esclusioni è presentata con lo stesso stile neutro degli altri blocchi. Per un potenziale cliente, le esclusioni sono informazioni critiche che influenzano la decisione di acquisto. L'assenza di segnale visivo (colore caution, icona warning, bordo sinistro colorato) fa sì che il blocco si mimetizzi con il resto.
  - **Fix**: Aggiungere `.modal-details h4.exclusions { color: var(--text-muted); }` con un'icona `⚠` o un bordo sinistro `border-left: 2px solid #f59e0b` per dare contesto senza allarmismo eccessivo.

- **CTA di contatto compare dopo il contenuto negativo**: La struttura attuale è: descrizione → casi d'uso → target → **esclusioni** → CTA email. Il bottone di contatto appare subito dopo aver letto "cosa non include", che psicologicamente è il momento di minima motivazione. Invertire l'ordine — mettere la CTA dopo il target e prima delle esclusioni — massimizzerebbe la conversion rate.

- **Nessuna navigazione interna per modal con contenuto lungo**: Con ~300-400 parole per prodotto, il modal richiede 3-5 scroll su mobile (390×844). Non ci sono anchor link, tabs interni, o un indice cliccabile delle sezioni. Su desktop il problema è meno grave, ma su mobile l'utente non sa quanto contenuto manca senza scorrere.
  - **Fix leggero**: Aggiungere un indicatore di progresso scroll verticale (`position: sticky; top: 0`) o convertire i 4 blocchi in tab (`Panoramica | Casi d'uso | Per chi | Limiti`).

- **Nessun header sticky nel modal**: Il titolo del prodotto (`#modalTitle`) e l'icona colorata scompaiono non appena si inizia a scorrere il contenuto dei dettagli. Su contenuti lunghi, l'utente perde il contesto di quale prodotto sta leggendo.
  - **Fix**: Rendere `.modal-header` `position: sticky; top: 0; z-index: 10; background: var(--card-bg);` con un leggero `box-shadow` per la separazione.

- **I `<strong>` dei settori nei casi d'uso sono sottodimensionati**: La struttura `<li><strong>Settore assicurativo:</strong> testo...</li>` enfatizza il settore in grassetto, ma senza `color` il contrasto rispetto al testo normale è minimo su dark background. I label di settore dovrebbero avere `color: var(--accent)` o un colore secondario per creare la gerarchia visiva voluta.

- **Il modal non mostra un indicatore di loading per i dettagli**: Se in futuro i dettagli venissero caricati lazy (da API), non c'è nessuno skeleton o spinner nel `#modalDetailsSection`. Già oggi c'è un microsecondo di parsing HTML che su dispositivi lenti può essere percepibile.

### 🟡 Admin Panel — Criticità specifica per i dettagli

- **L'editor HTML non ha schema/template**: Il campo `<textarea id="detailsHtml">` nell'admin panel non fornisce alcun suggerimento sulla struttura attesa (4 blocchi, tag usati, classi necessarie). Un editor admin che deve produrre HTML conforme a un'architettura specifica richiede almeno: (a) un pulsante "Inserisci template" che prepopoli la struttura base, (b) un tooltip o documentation link, (c) idealmente un editor WYSIWYG come TipTap o Quill configurato con solo i tag ammessi.
  - **Fix minimo**: Aggiungere un `placeholder` al textarea con la struttura HTML di esempio, e un `<details>` collassabile con le istruzioni di formattazione.

- **I dettagli EN/FR/DE/ES sono tutti vuoti**: Il pannello admin consente la modifica per lingua, ma il copywriting B2B è stato generato solo per `it`. Quando la lingua del sito è EN, il modal mostra l'`html` del fallback (vuoto) invece del contenuto italiano. Non c'è segnale nell'admin che ricordi all'utente quali lingue mancano.
  - **Fix**: Aggiungere nel tab Details dell'admin un badge per ogni lingua con stato (✅ compilato / ⚠️ mancante), e considerare una logica di fallback nel frontend (`details[lang].html || details['it'].html || ''`).

### 🟢 Punti di forza — Nuovi contenuti B2B

- Struttura in 4 blocchi è coerente per tutti i 38 prodotti ✓
- Le descrizioni estese (80–106 parole) sono calibrate per B2B senza eccessi promozionali ✓
- I casi d'uso anonimizzati per settore danno contesto concreto senza rivelare clienti ✓
- La sezione "Cosa non include" differenzia il prodotto e filtra aspettative — scelta strategica coraggiosa ✓
- Il linguaggio è uniforme: no prezzi, no tempistiche, formulazioni aperte per complessità variabile ✓

---

## Priorità di implementazione suggerita

| # | Miglioramento | Sezione | Impatto | Effort |
|---|--------------|---------|---------|--------|
| 1 | Fix CSS `.modal-details` per `h4`, `ul`, `li`, `p.lead`, `strong` | §9 | Alto | Basso |
| 2 | Fix fetch prodotti da Worker API con fallback statico | §1 | Alto | Basso |
| 3 | Eliminare contenuto duplicato `modalDesc` + `p.lead` | §9 | Alto | Basso |
| 4 | Deep link ai prodotti (`#key`) | §5 | Alto | Basso |
| 5 | Fix canonical/og:url a capabilities.piirz.eu | §8 | Alto | Basso |
| 6 | Chip filtro da `<span>` a `<button>` + aria | §2 | Alto | Basso |
| 7 | i18n titoli sezione dettagli (data-attr o JSON strutturato) | §9 | Alto | Medio |
| 8 | Fallback lingua nei dettagli (`details[lang] \|\| details['it']`) | §9 | Alto | Basso |
| 9 | Focus trap nel modal | §2 | Alto | Medio |
| 10 | Conferma "modifiche non salvate" nell'admin | §7 | Alto | Basso |
| 11 | Template/schema HTML nell'editor admin Details | §9 | Medio | Basso |
| 12 | Badge lingue mancanti nell'admin per i dettagli | §9 | Medio | Basso |
| 13 | Loading skeleton/spinner al caricamento JSON | §1 | Medio | Basso |
| 14 | Animazione apertura/chiusura modal | §4 | Medio | Basso |
| 15 | Riordinare CTA prima di "Cosa non include" nel modal | §9 | Medio | Basso |
| 16 | Affordance visiva per "Cosa non include" (bordo/colore) | §9 | Medio | Basso |
| 17 | Modal header sticky su scroll | §9 | Medio | Basso |
| 18 | Sottotitoli per divider sezioni prodotti | §5 | Medio | Basso |
| 19 | Footer con link e copyright | §5 | Medio | Basso |
| 20 | Contrasto colori WCAG AA | §2 | Medio | Basso |
| 21 | Skip-to-content link | §2 | Medio | Basso |
| 22 | Filtri collapsible su mobile | §3 | Medio | Medio |
| 23 | Preview HTML nell'editor admin | §7 | Medio | Medio |
| 24 | JSON-LD structured data | §8 | Medio | Medio |
| 25 | Navigazione interna modal (tab o indice sezioni) | §9 | Basso | Medio |
| 26 | Subset FontAwesome o icone alternative | §6 | Basso | Alto |
