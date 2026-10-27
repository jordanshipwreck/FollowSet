# Browser and backend checks

Not run by CI or `npm test`. Run them before a release that touches the screens or the cloud. Playwright and Chromium must be installed globally (`require('playwright')` works).

| Script | Checks | Run |
|---|---|---|
| `e2e.js` | A full workout: log, rest, reload mid-run, pause, end, rate, history edit, discard, next week, offline (18) | `npm run build && (cd dist && python3 -m http.server 8766 &)` then `node tests/browser/e2e.js <out-dir>` |
| `market.js` | Studio build/publish, follow, rest days, runner coach, health import, food, labs, pain answer; phone/tablet/desktop screenshots (15) | same server, `node tests/browser/market.js <out-dir>` |
| `motion.js`, `theme.js`, `toggle.js` | Press/slide motion, Light/Dark screenshots, theme switching | same server |
| `cloud-e2e.mts` + `mock-cloud.mts` | The app's cloud code against a mock of the Supabase REST contract: sign-in, pull, publish with media, sync, coach, connector, MCP client, suggestion → draft, delete (21) | `npx tsx tests/browser/mock-cloud.mts &`, build with `VITE_SUPABASE_URL=http://localhost:5190 VITE_SUPABASE_ANON_KEY=anon npx vite build --outDir /tmp/dist-cloud`, serve it on 5191, then `npx tsx tests/browser/cloud-e2e.mts <out-dir>`. Needs `tsx` and `@modelcontextprotocol/sdk` installed. |
| `mcp-e2e.mts` | The official MCP client against the server logic | `npx tsx tests/browser/mcp-e2e.mts` |
| `rls.sh` | Applies the migration to a throwaway Postgres and probes RLS (21) | `sudo bash tests/browser/rls.sh` |

The mock is not Supabase. A pass proves the app's side of the contract, not the deployed functions; run the smoke test in `docs/CLOUD.md` for that.
