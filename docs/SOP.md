# Followset SOP

Living document. It describes the current version (v4: marketplace, Studio, and coach). Update it in the same change as the code.

## Purpose

Run a weekly lifting program on the gym floor: show the next move with a demo and cues (and the creator talking), time the rests, log weight and reps, suggest when to add weight, and score how each muscle responded (Gains Grade).

Around that: a marketplace where creators build programs from the exercise vault or film their own demos (Discover + Studio), and an AI coach that answers from your training, food, recovery, and labs, mid-set included. Works on phone, tablet, and desktop.

## Scope

**In:** the Followset Original program (`src/lib/program.ts`); creator programs (Studio: build from the vault, film a demo, record a voice note, write a talk line, price, publish); following one program at a time; set logging, rest/work timers, voice cues, history and editing, Gains Grade, weekly volume, progress photos, exercise vault, Drive backup, JSON export/import, offline use; the coach (built-in, and Claude when the cloud is on); food log, Health Auto Export import, lab entry; an MCP connector for Claude/ChatGPT/Grok (cloud).

**Code written but not live:** the Supabase cloud (accounts, publishing to everyone, media upload, Claude coach, connector). See `docs/CLOUD.md` for what is tested.

**Out (for now):** real payments (Subscribe is test mode, MOCKED), native iPhone app and direct Apple Health, MyFitnessPal and Rythm APIs (neither offers one), multiple users per phone.

## Users

| Who | Does |
|---|---|
| Lifter (Jordan, any follower) | Follows a program, runs workouts, rates muscles, logs food, imports health data, asks the coach. |
| Creator | Builds programs in Studio, films demos and voice notes, sets a price, publishes. |
| Outside assistant (Claude, ChatGPT, Grok) | Reads the user's synced data over MCP and can suggest a program, which lands as a Studio draft. Needs the cloud and a connector link. |
| Maintainer | Edits the program, media, and code; deploys by pushing to `main`. |
| Assistant reading the Drive file | Reads `Fitty-Cent/fitty-workout.json` to review training. Read-only. |

## Inputs

- The program (`src/lib/program.ts`) and cues (`src/lib/cues.ts`).
- Media in `public/media/<slug>/`: `01.jpg` still, `demo.gif` animation, or `placeholder.svg` illustration for warm-ups and stretches.
- `public/exercises.json` for the exercise vault (mirrors `catalog/exercises.csv`).
- Health Auto Export JSON files (Coach → Health → Import).
- Cloud only: Supabase URL + anon key as repo variables, Anthropic key as a Supabase secret (`docs/CLOUD.md`).
- Google OAuth web client id in `index.html` (`window.FITTY_GOOGLE_CLIENT_ID`). Authorized JavaScript origin: `https://jordanshipwreck.github.io`. Consent screen is in Testing with `jordanshipwreck@gmail.com` as a test user.

## Workflow (a workout)

1. Open the app. **Today** shows the followed program (chip at the top), this week, today's workout, steps, estimated time, and muscles. A day the program leaves empty shows a rest-day card.
2. Tap the round play button. Past days start as a makeup; future days are preview only.
3. The **Runner** walks the queue: warm-up → supersets → finisher → stretches.
   - Weight is prefilled from the last time (or the suggested jump). Reps are prefilled from the same set last time, or the top of the range. Adjust with − / +.
   - **Log set** saves it and starts the rest. 15 s between superset moves, the group's rest after the round.
   - Timed moves (planks, walks, stretches) have a **Start** timer.
   - Drop sets show drop rows on the last set.
   - Creator programs can play a demo video, a voice note, or read the creator's talk line aloud as a step starts (once per step, not during rest or pause; spoken lines need Voice on).
   - The ✦ button opens the coach sheet: "What weight?", "Form cue", "Swap this", "It hurts", "Sets left?", or anything typed or spoken.
   - **Back / Skip**, the list button (jump to any step, end, discard), and **Pause** are always available. The back arrow minimizes the run; a bar at the bottom brings it back.
4. The last step, or **End workout**, finishes the run and opens the summary: time, sets, volume, copy log, and a pump/strain rating per muscle.
5. If signed in, the app syncs to Drive after the run and at launch.

