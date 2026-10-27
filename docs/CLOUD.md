# Followset cloud (Supabase)

The app is local-first: everything works with no account. The cloud adds publishing programs to everyone, the Claude coach, the "Use your own AI" connector, and (later) paid subscriptions. It turns on only when the build has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Status (be honest here)

| Piece | Where | Status |
|---|---|---|
| Database schema + RLS | `supabase/migrations/20261027000000_followset_cloud.sql` | **Tested** on Postgres 16 with stubbed `auth`/`storage` schemas: applies cleanly; 21 RLS probes pass (own-only writes, published-only reads, keys/usage/subscriptions closed to clients, media folder per creator). Not yet applied to a real Supabase project. |
| MCP server logic | `supabase/functions/_shared/mcp.ts` | **Tested**: unit tests (`tests/cloud.test.ts`) and the official MCP TypeScript client over HTTP (initialize, tools/list, every tool, suggest_program). |
| MCP edge function (auth, storage) | `supabase/functions/mcp/index.ts` | Type-checked. **Not run on Supabase yet.** |
| Connector keys | `supabase/functions/mcp-key/index.ts` | Type-checked. **Not run on Supabase yet.** |
| Claude coach | `supabase/functions/coach/index.ts` + `_shared/coachPrompt.ts` | Prompt builder unit-tested; the Claude call type-checks against `@anthropic-ai/sdk` 1.3.0. **Never called with a real key.** |
| Checkout | `supabase/functions/checkout/index.ts` | **MOCKED.** Returns 501. The app's Subscribe button runs in test mode and charges nothing. |
| App sign-in, publish, sync | `src/lib/cloudAuth.ts`, `src/lib/cloudSync.ts`, `src/components/CloudCard.tsx` | **Tested against a mock** of the same REST contract (21 browser checks): email-code sign-in incl. a wrong code, Discover pulling another creator's program, publish with a demo video upload and URL swap, edit re-push without re-upload, snapshot sync, cloud coach reply, connector link, a real MCP client reading the snapshot and suggesting a program, the suggestion landing as a Studio draft, delete removing it from the cloud. The app also runs unchanged with the cloud off. **Not yet run against a live Supabase project**: the mock is not Supabase. |

## One-time setup

You need: a Supabase account, an Anthropic API key, and (for payments, later) a Stripe account.

1. **Create the project.** supabase.com → New project. Note the **Project URL** and the **anon public key** (Settings → API).
2. **Install the CLI** (`npm i -g supabase`), then from the repo root:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push                      # applies supabase/migrations/
   ```
3. **Email sign-in.** Authentication → Providers → Email: on. Authentication → Email Templates → "Magic Link": include `{{ .Token }}` so the email shows the 6-digit code the app asks for. Authentication → URL Configuration → Site URL: `https://jordanshipwreck.github.io/FollowSet/`.
4. **Secrets for the functions:**
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...      # the coach
   supabase secrets set COACH_DAILY_LIMIT=60               # optional, questions per user per day
   supabase secrets set COACH_MODEL=claude-opus-5-5        # optional; the default
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.
5. **Deploy the functions:**
   ```bash
   supabase functions deploy coach
   supabase functions deploy mcp-key
   supabase functions deploy checkout
   supabase functions deploy mcp --no-verify-jwt   # outside assistants call it with a connector key
   ```
6. **Point the app at it.** GitHub repo → Settings → Secrets and variables → Actions → **Variables**: `SUPABASE_URL` = Project URL, `SUPABASE_ANON_KEY` = anon key. Re-run the Pages workflow. (The anon key is public by design; RLS protects the data.)
7. **Smoke test** (in this order): You → sign in with your email code → Studio → publish a program → open the site in a private window and check Discover lists it → Coach → ask "what's today's workout?" (the reply should not say "built-in coach") → Coach → Use your own AI → Create connector link → add it in Claude (Settings → Connectors → Add custom connector) and ask "what did I lift Monday?".

## How it fits together

```
Phone (local-first)                         Supabase
  localStorage + IndexedDB  ── sign in ──▶  auth (email code)
  Studio publish            ── REST ────▶  programs (RLS: creator writes own, everyone reads published)
  creator video/voice       ── storage ─▶  media bucket (public read, <uid>/ folders)
  snapshot (debounced 5 s)  ── REST ────▶  user_data (RLS: own only)
  Coach question            ── fn ──────▶  coach → Claude (daily cap via coach_usage)
  Create connector link     ── fn ──────▶  mcp-key → mcp_keys (SHA-256 only)
  Claude / ChatGPT / Grok   ── MCP ─────▶  mcp?key=… → reads user_data, writes suggestions
  app open / foreground     ◀─ REST ────── suggestions → Studio drafts ("AI suggested")
```

### MCP tools

| Tool | Does |
|---|---|
| `get_overview` | Text summary: today, this week vs last, Gains Grade, food, health, labs. |
| `get_program` | The followed program's days and exercises. |
| `get_workouts` | Logged sessions with every set, last N days (default 14). |
| `get_lift_history` | One exercise over time with best set and estimated 1RM (Epley, reps capped at 12). |
| `get_health` | Imported readings, last N days (default 30). |
| `get_nutrition` | Daily macro totals vs goals, last N days (default 7). |
| `get_labs` | Lab markers with low/high flags. |
| `suggest_program` | The only write. Saves a cleaned program as a suggestion; the app turns it into a Studio **draft**. It never changes what Today runs. |

Security: the connector key sits in the URL because Claude, ChatGPT, and Grok all accept a plain URL for custom connectors. URLs can end up in gateway logs, so treat the link like a password; making a new link revokes the old one, and the key only reads that user's synced data plus creating Studio drafts. OAuth (MCP's auth spec) is the upgrade if this goes public at scale.

Programs pulled from the cloud are written by other people. The app rebuilds every field (`cleanDays` in `src/lib/market.ts`, `fromRow` in `src/lib/cloudAuth.ts`), drops anything malformed, allows only `http(s)` or on-device media refs, and never lets a remote row replace one of your own programs.

Protocol: Streamable HTTP, JSON responses only (no SSE), protocol `2025-06-18` (older client versions are echoed back). `GET` returns 405, notifications return 202.

### Coach request

System prompt = fixed instructions (`COACH_INSTRUCTIONS`) + the person's data summary, then up to 10 prior turns and the question. Effort `low` (chat), prompt caching on, server-side refusal fallback (`fallbacks: "default"`). Mid-set questions get a "one or two sentences" instruction. If the function fails for any reason, the app answers with its built-in coach.

## Payments (not built)

Plan: Stripe Connect Express. Each creator onboards to a connected account; `checkout` creates a Checkout Session in subscription mode with an application fee; a `stripe-webhook` function writes `subscriptions` rows (clients can't). Then move paid programs' `days` behind an RLS check on `subscriptions` (today every published program's days are readable; the paywall is app-side only, see docs/SOP.md → Known limitations).

## Costs to expect

- Supabase: free tier covers early testing (500 MB database, 1 GB storage, 500k function calls/month). Video storage is the first thing that grows.
- Coach: Claude Opus 5.5 is $4 / $20 per million input/output tokens. A typical question sends ~2–4k tokens of context; the reply plus its (low-effort) thinking is a few hundred output tokens. That is roughly 1–3 cents a question uncached, less when the prefix is cached. At the default cap (60/day) one heavy user tops out around $1–2/day. These are estimates: check real usage in the Anthropic Console after the first week. For a cheaper model set `COACH_MODEL=claude-haiku-5-5` (the function skips the refusal fallback for Haiku, which has none).
