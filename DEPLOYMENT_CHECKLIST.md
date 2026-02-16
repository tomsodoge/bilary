# Deployment Checklist

## ✅ Code-Änderungen (abgeschlossen)

- [x] Backend `main.py` angepasst für Railway Port (`$PORT`)
- [x] Frontend `Connect.tsx` - Debug-Logs entfernt, besseres Error-Handling
- [x] Frontend `api/client.ts` - Production-URL Handling verbessert
- [x] Backend `config.py` - CORS-Origins korrekt parsen
- [x] Railway Deployment-Dateien erstellt (`Procfile`, `runtime.txt`)
- [x] Dokumentation erstellt (`RAILWAY_DEPLOYMENT.md`, `GOOGLE_OAUTH_SETUP.md`)

## 📋 Nächste Schritte (manuell auszuführen)

### 1. Railway Setup
- [ ] Gehe zu [railway.app](https://railway.app) und erstelle Projekt
- [ ] Verbinde mit GitHub-Repo `tomsodoge/bilary`
- [ ] Setze Root Directory auf `backend`
- [ ] Warte auf ersten Deploy
- [ ] Kopiere Railway-URL

### 2. Backend Environment Variables (Railway)
- [ ] `DATABASE_PATH=/app/data/invoices.db`
- [ ] `STORAGE_PATH=/app/storage/invoices`
- [ ] `ENCRYPTION_KEY=<generierter Key>`
- [ ] `CORS_ORIGINS=https://deine-vercel-app.vercel.app,http://localhost:5173`
- [ ] `FRONTEND_URL=https://deine-vercel-app.vercel.app`
- [ ] `BACKEND_URL=https://dein-backend.railway.app` (Railway-URL)

### 3. Frontend Environment Variable (Vercel)
- [ ] Gehe zu Vercel-Projekt → Settings → Environment Variables
- [ ] Füge hinzu: `VITE_API_BASE_URL=https://dein-backend.railway.app`
- [ ] Setze für alle Environments (Production, Preview, Development)
- [ ] Trigger neuen Deploy

### 4. Google OAuth Setup (optional)
- [ ] Google Cloud Console Projekt erstellen
- [ ] Gmail API aktivieren
- [ ] OAuth 2.0 Client ID erstellen
- [ ] Redirect URI hinzufügen: `https://dein-backend.railway.app/api/auth/google/callback`
- [ ] Client ID und Secret auf Railway setzen
- [ ] Siehe `GOOGLE_OAUTH_SETUP.md` für Details

### 5. Testing
- [ ] Backend Health-Check: `https://dein-backend.railway.app/health`
- [ ] Frontend lädt ohne Network Error
- [ ] "Postfach verbinden" funktioniert
- [ ] Google OAuth Login funktioniert (falls konfiguriert)
- [ ] Invoice Sync funktioniert

## 🔍 Troubleshooting

### Network Error auf Vercel
- Prüfe, ob `VITE_API_BASE_URL` auf Vercel gesetzt ist
- Prüfe, ob Frontend neu deployed wurde nach dem Setzen der Variable
- Prüfe Browser Console für genaue Fehlermeldung

### Google OAuth öffnet localhost
- Prüfe, ob `VITE_API_BASE_URL` korrekt auf Vercel gesetzt ist
- Prüfe, ob Frontend neu deployed wurde

### CORS Errors
- Prüfe, ob `CORS_ORIGINS` auf Railway deine Vercel-URL enthält
- Prüfe, ob `FRONTEND_URL` korrekt gesetzt ist
- Prüfe Browser Console für genaue CORS-Fehlermeldung

### Backend startet nicht auf Railway
- Prüfe Railway Logs
- Stelle sicher, dass `requirements.txt` alle Dependencies enthält
- Prüfe, ob `PORT` Environment Variable gesetzt ist (Railway setzt diese automatisch)
