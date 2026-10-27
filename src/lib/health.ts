// Health data the coach reads: metrics imported from Health Auto Export (Apple Health, which
// carries Hume band/scale data), lab results, and a food log. localStorage "followset-health-v1".
import { useSyncExternalStore } from "react";

export type MetricKey = "weight" | "bodyFat" | "restingHr" | "hrv" | "sleep" | "steps" | "activeEnergy";

export const METRICS: Record<MetricKey, { label: string; unit: string; sum?: boolean; names: string[] }> = {
  weight: { label: "Weight", unit: "lb", names: ["weight_body_mass", "body_mass", "weight"] },
  bodyFat: { label: "Body fat", unit: "%", names: ["body_fat_percentage", "body_fat"] },
  restingHr: { label: "Resting HR", unit: "bpm", names: ["resting_heart_rate"] },
  hrv: { label: "HRV", unit: "ms", names: ["heart_rate_variability", "heart_rate_variability_sdnn"] },
  sleep: { label: "Sleep", unit: "h", names: ["sleep_analysis", "sleep"] },
  steps: { label: "Steps", unit: "", sum: true, names: ["step_count", "steps"] },
  activeEnergy: { label: "Active energy", unit: "kcal", sum: true, names: ["active_energy", "active_energy_burned"] },
};

export interface Point {
  date: string;
  value: number;
}
export interface Lab {
  id: string;
  date: string;
  name: string;
  value: number;
  unit: string;
  low?: number;
  high?: number;
}
export interface Food {
  id: string;
  date: string;
  at: number;
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface Goals {
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface HealthState {
  version: 1;
  metrics: Partial<Record<MetricKey, Point[]>>;
  labs: Lab[];
  food: Food[];
  goals: Goals;
  importedAt?: number;
}

const KEY = "followset-health-v1";
const fresh = (): HealthState => ({ version: 1, metrics: {}, labs: [], food: [], goals: { cal: 2500, protein: 200, carbs: 250, fat: 80 } });

function read(): HealthState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw?.version === 1) return { ...fresh(), ...raw };
  } catch {
    /* fall through */
  }
  return fresh();
}

let state: HealthState = typeof localStorage === "undefined" ? fresh() : read();
const listeners = new Set<() => void>();
function commit(next: HealthState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}
const id = () => Math.random().toString(36).slice(2, 10);

export const health = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  importMetrics(m: Partial<Record<MetricKey, Point[]>>) {
    const metrics = { ...state.metrics };
    for (const k of Object.keys(m) as MetricKey[]) {
      const byDate = new Map((metrics[k] ?? []).map((p) => [p.date, p]));
      for (const p of m[k] ?? []) byDate.set(p.date, p);
      metrics[k] = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    }
    commit({ ...state, metrics, importedAt: Date.now() });
  },
  addLab(l: Omit<Lab, "id">) {
    commit({ ...state, labs: [...state.labs, { ...l, id: id() }].sort((a, b) => b.date.localeCompare(a.date)) });
  },
  removeLab(lid: string) {
    commit({ ...state, labs: state.labs.filter((l) => l.id !== lid) });
  },
  addFood(f: Omit<Food, "id" | "at">) {
    commit({ ...state, food: [...state.food, { ...f, id: id(), at: Date.now() }] });
  },
  removeFood(fid: string) {
    commit({ ...state, food: state.food.filter((f) => f.id !== fid) });
  },
  setGoals(g: Goals) {
    commit({ ...state, goals: g });
  },
  clearMetrics() {
    commit({ ...state, metrics: {}, importedAt: undefined });
  },
};

export function useHealth(): HealthState {
  return useSyncExternalStore(health.subscribe, health.get, health.get);
}

export function latest(h: HealthState, k: MetricKey): Point | undefined {
  const s = h.metrics[k];
  return s?.[s.length - 1];
}

/** Average of the last n points, for trend comparisons. */
export function avgLast(h: HealthState, k: MetricKey, n: number, skip = 0): number | null {
  const s = (h.metrics[k] ?? []).slice(0, (h.metrics[k]?.length ?? 0) - skip).slice(-n);
  return s.length ? s.reduce((a, p) => a + p.value, 0) / s.length : null;
}

export function dayTotals(h: HealthState, date: string): Goals {
  const t = { cal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const f of h.food) if (f.date === date) for (const k of ["cal", "protein", "carbs", "fat"] as const) t[k] += f[k];
  return t;
}

export function labFlag(l: Lab): "low" | "high" | null {
  if (l.low !== undefined && l.value < l.low) return "low";
  if (l.high !== undefined && l.value > l.high) return "high";
  return null;
}

// ---------- Health Auto Export parsing ----------

type HaePoint = Record<string, unknown> & { date?: string };
type HaeMetric = { name?: string; units?: string; data?: HaePoint[] };

/** "2026-10-17 07:12:00 -0500" → "2026-10-17" (the phone's local day, as exported). */
function dayOf(d: unknown): string | null {
  if (typeof d !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(d);
  return m ? m[1] : null;
}

function valueOf(p: HaePoint, key: MetricKey): number | null {
  const pick = key === "sleep" ? (p.totalSleep ?? p.asleep ?? p.qty) : (p.qty ?? p.Avg ?? p.avg ?? p.value);
  const n = typeof pick === "number" ? pick : typeof pick === "string" ? parseFloat(pick) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Health Auto Export JSON ({ data: { metrics: [...] } }) → daily points.
 * Sums steps and energy per day; averages the rest. Unknown metrics are ignored.
 */
export function parseHealthExport(json: unknown): { metrics: Partial<Record<MetricKey, Point[]>>; count: number } {
  const root = json as { data?: { metrics?: HaeMetric[] }; metrics?: HaeMetric[] };
  const list = root?.data?.metrics ?? root?.metrics ?? [];
  const out: Partial<Record<MetricKey, Point[]>> = {};
  let count = 0;
  for (const m of Array.isArray(list) ? list : []) {
    const key = (Object.keys(METRICS) as MetricKey[]).find((k) => METRICS[k].names.includes(String(m.name ?? "").toLowerCase()));
    if (!key || !Array.isArray(m.data)) continue;
    const acc = new Map<string, { sum: number; n: number }>();
    for (const p of m.data) {
      const d = dayOf(p.date);
      let v = valueOf(p, key);
      if (!d || v === null) continue;
      if (key === "bodyFat" && v <= 1) v *= 100;
      if (key === "weight" && String(m.units).toLowerCase() === "kg") v *= 2.20462;
      const a = acc.get(d) ?? { sum: 0, n: 0 };
      a.sum += v;
      a.n += 1;
      acc.set(d, a);
      count++;
    }
    out[key] = [...acc.entries()]
      .map(([date, a]) => ({ date, value: +(METRICS[key].sum ? a.sum : a.sum / a.n).toFixed(2) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return { metrics: out, count };
}
