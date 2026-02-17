# WICHTIG: Mixed Content Fix auf Vercel

## Das Problem im Screenshot
Die Seite macht Requests an `http://bilary-production.up.railway.app/...` statt `https://...`

## LÖSUNG: Vercel Environment Variable prüfen und neu deployen

### Schritt 1: Vercel Environment Variable EXAKT PRÜFEN

1. Gehe zu https://vercel.com
2. Wähle dein Projekt **bilary**
3. Gehe zu **Settings** → **Environment Variables**
4. Suche **`VITE_API_BASE_URL`**

**WICHTIG:** Der Wert MUSS **EXAKT** sein:
```
https://bilary-production.up.railway.app
```

**NICHT:**
- ❌ `http://bilary-production.up.railway.app` (fehlendes "s")
- ❌ `https://bilary-production.up.railway.app/` (slash am Ende)
- ❌ Leerzeichen davor oder dahinter

### Schritt 2: Falls falsch → Korrigieren

1. Klicke auf **Edit** (Stift-Icon)
2. Ändere den Wert zu: `https://bilary-production.up.railway.app`
3. Environments: **Production** UND **Preview** UND **Development** (alle 3 auswählen!)
4. Klicke **Save**

### Schritt 3: NEUEN BUILD ERZWINGEN

**KRITISCH:** Nach Änderung der Environment Variable MUSS ein neuer Build laufen!

**Option A - Redeploy ohne Cache (EMPFOHLEN):**
1. Vercel → **Deployments**
2. Beim letzten Deployment: **⋯** (drei Punkte) → **Redeploy**
3. **WICHTIG:** Haken bei **"Use existing Build Cache"** ENTFERNEN
4. **Redeploy** klicken
5. Warten bis fertig (ca. 1-2 Minuten)

**Option B - Git Push:**
1. Lokale Änderungen committen
2. `git push`
3. Vercel deployed automatisch neu

### Schritt 4: Browser-Cache leeren

Nach dem Redeploy:
1. **Cmd+Shift+R** (Mac) oder **Ctrl+Shift+R** (Windows/Linux)
2. Oder: DevTools öffnen (F12) → Rechtsklick auf Reload → **"Empty Cache and Hard Reload"**

### Schritt 5: Prüfen

1. Öffne https://bilary.vercel.app/dashboard
2. DevTools öffnen (F12) → **Network** Tab
3. Requests anschauen: ALLE sollten zu `https://...` gehen (mit S!)
4. Wenn immer noch `http://`: Schritte 1-4 wiederholen

---

## Falls es IMMER NOCH nicht funktioniert

**Letzte Option:** Environment Variable LÖSCHEN und NEU ERSTELLEN

1. Vercel → Settings → Environment Variables
2. `VITE_API_BASE_URL` komplett **DELETE**
3. **Add New** klicken
4. **Key:** `VITE_API_BASE_URL`
5. **Value:** `https://bilary-production.up.railway.app`
6. **Environments:** Production, Preview, Development (alle 3!)
7. **Save**
8. Redeploy ohne Cache (siehe Schritt 3)
