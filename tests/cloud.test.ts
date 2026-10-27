import { describe, expect, it } from "vitest";
import { buildCoachMessages, COACH_INSTRUCTIONS, parseCoachInput } from "../supabase/functions/_shared/coachPrompt";
import { callTool, cleanSuggestion, e1rm, handleRpc, PROTOCOL_VERSION, TOOLS, type Snapshot, type SuggestedProgram } from "../supabase/functions/_shared/mcp";
import { relabel } from "../src/lib/blocks";
import { alternatives, localAnswer, type CoachContext } from "../src/lib/coach";
import { parseHealthExport, type HealthState } from "../src/lib/health";
import { cleanDays, ORIGINAL, ORIGINAL_ID, publishProblems, REST_DAY, workoutFor, type Program } from "../src/lib/market";
import { PROGRAM, type Group, type Item } from "../src/lib/program";
import { buildSnapshot, daysFromSuggestion } from "../src/lib/snapshot";
import { applySeed, emptyState } from "../src/lib/store";
import { customItem, itemFromVault, timedSeconds, type VaultEntry } from "../src/lib/vault";

const NOW = new Date("2026-10-27T12:00:00Z");
const TODAY = "2026-10-27";

const vaultEntry = (p: Partial<VaultEntry>): VaultEntry => ({
  slug: "x",
  name: "Flat DB press",
  primaryMuscles: ["chest"],
  secondaryMuscles: [],
  station: "dumbbells",
  equipment: "Dumbbell",
  unilateral: false,
  defaultReps: "8–12",
  defaultSets: 3,
  restSeconds: 90,
  cues: ["Shoulder blades back."],
  phase: "work",
  days: [],
  drop: false,
  demoGif: null,
  still: "",
  ...p,
});
const VAULT = [
  vaultEntry({}),
  vaultEntry({ slug: "a", name: "Machine chest press", station: "machine", equipment: "Machine" }),
  vaultEntry({ slug: "b", name: "Push-up", station: "floor", equipment: "Bodyweight" }),
  vaultEntry({ slug: "c", name: "Plank", primaryMuscles: ["abs"], defaultReps: "45 s", phase: "work", equipment: "Bodyweight", station: "floor" }),
  vaultEntry({ slug: "d", name: "Cat-cow", primaryMuscles: ["back"], phase: "stretch", defaultReps: "30 s", station: "floor" }),
];

const health = (p: Partial<HealthState> = {}): HealthState => ({ version: 1, metrics: {}, labs: [], food: [], goals: { cal: 2500, protein: 200, carbs: 250, fat: 80 }, ...p });
const seeded = () => applySeed(emptyState());
const ctx = (p: Partial<CoachContext> = {}): CoachContext => ({ app: seeded(), program: ORIGINAL, health: health(), vault: VAULT, today: TODAY, ...p });

const snapshot = (): Snapshot =>
  buildSnapshot(
    seeded(),
    health({
      metrics: { weight: [{ date: "2026-10-26", value: 181.6 }, { date: "2025-01-01", value: 190 }] },
      labs: [{ id: "l", date: "2026-10-20", name: "HDL", value: 32, unit: "mg/dL", low: 40 }],
      food: [{ id: "f", date: TODAY, at: 1, name: "Eggs", cal: 300, protein: 24, carbs: 2, fat: 20 }],
    }),
    ORIGINAL,
    TODAY,
  );

describe("market", () => {
  it("the Original carries the built-in program and missing programs fall back to it", () => {
    expect(workoutFor(ORIGINAL_ID, "Tue")).toBe(PROGRAM.Tue);
    expect(workoutFor(undefined, "Mon")).toBe(PROGRAM.Mon);
    expect(workoutFor("no-such-program", "Mon")).toBe(PROGRAM.Mon);
  });

  it("blocks publishing until title, a workout day, and a creator name exist", () => {
    const p: Program = { ...ORIGINAL, id: "p", title: " ", days: {}, creator: { id: "me", name: "", handle: "", bio: "" }, builtin: undefined };
    expect(publishProblems(p)).toHaveLength(3);
    expect(publishProblems({ ...p, title: "Kay", days: { Mon: PROGRAM.Mon }, creator: { ...p.creator, name: "Kay" } })).toEqual([]);
    expect(REST_DAY.groups).toEqual([]);
  });

  it("letters supersets in order and leaves other blocks alone", () => {
    const g = (label: string): Group => ({ label, rest: 60, items: [] });
    expect(relabel([g("Warm-up"), g("Superset"), g("Straight"), g("Superset Z"), g("Superset Abs")]).map((x) => x.label)).toEqual([
      "Warm-up",
      "Superset A",
      "Straight",
      "Superset B",
      "Superset Abs",
    ]);
  });
});

