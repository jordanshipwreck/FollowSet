// Persistent state: localStorage key "fitty-v2". The shape is the v2 format earlier builds
// wrote, plus optional fields (updatedAt, settings.weightStep), so phones keep their history.
import { DAYS, type Day } from "./program";
import { logId, type Side } from "./queue";

export const STORAGE_KEY = "fitty-v2";

export interface Drop {
  weight: string;
  reps: string;
}

export interface SetLog {
  id: string;
  day: Day;
  date: string;
  name: string;
  side: Side;
  set: number;
  /** Number as text, "BW" for bodyweight, "—" when left blank. */
  weight: string;
  reps: string;
  drops: Drop[];
  at: number;
  note?: string;
  seedId?: string;
}

export interface Rating {
  muscle: string;
  pump: number;
  strain: number;
}

export interface Timer {
  kind: "rest" | "work";
  label: string;
  total: number;
  remainingMs: number;
  running: boolean;
  endsAt: number | null;
  beeped: boolean;
  cued10?: boolean;
  cued5?: boolean;
}

export interface Session {
  id: string;
  date: string;
  day: Day;
  startedAt: number | null;
  pausedMs: number;
  pauseStarted: number | null;
  idx: number;
  finished: boolean;
  focus: string[];
  logs: SetLog[];
  ratings: Rating[];
  timer: Timer | null;
  /** Logs as they were when this run started, so Discard can restore them. */
  runBase?: SetLog[];
  /** Last local change, used to merge with Drive. */
  updatedAt?: number;
  /** Wall-clock end of the run, for the duration shown in History. */
  endedAt?: number;
  seedId?: string;
}

export interface Settings {
  voice: boolean;
  focus: string[];
  weightStep: number;
  theme: Theme;
}

export type Theme = "system" | "light" | "dark";

export interface AppState {
  version: 2;
  sessions: Session[];
  settings: Settings;
}

export const sessionId = (date: string, day: Day) => `${date}|${day}`;

export function newSession(date: string, day: Day, focus: string[] = []): Session {
  return {
    id: sessionId(date, day),
    date,
    day,
    startedAt: null,
    pausedMs: 0,
    pauseStarted: null,
    idx: 0,
    finished: false,
    focus: [...focus],
    logs: [],
    ratings: [],
    timer: null,
  };
}

export function emptyState(): AppState {
  return { version: 2, sessions: [], settings: defaultSettings() };
}

export function defaultSettings(): Settings {
  return { voice: false, focus: [], weightStep: 5, theme: "system" };
}

const isDay = (v: unknown): v is Day => typeof v === "string" && (DAYS as readonly string[]).includes(v);
const isSide = (v: unknown): v is Side => v === "L" || v === "R" || v === null;

function cleanLog(v: unknown): SetLog | null {
  if (!v || typeof v !== "object") return null;
  const l = v as Record<string, unknown>;
  if (
    typeof l.id !== "string" ||
    !isDay(l.day) ||
    typeof l.date !== "string" ||
    typeof l.name !== "string" ||
    !isSide(l.side ?? null) ||
    typeof l.set !== "number" ||
    typeof l.weight !== "string" ||
    typeof l.reps !== "string" ||
    typeof l.at !== "number"
  )
    return null;
  const drops = Array.isArray(l.drops)
    ? l.drops
        .filter((d): d is Drop => !!d && typeof d === "object")
        .map((d) => ({ weight: String(d.weight ?? ""), reps: String(d.reps ?? "") }))
    : [];
  return { ...(l as unknown as SetLog), side: (l.side ?? null) as Side, drops };
}

export function cleanSession(v: unknown): Session | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.date !== "string" || !isDay(s.day) || !Array.isArray(s.logs)) return null;
  const base = newSession(s.date, s.day);
  return {
    ...base,
    ...(s as unknown as Session),
    logs: s.logs.map(cleanLog).filter((l): l is SetLog => !!l),
    ratings: Array.isArray(s.ratings)
      ? s.ratings
          .filter((r): r is Rating => !!r && typeof (r as Rating).muscle === "string")
          .map((r) => ({ muscle: r.muscle, pump: Number(r.pump) || 0, strain: Number(r.strain) || 0 }))
      : [],
    focus: Array.isArray(s.focus) ? s.focus.filter((f): f is string => typeof f === "string") : [],
    timer: s.timer && typeof s.timer === "object" ? (s.timer as Timer) : null,
  };
}

export function cleanSettings(v: unknown): Settings {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const step = Number(s.weightStep);
  return {
    voice: !!s.voice,
    focus: Array.isArray(s.focus) ? s.focus.filter((f): f is string => typeof f === "string") : [],
    weightStep: step > 0 && step <= 50 ? step : 5,
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : "system",
  };
}

/** Parses any v2 payload (localStorage, Drive file, or an imported JSON export). */
export function parseState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 2 || !Array.isArray(r.sessions)) return null;
  return {
    version: 2,
    sessions: r.sessions.map(cleanSession).filter((s): s is Session => !!s),
    settings: cleanSettings(r.settings),
  };
}

// ---------- One-time seed: the Oct 26 Push workout that was logged on paper ----------

