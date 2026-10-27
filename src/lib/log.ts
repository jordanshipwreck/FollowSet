// Read-side helpers over logged sets: copyable text, last weights, progression hints, volume.
import type { Session, SetLog } from "./store";

/** Same lift across days: "Cable lateral raise (low pulley)" and "Cable lateral raise" share history. */
export function liftKey(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
}

const numeric = (w: string) => (/^\d+(\.\d+)?$/.test(w.trim()) ? Number(w) : null);

export function setText(l: SetLog): string {
  const main = l.weight === "BW" || l.weight === "—" ? l.reps : `${l.weight}×${l.reps}`;
  const drops = l.drops.filter((d) => d.weight.trim() || d.reps.trim()).map((d) => `${d.weight || "—"}×${d.reps || "—"}`);
  return drops.length ? `${main} + ${drops.join(" + ")}` : main;
}

/** Plain-text log for pasting into a chat or notes app. */
export function logText(logs: SetLog[], dateLabel: string, title: string): string {
  if (!logs.length) return "";
  const order: string[] = [];
  const rows: Record<string, string[]> = {};
  for (const l of [...logs].sort((a, b) => a.at - b.at)) {
    const k = l.side ? `${l.name} ${l.side}` : l.name;
    if (!rows[k]) {
      rows[k] = [];
      order.push(k);
    }
    rows[k].push(setText(l) + (l.note ? ` (${l.note})` : ""));
  }
  return [`Workout log ${dateLabel} (${title})`, ...order.map((k) => `${k}: ${rows[k].join(", ")}`)].join("\n");
}

/** Most recent real weight used for this lift, newest first across all sessions. */
export function lastWeight(name: string, sessions: Session[]): string {
  const key = liftKey(name);
  let best: SetLog | null = null;
  for (const s of sessions)
    for (const l of s.logs)
      if (liftKey(l.name) === key && numeric(l.weight) !== null && (!best || l.at > best.at)) best = l;
  return best ? best.weight : "";
}

export interface Previous {
  date: string;
  sets: SetLog[];
}

/** The last earlier session (by date) that logged this lift. */
export function previousPerformance(name: string, sessions: Session[], beforeDate: string): Previous | null {
  const key = liftKey(name);
  let found: Previous | null = null;
  for (const s of sessions) {
    if (s.date >= beforeDate) continue;
    const sets = s.logs.filter((l) => liftKey(l.name) === key).sort((a, b) => a.set - b.set || a.at - b.at);
    if (sets.length && (!found || s.date > found.date)) found = { date: s.date, sets };
  }
  return found;
}

/** Top of a rep range: "8–12" → 12, "15" → 15, "30–45 s" → null (timed). */
export function repTop(reps: string): number | null {
  if (/\bs\b|min|\/side/.test(reps)) return null;
  const nums = reps.match(/\d+/g);
  return nums ? Number(nums[nums.length - 1]) : null;
}

export interface Hint {
  weight: string;
  text: string;
  up: boolean;
}

/**
 * Double progression: if every set last time hit the top of the range at one weight,
 * add a step. Otherwise keep the weight and chase reps.
 */
export function progressionHint(reps: string, prev: Previous | null, step: number): Hint | null {
  if (!prev) return null;
  const top = repTop(reps);
  const work = prev.sets.filter((l) => numeric(l.weight) !== null);
  if (!work.length) return null;
  const heaviest = Math.max(...work.map((l) => numeric(l.weight)!));
  const atTop = work.filter((l) => numeric(l.weight) === heaviest);
  if (top !== null && atTop.every((l) => (parseInt(l.reps, 10) || 0) >= top)) {
    const next = String(+(heaviest + step).toFixed(2));
    return { weight: next, text: `Hit ${top}s at ${heaviest} last time. Try ${next}.`, up: true };
  }
  return { weight: String(heaviest), text: `Stay at ${heaviest} and beat last time's reps.`, up: false };
}

export function volume(logs: SetLog[]): number {
  let v = 0;
  for (const l of logs) {
    const w = numeric(l.weight);
    const r = parseInt(l.reps, 10);
    if (w !== null && r > 0) v += w * r;
    for (const d of l.drops) {
      const dw = numeric(d.weight);
      const dr = parseInt(d.reps, 10);
      if (dw !== null && dr > 0) v += dw * dr;
    }
  }
  return Math.round(v);
}

export function compact(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
