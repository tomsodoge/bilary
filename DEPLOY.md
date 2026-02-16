# Deployment (Vercel + GitHub)

## 1. Repository auf GitHub anlegen

1. Gehe zu [github.com/new](https://github.com/new).
2. **Repository name:** z. B. `bilary`.
3. **Public** wählen, **kein** README, .gitignore oder License hinzufügen (Projekt existiert schon lokal).
4. Auf **Create repository** klicken.

## 2. Lokales Repo mit GitHub verbinden

Im Projektordner im Terminal ausführen (URL durch deine GitHub-Repo-URL ersetzen):

```bash
cd /Users/tomsodoge/Desktop/bilary
git remote add origin https://github.com/DEIN-USERNAME/bilary.git
git push -u origin main
```

(Falls du SSH nutzt: `git@github.com:DEIN-USERNAME/bilary.git`)

## 3. Projekt in Vercel anlegen

1. [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import Git Repository** → dein GitHub-Repo auswählen.
3. **Root Directory:** auf **Edit** klicken und **`frontend`** eintragen.
4. Build-Einstellungen (meist automatisch erkannt):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. **Deploy** klicken.

Danach: Jeder `git push` auf `main` löst automatisch ein neues Vercel-Deployment aus.
