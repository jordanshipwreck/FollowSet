// Followset MCP server logic: pure, import-free, so Deno (edge function) and vitest (tests/) both
// load it. The edge function handles auth and storage; this file turns JSON-RPC into answers
// over the user's synced snapshot.
//
// Read tools answer from the snapshot. The one write tool, suggest_program, never touches the
// user's plan: it returns a draft that lands in Studio for the user to review, edit, and follow.

/** What the app syncs to the cloud (user_data.data). Keep in step with src/lib/snapshot.ts. */
export interface Snapshot {
  v: 1;
  at: string;
  units: "lb";
  summary: string;
  program: {
    id: string;
    title: string;
    creator: string;
    days: Record<string, { title: string; exercises: { name: string; sets: number; reps: string; rir: string; block: string }[] }>;
  };
  sessions: {
    date: string;
    day: string;
    program: string;
    finished: boolean;
    sets: { name: string; side: string | null; set: number; weight: string; reps: string }[];
    ratings: { muscle: string; pump: number; strain: number }[];
  }[];
  health: {
    metrics: Record<string, { date: string; value: number }[]>;
    labs: { date: string; name: string; value: number; unit: string; low?: number; high?: number }[];
    food: { date: string; name: string; cal: number; protein: number; carbs: number; fat: number }[];
    goals: { cal: number; protein: number; carbs: number; fat: number };
  };
}

/** A program an outside assistant proposes. Stored as a suggestion; the app turns it into a Studio draft. */
export interface SuggestedProgram {
  title: string;
  summary: string;
  days: Record<string, { title: string; blocks: { label: string; rest: number; exercises: { name: string; sets: number; reps: string; rir: string; cues: string[] }[] }[] }>;
}

export const PROTOCOL_VERSION = "2025-06-18";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
}

const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const days = { type: "integer", minimum: 1, maximum: 365, description: "How many days back to include." };

export const TOOLS: Tool[] = [
  {
    name: "get_overview",
    title: "Overview",
    description: "Start here. One-page summary: today's plan, this week vs last week, Gains Grade, food today, latest health readings, labs.",
    inputSchema: obj(),
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_program",
    title: "Current program",
    description: "The program the user follows: every training day with its exercises, sets, reps, and RIR.",
    inputSchema: obj(),
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_workouts",
    title: "Workout log",
    description: "Logged sessions with every set (weight in lb x reps) and pump/strain ratings. Newest first.",
    inputSchema: obj({ days: { ...days, default: 14 } }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_lift_history",
    title: "Lift history",
    description: "Every logged session of one exercise with its best set and estimated 1RM, oldest first. Partial names match.",
    inputSchema: obj({ exercise: { type: "string", description: "Exercise name, e.g. 'incline press'." } }, ["exercise"]),
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_health",
    title: "Health metrics",
    description: "Body and recovery readings from Apple Health, Hume, and Apple Watch: weight, bodyFat, restingHr, hrv, sleep, steps, activeEnergy.",
    inputSchema: obj({ metric: { type: "string", enum: ["weight", "bodyFat", "restingHr", "hrv", "sleep", "steps", "activeEnergy"] }, days: { ...days, default: 30 } }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_nutrition",
    title: "Nutrition",
    description: "Daily calorie and macro totals from the food log against the user's goals, plus the foods logged.",
    inputSchema: obj({ days: { ...days, default: 7 } }),
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_labs",
    title: "Lab results",
    description: "Bloodwork markers the user entered (e.g. from Rythm), with reference ranges and out-of-range flags.",
    inputSchema: obj(),
    annotations: { readOnlyHint: true },
  },
  {
    name: "suggest_program",
    title: "Suggest a program",
    description:
      "Propose a training program tailored to the user. It appears in Followset Studio as a draft the user reviews and chooses to follow; it never changes their current plan. Use 1 to 7 days (Mon..Sun); days left out are rest days.",
    inputSchema: obj(
      {
        title: { type: "string" },
        summary: { type: "string", description: "Who it's for, session length, equipment." },
        days: {
          type: "object",
          description: "Keys Mon..Sun.",
          additionalProperties: {
            type: "object",
            properties: {
              title: { type: "string" },
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Warm-Up, Superset A, Straight, Core, Finisher, or Stretches." },
                    rest: { type: "integer", minimum: 0, maximum: 600, description: "Seconds of rest after each round." },
                    exercises: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          sets: { type: "integer", minimum: 1, maximum: 10 },
                          reps: { type: "string", description: "e.g. '8-12' or '30 s'." },
                          rir: { type: "string", description: "Reps in reserve, e.g. '1-2'." },
                          cues: { type: "array", items: { type: "string" } },
                        },
                        required: ["name", "sets", "reps"],
                      },
                    },
                  },
                  required: ["label", "exercises"],
                },
              },
            },
            required: ["title", "blocks"],
          },
        },
      },
      ["title", "days"],
    ),
  },
];

