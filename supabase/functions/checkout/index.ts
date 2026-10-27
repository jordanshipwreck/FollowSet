// POST /functions/v1/checkout  { programId, returnUrl }  →  { url }
// MOCKED: payments are not connected. This returns 501 until Stripe Connect is set up
// (docs/CLOUD.md, "Payments"). The app's subscribe flow stays in test mode meanwhile and never
// charges a card. Do not ship paid programs until this is real and tested.
import { CORS, reply, userFrom } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);
  if (!(await userFrom(req))) return reply({ error: "Sign in first" }, 401);
  return reply({ error: "Payments aren't connected yet" }, 501);
});
