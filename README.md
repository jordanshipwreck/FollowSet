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

Pushes to `main` run [`.github/workflows/pages.yml`](.github/workflows/pages.yml). That workflow uses `actions/configure-pages` (with `enablement: true`), `actions/upload-pages-artifact`, and `actions/deploy-pages`.

`GITHUB_TOKEN` often cannot create the Pages site. If a run fails with "Get Pages site failed" or "Create Pages site failed":

1. Open https://github.com/jordanshipwreck/fitty/settings/pages
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch").
3. Open https://github.com/jordanshipwreck/fitty/actions/workflows/pages.yml and choose **Re-run jobs** on the latest run, or push an empty commit.

The published address is https://jordanshipwreck.github.io/fitty/

The header gear opens Settings. On a phone that has no 2026-10-26 Push history yet, the app merges that workout once under seed id `fitty-seed:2026-10-26:push-1` and marks the day done. An existing log for that day is left alone.

## Google Drive sync

`site/index.html` sets `window.FITTY_GOOGLE_CLIENT_ID`. The app passes that id to Google Identity Services (`accounts.google.com/gsi/client`, `initTokenClient`) with scope `https://www.googleapis.com/auth/drive.file`. Sync writes `Fitty-Cent/fitty-workout.json`.

The OAuth client is a web client. Its authorized JavaScript origin is `https://jordanshipwreck.github.io` (no `/fitty` path). The consent screen is in Testing, with `jordanshipwreck@gmail.com` as a test user. Settings shows **Sign in with Google**, which requests that scope and then uploads the log.
