# Followset SOP

Living document. It describes the current version (v3, the source rebuild). Update it in the same change as the code.

## Purpose

Run a fixed weekly lifting program from a phone on the gym floor: show the next move with a demo and cues, time the rests, log weight and reps, suggest when to add weight, and score how each muscle responded (Gains Grade).

## Scope

**In:** the Mon–Sun program in `src/lib/program.ts`, set logging, rest/work timers, voice cues, history and editing, Gains Grade, weekly volume, progress photos, exercise library, Drive backup, JSON export/import, offline use.

**Out:** accounts, a server, multiple users per phone, nutrition, editing the program from inside the app (change `program.ts` instead).

## Users

| Who | Does |
|---|---|
| Lifter (Jordan) | Runs workouts, rates muscles, takes photos, signs in to Drive. |
| Maintainer | Edits the program, media, and code; deploys by pushing to `main`. |
| Assistant reading the Drive file | Reads `Fitty-Cent/fitty-workout.json` to review training. Read-only. |

## Inputs

- The program (`src/lib/program.ts`) and cues (`src/lib/cues.ts`).
- Media in `public/media/<slug>/`: `01.jpg` still, `demo.gif` animation, or `placeholder.svg` illustration for warm-ups and stretches.
- `public/exercises.json` for the Library (mirrors `catalog/exercises.csv`).
- Google OAuth web client id in `index.html` (`window.FITTY_GOOGLE_CLIENT_ID`). Authorized JavaScript origin: `https://jordanshipwreck.github.io`. Consent screen is in Testing with `jordanshipwreck@gmail.com` as a test user.

## Workflow (a workout)

1. Open the app. **Today** shows this week, today's workout, steps, estimated time, and muscles.
2. Tap the round play button. Past days start as a makeup; future days are preview only.
3. The **Runner** walks the queue: warm-up → supersets → finisher → stretches.
   - Weight is prefilled from the last time (or the suggested jump). Reps are prefilled from the same set last time, or the top of the range. Adjust with − / +.
   - **Log set** saves it and starts the rest. 15 s between superset moves, the group's rest after the round.
   - Timed moves (planks, walks, stretches) have a **Start** timer.
   - Drop sets show drop rows on the last set.
   - **Back / Skip**, the list button (jump to any step, end, discard), and **Pause** are always available. The back arrow minimizes the run; a bar at the bottom brings it back.
4. The last step, or **End workout**, finishes the run and opens the summary: time, sets, volume, copy log, and a pump/strain rating per muscle.
5. If signed in, the app syncs to Drive after the run and at launch.

## System structure

React 19 + TypeScript, built by Vite into static files. No server. See the layout in `README.md`. Visual rules: `docs/DESIGN.md`.

Data (`localStorage["fitty-v2"]`):

```
AppState { version: 2, sessions: Session[], settings: { voice, focus[], weightStep, theme: system|light|dark } }
Session  { id "YYYY-MM-DD|Day", date, day, startedAt, pausedMs, pauseStarted, idx, finished,
           focus[], logs: SetLog[], ratings: Rating[], timer, runBase?, updatedAt?, endedAt?, seedId? }
SetLog   { id "date|Day|name|set|side", name, side L/R/null, set, weight ("50" | "BW" | "—"), reps, drops[], at, note?, seedId? }
Rating   { muscle, pump 1–10, strain 1–5 }
```

This is the same v2 format the earlier single-file build wrote, plus optional fields. Old phones keep their history with no migration step.

Other storage: IndexedDB `fitty-photos` (photos), `sessionStorage` (unsaved field drafts, Drive token), `localStorage` flags `fitty-google-signed-in`, `fitty-last-synced`, `fitty-seed:2026-10-26:push-1`.

## Rules & logic

- **Week:** Monday first, local time. The program repeats every week; the date only decides which session logs go to. If the app stays open past midnight, Today moves to the new day.
- **Queue:** each group runs in rounds. Round *n* does set *n* of every item that has it. Unilateral items get an L and an R step. Rest is 15 s between moves in a round and the group rest after the round; the final step has no rest.
- **Focus muscles:** +1 set on every work item for that muscle. Locked in when a run starts.
- **Prefill:** weight = saved draft → this session's last weight for the lift → last weight ever. The progression hint never prefills; it shows a one-tap "Use X" button. Lifts share history across name variants (text in parentheses is ignored).
- **Progression hint (double progression):** if every set at last session's heaviest weight hit the top of the rep range, suggest heaviest + weight step (default 5 lb). Otherwise keep the weight and beat the reps. Timed and per-side ranges get no hint.
- **Reps:** weighted moves need reps (voice mode listens if blank). Bodyweight and timed moves log the target when left blank.
- **Gains Grade:** `round(pump × 10 − max(0, strain − 3) × 12)`, clamped 0–100, averaged per muscle across all ratings. Flags: 15+ below the median grade (needs 2+ muscles), or strain ≥ 4 with pump ≤ 5.
- **Volume:** sum of weight × reps for numeric weights, drops included.
- **Discard:** restores the logs as they were when the run started (`runBase`).
- **Drive merge:** per session, the most recent change (`updatedAt`, else latest log time) wins whole. A session on only one side is kept. A run that is live on this phone is never replaced. JSON import uses the same merge.
- **Oct 26 seed:** a phone with no log for 2026-10-26 gets the paper-logged Push workout once (27 sets, incline press noted as 120 total / 60 per hand). Never written over a day that has logs, never re-added after deletion.

## Roles & permissions

Single user, no accounts. Anyone with the phone can see and edit everything on it. Drive access uses the `drive.file` scope: the app can only see files it created. Repo write access = deploy access.

