// Local-calendar date helpers. Dates are ISO strings (YYYY-MM-DD) in the phone's time zone.
import { DAYS, type Day } from "./program";

export function iso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s: string, n: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Program day for a date. Monday-first, so Sunday maps to "Sun". */
export function dayOf(s: string): Day {
  return DAYS[(parseIso(s).getDay() + 6) % 7];
}

/** Monday of the week containing the date. */
export function weekStart(s: string): string {
  return addDays(s, -((parseIso(s).getDay() + 6) % 7));
}

export function weekDates(s: string): string[] {
  const start = weekStart(s);
  return DAYS.map((_, i) => addDays(start, i));
}

export function fmt(s: string, opts: Intl.DateTimeFormatOptions): string {
  return parseIso(s).toLocaleDateString("en-US", opts);
}

export const longDay = (s: string) => fmt(s, { weekday: "long" });
export const monthDay = (s: string) => fmt(s, { month: "short", day: "numeric" });

export function weekRangeLabel(s: string): string {
  const d = weekDates(s);
  return `${monthDay(d[0])} – ${monthDay(d[6])}`;
}

/** 6×7 grid for a month view, Monday-first. */
export function monthGrid(year: number, month: number): { iso: string; date: number; inMonth: boolean }[] {
  const first = iso(new Date(year, month, 1, 12));
  const start = weekStart(first);
  const out = [];
  for (let i = 0; i < 42; i++) {
    const s = addDays(start, i);
    const d = parseIso(s);
    out.push({ iso: s, date: d.getDate(), inMonth: d.getMonth() === month });
  }
  return out;
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(r).padStart(2, "0")}`;
}