**Following a program:** Discover → tap a program → Follow (free) or Subscribe (paid, test mode). Today runs it from then on. A day that already has logs keeps the program it was logged under.

**Building a program:** Discover → Create a program (or You → Studio) → New program or Remix. Set title, summary, level, price, tags. Per day: name the workout, add blocks (Warm-up, Superset, Straight, Core, Finisher, Stretches), add moves from the vault or as custom moves, set sets/reps/RIR/cues/talk, film or record. **Follow it on Today** to test-run it; **Listed in Discover** publishes it (needs a title, a workout day, and a creator name).

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

`Session.programId` names the program the run used (missing = Followset Original).

```
localStorage["followset-market-v1"]  { version: 1, programs: Program[], subscriptions: Subscription[], activeId, me: Creator }
  Program { id, title, summary, creator { id, name, handle, bio }, price, level, tags[], days { Mon?: Workout … },
            published, builtin?, createdAt, updatedAt }
  Item (in Workout.groups[].items) adds videoRef?, voiceRef? ("local:<id>" or a cloud URL) and talk?
localStorage["followset-health-v1"]  { version: 1, metrics { weight|bodyFat|restingHr|hrv|sleep|steps|activeEnergy: {date,value}[] },
                                       labs[], food[], goals { cal, protein, carbs, fat }, importedAt? }
localStorage["followset-coach-v1"]   last 60 chat messages
localStorage["followset-cloud-session"]  Supabase session (cloud only)
```

Other storage: IndexedDB `fitty-photos` (photos) and `followset-media` (creator video/voice), `sessionStorage` (unsaved field drafts, Drive token), `localStorage` flags `fitty-google-signed-in`, `fitty-last-synced`, `fitty-seed:2026-10-26:push-1`.

Cloud (when on): Supabase tables `profiles`, `programs`, `subscriptions`, `user_data` (the synced snapshot, `src/lib/snapshot.ts`), `mcp_keys`, `suggestions`, `coach_usage`; storage bucket `media`. Schema and RLS: `supabase/migrations/`.

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
- **Which program a day runs:** a session that has started or has logs keeps its `programId`; otherwise the followed program (`activeId`). An unknown program id falls back to the Original.
- **Supersets in Studio** are lettered A, B, C… in order (`relabel`). A block's kind sets each move's phase: Warm-up → warmup, Stretches → stretch, Finisher → finisher, everything else → work. Non-work moves get no muscle and RIR "—".
- **Paid programs:** following needs a subscription unless the program is free or yours. Test-mode subscriptions are stored locally (`test: true`) and never charge.
- **Built-in coach:** rules over your data, checked in this order: pain (stop, swap, see a professional) → swap → lift weight/progression → sets left (mid-set) → form cue → rest → food/protein → sleep/HRV/recovery → labs → body weight → today's workout → weekly progress → a general answer. Health and lab answers end with "General fitness guidance, not medical advice."
- **Cloud coach:** used when the cloud is on and you're signed in; sends a text summary of your data plus the last 10 messages. Any failure (offline, limit, error) answers with the built-in coach instead. Daily cap per user: `COACH_DAILY_LIMIT` (default 60).
- **Lab flags:** below the entered low → low; above the entered high → high.
- **Health import:** steps and active energy are summed per day; other metrics averaged per day; body fat ≤ 1 is treated as a fraction (×100); kg → lb.
- **Cloud programs:** Discover pulls every published program when the cloud is on (signed in or not) and merges them with your local ones; your own come from this device. While signed in, any program of yours that is published (or was before) and changed since its last push is pushed 1.5 s after the change; on-device videos and voice notes upload once to `media/<uid>/<program>/…` and the program then points at their public URLs.
- **Cloud sync:** while signed in, the snapshot (last 180 days of sessions, 365 of health, 60 of food, all labs, the followed program, a summary) uploads 5 s after the last change. AI suggestions are pulled at launch and when the app comes to the foreground, saved as Studio drafts tagged "AI suggested", and marked claimed.
- **Oct 26 seed:** a phone with no log for 2026-10-26 gets the paper-logged Push workout once (27 sets, incline press noted as 120 total / 60 per hand). Never written over a day that has logs, never re-added after deletion.

## Roles & permissions

