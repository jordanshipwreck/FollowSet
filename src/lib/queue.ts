// Flattens a workout into the ordered list of steps the runner walks through.
// Supersets alternate: A1 set 1, A2 set 1, A1 set 2, ... Unilateral items get an L and an R step.
import type { Group, Item, Muscle, Workout } from "./program";

export type Side = "L" | "R" | null;

export interface Step {
  group: string;
  /** Position of the item inside its group (0-based), used for the A1/A2 label. */
  slot: number;
  item: Item;
  set: number;
  side: Side;
  /** Seconds of rest after this step. 15 s between superset moves, the group rest after the round. */
  restAfter: number;
}

/** Focus muscles get one extra set on their work items. */
export function withFocus(w: Workout, focus: readonly string[] = []): Workout {
  const f = new Set(focus);
  return {
    title: w.title,
    groups: w.groups.map((g) => ({
      ...g,
      items: g.items.map((it) =>
        it.phase === "work" && it.muscle && f.has(it.muscle) ? { ...it, sets: it.sets + 1 } : it,
      ),
    })),
  };
}

export const SWITCH_REST = 15;

export function buildQueue(w: Workout, focus: readonly string[] = []): Step[] {
  const out: Step[] = [];
  for (const g of withFocus(w, focus).groups) {
    const rounds = Math.max(...g.items.map((i) => i.sets));
    for (let r = 0; r < rounds; r++) {
      const live = g.items.filter((i) => i.sets > r);
      live.forEach((item, li) => {
        const lastInRound = li === live.length - 1;
        const sides: Side[] = item.unilateral ? ["L", "R"] : [null];
        sides.forEach((side, si) => {
          out.push({
            group: g.label,
            slot: g.items.indexOf(item),
            item,
            set: r + 1,
            side,
            restAfter: lastInRound && si === sides.length - 1 ? g.rest : SWITCH_REST,
          });
        });
      });
    }
  }
  const last = out[out.length - 1];
  if (last) last.restAfter = 0;
  return out;
}

/** "A1", "Abs 2", "Walk", "Warm", ... */
export function slotLabel(group: string, slot: number): string {
  const m = /^Superset\s+([A-Z])$/.exec(group);
  if (m) return `${m[1]}${slot + 1}`;
  switch (group) {
    case "Daily abs":
    case "Superset Abs":
    case "Core":
      return `Abs ${slot + 1}`;
    case "Finisher":
    case "Conditioning":
      return "Walk";
    case "Mobility":
    case "Stretches":
      return "Move";
    case "Ramp-up":
      return "Ramp";
    case "Warm-up":
      return "Warm";
    case "Straight sets":
    case "Straight":
      return "Work";
    default:
      return String(slot + 1);
  }
}

export function isDropSet(item: Item, set: number): boolean {
  return !!item.drop && set === item.sets;
}

/** Stable id for one logged set. Must match v2 data already on phones. */
export function logId(date: string, day: string, name: string, set: number, side: Side): string {
  return `${date}|${day}|${name}|${set}|${side ?? ""}`;
}

/** Rough duration estimate in minutes: ~40 s per working step plus all programmed rests and timers. */
export function estimateMinutes(steps: Step[]): number {
  let sec = 0;
  for (const s of steps) sec += (s.item.timerSec ?? 40) + s.restAfter;
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

export function groupsTraining(groups: Group[], muscle: Muscle): number {
  let sets = 0;
  for (const g of groups) for (const it of g.items) if (it.phase === "work" && it.muscle === muscle) sets += it.sets;
  return sets;
}
