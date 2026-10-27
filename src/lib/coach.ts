// The AI coach. Two brains behind one interface:
//  - built-in: rules over the person's own data (works offline, no account, no key)
//  - cloud: Claude through the Supabase "coach" function, sent the same context summary
// Neither gives medical advice; both say so when health or pain comes up.
import { CLOUD } from "./cloud";
import { addDays, dayOf, iso, weekStart } from "./dates";
import { flags, overall, summarize } from "./grade";
import { avgLast, dayTotals, labFlag, latest, METRICS, type HealthState, type MetricKey } from "./health";
import { liftKey, previousPerformance, progressionHint, setText, volume } from "./log";
import { workoutFor, type Program } from "./market";
import { buildQueue, estimateMinutes, type Step } from "./queue";
import type { AppState } from "./store";
import type { VaultEntry } from "./vault";

export interface CoachMsg {
  role: "user" | "coach";
  text: string;
  at: number;
  via?: "local" | "cloud";
}

export interface CoachContext {
  app: AppState;
  program: Program;
  health: HealthState;
  vault: VaultEntry[];
  /** Set when asked from the workout screen. */
  step?: Step | null;
  today?: string;
}

const DISCLAIMER = "General fitness guidance, not medical advice.";

const has = (q: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(q));

/** Exercise named in the question, matched against the program and the vault. */
function findLift(q: string, ctx: CoachContext): string | null {
  const names = new Set<string>();
  for (const d of Object.values(ctx.program.days)) for (const g of d?.groups ?? []) for (const it of g.items) names.add(it.name);
  for (const v of ctx.vault) names.add(v.name);
  const s = q.toLowerCase();
  let best: string | null = null;
  for (const n of names) {
    const k = liftKey(n);
    if (k.length > 3 && s.includes(k) && (!best || k.length > liftKey(best).length)) best = n;
  }
  return best;
}

function weekStats(ctx: CoachContext, start: string) {
  const end = addDays(start, 7);
  const ss = ctx.app.sessions.filter((s) => s.date >= start && s.date < end && s.logs.length);
  return { sessions: ss.length, sets: ss.reduce((n, s) => n + s.logs.length, 0), volume: volume(ss.flatMap((s) => s.logs)) };
}