On the device: single user, no accounts. Anyone with the phone can see and edit everything on it. Drive access uses the `drive.file` scope: the app can only see files it created. Repo write access = deploy access.

Cloud (RLS, tested): a creator inserts, edits, and deletes only their own programs and media folder; everyone, signed in or not, reads published programs; each user reads and writes only their own synced data and suggestions. Connector keys, coach usage, and subscriptions can't be read or written by any client; only edge functions with the service role touch them. A connector link gives read access to that user's synced data plus the suggest tool; making a new link revokes the old one.

## Procedures

**Change the program:** edit `src/lib/program.ts`. Every new exercise needs 2–3 cues in `src/lib/cues.ts` (the app throws on load otherwise) and media (see next). Run `npm test`; the media test fails if a file is missing.

**Add or replace media:** put files in `public/media/<slug>/`. Map the name in `src/lib/media.ts` (`PREFIX`, `STARTS`, `ILLUSTRATED`, `STILL_ONLY`). Update `public/exercises.json` and `catalog/exercises.csv`. If you replace a file at an existing path, bump `MEDIA` in `public/sw.js` (currently `followset-media-v3`; bump to the next number) or phones keep the old one.

**Deploy:** merge to `main`. CI tests, builds, and publishes. Each build stamps a new service-worker cache; phones pick it up on the next launch after the one that downloads it.

**Back up / move phones:** You → Export JSON, then Import JSON on the new phone. Or sign in to Drive on both.

**Run locally:** `npm install && npm run dev`.

**Publish a program (local):** Studio → open it → toggle **Listed in Discover**. Until the cloud is on, it's listed only on this device.

**Import health data:** install Health Auto Export on the iPhone, export JSON (weight, body fat, resting HR, HRV, sleep, steps, active energy), then Coach → Health → Import.

**Set up the cloud / connect an AI:** `docs/CLOUD.md`.

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
| Followed program has no workout today | Rest-day card; tap another day to run it. |
| A program is deleted while a day still references it | That day runs the Original. |
| No camera or mic permission in Studio | Recorder shows an error; **Upload a file** still works (60 MB max). |
| Cloud coach unreachable or over the daily limit | The built-in coach answers instead. |
| Health file isn't a Health Auto Export JSON | Toast: "That isn't a Health Auto Export JSON file." Nothing changes. |

## Quality control

- `npm test`: queue shape (Tuesday = 41 steps), focus sets, every program exercise has media on disk, catalog files exist, v2 parsing, seed rules, merge rules, grade math, progression, log text, spoken numbers, zip CRC; plus (`tests/cloud.test.ts`) program fallback, publish rules, superset lettering, vault items, Health Auto Export parsing, built-in coach intents, coach prompt building, the snapshot, every MCP method and tool, and suggestion → draft conversion.
- Browser checks (manual, before releases): `tests/browser/README.md`.
- Database: the migration has been applied to Postgres 16 and probed with 21 RLS checks (`tests/browser/rls.sh`). Re-run after any schema change.
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
| Today shows the wrong program on a past day | That day was logged under another program (by design) | Discard or delete that day's logs to make it follow the current program. |
| Coach replies say "built-in coach" while signed in | Cloud coach failed or hit the daily cap | Check function logs: `supabase functions logs coach`. |
| Assistant says "No data synced yet" | Snapshot never uploaded | Open the app while signed in and wait 5 s; check `user_data` has a row. |
| Assistant gets 401 from the connector | Link revoked (a newer one was made) | Coach → Use your own AI → Create connector link, re-add it. |
| Page scrolls sideways on Coach | A chip row widened a grid track | Give the grid `minmax(0, 1fr)` and children `min-width: 0` (see DESIGN.md rules). |

## Maintenance

- After each training block, review the program and progression step.
- Monthly: Export JSON as an offline backup; Export photo zip if photos matter.
- Keep dependencies current with `npm outdated` a few times a year; run the full QC list after upgrades.
- Owner: Jordan.

## Known limitations

Shortcuts taken on purpose. Fix before the cloud goes public.

