# Followset

A workout PWA and creator marketplace. Follow a program (the Followset Original or one a creator built in Studio), run it with demos, rest timers, and the creator talking mid-set, log sets, grade each muscle (Gains Grade), and ask the AI coach about training, food, recovery, and labs. Phone, tablet, and desktop.

GitHub Pages serves it at https://jordanshipwreck.github.io/FollowSet/. Workouts are stored on the phone (`localStorage` key `fitty-v2`), and Google Drive keeps an optional backup.

- **How to run, fix, and maintain it:** [`docs/SOP.md`](docs/SOP.md)
- **Why it is built this way:** [`docs/DECISIONS.md`](docs/DECISIONS.md)
- **How it should look:** [`docs/DESIGN.md`](docs/DESIGN.md)
- **Cloud backend (Supabase) setup and status:** [`docs/CLOUD.md`](docs/CLOUD.md)
- **What's next, and what's needed from you:** [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

Node 22. The app needs no backend; the optional Supabase cloud lives in `supabase/` (see `docs/CLOUD.md`).

## Layout

```
index.html              boot screen, Google client id, entry script
src/
  App.tsx               tabs, starting a run, Drive sync, cloud sync, midnight rollover
  screens/              Today, Runner, Summary, History, Progress, Library (exercise vault), Me,
                        Discover (programs), Studio (creator editor), Coach (chat, food, health, labs)
  components/           Icon, TickRing, DotRow, Num, StatCard, KnobButton, Aura, Pills, Sheet, Stepper, Toggle, Thumb,
                        Recorder (camera/mic), CoachChat, CloudCard
  lib/
    program.ts          the Followset Original weekly program
    market.ts           programs, following, subscriptions (test mode), workoutFor(program, day)
    blocks.ts           block kinds (Warm-up, Superset…) and superset lettering
    vault.ts            exercise vault (public/exercises.json) → program items
    mediaStore.ts       creator video/voice blobs (IndexedDB)
    coach.ts            built-in coach answers + cloud coach call
    health.ts           health readings, labs, food log, Health Auto Export parser
    snapshot.ts         data synced to the cloud; AI-suggested program → Studio draft
    cloud.ts            cloud on/off from build variables
    cloudAuth.ts        email-code sign-in and REST calls
    cloudSync.ts        debounced snapshot push, suggestion pull
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
supabase/               migrations (schema + RLS) and edge functions: coach, mcp, mcp-key, checkout
tests/                  vitest
```

## Deploy

Pushing to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml): `npm ci` → `npm test` → `npm run build` → publish `dist/` to Pages. Pull requests run the same build and tests without deploying. The build reads repo variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`; without them the cloud stays off.

If a run fails with "Get Pages site failed": **Settings → Pages → Build and deployment → Source: GitHub Actions**, then re-run the workflow.
