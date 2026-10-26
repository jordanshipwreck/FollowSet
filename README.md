# Fitty-Cent

Workout PWA for the week of Oct 26–Nov 1, 2026.

Live site: https://jordanshipwreck.github.io/fitty/

## What is in this repo

The Vite app in the private Origin repo (`jordan-d1m1b/fitty`, main) was not reachable from the environment that published this site (Origin CLI had no `CURSOR_AUTH_TOKEN`). `site/` is the single-file v2 build, with images inlined, plus:

- `manifest.webmanifest` — `start_url` and `scope` are `/fitty/`
- `sw.js` — offline shell, registered with scope `/fitty/`
- `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png`

There is no `npm run build` step. The workflow publishes the `site/` directory as-is.

## Deploy

Pushes to `main` run [`.github/workflows/pages.yml`](.github/workflows/pages.yml). That workflow uses `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.

GitHub Pages has to use **GitHub Actions** as the source. If the site is not live yet:

1. Open https://github.com/jordanshipwreck/fitty/settings/pages
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. If the latest run failed, open the **Actions** tab, select **Deploy to GitHub Pages**, and choose **Re-run jobs**.

The published address is https://jordanshipwreck.github.io/fitty/

## Google Drive sync

Sync stays off until a client id is set. `site/index.html` contains:

```html
window.FITTY_GOOGLE_CLIENT_ID = "";
```

The built app reads that value (`googleClientId`). JSON export works with it empty.

To turn Drive sync on later:

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add authorized JavaScript origin `https://jordanshipwreck.github.io` (origin only, no `/fitty` path).
3. Paste the client id into `window.FITTY_GOOGLE_CLIENT_ID` and push to `main`.

The Drive file is `Fitty-Cent/fitty-workout.json`, using the `drive.file` scope.
