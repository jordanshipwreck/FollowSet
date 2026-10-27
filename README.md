# Followset

A workout PWA for a repeating weekly lifting program: logs sets, runs superset rest timers, keeps the demo on screen, and grades each muscle afterwards (Gains Grade).

GitHub Pages serves it at https://jordanshipwreck.github.io/FollowSet/. Workouts are stored on the phone (`localStorage` key `fitty-v2`), and Google Drive keeps an optional backup.

- **How to run, fix, and maintain it:** [`docs/SOP.md`](docs/SOP.md)
- **Why it is built this way:** [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

Node 22. There is no backend.

## Layout

```
index.html              boot screen, Google client id, entry script
src/
  App.tsx               tabs, starting a run, Drive sync, midnight rollover
  screens/              Today, Runner, Summary, History, Progress, Library, Me
  components/           Icon, Ring, Sheet, Stepper, Toggle, Thumb
  lib/
    program.ts          the weekly program (edit this to change workouts)
    cues.ts             form cues per exercise (2–3 each, required)
    queue.ts            program → ordered steps (supersets, sides, rests)
    store.ts            data model, load/save, v2 migration, Oct 26 seed, merge
    log.ts              copyable log text, last weights, progression hints, volume
    grade.ts            Gains Grade formula and flags
    dates.ts            week math (Monday first, local time)
    media.ts            exercise name → public/media/<slug>/
    drive.ts            Google Drive backup
    photos.ts           progress photos (IndexedDB) + zip export
    device.ts           beep, vibrate, speech in/out, wake lock
    useStore.ts         React state + persistence
public/                 copied as-is: media, exercises.json, manifest, sw.js, icons
catalog/exercises.csv   the exercise catalog in spreadsheet form (not deployed)
tests/                  vitest
```

## Deploy

Pushing to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml): `npm ci` → `npm test` → `npm run build` → publish `dist/` to Pages. Pull requests run the same build and tests without deploying.

If a run fails with "Get Pages site failed": **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-run the workflow.
