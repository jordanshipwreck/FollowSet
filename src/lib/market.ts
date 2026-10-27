// Programs, creators and subscriptions. Local-first: everything lives in localStorage
// ("followset-market-v1") until a Supabase project is connected (see src/lib/cloud.ts).
import { useSyncExternalStore } from "react";
import { DAYS, MUSCLES, PROGRAM, type Day, type Group, type Item, type Muscle, type Phase, type Workout } from "./program";

export type Level = "beginner" | "intermediate" | "advanced";

export interface Creator {
  id: string;
  name: string;
  handle: string;
  bio: string;
}

export interface Program {
  id: string;
  title: string;
  summary: string;
  creator: Creator;
  /** Monthly price in USD. 0 = free. */
  price: number;
  level: Level;
  tags: string[];
  /** Missing day = rest day. */
  days: Partial<Record<Day, Workout>>;
  published: boolean;
  builtin?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Subscription {
  programId: string;
  since: number;
  price: number;
  /** True until Stripe is connected: no money moved. */
  test: boolean;
}

export interface MarketState {
  version: 1;
  programs: Program[];
  subscriptions: Subscription[];
  /** The program Today runs. */
  activeId: string;
  /** This phone's creator profile (Studio). */
  me: Creator;
}

export const ORIGINAL_ID = "followset-original";

export const ORIGINAL: Program = {
  id: ORIGINAL_ID,
  title: "Followset Original",
  summary: "Five supersetted push / pull / legs sessions a week, about 60 minutes, knee-friendly, with an optional arms-and-walk Friday and a daily-abs Sunday.",
  creator: { id: "jordan", name: "Jordan", handle: "followset", bio: "Built Followset. Trains early, supersets everything." },
  price: 0,
  level: "intermediate",
  tags: ["hypertrophy", "supersets", "knee-friendly", "5 days"],
  days: PROGRAM,
  published: true,
  builtin: true,
  createdAt: Date.UTC(2026, 9, 26),
  updatedAt: Date.UTC(2026, 9, 26),
};

export const REST_DAY: Workout = { title: "Rest day", groups: [] };

const KEY = "followset-market-v1";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function fresh(): MarketState {
  return {
    version: 1,
    programs: [],
    subscriptions: [],
    activeId: ORIGINAL_ID,
    me: { id: `me-${uid()}`, name: "", handle: "", bio: "" },
  };
}

const PHASES: Phase[] = ["warmup", "work", "finisher", "stretch"];
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.slice(0, max) : d);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
const mediaRef = (v: unknown) => (typeof v === "string" && /^(local:|https?:\/\/)/.test(v) ? v.slice(0, 500) : undefined);

/** Program days from storage or the cloud, rebuilt field by field. Anything malformed is dropped, so one bad program can't break Today or Discover. */
export function cleanDays(raw: unknown): Program["days"] {
  const out: Program["days"] = {};
  if (!raw || typeof raw !== "object") return out;
  for (const d of DAYS) {
    const w = (raw as Record<string, unknown>)[d] as { title?: unknown; groups?: unknown } | undefined;
    if (!w || typeof w !== "object" || !Array.isArray(w.groups)) continue;
    const groups: Group[] = w.groups.slice(0, 20).flatMap((g: { label?: unknown; rest?: unknown; items?: unknown }) => {
      if (!g || typeof g !== "object" || !Array.isArray(g.items)) return [];
      const items: Item[] = g.items.slice(0, 12).flatMap((it: Record<string, unknown>) => {
        const name = str(it?.name, 80).trim();
        if (!name) return [];
        const phase = PHASES.includes(it.phase as Phase) ? (it.phase as Phase) : "work";
        const item: Item = {
          name,
          sets: num(it.sets, 1, 10, 3),
          reps: str(it.reps, 20, "10"),
          rir: str(it.rir, 10, "—"),
          station: str(it.station, 40, "custom"),
          muscle: (MUSCLES as readonly string[]).includes(it.muscle as string) ? (it.muscle as Muscle) : null,
          phase,
          cues: Array.isArray(it.cues) ? it.cues.filter((c): c is string => typeof c === "string").slice(0, 6).map((c) => c.slice(0, 200)) : [],
        };
        if (typeof it.note === "string") item.note = it.note.slice(0, 200);
        if (typeof it.timerSec === "number") item.timerSec = num(it.timerSec, 1, 3600, 30);
        for (const k of ["noWeight", "unilateral", "drop"] as const) if (it[k] === true) item[k] = true;
        const v = mediaRef(it.videoRef);
        const a = mediaRef(it.voiceRef);
        if (v) item.videoRef = v;
        if (a) item.voiceRef = a;
        if (typeof it.talk === "string" && it.talk.trim()) item.talk = it.talk.slice(0, 300);
        return [item];
      });
      return [{ label: str(g.label, 40, "Straight") || "Straight", rest: num(g.rest, 0, 600, 60), items }];
    });
    out[d] = { title: str(w.title, 60), groups };
  }
  return out;
}

