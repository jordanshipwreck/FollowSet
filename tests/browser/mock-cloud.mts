// Contract-faithful stand-in for Supabase (only the endpoints the app uses), for browser tests.
// Emulates RLS on writes (creator_id must match the token's user). Uses the REAL MCP + coach-input logic.
import http from "node:http";
import { handleRpc } from "../../supabase/functions/_shared/mcp.ts";
import { parseCoachInput } from "../../supabase/functions/_shared/coachPrompt.ts";

const PORT = 5190, BASE = `http://localhost:${PORT}`;
const users: Record<string, { id: string; email: string }> = { "tok-A": { id: "uuid-A", email: "kay@test.dev" } };
const st = {
  programs: [{ id: "remote-1", creator_id: "uuid-B", creator_name: "Remote Rae", creator_handle: "rae", title: "Rae Glute Lab", summary: "Cloud program", price_cents: 0, level: "beginner", tags: ["glutes"], published: true, updated_at: new Date().toISOString(),
    days: { Wed: { title: "Glutes", groups: [{ label: "Straight", rest: 60, items: [{ name: "Hip thrust", sets: 3, reps: "10", rir: "1–2", station: "bench", muscle: "glutes", phase: "work", cues: ["Chin tucked."] }] }] } } }] as any[],
  userData: {} as Record<string, any>, suggestions: [] as any[], media: {} as Record<string, { type: string; body: Buffer }>,
  coachCalls: [] as any[], keys: {} as Record<string, string>, log: [] as string[],
};
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };
const send = (res: http.ServerResponse, code: number, body?: unknown, h: Record<string, string> = {}) => {
  res.writeHead(code, { ...cors, "Content-Type": "application/json", ...h }); res.end(body === undefined ? "" : JSON.stringify(body)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url!, BASE); const path = url.pathname;
  if (req.method === "OPTIONS") return send(res, 204);
  const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer); const raw = Buffer.concat(chunks);
  const json = () => JSON.parse(raw.toString() || "null");
  const user = users[(req.headers.authorization ?? "").replace("Bearer ", "")];
  st.log.push(`${req.method} ${path}${url.search}`);
  if (path === "/__state") return send(res, 200, { ...st, media: Object.fromEntries(Object.entries(st.media).map(([k, v]) => [k, { type: v.type, bytes: v.body.length }])) });
  if (req.headers.apikey !== "anon" && !path.startsWith("/storage/v1/object/public") && !path.startsWith("/functions/v1/mcp")) return send(res, 401, { message: "No API key" });

  if (path === "/auth/v1/otp") return send(res, 200, {});
  if (path === "/auth/v1/verify") { const b = json(); return b.token === "123456" ? send(res, 200, { access_token: "tok-A", refresh_token: "r", expires_in: 3600, user: { id: "uuid-A", email: b.email } }) : send(res, 400, { msg: "Token has expired or is invalid" }); }

  if (path === "/rest/v1/programs" && req.method === "GET") return send(res, 200, st.programs.filter((p) => p.published));
  if (path === "/rest/v1/programs" && req.method === "POST") {
    const row = json(); if (!user || row.creator_id !== user.id) return send(res, 403, { message: "new row violates row-level security policy" });
    st.programs = st.programs.filter((p) => p.id !== row.id).concat({ ...row, updated_at: new Date().toISOString() }); return send(res, 201);
  }
  if (path === "/rest/v1/programs" && req.method === "DELETE") { const id = url.searchParams.get("id")!.replace("eq.", ""); st.programs = st.programs.filter((p) => !(p.id === id && p.creator_id === user?.id)); return send(res, 204); }
  if (path === "/rest/v1/user_data" && req.method === "POST") { const row = json(); if (!user || row.user_id !== user.id) return send(res, 403, { message: "rls" }); st.userData[row.user_id] = row.data; return send(res, 201); }
  if (path === "/rest/v1/suggestions" && req.method === "GET") { if (!user) return send(res, 401, {}); return send(res, 200, st.suggestions.filter((s) => s.user_id === user.id && !s.claimed_at)); }
  if (path === "/rest/v1/suggestions" && req.method === "PATCH") { const id = url.searchParams.get("id")!.replace("eq.", ""); const s = st.suggestions.find((x) => x.id === id && x.user_id === user?.id); if (s) s.claimed_at = json().claimed_at; return send(res, 204); }

  const up = path.match(/^\/storage\/v1\/object\/media\/(.+)$/);
  if (up && req.method === "POST") { if (!user || !up[1].startsWith(user.id + "/")) return send(res, 403, { message: "rls" }); st.media[up[1]] = { type: String(req.headers["content-type"]), body: raw }; return send(res, 200, { Key: up[1] }); }
  const pub = path.match(/^\/storage\/v1\/object\/public\/media\/(.+)$/);
  if (pub) { const m = st.media[pub[1]]; if (!m) return send(res, 404, {}); res.writeHead(200, { ...cors, "Content-Type": m.type }); return res.end(m.body); }

  if (path === "/functions/v1/coach") { if (!user) return send(res, 401, {}); const inp = parseCoachInput(json()); st.coachCalls.push(inp); return send(res, 200, { answer: `CLOUD COACH: ${inp.question} (context ${inp.context.length} chars, ${inp.history.length} turns, midSet ${inp.midSet})` }); }
  if (path === "/functions/v1/mcp-key") { if (!user) return send(res, 401, {}); for (const k of Object.keys(st.keys)) if (st.keys[k] === user.id) delete st.keys[k]; const key = "fs_" + Math.random().toString(36).slice(2); st.keys[key] = user.id; return send(res, 200, { key, url: `${BASE}/functions/v1/mcp?key=${key}` }); }
  if (path === "/functions/v1/mcp") {
    const uid = st.keys[url.searchParams.get("key") ?? ""]; if (!uid) return send(res, 401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "revoked" } });
    if (req.method !== "POST") return send(res, 405, {});
    const body = json(); const batch = Array.isArray(body) ? body : [body];
    const out = (await Promise.all(batch.map((m) => handleRpc(m, { snapshot: st.userData[uid] ?? null, now: new Date(), suggest: async (p) => { const id = "sg-" + st.suggestions.length; st.suggestions.push({ id, user_id: uid, program: p, created_at: new Date().toISOString(), claimed_at: null }); return id; } })))).filter(Boolean);
    return out.length ? send(res, 200, Array.isArray(body) ? out : out[0]) : send(res, 202);
  }
  send(res, 404, { message: `mock: no route ${req.method} ${path}` });
}).listen(PORT, () => console.log("mock cloud on", PORT));