describe("untrusted program days", () => {
  it("keeps a valid program intact", () => {
    expect(cleanDays(JSON.parse(JSON.stringify({ Mon: PROGRAM.Mon })))).toEqual({ Mon: PROGRAM.Mon });
  });

  it("drops or repairs malformed parts instead of crashing", () => {
    const days = cleanDays({
      Mon: { title: 5, groups: [{ label: "Superset A", rest: "x", items: [{ name: "Row", sets: 999, reps: 8, videoRef: "javascript:alert(1)", talk: "go" }, { sets: 3 }, null] }, "junk", { items: "no" }] },
      Tue: { groups: "nope" },
      Funday: { groups: [] },
    });
    expect(Object.keys(days)).toEqual(["Mon"]);
    expect(days.Mon!.title).toBe("");
    expect(days.Mon!.groups).toHaveLength(1);
    expect(days.Mon!.groups[0]).toMatchObject({ label: "Superset A", rest: 60 });
    expect(days.Mon!.groups[0].items).toEqual([{ name: "Row", sets: 10, reps: "10", rir: "—", station: "custom", muscle: null, phase: "work", cues: [], talk: "go" }]);
    expect(cleanDays(null)).toEqual({});
    expect(cleanDays("x")).toEqual({});
  });
});

describe("exercise vault", () => {
  it("reads timed reps", () => {
    expect(timedSeconds("45 s")).toBe(45);
    expect(timedSeconds("30s each side")).toBe(30);
    expect(timedSeconds("8–12")).toBeUndefined();
  });

  it("turns vault entries into runnable items", () => {
    const plank = itemFromVault(VAULT[3]);
    expect(plank).toMatchObject({ name: "Plank", timerSec: 45, noWeight: true, muscle: "abs", phase: "work" });
    const stretch = itemFromVault(VAULT[4]);
    expect(stretch).toMatchObject({ phase: "stretch", muscle: null, rir: "—", sets: 3 });
    expect(customItem("  Landmine press ", null)).toMatchObject({ name: "Landmine press", station: "custom", sets: 3 });
  });
});

describe("health import", () => {
  it("reads Health Auto Export: averages, daily sums, kg and fractions converted", () => {
    const { metrics, count } = parseHealthExport({
      data: {
        metrics: [
          { name: "weight_body_mass", units: "kg", data: [{ qty: 82, date: "2026-10-26 07:00:00 -0500" }] },
          { name: "body_fat_percentage", units: "%", data: [{ qty: 0.188, date: "2026-10-26 07:00:00 -0500" }] },
          { name: "step_count", units: "count", data: [{ qty: 4000, date: "2026-10-26 09:00:00 -0500" }, { qty: 5200, date: "2026-10-26 18:00:00 -0500" }] },
          { name: "heart_rate_variability", units: "ms", data: [{ qty: 50, date: "2026-10-26 01:00:00 -0500" }, { qty: 60, date: "2026-10-26 03:00:00 -0500" }] },
          { name: "something_else", data: [{ qty: 1, date: "2026-10-26" }] },
        ],
      },
    });
    expect(metrics.weight![0].value).toBeCloseTo(180.78, 1);
    expect(metrics.bodyFat![0].value).toBeCloseTo(18.8);
    expect(metrics.steps).toEqual([{ date: "2026-10-26", value: 9200 }]);
    expect(metrics.hrv).toEqual([{ date: "2026-10-26", value: 55 }]);
    expect(count).toBe(6);
  });

  it("returns nothing for files that aren't exports", () => {
    expect(parseHealthExport({ hello: 1 }).count).toBe(0);
    expect(parseHealthExport(null).count).toBe(0);
  });
});

