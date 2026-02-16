# Google OAuth Setup Guide

## Schritt 1: Google Cloud Console Projekt erstellen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes aus
3. Aktiviere die **Gmail API**:
   - Gehe zu "APIs & Services" → "Library"
   - Suche nach "Gmail API"
   - Klicke "Enable"

## Schritt 2: OAuth 2.0 Credentials erstellen

1. Gehe zu "APIs & Services" → "Credentials"
2. Klicke auf "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Falls du noch keinen OAuth consent screen hast:
   - Klicke auf "CONFIGURE CONSENT SCREEN"
   - Wähle "External" (für persönliche Nutzung)
   - Fülle die erforderlichen Felder aus:
     - App name: "Bilary"
     - User support email: Deine E-Mail
     - Developer contact: Deine E-Mail
   - Scopes hinzufügen:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `openid`
     - `email`
     - `profile`
   - Test users hinzufügen (deine Gmail-Adresse)
   - Speichern

4. Zurück zu "Credentials" → "+ CREATE CREDENTIALS" → "OAuth client ID"
5. Application type: **Web application**
6. Name: "Bilary Backend"
7. **Authorized redirect URIs** hinzufügen:
   ```
   https://dein-backend.railway.app/api/auth/google/callback
   ```
   **Wichtig:** Ersetze `dein-backend.railway.app` mit deiner tatsächlichen Railway-URL

8. Klicke "CREATE"
9. Kopiere die **Client ID** und **Client Secret**

## Schritt 3: Railway Environment Variables setzen

1. Gehe zu deinem Railway-Projekt
2. Service → "Variables" Tab
3. Füge hinzu:
   - **Name:** `GOOGLE_CLIENT_ID`
   - **Value:** Deine Client ID aus Schritt 2
   - Klicke "Add"

4. Füge hinzu:
   - **Name:** `GOOGLE_CLIENT_SECRET`
   - **Value:** Dein Client Secret aus Schritt 2
   - Klicke "Add"

5. Railway deployt automatisch neu

## Schritt 4: Testen

1. Gehe zu deiner Vercel-App
2. Navigiere zur Connect-Seite
3. Klicke auf "Mit Google anmelden"
4. Ein Popup sollte sich öffnen mit Google-Login
5. Nach erfolgreichem Login sollte das Popup sich schließen
6. Du solltest "Google-Konto verbunden" sehen

## Troubleshooting

### "Google-Login ist noch nicht konfiguriert"
- Prüfe, ob `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` auf Railway gesetzt sind
- Stelle sicher, dass Railway neu deployed wurde nach dem Setzen der Variablen

### "redirect_uri_mismatch" Error
- Prüfe, ob die Redirect URI in Google Cloud Console exakt übereinstimmt:
  - Muss sein: `https://dein-backend.railway.app/api/auth/google/callback`
  - Keine trailing slashes, exakte URL

### Popup öffnet localhost statt Production-URL
- Prüfe, ob `VITE_API_BASE_URL` auf Vercel gesetzt ist
- Stelle sicher, dass Frontend neu deployed wurde

### OAuth Consent Screen zeigt Warnung
- Für Production muss der Consent Screen verifiziert werden
- Für Testing kannst du Test-User hinzufügen
- Oder nutze "Internal" User Type (nur für Google Workspace)
