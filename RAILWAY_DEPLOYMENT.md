# Railway Deployment Guide

## Schritt 1: Railway-Projekt erstellen

1. Gehe zu [railway.app](https://railway.app) und melde dich an (mit GitHub)
2. Klicke auf "New Project"
3. Wähle "Deploy from GitHub repo"
4. Wähle dein Repository `tomsodoge/bilary` aus

## Schritt 2: Backend-Service konfigurieren

1. Railway erstellt automatisch einen Service
2. Klicke auf den Service → "Settings"
3. **WICHTIG:** Setze **Root Directory** auf: `backend`
   - Dies ist kritisch, damit Railway das Python-Projekt erkennt!
   - Ohne dieses Setting erkennt Railway das Projekt nicht
4. Setze **Start Command** auf: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Oder lasse es leer, dann verwendet Railway das Procfile im backend-Verzeichnis

## Schritt 3: Environment Variables setzen

Gehe zu "Variables" Tab und füge folgende Variablen hinzu:

### Erforderliche Variablen:

```
DATABASE_PATH=/app/data/invoices.db
STORAGE_PATH=/app/storage/invoices
ENCRYPTION_KEY=<generiere einen neuen Key mit: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
CORS_ORIGINS=https://deine-vercel-app.vercel.app,http://localhost:5173
FRONTEND_URL=https://deine-vercel-app.vercel.app
BACKEND_URL=https://dein-backend.railway.app
```

**Wichtig:** Ersetze:
- `deine-vercel-app.vercel.app` mit deiner tatsächlichen Vercel-URL
- `dein-backend.railway.app` mit deiner Railway-URL (wird nach dem ersten Deploy angezeigt)

### Optionale Variablen (für Google OAuth):

```
GOOGLE_CLIENT_ID=<wird nach Google Cloud Console Setup gesetzt>
GOOGLE_CLIENT_SECRET=<wird nach Google Cloud Console Setup gesetzt>
```

## Schritt 4: Deploy

1. Railway deployt automatisch bei jedem Git-Push auf `main`
2. Oder klicke auf "Deploy" Button für manuelles Deploy
3. Warte bis der Deploy erfolgreich ist
4. Kopiere die generierte URL (z.B. `https://bilary-production.up.railway.app`)

## Schritt 5: Vercel Environment Variable setzen

1. Gehe zu deinem Vercel-Projekt
2. Settings → Environment Variables
3. Füge hinzu:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** Deine Railway-URL **mit https://** (z.B. `https://bilary-production.up.railway.app`) – **kein http://**, sonst Mixed Content / Network Error
   - **Environment:** Production, Preview, Development (alle auswählen)
4. Klicke "Save"
5. Trigger einen neuen Deploy (oder warte auf automatischen Deploy)

## Schritt 6: Google OAuth Setup (optional)

Siehe `GOOGLE_OAUTH_SETUP.md` für detaillierte Anweisungen.

## Troubleshooting

### "Railpack could not determine how to build the app"
**LÖSUNG:** Du musst das **Root Directory** in den Railway Settings setzen!
1. Gehe zu deinem Railway Service
2. Klicke auf "Settings"
3. Scrolle zu "Root Directory"
4. Setze es auf: `backend`
5. Speichere und deploye neu

Ohne dieses Setting erkennt Railway das Python-Projekt nicht, weil sowohl `backend/` als auch `frontend/` im Root-Verzeichnis existieren.

### Backend startet nicht
- Prüfe Logs in Railway Dashboard
- Stelle sicher, dass `requirements.txt` alle Dependencies enthält
- Prüfe, ob `PORT` Environment Variable gesetzt ist (Railway setzt diese automatisch)
- Stelle sicher, dass Root Directory auf `backend` gesetzt ist

### Mixed Content: "requested an insecure XMLHttpRequest endpoint 'http://...'"
Die Seite läuft auf HTTPS, der Request geht aber an `http://...` → Browser blockiert.

**Checkliste (der Reihe nach prüfen):**

1. **Vercel Environment Variable**
   - Vercel → Projekt → **Settings** → **Environment Variables**
   - Eintrag **`VITE_API_BASE_URL`**:
     - Wert **genau:** `https://bilary-production.up.railway.app` (mit `https://`, **kein** `http://`, kein Leerzeichen, kein Slash am Ende)
   - Environment: **Production** (und ggf. Preview) auswählen → **Save**

2. **Neuen Build auslösen**
   - `VITE_*`-Variablen werden **nur beim Build** eingebettet. Nach Änderung:
   - Vercel → **Deployments** → bei dem letzten Deployment **⋯** → **Redeploy** (ohne "Use existing Build Cache" oder Cache leeren)
   - Warten, bis der neue Deploy fertig ist

3. **Browser-Cache umgehen**
   - Seite mit **Hard Reload** neu laden: **Ctrl+Shift+R** (Windows/Linux) bzw. **Cmd+Shift+R** (Mac)
   - Oder im gleichen Tab: DevTools (F12) → Rechtsklick auf Reload → **Empty Cache and Hard Reload**

4. **Im Code**
   - Die App erzwingt in Produktion im Request-Interceptor **immer** HTTPS, wenn die Seite über HTTPS läuft. Wenn du trotzdem `http://` siehst, kommt die Anforderung sehr wahrscheinlich noch von einem **alten Build** (siehe 2. und 3.).

### Zeitüberschreitung beim Sync (z. B. Jahr 2025)
- Der Sync nutzt im Frontend ein Timeout von 15 Minuten; das Backend lädt E-Mails in Batches (schneller).
- Wenn trotzdem ein Timeout auftritt: Railway-Standard-Request-Limits prüfen (ggf. Plan anpassen) oder einen kürzeren Zeitraum synchen (z. B. pro Monat).

### CORS Errors
- Stelle sicher, dass `CORS_ORIGINS` deine Vercel-URL enthält
- Prüfe, dass `FRONTEND_URL` korrekt gesetzt ist

### Database/Storage Issues
- Railway bietet persistenten Storage im `/app` Verzeichnis
- Stelle sicher, dass `DATABASE_PATH` und `STORAGE_PATH` auf `/app/...` zeigen

### Health Check
- Teste: `https://dein-backend.railway.app/health`
- Sollte `{"status": "healthy"}` zurückgeben
