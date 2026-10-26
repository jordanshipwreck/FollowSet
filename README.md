# Followset

Workout PWA for the week of Oct 26–Nov 1, 2026. The on-screen name is Followset. The per-muscle score is still called Gains Grade.

The repo is `jordanshipwreck/FollowSet`. GitHub Pages serves it at https://jordanshipwreck.github.io/FollowSet/. The manifest `id`, `start_url`, and `scope` are `/FollowSet/` (trailing slash, case-sensitive). The service worker is registered at that same scope.

## What is in this repo

The Vite app in the private Origin repo (`jordan-d1m1b/fitty`, main) was not reachable from the environment that published this site (Origin CLI had no `CURSOR_AUTH_TOKEN`). `site/` is the single-file v2 build, with images inlined, plus:

- `manifest.webmanifest` — `start_url` and `scope` are `/FollowSet/`
- `sw.js` — offline shell (`fitty-shell-v8`), registered with scope `/FollowSet/`. A navigation waits at most 4 seconds for the network, then uses the cached shell, then a visible message. Activating this worker deletes older `fitty-shell` caches. It does not claim the open page and it does not reload on `controllerchange`.
- `exercises.json` — one entry per exercise. The app’s Exercise Library reads this file.
- `media/<slug>/01.jpg` — the still frame extracted from the build. Frames `02.jpg`–`08.jpg` are catalog paths for later swaps.
- `media/<slug>/demo.gif` — 29 demo animations, loaded by relative path when that exercise is on screen. They are not inlined in `index.html`. The service worker caches each GIF the first time it is shown. Nine lifts, plus the incline walk, still use `01.jpg` because no GIF was supplied for them.
- `media/<slug>/placeholder.svg` — illustration card for the 16 warm-ups and stretches that have no photo yet. The Now card and the Exercise Library show that card at full width.
- `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png`

`catalog/exercises.csv` is the same catalog in spreadsheet form. It is not part of the Pages upload.

There is no `npm run build` step. The workflow publishes the `site/` directory as-is.

## Deploy

Pushes to `main` run [`.github/workflows/pages.yml`](.github/workflows/pages.yml). That workflow uses `actions/configure-pages` (with `enablement: true`), `actions/upload-pages-artifact`, and `actions/deploy-pages`.

`GITHUB_TOKEN` often cannot create the Pages site. If a run fails with "Get Pages site failed" or "Create Pages site failed":

1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch").
3. Re-run the latest **pages** workflow, or push an empty commit.

The header gear opens Settings. The swipe-up sheet also has Plan, History, Calendar, Gains Grade, Photos, Library, and Settings. On a phone that has no 2026-10-26 Push history yet, the app merges that workout once under seed id `fitty-seed:2026-10-26:push-1` and marks the day done. An existing log for that day is left alone. Logs stay in `localStorage` key `fitty-v2`. Photos stay in IndexedDB `fitty-photos`.

## Google Drive sync

`site/index.html` sets `window.FITTY_GOOGLE_CLIENT_ID`. The app passes that id to Google Identity Services (`accounts.google.com/gsi/client`, `initTokenClient`) with scope `https://www.googleapis.com/auth/drive.file`. Sync writes `Fitty-Cent/fitty-workout.json`.

The OAuth client is a web client. Its authorized JavaScript origin is `https://jordanshipwreck.github.io` (no `/fitty` path). The consent screen is in Testing, with `jordanshipwreck@gmail.com` as a test user. Settings shows **Sign in with Google**, which requests that scope and then uploads the log.