function read(): MarketState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.version === 1 && Array.isArray(raw.programs)) {
      return {
        ...fresh(),
        ...raw,
        programs: raw.programs.filter((p: Program) => p && typeof p.id === "string" && p.days && typeof p.days === "object").map((p: Program) => ({ ...p, days: cleanDays(p.days) })),
        subscriptions: Array.isArray(raw.subscriptions) ? raw.subscriptions : [],
      };
    }
  } catch {
    /* fall through */
  }
  return fresh();
}

let state: MarketState = typeof localStorage === "undefined" ? fresh() : read();
const listeners = new Set<() => void>();

function commit(next: MarketState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the change still lives for this session */
  }
  listeners.forEach((l) => l());
}

export const market = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Every program this phone knows: the built-in Original first, then local ones. */
  all(): Program[] {
    return [ORIGINAL, ...state.programs];
  },
  find(id: string | undefined): Program {
    return (id && state.programs.find((p) => p.id === id)) || ORIGINAL;
  },
  active(): Program {
    return market.find(state.activeId);
  },
  setActive(id: string) {
    commit({ ...state, activeId: id });
  },
  save(p: Program) {
    if (p.builtin) return;
    const next = { ...p, updatedAt: Date.now() };
    const exists = state.programs.some((x) => x.id === p.id);
    commit({ ...state, programs: exists ? state.programs.map((x) => (x.id === p.id ? next : x)) : [...state.programs, next] });
  },
  remove(id: string) {
    commit({
      ...state,
      programs: state.programs.filter((p) => p.id !== id),
      subscriptions: state.subscriptions.filter((s) => s.programId !== id),
      activeId: state.activeId === id ? ORIGINAL_ID : state.activeId,
    });
  },
  /** New empty program owned by this phone's creator profile. */
  draft(): Program {
    const now = Date.now();
    return {
      id: `p-${uid()}`,
      title: "",
      summary: "",
      creator: state.me,
      price: 0,
      level: "intermediate",
      tags: [],
      days: {},
      published: false,
      createdAt: now,
      updatedAt: now,
    };
  },
  setMe(me: Creator) {
    commit({
      ...state,
      me,
      programs: state.programs.map((p) => (p.creator.id === me.id ? { ...p, creator: me } : p)),
    });
  },
  isMine(p: Program) {
    return !p.builtin && p.creator.id === state.me.id;
  },
  subscribed(id: string) {
    return state.subscriptions.some((s) => s.programId === id);
  },
  /** Test-mode subscription. Real billing goes through Stripe Checkout once connected. */
  subscribeTo(p: Program) {
    if (market.subscribed(p.id)) return;
    commit({ ...state, subscriptions: [...state.subscriptions, { programId: p.id, since: Date.now(), price: p.price, test: true }] });
  },
  unsubscribe(id: string) {
    commit({ ...state, subscriptions: state.subscriptions.filter((s) => s.programId !== id) });
  },
  /** Replace local programs from a sync (cloud) without touching the rest. */
  replacePrograms(programs: Program[]) {
    commit({ ...state, programs });
  },
};

export function useMarket(): MarketState {
  return useSyncExternalStore(market.subscribe, market.get, market.get);
}

/** The workout a program runs on a weekday; rest day when the creator left it empty. */
export function workoutFor(programId: string | undefined, day: Day): Workout {
  return market.find(programId).days[day] ?? REST_DAY;
}

export function trainingDays(p: Program): Day[] {
  return DAYS.filter((d) => (p.days[d]?.groups.length ?? 0) > 0);
}

/** Exercise names across a program, in order, for covers and search. */
export function programExercises(p: Program): string[] {
  const out: string[] = [];
  for (const d of DAYS)
    for (const g of p.days[d]?.groups ?? [])
      for (const it of g.items) if (it.phase === "work" && !out.includes(it.name)) out.push(it.name);
  return out;
}

export function priceLabel(price: number): string {
  return price > 0 ? `$${price % 1 ? price.toFixed(2) : price}/mo` : "Free";
}

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Why a program can't be listed in Discover yet (empty when it can). */
export function publishProblems(p: Program): string[] {
  const out: string[] = [];
  if (!p.title.trim()) out.push("Give the program a title.");
  if (!trainingDays(p).length) out.push("Add at least one workout day.");
  if (!p.creator.name.trim()) out.push("Add your creator name (Studio home).");
  return out;
}