export const SEED_ID = "fitty-seed:2026-10-26:push-1";
const SEED_DATE = "2026-10-26";
export const INCLINE_TOTAL_NOTE = "120 total / 60 per hand";

function seedLogs(): SetLog[] {
  let tick = Date.UTC(2026, 9, 26, 16, 0, 0);
  const rows: [string, [string, string, string?][]][] = [
    ["Incline DB press (30°)", [["120", "12", INCLINE_TOTAL_NOTE], ["120", "12", INCLINE_TOTAL_NOTE], ["120", "10", INCLINE_TOTAL_NOTE]]],
    ["Cable lateral raise (low pulley)", [["30", "12"], ["30", "8"], ["30", "13"], ["30", "8"]]],
    ["Seated cable chest press", [["low", "10", "warm-up"], ["180", "12"], ["180", "10"], ["180", "10"]]],
    ["Face pull (rope, high)", [["90", "12"], ["90", "12"], ["90", "12"], ["90", "12"]]],
    ["Cable fly, high-to-low", [["100", "12"], ["100", "12"]]],
    ["Overhead rope triceps extension", [["90", "20"], ["90", "15"], ["90", "12"]]],
    ["Triceps pushdown", [["90", "10"], ["90", "12"]]],
    ["Dead bug", [["BW", "7"], ["BW", "16"]]],
    ["Front plank", [["BW", "30 s"], ["BW", "20 s"]]],
    ["Incline walk, 10–14° at 2.8–3.3 mph", [["BW", "15 min"]]],
  ];
  const out: SetLog[] = [];
  for (const [name, sets] of rows)
    sets.forEach(([weight, reps, note], i) => {
      tick += 1000;
      out.push({
        id: logId(SEED_DATE, "Mon", name, i + 1, null),
        seedId: SEED_ID,
        day: "Mon",
        date: SEED_DATE,
        name,
        side: null,
        set: i + 1,
        weight,
        reps,
        drops: [],
        at: tick,
        ...(note ? { note } : {}),
      });
    });
  return out;
}

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * Adds the Oct 26 workout once, on a phone that has no log for that day.
 * Never touches a day the person already logged, and never re-adds it after they delete it.
 */
export function applySeed(state: AppState): AppState {
  if (flag(SEED_ID)) return state;
  if (state.sessions.some((s) => s.seedId === SEED_ID || s.logs.some((l) => l.seedId === SEED_ID))) return state;
  const existing = state.sessions.find((s) => s.id === sessionId(SEED_DATE, "Mon"));
  if (existing && (existing.logs.length > 0 || existing.startedAt || existing.finished)) return state;
  const seeded: Session = {
    ...(existing ?? newSession(SEED_DATE, "Mon")),
    seedId: SEED_ID,
    finished: true,
    logs: seedLogs(),
    updatedAt: Date.UTC(2026, 9, 26, 17, 0, 0),
  };
  return {
    ...state,
    sessions: existing ? state.sessions.map((s) => (s === existing ? seeded : s)) : [...state.sessions, seeded],
  };
}

/** Older seeds stored the incline press weight without saying it was the total of two dumbbells. */
export function clarifyIncline(state: AppState): AppState {
  let changed = false;
  const sessions = state.sessions.map((s) => {
    let touched = false;
    const logs = s.logs.map((l) => {
      if (l.seedId !== SEED_ID || l.name !== "Incline DB press (30°)" || l.weight !== "120") return l;
      if (l.note && l.note !== "120 lb may be total or per hand") return l;
      touched = changed = true;
      return { ...l, note: INCLINE_TOTAL_NOTE };
    });
    return touched ? { ...s, logs } : s;
  });
  return changed ? { ...state, sessions } : state;
}

export function load(): AppState {
  let state: AppState | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = parseState(JSON.parse(raw));
  } catch {
    /* Corrupt or blocked storage falls through to a fresh state. */
  }
  return clarifyIncline(applySeed(state ?? emptyState()));
}

/** Returns false when the browser refuses to save (private mode, quota). */
export function save(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (state.sessions.some((s) => s.seedId === SEED_ID)) localStorage.setItem(SEED_ID, "1");
    return true;
  } catch {
    return false;
  }
}

// ---------- Merge with a copy from another device ----------

function stamp(s: Session): number {
  if (s.updatedAt) return s.updatedAt;
  let t = s.startedAt ?? 0;
  for (const l of s.logs) if (l.at > t) t = l.at;
  return t;
}

/**
 * Session-level last-writer-wins. A session that only exists on one side is kept.
 * When both sides have it, the one changed most recently wins whole, so deleted
 * or edited sets don't come back from the other copy.
 */
export function mergeStates(local: AppState, remote: AppState): { state: AppState; changed: boolean } {
  const byId = new Map(local.sessions.map((s) => [s.id, s]));
  let changed = false;
  for (const r of remote.sessions) {
    const l = byId.get(r.id);
    if (!l) {
      byId.set(r.id, r);
      changed = true;
      continue;
    }
    // Never replace a run that is live on this phone.
    if (l.startedAt && !l.finished) continue;
    if (stamp(r) > stamp(l)) {
      byId.set(r.id, r);
      changed = true;
    }
  }
  return { state: { ...local, sessions: [...byId.values()] }, changed };
}
