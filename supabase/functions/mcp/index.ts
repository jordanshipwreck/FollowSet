// MCP server (Streamable HTTP, JSON responses) for Claude, ChatGPT, Grok, or any MCP client.
// URL: /functions/v1/mcp?key=<connector key>   (or Authorization: Bearer <connector key>)
// The key comes from /functions/v1/mcp-key; only its SHA-256 is stored. Deploy with
// --no-verify-jwt: callers are outside assistants, not signed-in browsers.
import { handleRpc, type Snapshot, type SuggestedProgram } from "../_shared/mcp.ts";
import { CORS, db, reply, sha256 } from "../_shared/http.ts";

async function ownerOf(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const key = url.searchParams.get("key") ?? (bearer?.startsWith("fs_") ? bearer : null);
  if (!key) return null;
  const rows = await db<{ user_id: string }[]>(`mcp_keys?key_hash=eq.${await sha256(key)}&revoked_at=is.null&select=user_id`);
  if (!rows.length) return null;
  const uid = rows[0].user_id;
  // Best effort; a failed timestamp never blocks the call.
  db(`mcp_keys?key_hash=eq.${await sha256(key)}`, { method: "PATCH", body: JSON.stringify({ last_used_at: new Date().toISOString() }) }).catch(() => {});
  return uid;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  // No server-initiated stream: GET is not offered (spec allows 405).
  if (req.method !== "POST") return reply({ error: "POST JSON-RPC to this URL" }, 405, { Allow: "POST" });

  const uid = await ownerOf(req);
  if (!uid) return reply({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or revoked Followset connector key" } }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  let snapshot: Snapshot | null | undefined;
  const env = {
    now: new Date(),
    get snapshot() {
      return snapshot ?? null;
    },
    suggest: async (p: SuggestedProgram) => {
      const [row] = await db<{ id: string }[]>("suggestions", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ user_id: uid, program: p }),
      });
      return row.id;
    },
  };
  const loadSnapshot = async () => {
    const rows = await db<{ data: Snapshot }[]>(`user_data?user_id=eq.${uid}&select=data`);
    snapshot = rows[0]?.data ?? null;
  };

  const batch = Array.isArray(body) ? body : [body];
  if (batch.some((m) => (m as { method?: string })?.method === "tools/call")) await loadSnapshot();
  const out = (await Promise.all(batch.map((m) => handleRpc(m as Parameters<typeof handleRpc>[0], env)))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return reply(Array.isArray(body) ? out : out[0]);
});