function stepLine(ctx: CoachContext): string {
  const s = ctx.step;
  if (!s) return "";
  const prev = previousPerformance(s.item.name, ctx.app.sessions, ctx.today ?? iso());
  const hint = s.item.noWeight ? null : progressionHint(s.item.reps, prev, ctx.app.settings.weightStep);
  return [
    `You're on ${s.item.name}, set ${s.set} of ${s.item.sets}${s.side ? ` (${s.side === "L" ? "left" : "right"})` : ""}: ${s.item.reps}${s.item.rir !== "—" ? ` at RIR ${s.item.rir}` : ""}.`,
    prev ? `Last time: ${prev.sets.map(setText).join(", ")}.` : "",
    hint?.text ?? "",
    s.item.cues[0] ? `Cue: ${s.item.cues[0]}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Plain-text snapshot of the person's data. The cloud coach gets this as its context. */
export function contextSummary(ctx: CoachContext): string {
  const today = ctx.today ?? iso();
  const w = workoutFor(ctx.program.id, dayOf(today));
  const q = buildQueue(w);
  const thisWeek = weekStats(ctx, weekStart(today));
  const lastWeek = weekStats(ctx, addDays(weekStart(today), -7));
  const grades = summarize(ctx.app.sessions.flatMap((s) => s.ratings));
  const food = dayTotals(ctx.health, today);
  const g = ctx.health.goals;
  const lines = [
    `Today: ${today} (${dayOf(today)}). Program: ${ctx.program.title} by ${ctx.program.creator.name || "the user"}.`,
    q.length ? `Today's workout: ${w.title}, ${q.length} steps, ~${estimateMinutes(q)} min.` : "Today is a rest day.",
    `This week: ${thisWeek.sessions} sessions, ${thisWeek.sets} sets, ${thisWeek.volume} lb volume. Last week: ${lastWeek.sessions} sessions, ${lastWeek.volume} lb.`,
    grades.length ? `Gains Grade (pump/strain ratings) avg ${overall(grades)}: ${grades.map((x) => `${x.muscle} ${x.grade}`).join(", ")}.` : "",
    flags(grades).length ? `Flags: ${flags(grades).map((f) => `${f.muscle}: ${f.reason}`).join(" ")}` : "",
    `Food today: ${food.cal}/${g.cal} kcal, ${food.protein}/${g.protein} g protein, ${food.carbs}/${g.carbs} g carbs, ${food.fat}/${g.fat} g fat.`,
    ...(Object.keys(METRICS) as MetricKey[]).map((k) => {
      const p = latest(ctx.health, k);
      return p ? `${METRICS[k].label}: ${p.value}${METRICS[k].unit} on ${p.date}.` : "";
    }),
    ctx.health.labs.length
      ? `Labs: ${ctx.health.labs
          .slice(0, 20)
          .map((l) => `${l.name} ${l.value} ${l.unit} (${l.date}${labFlag(l) ? `, ${labFlag(l)}` : ""})`)
          .join("; ")}.`
      : "",
    stepLine(ctx) ? `Mid-workout: ${stepLine(ctx)}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Built-in coach: answers from the data, offline. */
export function localAnswer(question: string, ctx: CoachContext): string {
  const q = question.trim();
  const today = ctx.today ?? iso();

  if (has(q, "pain", "hurt", "injur", "pinch", "sharp", "tweak", "strain(ed)?\\b")) {
    const lift = findLift(q, ctx) ?? ctx.step?.item.name ?? null;
    const swaps = lift ? alternatives(lift, ctx).slice(0, 3) : [];
    return [
      "Stop the set. Sharp, catching, or worsening pain means you skip that move today.",
      swaps.length ? `Pain-free swaps for ${lift}: ${swaps.join(", ")}. Go lighter and stay in a range that doesn't hurt.` : "Swap to a move that trains the same muscle without the painful position, and go lighter.",
      "If it's still there in a few days, or it swells or goes numb, get it checked by a physio or doctor.",
      DISCLAIMER,
    ].join(" ");
  }

  const lift = findLift(q, ctx);
  if (lift && has(q, "swap", "replace", "alternative", "instead", "substitut")) {
    const a = alternatives(lift, ctx);
    return a.length ? `Swaps for ${lift} that hit the same muscle: ${a.slice(0, 4).join(", ")}.` : `I don't have a close swap for ${lift} in the vault.`;
  }
  if (lift || (ctx.step && has(q, "weight", "heavy", "how much", "increase", "lift", "load", "reps"))) {
    const name = lift ?? ctx.step!.item.name;
    const item = ctx.step?.item.name === name ? ctx.step.item : undefined;
    const prev = previousPerformance(name, ctx.app.sessions, today);
    const hint = progressionHint(item?.reps ?? "8–12", prev, ctx.app.settings.weightStep);
    if (!prev) return `No history for ${name} yet. Pick a weight you could do 2 more reps with at the top of the range, and log it so I can progress you next time.`;
    return `${name} last time (${prev.date}): ${prev.sets.map(setText).join(", ")}. ${hint?.text ?? ""}`.trim();
  }

  if (ctx.step && has(q, "next", "left", "remaining", "how many")) return stepLine(ctx);
  if (ctx.step && has(q, "cue", "form", "technique", "how do i")) {
    return ctx.step.item.cues.length ? `${ctx.step.item.name}: ${ctx.step.item.cues.join(" ")}` : `Control the weight, full range, no swinging.`;
  }
  if (has(q, "rest", "tired", "exhaust", "gassed")) {
    return "Between superset rounds, 60–90 s is enough for most isolation work and 2–3 min for heavy compound sets. If you're cooked, add 15 s rather than cutting reps. If you're dragging across the whole week, check your sleep and protein.";
  }

  if (has(q, "protein", "calorie", "kcal", "food", "eat", "macro", "carb", "fat\\b", "diet", "hungry")) {
    const t = dayTotals(ctx.health, today);
    const g = ctx.health.goals;
    const left = { cal: g.cal - t.cal, protein: g.protein - t.protein };
    if (!t.cal && !t.protein) return `Nothing logged today. Goal is ${g.cal} kcal and ${g.protein} g protein. Log meals in the Coach tab and I'll track what's left.`;
    return `Today: ${t.cal} kcal and ${t.protein} g protein (estimates). ${
      left.protein > 0 ? `${left.protein} g protein to go: ` + (left.protein >= 40 ? "a 40 g serving at each remaining meal gets you there." : "one more serving does it.") : "Protein goal hit."
    } ${left.cal > 0 ? `${left.cal} kcal left.` : `${-left.cal} kcal over.`}`;
  }

  if (has(q, "sleep", "hrv", "recover", "readiness", "resting", "heart")) {
    const sleep = latest(ctx.health, "sleep");
    const hrv = latest(ctx.health, "hrv");
    const hrvAvg = avgLast(ctx.health, "hrv", 7, 1);
    if (!sleep && !hrv) return "No recovery data yet. Import your Health Auto Export file in the Coach tab (it carries Hume and Apple Watch data) and I'll read sleep and HRV.";
    const parts = [sleep ? `Sleep ${sleep.value} h on ${sleep.date}.` : "", hrv ? `HRV ${hrv.value} ms${hrvAvg ? ` vs ${Math.round(hrvAvg)} ms 7-day average` : ""}.` : ""];
    const low = (sleep && sleep.value < 6) || (hrv && hrvAvg && hrv.value < hrvAvg * 0.85);
    parts.push(low ? "Recovery looks low: keep today's weights, drop one set per exercise, and stop at RIR 2." : "Recovery looks fine. Train as planned.");
    return parts.filter(Boolean).join(" ");
  }

  if (has(q, "lab", "blood", "cholesterol", "hdl", "ldl", "apob", "vitamin", "testosterone", "rythm", "marker")) {
    const out = ctx.health.labs.filter((l) => labFlag(l));
    if (!ctx.health.labs.length) return "No labs saved. Add results from Rythm (or any lab report) in the Coach tab.";
    if (!out.length) return `All ${ctx.health.labs.length} saved markers are inside the ranges you entered.`;
    return `Out of range: ${out.map((l) => `${l.name} ${l.value} ${l.unit} (${labFlag(l)})`).join(", ")}. Lifestyle levers that usually help lipids: more cardio, fiber and fish, less sugar and fried food. Take these to your doctor. ${DISCLAIMER}`;
  }

  if (has(q, "weight\\b", "scale", "body fat", "bodyfat", "lean", "cut", "bulk")) {
    const wt = latest(ctx.health, "weight");
    const bf = latest(ctx.health, "bodyFat");
    if (!wt) return "No scale data yet. Import Health Auto Export (with Weight and Body Fat turned on) in the Coach tab.";
    const prior = avgLast(ctx.health, "weight", 7, 7);
    return `Weight ${wt.value} lb on ${wt.date}${bf ? `, body fat ${bf.value}%` : ""}.${prior ? ` That's ${(wt.value - prior).toFixed(1)} lb vs the week before.` : ""}`;
  }

  if (has(q, "today", "workout", "what('| i)?s next", "plan", "schedule")) {
    const w = workoutFor(ctx.program.id, dayOf(today));
    const steps = buildQueue(w);
    if (!steps.length) return `Rest day in ${ctx.program.title}. Walk, stretch, and hit your protein.`;
    const moves = [...new Set(steps.filter((s) => s.item.phase === "work").map((s) => s.item.name))];
    return `${w.title}: ${steps.length} steps, about ${estimateMinutes(steps)} minutes. Main moves: ${moves.slice(0, 6).join(", ")}.`;
  }

  if (has(q, "how am i", "progress", "doing", "week", "summary", "stats", "grade")) {
    const ws = weekStart(today);
    const a = weekStats(ctx, ws);
    const b = weekStats(ctx, addDays(ws, -7));
    const grades = summarize(ctx.app.sessions.flatMap((s) => s.ratings));
    const f = flags(grades);
    return [
      `This week: ${a.sessions} sessions, ${a.sets} sets, ${a.volume.toLocaleString()} lb moved${b.volume ? ` (last week ${b.volume.toLocaleString()} lb)` : ""}.`,
      grades.length ? `Gains Grade average ${overall(grades)}.` : "Rate muscles after workouts and I'll grade them.",
      f.length ? `Watch ${[...new Set(f.map((x) => x.muscle))].join(", ")}: ${f[0].reason}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    "I can answer from your own data: today's workout, what weight to use on a lift, swaps, rest, protein left today, sleep and HRV, labs, or how your week is going.",
    CLOUD.configured ? "" : "Connect the Followset cloud to unlock the full Claude coach for open-ended questions.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Vault moves for the same primary muscle, excluding the lift itself. */
export function alternatives(lift: string, ctx: CoachContext): string[] {
  const key = liftKey(lift);
  const self = ctx.vault.find((v) => liftKey(v.name) === key);
  let muscle = self?.primaryMuscles[0];
  if (!muscle)
    for (const d of Object.values(ctx.program.days))
      for (const g of d?.groups ?? []) for (const it of g.items) if (liftKey(it.name) === key && it.muscle) muscle = it.muscle;
  if (!muscle) return [];
  return ctx.vault
    .filter((v) => v.phase === "work" && v.primaryMuscles.includes(muscle!) && liftKey(v.name) !== key && v.station !== self?.station)
    .concat(ctx.vault.filter((v) => v.phase === "work" && v.primaryMuscles.includes(muscle!) && liftKey(v.name) !== key && v.station === self?.station))
    .map((v) => v.name)
    .filter((n, i, a) => a.indexOf(n) === i);
}

/** Ask the coach. Uses Claude via the cloud when connected and signed in, otherwise the built-in coach. */
export async function ask(question: string, ctx: CoachContext, history: CoachMsg[], token?: string): Promise<CoachMsg> {
  if (CLOUD.configured && token) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      const r = await fetch(CLOUD.fn("coach"), {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: CLOUD.anonKey },
        body: JSON.stringify({
          question,
          context: contextSummary(ctx),
          history: history.slice(-10).map((m) => ({ role: m.role === "coach" ? "assistant" : "user", content: m.text })),
          midSet: !!ctx.step,
        }),
      });
      clearTimeout(t);
      if (r.ok) {
        const j = (await r.json()) as { answer?: string };
        if (j.answer) return { role: "coach", text: j.answer, at: Date.now(), via: "cloud" };
      }
    } catch {
      /* fall back to the built-in coach */
    }
  }
  return { role: "coach", text: localAnswer(question, ctx), at: Date.now(), via: "local" };
}
