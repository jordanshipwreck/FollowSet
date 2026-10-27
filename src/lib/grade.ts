// Gains Grade: a 0–100 score per muscle from post-workout pump (1–10) and strain (1–5) ratings.
// grade = pump × 10, minus 12 per strain point above 3.
import type { Rating } from "./store";

export const GRADE_NAME = "Gains Grade";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function grade(pump: number, strain: number): number {
  const p = clamp(pump, 1, 10);
  const s = clamp(strain, 1, 5);
  return clamp(Math.round(p * 10 - Math.max(0, s - 3) * 12), 0, 100);
}

export interface MuscleGrade {
  muscle: string;
  pump: number;
  strain: number;
  grade: number;
  samples: number;
}

export function summarize(ratings: Rating[]): MuscleGrade[] {
  const acc = new Map<string, { pump: number; strain: number; n: number }>();
  for (const r of ratings) {
    const a = acc.get(r.muscle) ?? { pump: 0, strain: 0, n: 0 };
    a.pump += r.pump;
    a.strain += r.strain;
    a.n += 1;
    acc.set(r.muscle, a);
  }
  const out: MuscleGrade[] = [];
  for (const [muscle, a] of acc) {
    const pump = a.pump / a.n;
    const strain = a.strain / a.n;
    out.push({ muscle, pump, strain, grade: grade(pump, strain), samples: a.n });
  }
  return out.sort((a, b) => a.muscle.localeCompare(b.muscle));
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface Flag {
  muscle: string;
  reason: string;
}

/** Muscles lagging the rest (15+ below median) or straining without a pump. */
export function flags(grades: MuscleGrade[]): Flag[] {
  const out: Flag[] = [];
  const med = median(grades.map((g) => g.grade));
  for (const g of grades) {
    if (grades.length >= 2 && g.grade <= med - 15)
      out.push({
        muscle: g.muscle,
        reason: `${GRADE_NAME} ${g.grade} is ${Math.round(med - g.grade)} below your median of ${Math.round(med)}.`,
      });
    if (g.strain >= 4 && g.pump <= 5)
      out.push({
        muscle: g.muscle,
        reason: `Strain averages ${g.strain.toFixed(1)} while pump averages ${g.pump.toFixed(1)}.`,
      });
  }
  return out;
}

export function overall(grades: MuscleGrade[]): number | null {
  if (!grades.length) return null;
  return Math.round(grades.reduce((a, g) => a + g.grade, 0) / grades.length);
}