describe("built-in coach", () => {
  it("stops the set on pain and offers same-muscle swaps", () => {
    const a = localAnswer("my shoulder hurts on flat db press", ctx());
    expect(a).toMatch(/^Stop the set/);
    expect(a).toContain("Machine chest press");
    expect(a).toContain("not medical advice");
  });

  it("swaps across stations first", () => {
    expect(alternatives("Flat DB press", ctx())[0]).toBe("Machine chest press");
    expect(alternatives("Unknown lift", ctx())).toEqual([]);
  });

  it("answers protein left from the food log", () => {
    const a = localAnswer("How much protein is left?", ctx({ health: health({ food: [{ id: "f", date: TODAY, at: 1, name: "Shake", cal: 200, protein: 40, carbs: 5, fat: 3 }] }) }));
    expect(a).toContain("160 g protein to go");
  });

  it("flags out-of-range labs and defers to a doctor", () => {
    const a = localAnswer("Any labs out of range?", ctx({ health: health({ labs: [{ id: "l", date: TODAY, name: "HDL", value: 32, unit: "mg/dL", low: 40 }] }) }));
    expect(a).toContain("HDL 32");
    expect(a).toMatch(/doctor/);
  });

  it("knows the seeded incline press history", () => {
    expect(localAnswer("what weight for incline db press?", ctx())).toMatch(/incline/i);
  });
});

describe("cloud coach prompt", () => {
  it("validates input and keeps the last ten turns", () => {
    expect(() => parseCoachInput({ question: "  " })).toThrow();
    const history = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const inp = parseCoachInput({ question: "q", context: "ctx", history: [...history, { role: "system", content: "x" }, { role: "user", content: "" }] });
    expect(inp.history).toHaveLength(10);
    expect(inp.history.every((m) => m.role !== ("system" as string))).toBe(true);
  });

  it("puts stable instructions first, data second, and alternating turns starting with the user", () => {
    const { system, messages } = buildCoachMessages({
      question: "what weight?",
      context: "Today: Tue",
      history: [
        { role: "assistant", content: "hi" },
        { role: "user", content: "a" },
        { role: "user", content: "b" },
        { role: "assistant", content: "c" },
      ],
      midSet: true,
    });
    expect(system[0].text).toBe(COACH_INSTRUCTIONS);
    expect(system[1].text).toContain("Today: Tue");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[0].content).toBe("a\n\nb");
    expect(messages[2].content).toMatch(/mid-workout[\s\S]*what weight\?$/);
  });
});

describe("snapshot", () => {
  it("syncs the seeded workout, recent health, labs, and a summary", () => {
    const s = snapshot();
    expect(s.v).toBe(1);
    expect(s.program.days.Mon.exercises.length).toBeGreaterThan(5);
    expect(s.sessions.find((x) => x.date === "2026-10-26")!.sets).toHaveLength(27);
    expect(s.health.metrics.weight).toEqual([{ date: "2026-10-26", value: 181.6 }]); // older than a year dropped
    expect(s.summary).toContain("Followset Original");
    expect(JSON.stringify(s)).not.toContain('"id":"f"'); // internal ids stay home
  });
});