| Limitation | Risk | Fix |
|---|---|---|
| Paywall is app-side: published paid programs' `days` are readable by anyone through the API | A technical user can read a paid program for free | With Stripe live, split `days` into a table readable only with an active `subscriptions` row (or the creator). |
| Subscribe is test mode (MOCKED) | No revenue; creators can't get paid | Stripe Connect + `checkout` + a webhook (docs/CLOUD.md → Payments). |
| Cloud functions never run on Supabase | Unknown deploy/runtime issues | Run the docs/CLOUD.md smoke test. |
| A program another creator unpublishes stays on devices that already pulled it | Stale listing; followers keep running it | Track cloud-sourced ids and drop ones missing from the next pull (keep it if being followed). |
| Cloud sync starts on the next render after sign-in, not instantly | A few seconds' delay | Fine for now. |
| One followed program at a time | Can't mix two creators' weeks | By design for v4. |

## Change log

| Date | Change |
|---|---|
| 2026-10-27 | **v4: marketplace, Studio, coach.** New tabs Today / Discover / Coach / Progress / You (History moved under Progress, the Library is now the Exercise vault under Discover). Discover lists programs (free/paid/following filters, program sheet, follow, test-mode subscribe, remix). Studio builds programs from the vault or custom moves with creator video, voice notes, and talk lines, then publishes. Today and the runner follow the chosen program; rest days supported. Runner plays creator media/talk and has an Ask Coach sheet. Coach tab: chat (built-in rules coach, Claude when signed in), food log with macro goals, Health Auto Export import, lab entry with range flags, "Use your own AI" MCP connector. Tablet and desktop layouts (side rail, split workout screen). Supabase cloud written (schema + RLS tested on Postgres; MCP logic tested with the official MCP client; functions not yet deployed). Fixed: Coach page scrolled sideways on phones, desktop rail pill stuck on Today, "1 days"/"1 markers" copy. |
| 2026-10-27 | **v3 rebuild from source.** Vite + React + TypeScript replaces the 4 MB minified single file (now ~90 KB gzipped plus fonts). New UI: dark canvas, lime/lilac/peach bento cards, pill nav, full-screen runner with steppers and a ring rest timer. Program repeats weekly instead of ending Nov 1. Added: week navigation, last-time and progression hints, weekly volume chart, per-muscle sparklines, JSON import, Drive sign-out, step jump list, minimize-while-running bar, midnight rollover. Fixed: Drive sign-in timed out after 2 s (consent popup could never finish), Drive merge never applied edits from another device, catalog pointed the incline walk at a missing GIF, offline launch needed precached assets, photo zip names collided for repeat shots. Dropped: v1 `fitty-workout-log` import and the one-time Oct 26 "repair" that could overwrite a hand-logged Oct 26. |
| 2026-10-27 | **Motion + prefill.** Spring press feedback on every tappable item, sliding selection pills (tab bar, week strip), staggered screen entrances, step and rest transitions, stepper number roll, dial sweep, swipe-down-to-close sheets, Android tap haptic (docs/DESIGN.md → Motion). The weight now prefills with last time's weight; the progression suggestion is a one-tap "Use X" button instead of being prefilled. |
| 2026-10-27 | **Back to lime, themes kept.** Jordan rejected the pink. Accent is neon lime again (#d9f34a) in both Light and Dark; the Auto/Light/Dark setting stays. Dark theme is neutral near-black. Illustrations back to lime; media cache bumped to `followset-media-v3`. |
| 2026-10-27 | **Hot pink + light/dark themes.** Accent changed from lime to neon hot pink (#ff3d9a, dark text on pink fills). Added Dark theme and an Auto/Light/Dark setting (You → Appearance, stored as `settings.theme`). Warm-up/stretch illustrations recolored pink; media cache bumped to `followset-media-v2`. |
| 2026-10-27 | **Restyle to the Rondesign reference** (docs/DESIGN.md). Light warm canvas with blurred glows, white frosted cards, thin Outfit numerals, Doto dot-matrix timers, knob-pill Start/Log buttons, tick rings and tick charts, black ↗ buttons, black-pill tabs. The workout screen is dark mauve glass over the blurred demo frame. Fonts: Inter Tight replaced by Outfit + Doto. |
| 2026-10-26 | v2 single-file build: End/Discard, Oct 26 Push seed, exercise catalog, demo GIFs, Drive sync, Settings gear. |
