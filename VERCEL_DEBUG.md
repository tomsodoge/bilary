# KRITISCH: Mixed Content Problem beheben

## Das Problem in deinem Screenshot
Die Requests gehen **IMMER NOCH** an `http://bilary-production.up.railway.app` statt `https://`

Das bedeutet: **Der neue Build ist noch nicht aktiv** ODER **die Environment Variable fehlt/ist falsch**.

## SOFORT-LÖSUNG: Manuell prüfen

### Schritt 1: Vercel Environment Variable GENAU prüfen

1. Gehe zu https://vercel.com
2. Wähle Projekt **bilary**
3. **Settings** → **Environment Variables**
4. Suche **`VITE_API_BASE_URL`**

**MUSS EXAKT SO SEIN:**
```
Name: VITE_API_BASE_URL
Value: https://bilary-production.up.railway.app
```

**WICHTIG:**
- ✅ MIT `https://` (nicht `http://`)
- ✅ OHNE `/` am Ende
- ✅ KEINE Leerzeichen
- ✅ Environments: **Production** UND **Preview** BEIDE angehakt

**Falls NICHT so:** LÖSCHEN und NEU erstellen!

### Schritt 2: Komplett neuer Deploy OHNE Cache

**KRITISCH:** Nach jeder Änderung der Variable brauchst du einen neuen Build!

1. Vercel → **Deployments**
2. Beim **neuesten Deployment** (ganz oben): **⋯** (drei Punkte) → **Redeploy**
3. **KRITISCH:** Im Dialog:
   - ✅ Haken bei **"Use existing Build Cache"** ENTFERNEN
   - ✅ Dann erst **Redeploy** klicken
4. Warte bis Build fertig ist (1-2 Minuten)

### Schritt 3: Nach dem Deploy - Console prüfen

1. Öffne https://bilary.vercel.app/dashboard
2. **Cmd+Shift+R** (Mac) oder **Ctrl+Shift+R** (Windows) - Hard Reload
3. **F12** → **Console** Tab

**Du solltest sehen:**
```
[API Client] Raw VITE_API_BASE_URL: https://bilary-production.up.railway.app
[API Client] Validated API Base URL: https://bilary-production.up.railway.app
[API Client] Is DEV: false
[API Client] Mode: production
```

**Falls du siehst:**
- `Raw VITE_API_BASE_URL: undefined` → Variable ist NICHT gesetzt!
- `Raw VITE_API_BASE_URL: http://...` → Variable ist FALSCH (ohne S)!

### Schritt 4: Falls immer noch HTTP-Requests

**Screenshot der Console machen** und mir zeigen - dann sehe ich den genauen Wert!

---

## Alternative: Variable komplett NEU erstellen

Falls nichts hilft:

1. Vercel → Settings → Environment Variables
2. `VITE_API_BASE_URL` **DELETE** (komplett löschen)
3. **Add New** klicken
4. **Key:** `VITE_API_BASE_URL`
5. **Value:** `https://bilary-production.up.railway.app`
6. **Environments:** Production ✅ Preview ✅ Development ✅
7. **Save**
8. Redeploy OHNE Cache (siehe Schritt 2)

---

## Warum passiert das?

**VITE Variables werden beim BUILD eingebettet**, nicht zur Laufzeit!

Wenn die Variable fehlt oder falsch ist **BEIM BUILD**, bleibt der falsche Wert im JavaScript-Code.

Deshalb MUSS nach jeder Variable-Änderung ein **neuer Build ohne Cache** laufen!