// ---------- Tool bodies ----------

const cutoff = (now: Date, n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const clampDays = (v: unknown, d: number) => (typeof v === "number" && v >= 1 ? Math.min(365, Math.floor(v)) : d);
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Epley estimate; bodyweight or blank sets have none. */
export function e1rm(weight: string, reps: string): number | null {
  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  if (!(w > 0) || !(r > 0)) return null;
  return Math.round(w * (1 + Math.min(r, 12) / 30));
}

function liftHistory(s: Snapshot, exercise: string) {
  const want = norm(exercise);
  const rows = [];
  for (const ses of [...s.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const sets = ses.sets.filter((x) => norm(x.name).includes(want));
    if (!sets.length) continue;
    let best = sets[0];
    let bestE = -1;
    for (const x of sets) {
      const e = e1rm(x.weight, x.reps) ?? 0;
      if (e > bestE) {
        bestE = e;
        best = x;
      }
    }
    rows.push({ date: ses.date, exercise: best.name, sets: sets.map((x) => `${x.weight}x${x.reps}${x.side ? ` ${x.side}` : ""}`), best: `${best.weight}x${best.reps}`, e1rm: bestE > 0 ? bestE : null });
  }
  return rows;
}

function nutrition(s: Snapshot, n: number, now: Date) {
  const from = cutoff(now, n - 1);
  const byDay = new Map<string, { cal: number; protein: number; carbs: number; fat: number; foods: string[] }>();
  for (const f of s.health.food) {
    if (f.date < from) continue;
    const d = byDay.get(f.date) ?? { cal: 0, protein: 0, carbs: 0, fat: 0, foods: [] };
    d.cal += f.cal;
    d.protein += f.protein;
    d.carbs += f.carbs;
    d.fat += f.fat;
    d.foods.push(f.name);
    byDay.set(f.date, d);
  }
  return { goals: s.health.goals, days: [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, t]) => ({ date, ...t })) };
}

const labFlag = (l: Snapshot["health"]["labs"][number]) => (l.low != null && l.value < l.low ? "low" : l.high != null && l.value > l.high ? "high" : null);

/** Validate and tidy a suggested program. Throws a readable message on bad input. */
export function cleanSuggestion(a: Record<string, unknown>): SuggestedProgram {
  const title = typeof a.title === "string" ? a.title.trim().slice(0, 80) : "";
  if (!title) throw new Error("title is required");
  const rawDays = a.days && typeof a.days === "object" ? (a.days as Record<string, unknown>) : {};
  const out: SuggestedProgram = { title, summary: typeof a.summary === "string" ? a.summary.slice(0, 600) : "", days: {} };
  for (const [k, v] of Object.entries(rawDays)) {
    const day = DAY_NAMES.find((d) => d.toLowerCase() === k.slice(0, 3).toLowerCase());
    if (!day || !v || typeof v !== "object") continue;
    const w = v as { title?: unknown; blocks?: unknown };
    const blocks = (Array.isArray(w.blocks) ? w.blocks : []).slice(0, 12).flatMap((b) => {
      const bb = b as { label?: unknown; rest?: unknown; exercises?: unknown };
      const exercises = (Array.isArray(bb.exercises) ? bb.exercises : []).slice(0, 8).flatMap((e) => {
        const ee = e as Record<string, unknown>;
        const name = typeof ee.name === "string" ? ee.name.trim().slice(0, 80) : "";
        if (!name) return [];
        const sets = Math.max(1, Math.min(10, Math.round(Number(ee.sets) || 3)));
        return [{ name, sets, reps: String(ee.reps ?? "10").slice(0, 20), rir: String(ee.rir ?? "1-2").slice(0, 10), cues: (Array.isArray(ee.cues) ? ee.cues : []).map(String).slice(0, 5) }];
      });
      if (!exercises.length) return [];
      return [{ label: typeof bb.label === "string" && bb.label.trim() ? bb.label.trim().slice(0, 40) : "Straight", rest: Math.max(0, Math.min(600, Math.round(Number(bb.rest) || 90))), exercises }];
    });
    if (blocks.length) out.days[day] = { title: typeof w.title === "string" && w.title.trim() ? w.title.trim().slice(0, 60) : `${day} workout`, blocks };
  }
  if (!Object.keys(out.days).length) throw new Error("days needs at least one day with exercises");
  return out;
}

