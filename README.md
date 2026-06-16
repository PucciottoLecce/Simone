# Preventivi Pro — Deploy su Cloudflare

## Struttura
```
preventivi-worker/
├── worker.js      ← Cloudflare Worker (proxy sicuro verso Turso)
├── wrangler.toml  ← Configurazione Worker
├── package.json
└── index.html     ← App frontend (da hostare su Cloudflare Pages o altro)
```

---

## 1. Prerequisiti

- Account Cloudflare (gratuito va bene)
- Node.js ≥ 18 installato
- Wrangler CLI: `npm install -g wrangler`
- Account Turso attivo con il DB già creato

---

## 2. Deploy del Worker

### 2a. Clona / posizionati nella cartella
```bash
cd preventivi-worker
npm install
```

### 2b. Login su Cloudflare
```bash
wrangler login
```

### 2c. Imposta i segreti (NON metterli in wrangler.toml!)
```bash
wrangler secret put TURSO_TOKEN
# → incolla il token JWT di Turso quando richiesto

wrangler secret put APP_SECRET
# → inserisci una stringa casuale lunga, es. genera con:
#   openssl rand -hex 32
```

### 2d. Deploy
```bash
wrangler deploy
```

L'output mostrerà l'URL del worker, tipo:
```
https://preventivi-pro-worker.<tuo-account>.workers.dev
```

---

## 3. Aggiorna index.html

Apri `index.html` e modifica le due costanti in cima al `<script>`:

```js
const WORKER_URL = 'https://preventivi-pro-worker.<tuo-account>.workers.dev';
const APP_SECRET = 'la-stessa-stringa-che-hai-dato-a-wrangler-secret';
```

---

## 4. Deploy del frontend (Cloudflare Pages — consigliato)

### Opzione A — Drag & drop (più semplice)
1. Vai su https://pages.cloudflare.com
2. "Create a project" → "Direct Upload"
3. Carica `index.html`
4. Done — ottieni un URL tipo `https://preventivi-pro.pages.dev`

### Opzione B — Git (deploy automatico)
1. Crea un repo Git con `index.html` nella root
2. Su Cloudflare Pages: connetti il repo
3. Build command: *(vuoto)*  |  Output directory: `.`
4. Ogni push su `main` rideploya automaticamente

---

## 5. Sicurezza

| Cosa | Dove vive |
|---|---|
| Token Turso | Solo nel Worker (variabile d'ambiente Cloudflare) |
| APP_SECRET | Worker env + hardcodato in index.html (lato client) |
| Credenziali utente | DB Turso (tabella `utenti`) |

> ⚠️ `APP_SECRET` nell'HTML è visibile chi ispeziona il sorgente — serve a
> evitare che chiunque chiami il tuo Worker a caso. Per maggiore sicurezza
> in produzione, considera di aggiungere un controllo sull'`Origin` header
> nel Worker, o di spostare l'auth su un login con JWT proprio.

---

## 6. Test in locale

```bash
wrangler dev
```
Poi nel browser apri `index.html` direttamente (file://) oppure con un
server locale, e punta `WORKER_URL` a `http://localhost:8787`.

---

## 7. Vedere le tabelle Turso / eseguire SQL

### Opzione A — Turso Shell (da terminale)
```bash
# Installa CLI Turso
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Apri shell interattiva sul tuo DB
turso db shell preventivi-pro-joonior

# Poi dentro la shell:
.tables                        # lista tutte le tabelle
.schema utenti                 # struttura tabella
SELECT * FROM utenti;
SELECT * FROM preventivi ORDER BY created_at DESC LIMIT 10;
SELECT * FROM intestazione;
```

### Opzione B — Turso Dashboard (browser)
1. Vai su https://app.turso.tech
2. Seleziona il tuo database `preventivi-pro-joonior`
3. Tab **"Shell"** → editor SQL interattivo online

### Comandi SQL utili
```sql
-- Reset password admin
UPDATE utenti SET password = '1234' WHERE username = 'admin';

-- Crea nuovo utente
INSERT INTO utenti (username, password) VALUES ('mario', 'pass123');

-- Conta preventivi per stato
SELECT stato, COUNT(*) as n, SUM(totale) as totale
FROM preventivi GROUP BY stato;

-- Vedi ultimi 5 preventivi
SELECT numero, cliente, totale, stato, data
FROM preventivi ORDER BY created_at DESC LIMIT 5;

-- Elimina un preventivo per ID
DELETE FROM preventivi WHERE id = '...';
```
