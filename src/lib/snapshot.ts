// What the app syncs to the Followset cloud when signed in (user_data), and how a program an
// outside assistant suggested (MCP suggest_program) becomes a Studio draft.
// The snapshot is read-only for assistants; nothing in it flows back into the app's own data.
import type { Snapshot, SuggestedProgram } from "../../supabase/functions/_shared/mcp";
import { kindOf, phaseOf, relabel } from "./blocks";
import { contextSummary } from "./coach";
import { addDays, iso } from "./dates";
import type { HealthState } from "./health";
import { liftKey } from "./log";
import type { Program } from "./market";
import { DAYS, type Group, type Workout } from "./program";
import type { AppState } from "./store";
import { customItem, itemFromVault, timedSeconds, type VaultEntry } from "./vault";

export type { Snapshot, SuggestedProgram };

const SESSION_DAYS = 180;
const METRIC_DAYS = 365;
const FOOD_DAYS = 60;

export function buildSnapshot(app: AppState, health: HealthState, program: Program, today = iso()): Snapshot {
  const since = (n: number) => addDays(today, -n);
  const days: Snapshot["program"]["days"] = {};
  for (const d of DAYS) {
    const w = program.days[d];
    if (!w?.groups.length) continue;
    days[d] = { title: w.title, exercises: w.groups.flatMap((g) => g.items.map((it) => ({ name: it.name, sets: it.sets, reps: it.reps, rir: it.rir, block: g.label }))) };
  }
  const metrics: Snapshot["health"]["metrics"] = {};
  for (const [k, pts] of Object.entries(health.metrics)) metrics[k] = (pts ?? []).filter((p) => p.date >= since(METRIC_DAYS));
  return {
    v: 1,
    at: new Date().toISOString(),
    units: "lb",
    summary: contextSummary({ app, program, health, vault: [], today }),
    program: { id: program.id, title: program.title, creator: program.creator.name, days },
    sessions: app.sessions
      .filter((s) => s.date >= since(SESSION_DAYS) && (s.logs.length || s.ratings.length))
      .map((s) => ({
        date: s.date,
        day: s.day,
        program: s.programId ?? "followset-original",
        finished: s.finished,
        sets: s.logs.map((l) => ({ name: l.name, side: l.side, set: l.set, weight: l.weight, reps: l.reps })),
        ratings: s.ratings,
      })),
    health: {
      metrics,
      labs: health.labs.map(({ date, name, value, unit, low, high }) => ({ date, name, value, unit, low, high })),
      food: health.food.filter((f) => f.date >= since(FOOD_DAYS)).map(({ date, name, cal, protein, carbs, fat }) => ({ date, name, cal, protein, carbs, fat })),
      goals: health.goals,
    },
  };
}

/** Turn a suggestion into program days. Vault moves keep their demo media and muscle; unknown names become custom moves. */
export function daysFromSuggestion(s: SuggestedProgram, vault: VaultEntry[]): Program["days"] {
  const byKey = new Map(vault.map((v) => [liftKey(v.name), v]));
  const out: Program["days"] = {};
  for (const d of DAYS) {
    const sd = s.days[d];
    if (!sd) continue;
    const groups: Group[] = sd.blocks.map((b) => {
      const kind = kindOf(b.label);
      const phase = phaseOf(kind);
      return {
        label: kind === "Superset" ? "Superset" : kind,
        rest: b.rest,
        items: b.exercises.map((e) => {
          const v = byKey.get(liftKey(e.name));
          const base = v ? itemFromVault(v) : customItem(e.name, null);
          const timerSec = timedSeconds(e.reps) ?? base.timerSec;
          return {
            ...base,
            ...(timerSec ? { timerSec } : {}),
            sets: e.sets,
            reps: e.reps,
            rir: phase === "work" ? e.rir : "—",
            phase,
            muscle: phase === "work" ? base.muscle : null,
            cues: e.cues.length ? e.cues : base.cues,
          };
        }),
      };
    });
    const w: Workout = { title: sd.title, groups: relabel(groups) };
    out[d] = w;
  }
  return out;
}
