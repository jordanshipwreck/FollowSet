// POST /functions/v1/coach  { question, context, history, midSet }  →  { answer }
// Signed-in users only (Supabase verifies the JWT). Claude answers with the person's data as
// context. A per-user daily cap (COACH_DAILY_LIMIT, default 60) keeps the API bill bounded.
// When anything fails the app falls back to its built-in coach, so errors stay short.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { buildCoachMessages, parseCoachInput } from "../_shared/coachPrompt.ts";
import { CORS, db, reply, userFrom } from "../_shared/http.ts";

const client = new Anthropic(); // ANTHROPIC_API_KEY from the function's secrets
const MODEL = Deno.env.get("COACH_MODEL") ?? "claude-opus-5-5";
const DAILY = Number(Deno.env.get("COACH_DAILY_LIMIT") ?? "60");
// Haiku has no server-side refusal fallback; every other current model does.
const FALLBACK = MODEL.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);
  const user = await userFrom(req);
  if (!user) return reply({ error: "Sign in first" }, 401);

  let input;
  try {
    input = parseCoachInput(await req.json());
  } catch (e) {
    return reply({ error: (e as Error).message }, 400);
  }

  const used = await db<number>("rpc/bump_coach_usage", { method: "POST", body: JSON.stringify({ uid: user.id }) });
  if (used > DAILY) return reply({ error: "Daily coach limit reached" }, 429);

  const { system, messages } = buildCoachMessages(input);
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: input.midSet ? 2000 : 8000,
      // Chat, not deep work: low effort keeps answers quick and cheap.
      output_config: { effort: "low" },
      // Caches instructions + data + history; the next question in the same chat reuses it.
      cache_control: { type: "ephemeral" },
      // A safety-classifier decline is retried on Anthropic's recommended fallback model.
      ...FALLBACK,
      system,
      messages,
    });
    if (res.stop_reason === "refusal") return reply({ error: "declined" }, 422);
    const answer = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!answer) return reply({ error: "empty" }, 502);
    return reply({ answer });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reply({ error: "busy" }, 429);
    if (e instanceof Anthropic.APIError) {
      console.error("coach api", e.status, e.message);
      return reply({ error: "coach unavailable" }, 502);
    }
    console.error("coach", e);
    return reply({ error: "coach unavailable" }, 500);
  }
});