describe("MCP server", () => {
  const env = (snap: Snapshot | null = snapshot(), saved: SuggestedProgram[] = []) => ({
    snapshot: snap,
    now: NOW,
    suggest: async (p: SuggestedProgram) => {
      saved.push(p);
      return "s1";
    },
  });
  const rpc = (method: string, params?: Record<string, unknown>, id: number | undefined = 1) => ({ jsonrpc: "2.0", id, method, params });

  it("initializes and negotiates the protocol version", async () => {
    const r = (await handleRpc(rpc("initialize", { protocolVersion: "2025-03-26" }), env())) as { result: { protocolVersion: string; capabilities: object } };
    expect(r.result.protocolVersion).toBe("2025-03-26");
    const newer = (await handleRpc(rpc("initialize", { protocolVersion: "2099-01-01" }), env())) as { result: { protocolVersion: string } };
    expect(newer.result.protocolVersion).toBe(PROTOCOL_VERSION);
  });

  it("returns nothing for notifications and errors for unknown methods", async () => {
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, env())).toBeNull();
    expect(await handleRpc(rpc("resources/list"), env())).toMatchObject({ error: { code: -32601 } });
    expect(await handleRpc({ method: "x" } as never, env())).toMatchObject({ error: { code: -32600 } });
  });

  it("lists tools with schemas; only suggest_program writes", async () => {
    const r = (await handleRpc(rpc("tools/list"), env())) as { result: { tools: typeof TOOLS } };
    expect(r.result.tools.map((t) => t.name)).toContain("get_overview");
    expect(r.result.tools.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name)).toEqual(["suggest_program"]);
  });

  it("answers lift history with an e1RM, matching partial names", async () => {
    const r = await callTool("get_lift_history", { exercise: "incline" }, env());
    const rows = JSON.parse(r.text);
    expect(rows[0].date).toBe("2026-10-26");
    expect(rows[0].e1rm).toBeGreaterThan(0);
    expect(e1rm("BW", "10")).toBeNull();
    expect(e1rm("100", "10")).toBe(133);
  });

  it("filters workouts, health, nutrition, and labs by date", async () => {
    expect(JSON.parse((await callTool("get_workouts", { days: 7 }, env())).text)).toHaveLength(1);
    expect(JSON.parse((await callTool("get_workouts", { days: 7 }, { ...env(), now: new Date("2026-12-01") })).text)).toHaveLength(0);
    expect(JSON.parse((await callTool("get_health", { metric: "weight" }, env())).text).weight).toHaveLength(1);
    const n = JSON.parse((await callTool("get_nutrition", {}, env())).text);
    expect(n.days[0]).toMatchObject({ date: TODAY, protein: 24, foods: ["Eggs"] });
    expect(JSON.parse((await callTool("get_labs", {}, env())).text)[0].flag).toBe("low");
  });

  it("says so when nothing has synced yet", async () => {
    const r = await callTool("get_overview", {}, env(null));
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/No data synced/);
  });

  it("stores a cleaned suggestion and rejects empty ones", async () => {
    const saved: SuggestedProgram[] = [];
    const ok = await handleRpc(
      rpc("tools/call", {
        name: "suggest_program",
        arguments: { title: "Push focus", days: { monday: { title: "Push", blocks: [{ label: "Superset A", rest: 90, exercises: [{ name: "Flat DB press", sets: 4, reps: "6-8", rir: "1" }] }] }, Funday: {} } },
      }),
      env(snapshot(), saved),
    );
    expect(ok).toMatchObject({ result: { isError: false } });
    expect(Object.keys(saved[0].days)).toEqual(["Mon"]);
    const bad = await callTool("suggest_program", { title: "x", days: { Mon: { title: "a", blocks: [] } } }, env());
    expect(bad.isError).toBe(true);
    expect(() => cleanSuggestion({ days: {} })).toThrow(/title/);
  });

  it("clamps junk in suggestions", () => {
    const s = cleanSuggestion({ title: "T", days: { Tue: { blocks: [{ exercises: [{ name: "Squat", sets: 99, reps: 5 }] }] } } });
    expect(s.days.Tue).toMatchObject({ title: "Tue workout", blocks: [{ label: "Straight", rest: 90, exercises: [{ name: "Squat", sets: 10, reps: "5", rir: "1-2", cues: [] }] }] });
  });
});

describe("suggestion to Studio draft", () => {
  it("uses vault media and muscles when names match, custom moves otherwise", () => {
    const days = daysFromSuggestion(
      {
        title: "AI",
        summary: "",
        days: {
          Mon: {
            title: "Push",
            blocks: [
              { label: "Superset", rest: 90, exercises: [{ name: "flat db press", sets: 4, reps: "6-8", rir: "1", cues: [] }, { name: "Cable fly", sets: 3, reps: "12", rir: "2", cues: ["Hug a tree"] }] },
              { label: "Stretches", rest: 15, exercises: [{ name: "Cat-cow", sets: 1, reps: "30 s", rir: "1", cues: [] }] },
            ],
          },
        },
      },
      VAULT,
    );
    const [ss, st] = days.Mon!.groups;
    expect(ss.label).toBe("Superset A");
    const [press, fly]: Item[] = ss.items;
    expect(press).toMatchObject({ name: "Flat DB press", sets: 4, reps: "6-8", muscle: "chest", station: "dumbbells", cues: ["Shoulder blades back."] });
    expect(fly).toMatchObject({ name: "Cable fly", station: "custom", cues: ["Hug a tree"] });
    expect(st.items[0]).toMatchObject({ phase: "stretch", rir: "—", timerSec: 30, muscle: null });
  });
});
