// Workout block kinds shared by Studio and AI-suggested programs.
import type { Group, Phase } from "./program";

export const KINDS = ["Warm-up", "Superset", "Straight", "Core", "Finisher", "Stretches"] as const;
export type Kind = (typeof KINDS)[number];

export const kindOf = (label: string): Kind =>
  label.startsWith("Superset") && label !== "Superset Abs" ? "Superset" : ((KINDS as readonly string[]).includes(label) ? label : "Straight") as Kind;

export const phaseOf = (k: Kind): Phase => (k === "Warm-up" ? "warmup" : k === "Stretches" ? "stretch" : k === "Finisher" ? "finisher" : "work");

export const DEFAULT_REST: Record<Kind, number> = { "Warm-up": 15, Superset: 90, Straight: 75, Core: 30, Finisher: 15, Stretches: 15 };

/** Supersets are lettered in order (A, B, C…) so the runner shows A1/A2 labels. */
export function relabel(groups: Group[]): Group[] {
  let n = 0;
  return groups.map((g) => (kindOf(g.label) === "Superset" ? { ...g, label: `Superset ${String.fromCharCode(65 + n++)}` } : g));
}