## Procedures

**Change the program:** edit `src/lib/program.ts`. Every new exercise needs 2–3 cues in `src/lib/cues.ts` (the app throws on load otherwise) and media (see next). Run `npm test`; the media test fails if a file is missing.

**Add or replace media:** put files in `public/media/<slug>/`. Map the name in `src/lib/media.ts` (`PREFIX`, `STARTS`, `ILLUSTRATED`, `STILL_ONLY`). Update `public/exercises.json` and `catalog/exercises.csv`. If you replace a file at an existing path, bump `MEDIA` in `public/sw.js` (currently `followset-media-v3`; bump to the next number) or phones keep the old one.

**Deploy:** merge to `main`. CI tests, builds, and publishes. Each build stamps a new service-worker cache; phones pick it up on the next launch after the one that downloads it.

**Back up / move phones:** You → Export JSON, then Import JSON on the new phone. Or sign in to Drive on both.

**Run locally:** `npm install && npm run dev`.

## Exceptions

| Situation | What happens |
|---|---|
| Browser blocks storage (private mode) | Red banner on You: export JSON before leaving. |
| A run is live on another day | Today shows a resume card; you can't start a second run until you end it. |
| Missed a day | Select it and start; it logs as that date (makeup). |
| Exercise has no media | A text card with the phase and name. |
| GIF fails to load | Falls back to the still. |
| Drive sign-in popup closed or slow | Error message on You; local data is untouched. |
| Old data with several unfinished runs | The most recently touched one is the live run. |

## Quality control

- `npm test`: queue shape (Tuesday = 41 steps), focus sets, every program exercise has media on disk, catalog files exist, v2 parsing, seed rules, merge rules, grade math, progression, log text, spoken numbers, zip CRC.
- `npm run build` runs `tsc` first, so type errors block deploys.
- CI runs both on every PR and push.
- Before a release that touches the runner, run one full workout in `npm run preview` on a phone-sized window: log, rest, reload mid-run, pause, end, rate, discard.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Stuck on "Loading Followset…" | Old cached shell or a JS error | The boot screen shows the error after 8 s with **Reset app cache** (keeps workouts). |
| New version not showing | Service worker serves the previous build until the next launch | Close and reopen the app, or You → Reset app cache. |
| Drive: "Sign-in expired" | Token older than ~1 h | Tap Sync now; it asks Google again. |
| Drive: 403 / access blocked | Account not a test user, or wrong origin | Add the account under the OAuth consent screen's test users; origin must be `https://jordanshipwreck.github.io`. |
| Pages deploy fails "Get Pages site failed" | Pages source not set | Settings → Pages → Source: GitHub Actions. |
| App throws "Missing cues for …" | New exercise without cues | Add 2–3 cues in `cues.ts`. |
| Screen sleeps mid-workout | Wake Lock refused (low power mode) | The muted video fallback covers older iOS; low power mode can still override it. |

## Maintenance

- After each training block, review the program and progression step.
- Monthly: Export JSON as an offline backup; Export photo zip if photos matter.
- Keep dependencies current with `npm outdated` a few times a year; run the full QC list after upgrades.
- Owner: Jordan.

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | **v3 rebuild from source.** Vite + React + TypeScript replaces the 4 MB minified single file (now ~90 KB gzipped plus fonts). New UI: dark canvas, lime/lilac/peach bento cards, pill nav, full-screen runner with steppers and a ring rest timer. Program repeats weekly instead of ending Nov 1. Added: week navigation, last-time and progression hints, weekly volume chart, per-muscle sparklines, JSON import, Drive sign-out, step jump list, minimize-while-running bar, midnight rollover. Fixed: Drive sign-in timed out after 2 s (consent popup could never finish), Drive merge never applied edits from another device, catalog pointed the incline walk at a missing GIF, offline launch needed precached assets, photo zip names collided for repeat shots. Dropped: v1 `fitty-workout-log` import and the one-time Oct 26 "repair" that could overwrite a hand-logged Oct 26. |
| 2026-10-27 | **Motion + prefill.** Spring press feedback on every tappable item, sliding selection pills (tab bar, week strip), staggered screen entrances, step and rest transitions, stepper number roll, dial sweep, swipe-down-to-close sheets, Android tap haptic (docs/DESIGN.md → Motion). The weight now prefills with last time's weight; the progression suggestion is a one-tap "Use X" button instead of being prefilled. |
| 2026-10-27 | **Back to lime, themes kept.** Jordan rejected the pink. Accent is neon lime again (#d9f34a) in both Light and Dark; the Auto/Light/Dark setting stays. Dark theme is neutral near-black. Illustrations back to lime; media cache bumped to `followset-media-v3`. |
| 2026-10-27 | **Hot pink + light/dark themes.** Accent changed from lime to neon hot pink (#ff3d9a, dark text on pink fills). Added Dark theme and an Auto/Light/Dark setting (You → Appearance, stored as `settings.theme`). Warm-up/stretch illustrations recolored pink; media cache bumped to `followset-media-v2`. |
| 2026-10-27 | **Restyle to the Rondesign reference** (docs/DESIGN.md). Light warm canvas with blurred glows, white frosted cards, thin Outfit numerals, Doto dot-matrix timers, knob-pill Start/Log buttons, tick rings and tick charts, black ↗ buttons, black-pill tabs. The workout screen is dark mauve glass over the blurred demo frame. Fonts: Inter Tight replaced by Outfit + Doto. |
| 2026-10-26 | v2 single-file build: End/Discard, Oct 26 Push seed, exercise catalog, demo GIFs, Drive sync, Settings gear. |
