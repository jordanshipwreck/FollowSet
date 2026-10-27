// POST /functions/v1/mcp-key  →  { key, url }
// Issues a fresh connector key for the signed-in user and revokes their older ones.
// The key is shown once; only its hash is stored.
import { CORS, db, reply, sha256, userFrom } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);
  const user = await userFrom(req);
  if (!user) return reply({ error: "Sign in first" }, 401);

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const key = "fs_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await db(`mcp_keys?user_id=eq.${user.id}&revoked_at=is.null`, { method: "PATCH", body: JSON.stringify({ revoked_at: new Date().toISOString() }) });
  await db("mcp_keys", { method: "POST", body: JSON.stringify({ user_id: user.id, key_hash: await sha256(key) }) });
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mcp?key=${key}`;
  return reply({ key, url });
});
