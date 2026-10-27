# Followset roadmap

Goal: a marketplace where creators publish workouts (vault moves or their own filmed demos, talking mid-set), plus an AI total-health coach that reads your training, food, recovery, and labs, and connects to Claude, ChatGPT, or Grok.

Decisions behind this: `docs/DECISIONS.md` #13–20.

## Phases

| # | Phase | State | You test |
|---|---|---|---|
| 1 | Web app on phone, tablet, desktop: Discover, Studio, Coach, health and food logs, labs | **Built** (this branch). Local-only. | Build a program in Studio from the vault, film one move, add a talk line, follow it, run it. Ask the coach mid-set. Import a Health Auto Export file. |
| 2 | Cloud: sign-in, publishing to everyone, media upload, Claude coach, AI connector | **Code written, not deployed.** Schema/RLS and MCP logic tested; the functions have never run on Supabase. | Follow `docs/CLOUD.md` setup, then its smoke test. |
| 3 | Payments: Stripe Connect, creator payouts, real paywall | **Not built.** Subscribe runs in test mode. | Subscribe to a $4.99 program with a Stripe test card, see it unlock, cancel. |
| 4 | Native iPhone app | **Not started.** | Apple Health and Hume sync with no export step, background rest-timer notifications. |
| 5 | Integrations | Partly: Health Auto Export import, own food log, manual labs. | See below. |

## Integrations: what's possible

| Source | How | Notes |
|---|---|---|
| Apple Health / Apple Watch / Hume scale and band | **Now:** Health Auto Export app → JSON → Coach → Import. **Native app:** HealthKit directly. | A web page cannot read HealthKit. Hume writes into Apple Health, so it rides along. |
| MyFitnessPal | Own food log built in (Coach → Food). | MyFitnessPal has no public API for new apps. Importing its CSV export is possible later. |
| Rythm (bloodwork) | Manual lab entry with presets (Coach → Labs). | No public API. A PDF import (read the report with Claude) is a good next step once the cloud coach is live. |
| Claude, ChatGPT, Grok | MCP connector link (Coach → Use your own AI). | Needs phase 2 deployed. |

## Needs from you

| Item | Why | Where it goes |
|---|---|---|
| Supabase project URL + anon key | Turns the cloud on | GitHub repo variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Anthropic API key | Claude coach | `supabase secrets set ANTHROPIC_API_KEY=…` (never in the repo) |
| Stripe account (Connect enabled) | Paid programs, creator payouts | Phase 3 |
| Apple Developer account ($99/yr) | Native iPhone app, HealthKit | Phase 4 |
| Your call: platform fee on creator subscriptions | Pricing | Phase 3 (common range is 10–30%) |
| Your call: who can publish | Open to anyone vs invite-only creators at launch | Before phase 2 goes public |
