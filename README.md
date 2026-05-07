# YouTube Insights RAG

Monorepo con **front-end Next.js**, **API gateway** e **microservizi Node** (tra cui il servizio che sincronizza gli ultimi video YouTube in **PostgreSQL**).

## Requisiti

- **Node.js** 20+ (consigliato LTS) e **npm**
- **Docker Desktop** (o Docker Engine + Compose) per PostgreSQL in locale

## Prima configurazione

1. **Clona il repository** e dalla radice del progetto installa le dipendenze di tutti i workspace:

   ```bash
   npm install
   ```

2. **Variabili d’ambiente**: copia il template e rinomialo `.env.local` nella **radice del repo** (stesso livello di `package.json`):

   ```bash
   copy .env.example .env.local
   ```

   Su PowerShell puoi usare `Copy-Item .env.example .env.local`. Il file `.env.local` è ignorato da Git e non va committato.

3. Controlla almeno queste voci in `.env.local` (i default vanno bene in locale):

   - `DATABASE_URL` — deve puntare al Postgres avviato con Docker Compose
   - `YOUTUBE_CHANNEL_HANDLE` — handle **senza `@`** del canale *Ingegneri in Borsa*: `Ingegneriinborsa` → [youtube.com/@Ingegneriinborsa](https://www.youtube.com/@Ingegneriinborsa/videos). Il canale *Ingegneria Italia* è un altro progetto ([@IngegneriaItalia](https://www.youtube.com/@IngegneriaItalia)); non configurarlo qui se vuoi solo Ingegneri in Borsa.
   - `API_GATEWAY_INTERNAL_URL` — usato dal front-end in build/SSR per parlare col gateway (di solito `http://127.0.0.1:4000`)

## Avvio di PostgreSQL

Avvia Docker Desktop, poi dalla radice del repo:

```bash
docker compose up -d
```

Questo crea un database PostgreSQL 16 con utente `youtube`, password `youtube`, database `youtube_insights`. Sul **computer host** la porta pubblicata è **5433** (il contenitore resta su 5432) per evitare conflitti con un eventuale PostgreSQL già installato su Windows che usa spesso la porta **5432**.

L’URL predefinito in `.env.example` è quindi `...@127.0.0.1:5433/youtube_insights`.

Per fermare i container:

```bash
docker compose down
```

## Come avviare l’applicazione (sviluppo)

Dalla **radice del repository** (non dalla cartella `frontend`):

```bash
npm run dev
```

Questo comando avvia in parallelo:

| Servizio              | Porta | Ruolo |
|----------------------|-------|--------|
| Front-end Next.js    | **3000** | Interfaccia web |
| API gateway          | **4000** | Instrada le richieste ai microservizi |
| Insights service     | **4001** | Esempio microservizio |
| YouTube service      | **4002** | Video da YouTube → Postgres, API `/youtube/*` |

Apri il browser su **[http://localhost:3000](http://localhost:3000)**.

La prima volta l’elenco può essere vuoto: clicca **«Aggiorna ultimi 10 video»** per importare gli ultimi dieci video del canale nel database (richiede Postgres in esecuzione e rete disponibile per YouTube).

### Comandi utili solo front-end o solo back-end

- Solo Next.js: `npm run dev:frontend`
- Solo gateway + microservizi: `npm run dev:backend`

## Build di produzione (locale)

Dopo `npm install` e con `.env.local` configurato:

```bash
npm run build
```

Poi avvia il front-end in produzione (tipicamente in un altro terminale, dopo aver avviato gateway, servizi e Postgres):

```bash
npm run start -w frontend
```

Per un deploy reale vanno definiti host/porte del gateway e `DATABASE_URL` sull’ambiente di destinazione.

## Struttura del progetto

```
frontend/                    # App Next.js (App Router)
backend/services/
  api-gateway/              # Proxy HTTP verso gli altri servizi
  insights-service/       # Esempio microservizio
  youtube-service/        # Sync video YouTube + Postgres
docker-compose.yml          # Postgres per sviluppo locale
.env.example               # Template variabili (versionato)
.env.local                 # Copia locale (non committare)
```

Le richieste del browser al path **`/api/backend/*`** sono riscritte verso il gateway (vedi `frontend/next.config.ts`), così si evitano problemi di CORS in locale.

## Risoluzione problemi

- **`YOUTUBE_CHANNEL_ID` sbagliato**  
  Se in `.env.local` hai fissato l’ID del canale «Ingegneria Italia», la lista mostrerebbe solo quel canale. Per usare **Ingegneri in Borsa**, rimuovi `YOUTUBE_CHANNEL_ID` e lascia solo `YOUTUBE_CHANNEL_HANDLE=Ingegneriinborsa`, oppure incolla l’ID UC del canale [@Ingegneriinborsa](https://www.youtube.com/@Ingegneriinborsa).

- **Errore Postgres `28P01` (autenticazione con password fallita)**  
  Succede quasi sempre se `DATABASE_URL` punta alla porta **sbagliata**: su Windows è facile avere un altro PostgreSQL in ascolto su **5432** (con utenti diversi da `youtube`). Questo progetto espone il container su **5433**; verifica in `.env.local`:

  `DATABASE_URL=postgresql://youtube:youtube@127.0.0.1:5433/youtube_insights`

  Poi riavvia i container (`docker compose up -d`) e `npm run dev`. Se il volume era stato creato in precedenza con credenziali diverse, puoi ricreare il database locale (cancella i dati nel volume) con:

  ```bash
  docker compose down -v
  docker compose up -d
  ```

- Se vedi ancora video «Ingegneria Italia», il refresh **non usa più solo il feed RSS**: scarica un **pool di candidati** dalla griglia `/videos` e dalla **playlist uploads** (`UU…`), ne usa al massimo **50** (`YOUTUBE_FETCH_CANDIDATES`), applica un **filtro** su nome canale e titolo (`video-filter.ts`), poi salva gli ultimi **10** (`YOUTUBE_SAVE_COUNT`) ordinati per data.

- **«Impossibile caricare il canale» / feed vuoto**  
  Aggiungi in `.env.local` l’ID canale esplicito:

  ```env
  YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxx
  ```

  (lo trovi nella pagina del canale o in YouTube Studio).

- **Errore di connessione al database**  
  Verifica che `docker compose ps` mostri Postgres in esecuzione e che `DATABASE_URL` coincida con utente, password, host e nome DB.

- **Porta già in uso**  
  Modifica la porta nel servizio interessato in `.env.local` (es. `API_GATEWAY_PORT`, `YOUTUBE_SERVICE_PORT`) e, per il gateway usato da Next, aggiorna anche `API_GATEWAY_INTERNAL_URL` e `NEXT_PUBLIC_API_URL` di conseguenza.

- **`npm audit` e `npm audit fix --force`**  
  Consulta `npm audit` per i dettagli. Evita `--force` salvo che tu sappia che può aggiornare major e rompere il build; preferisci fix mirati o aggiornamenti manuali delle dipendenze.

## Lint

```bash
npm run lint
```

---

Per approfondire Next.js vedi la [documentazione ufficiale](https://nextjs.org/docs).