export interface ToolEnv {
  snapshot: Snapshot | null;
  now: Date;
  /** Store a suggestion; returns its id. */
  suggest?: (p: SuggestedProgram) => Promise<string>;
}

export async function callTool(name: string, args: Record<string, unknown>, env: ToolEnv): Promise<{ text: string; isError?: boolean }> {
  const s = env.snapshot;
  const json = (v: unknown) => ({ text: JSON.stringify(v, null, 1) });
  if (name === "suggest_program") {
    if (!env.suggest) return { text: "Suggestions aren't available.", isError: true };
    try {
      const p = cleanSuggestion(args);
      await env.suggest(p);
      return { text: `Saved "${p.title}" (${Object.keys(p.days).join(", ")}) as a draft in the user's Followset Studio. They'll review it and choose whether to follow it.` };
    } catch (e) {
      return { text: `Not saved: ${(e as Error).message}`, isError: true };
    }
  }
  if (!TOOLS.some((t) => t.name === name)) return { text: `Unknown tool ${name}`, isError: true };
  if (!s) return { text: "No data synced yet. Ask the user to open Followset while signed in.", isError: true };
  switch (name) {
    case "get_overview":
      return { text: `${s.summary}\n(Synced ${s.at}. Weights in lb.)` };
    case "get_program":
      return json(s.program);
    case "get_workouts": {
      const from = cutoff(env.now, clampDays(args.days, 14));
      return json(s.sessions.filter((x) => x.date >= from && x.sets.length).sort((a, b) => b.date.localeCompare(a.date)));
    }
    case "get_lift_history": {
      const ex = typeof args.exercise === "string" ? args.exercise : "";
      if (!norm(ex)) return { text: "exercise is required", isError: true };
      const rows = liftHistory(s, ex);
      return rows.length ? json(rows) : { text: `No logged sets match "${ex}".` };
    }
    case "get_health": {
      const from = cutoff(env.now, clampDays(args.days, 30));
      const keys = typeof args.metric === "string" ? [args.metric] : Object.keys(s.health.metrics);
      const out: Record<string, { date: string; value: number }[]> = {};
      for (const k of keys) out[k] = (s.health.metrics[k] ?? []).filter((p) => p.date >= from);
      return json(out);
    }
    case "get_nutrition":
      return json(nutrition(s, clampDays(args.days, 7), env.now));
    case "get_labs":
      return json(s.health.labs.map((l) => ({ ...l, flag: labFlag(l) })));
  }
  return { text: `Unknown tool ${name}`, isError: true };
}

// ---------- JSON-RPC ----------

interface Rpc {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const INSTRUCTIONS =
  "Followset is the user's workout, nutrition, recovery, and lab tracker. Call get_overview first. Weights are lb. Health and lab answers are general fitness guidance, not medical advice. To build the user a plan, use suggest_program: it lands in their Studio as a draft they approve.";

/** Handle one JSON-RPC message. Returns null for notifications (HTTP 202, no body). */
export async function handleRpc(msg: Rpc, env: ToolEnv): Promise<Record<string, unknown> | null> {
  const id = msg.id ?? null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(-32600, "Invalid request");
  if (msg.id === undefined) return null; // notification (e.g. notifications/initialized)
  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.protocolVersion === "string" ? (msg.params.protocolVersion as string) : PROTOCOL_VERSION;
      return ok({
        protocolVersion: asked <= PROTOCOL_VERSION ? asked : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "followset", title: "Followset", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = typeof msg.params?.name === "string" ? (msg.params.name as string) : "";
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      const r = await callTool(name, args, env);
      return ok({ content: [{ type: "text", text: r.text }], isError: !!r.isError });
    }
    default:
      return err(-32601, `Method not found: ${msg.method}`);
  }
}
