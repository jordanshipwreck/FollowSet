// The weekly program. It repeats every week: the day key (Mon–Sun) picks the workout,
// the calendar date only decides which session the logs belong to.
import { CUES } from "./cues";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export const MUSCLES = [
  "chest",
  "shoulders",
  "rear delts",
  "triceps",
  "biceps",
  "back",
  "lats",
  "hamstrings",
  "glutes",
  "quads",
  "calves",
  "abs",
  "obliques",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type Phase = "warmup" | "work" | "finisher" | "stretch";

export interface Item {
  name: string;
  sets: number;
  reps: string;
  rir: string;
  station: string;
  muscle: Muscle | null;
  phase: Phase;
  cues: string[];
  note?: string;
  timerSec?: number;
  noWeight?: boolean;
  unilateral?: boolean;
  drop?: boolean;
  /** Creator media (Studio): a demo video of the creator, and a voice note that plays when the set starts. */
  videoRef?: string;
  voiceRef?: string;
  /** Creator's spoken note for this move; read aloud mid-set when there is no recording. */
  talk?: string;
}

export interface Group {
  label: string;
  rest: number;
  items: Item[];
}

export interface Workout {
  title: string;
  groups: Group[];
}

interface Opts {
  station: string;
  muscle: Muscle | null;
  phase?: Phase;
  note?: string;
  timerSec?: number;
  noWeight?: boolean;
  unilateral?: boolean;
  drop?: boolean;
}

function cuesFor(name: string): string[] {
  const cues = CUES[name];
  if (!cues || cues.length < 2 || cues.length > 3) throw new Error(`Missing cues for ${name}`);
  return cues;
}

function ex(name: string, sets: number, reps: string, rir: string, o: Opts): Item {
  return {
    name,
    sets,
    reps,
    rir,
    station: o.station,
    muscle: o.muscle,
    phase: o.phase ?? "work",
    cues: cuesFor(name),
    ...(o.note ? { note: o.note } : {}),
    ...(o.timerSec ? { timerSec: o.timerSec } : {}),
    ...(o.noWeight ? { noWeight: true } : {}),
    ...(o.unilateral ? { unilateral: true } : {}),
    ...(o.drop ? { drop: true } : {}),
  };
}

const BW = { noWeight: true } as const;
const DROP = { drop: true, note: "Drop set on last set" } as const;

const floor = (name: string, reps: string, phase: Phase, extra: Partial<Opts> = {}) =>
  ex(name, 1, reps, "—", { station: "floor", muscle: null, phase, ...BW, ...extra });
const hold30 = (name: string, unilateral = true) =>
  floor(name, "30 s", "stretch", { timerSec: 30, unilateral });

function walk(min: number, rest = 15): Group {
  return {
    label: min >= 25 ? "Conditioning" : "Finisher",
    rest,
    items: [
      ex("Incline walk, 10–14° at 2.8–3.3 mph", 1, `${min} min`, "—", {
        station: "treadmill",
        muscle: null,
        phase: "finisher",
        timerSec: min * 60,
        ...BW,
      }),
    ],
  };
}
const warmup = (items: Item[]): Group => ({ label: "Warm-up", rest: 15, items });
const stretches = (items: Item[]): Group => ({ label: "Stretches", rest: 15, items });

const armCircles = () => floor("Arm circles", "15/side", "warmup");
const wallSlides = () => floor("Wall slides", "8", "warmup");
const scapSqueeze = () => floor("Scapular squeezes", "10", "warmup");
const walkPrimer = () =>
  ex("Incline walk primer, easy pace", 1, "2 min", "—", {
    station: "treadmill",
    muscle: null,
    phase: "warmup",
    timerSec: 120,
    ...BW,
  });
const legSwings = () => floor("Leg swings, front to back", "8", "warmup", { unilateral: true });
const squatPrimer = () => floor("Bodyweight squat primer", "8", "warmup");
const bridges = () => floor("Glute bridges, easy", "8", "warmup");
const march = () => floor("Easy march in place", "45 s", "warmup", { timerSec: 45 });
const pecStretch = () => hold30("Doorway pec stretch");
const triStretch = () => hold30("Triceps stretch behind the head");
const latStretch = () => hold30("Lat stretch, arm overhead");
const biStretch = () => hold30("Biceps stretch, arm on a wall");
const hamStretch = () => hold30("Hamstring stretch, one leg long");
const hipStretch = () => hold30("Hip flexor stretch, half kneel");
const calfStretch = () => hold30("Calf stretch on a step");
const chestOpener = () => hold30("Chest opener, hands clasped behind", false);
const jointCircles = () =>
  ex("Joint circles, easy range", 1, "10 min", "—", {
    station: "none",
    muscle: null,
    phase: "stretch",
    timerSec: 600,
    ...BW,
  });

const upperWarmup = () => warmup([armCircles(), wallSlides(), walkPrimer()]);
const pullWarmup = () => warmup([armCircles(), scapSqueeze(), walkPrimer()]);
const legWarmup = () => warmup([legSwings(), squatPrimer(), bridges()]);
const pushStretch = () => stretches([pecStretch(), triStretch(), chestOpener()]);
const pullStretch = () => stretches([latStretch(), biStretch(), chestOpener()]);
const legStretch = () => stretches([hipStretch(), hamStretch(), calfStretch()]);

const lateral = (name: string, sets: number, reps: string, drop = false) =>
  ex(name, sets, reps, "0–1", { station: "cable", muscle: "shoulders", unilateral: true, ...(drop ? DROP : {}) });
const sidePlank = (sets = 2) =>
  ex("Side plank", sets, "30 s", "1–2", { station: "floor", muscle: "obliques", timerSec: 30, unilateral: true, ...BW });
const deadBug = (sets = 2) => ex("Dead bug", sets, "10/side", "1–2", { station: "floor", muscle: "abs", ...BW });
const frontPlank = () =>
  ex("Front plank", 2, "30–45 s", "1–2", { station: "floor", muscle: "abs", timerSec: 45, ...BW });
const calfRaise = () =>
  ex("Standing DB calf raise", 3, "12–15", "0–1", { station: "db-standing", muscle: "calves" });

export const PROGRAM: Record<Day, Workout> = {
  Mon: {
    title: "#1 Push",
    groups: [
      upperWarmup(),
      {
        label: "Superset A",
        rest: 90,
        items: [
          ex("Incline DB press (30°)", 3, "8–12", "1–2", { station: "db-incline", muscle: "chest" }),
          lateral("Cable lateral raise (low pulley)", 3, "12–15"),
        ],
      },
      {
        label: "Superset B",
        rest: 75,
        items: [
          ex("Seated cable chest press", 3, "10–12", "1", { station: "cable", muscle: "chest" }),
          frontPlank(),
        ],
      },
      {
        label: "Superset C",
        rest: 60,
        items: [ex("Face pull (rope, high)", 2, "12–15", "1", { station: "cable", muscle: "rear delts" }), deadBug(2)],
      },
      {
        label: "Straight",
        rest: 60,
        items: [ex("Cable fly, high-to-low", 2, "12–15", "0–1", { station: "cable", muscle: "chest", ...DROP })],
      },
      {
        label: "Straight",
        rest: 60,
        items: [ex("Overhead rope triceps extension", 3, "10–12", "1", { station: "cable", muscle: "triceps" })],
      },
      {
        label: "Straight",
        rest: 45,
        items: [ex("Triceps pushdown", 2, "12–15", "0–1", { station: "cable", muscle: "triceps", ...DROP })],
      },
      walk(10),
      pushStretch(),
    ],
  },
  Tue: {
    title: "#2 Pull",
    groups: [
      pullWarmup(),
      {
        label: "Superset A",
        rest: 90,
        items: [
          ex("Lat pulldown (high pulley)", 3, "8–12", "1–2", { station: "cable", muscle: "lats" }),
          ex("Chest-supported DB row", 3, "8–12", "1–2", { station: "db-chest", muscle: "back" }),
        ],
      },
      {
        label: "Superset B",
        rest: 90,
        items: [ex("Kneeling cable crunch", 3, "12–15", "1", { station: "cable", muscle: "abs" }), calfRaise()],
      },
      {
        label: "Superset C",
        rest: 75,
        items: [
          ex("Seated cable row (V-handle)", 3, "10–12", "1", { station: "cable", muscle: "back" }),
          ex("Incline DB curl", 3, "10–12", "0–1", { station: "db-incline", muscle: "biceps" }),
        ],
      },
      {
        label: "Superset D",
        rest: 60,
        items: [
          lateral("Cable lateral raise", 3, "12–15"),
          ex("Hammer curl", 2, "10–12", "0–1", { station: "db-standing", muscle: "biceps", ...DROP }),
        ],
      },
      {
        label: "Superset Abs",
        rest: 30,
        items: [
          ex("Hollow hold", 2, "20–30 s", "1–2", { station: "floor", muscle: "abs", timerSec: 30, ...BW }),
          sidePlank(2),
        ],
      },
      walk(10),
      pullStretch(),
    ],
  },
  Wed: {
    title: "#3 Legs A (no squat)",
    groups: [
      legWarmup(),
      {
        label: "Superset A",
        rest: 120,
        items: [
          ex("DB Romanian deadlift", 3, "8–10", "2", { station: "db-standing", muscle: "hamstrings" }),
          ex("Pallof press (cable, mid)", 3, "10", "—", { station: "cable", muscle: "obliques", unilateral: true }),
        ],
      },
      {
        label: "Superset B",
        rest: 75,
        items: [
          ex("Leg extension (3 s down, pain-free)", 3, "12–15", "1", { station: "leg-ext", muscle: "quads" }),
          ex("Seated leg curl", 3, "10–12", "0–1", { station: "leg-curl", muscle: "hamstrings", ...DROP }),
        ],
      },
      {
        label: "Superset C",
        rest: 75,
        items: [ex("Hip thrust (DB or barbell)", 3, "10–12", "1", { station: "hip-thrust", muscle: "glutes" }), calfRaise()],
      },
      {
        label: "Superset D",
        rest: 45,
        items: [
          ex("Kneeling cable crunch", 2, "12–15", "1", { station: "cable", muscle: "abs" }),
          ex("Reverse crunch on bench", 2, "10–15", "1–2", { station: "floor", muscle: "abs", ...BW }),
        ],
      },
      { label: "Core", rest: 30, items: [sidePlank(2)] },
      walk(10),
      legStretch(),
    ],
  },
  Thu: {
    title: "#4 Upper",
    groups: [
      upperWarmup(),
      {
        label: "Superset A",
        rest: 90,
        items: [
          ex("Flat DB press", 3, "8–12", "1–2", { station: "db-flat", muscle: "chest" }),
          ex("Single-arm cable row (mid)", 3, "10–12", "1", { station: "cable", muscle: "back", unilateral: true }),
        ],
      },
      {
        label: "Superset B",
        rest: 90,
        items: [
          ex("Seated DB shoulder press", 3, "8–12", "1–2", { station: "db-shoulder", muscle: "shoulders" }),
          ex("Neutral-grip lat pulldown", 3, "10–12", "1", { station: "cable", muscle: "lats" }),
        ],
      },
      {
        label: "Superset C",
        rest: 60,
        items: [
          lateral("Cable lateral raise", 3, "12–15", true),
          ex("Reverse crunch", 2, "10–15", "1–2", { station: "floor", muscle: "abs", ...BW }),
        ],
      },
      {
        label: "Straight",
        rest: 60,
        items: [ex("Reverse cable fly (high)", 2, "12–15", "0–1", { station: "cable", muscle: "rear delts" })],
      },
      { label: "Straight", rest: 45, items: [ex("Cable curl", 2, "12–15", "0–1", { station: "cable", muscle: "biceps" })] },
      {
        label: "Straight",
        rest: 45,
        items: [ex("Rope pushdown", 2, "12–15", "0–1", { station: "cable", muscle: "triceps" })],
      },
      {
        label: "Straight",
        rest: 30,
        items: [
          ex("Cable woodchop (high to low)", 2, "10", "1–2", { station: "cable", muscle: "obliques", unilateral: true }),
        ],
      },
      walk(10),
      pushStretch(),
    ],
  },
  Fri: {
    title: "Optional: walk, arms, abs",
    groups: [
      warmup([armCircles(), scapSqueeze()]),
      walk(25, 60),
      {
        label: "Superset A",
        rest: 60,
        items: [
          ex("DB curl", 3, "12–15", "1", { station: "db-bench", muscle: "biceps" }),
          lateral("Cable lateral raise", 3, "15"),
        ],
      },
      {
        label: "Superset B",
        rest: 60,
        items: [
          ex("DB skull crusher", 3, "12–15", "1", { station: "db-bench", muscle: "triceps" }),
          ex("Kneeling cable crunch", 2, "12–15", "1–2", { station: "cable", muscle: "abs" }),
        ],
      },
      { label: "Core", rest: 30, items: [deadBug(2)] },
      stretches([pecStretch(), triStretch(), chestOpener(), jointCircles()]),
    ],
  },
  Sat: {
    title: "#5 Legs B (squat day)",
    groups: [
      legWarmup(),
      {
        label: "Ramp-up",
        rest: 60,
        items: [
          ex("Bodyweight box squats, empty bar x10, light sets", 1, "6–8 min", "—", {
            station: "barbell",
            muscle: "quads",
            ...BW,
          }),
        ],
      },
      {
        label: "Straight sets",
        rest: 150,
        items: [
          ex("Barbell box squat (box at or above parallel)", 4, "6–8", "2–3", {
            station: "barbell",
            muscle: "quads",
            note: "Stop on any sharp or catching knee pain",
          }),
        ],
      },
      {
        label: "Superset A",
        rest: 75,
        items: [
          ex("Leg extension", 3, "12–15", "1", { station: "leg-ext", muscle: "quads" }),
          ex("Band lying leg curl", 3, "15–20", "1", { station: "band", muscle: "hamstrings" }),
        ],
      },
      {
        label: "Superset B",
        rest: 60,
        items: [
          ex("Cable pull-through (rope)", 3, "12–15", "1", { station: "cable", muscle: "glutes" }),
          ex("Seated calf raise (DB on knees)", 3, "15", "0–1", { station: "db-seated", muscle: "calves" }),
        ],
      },
      {
        label: "Superset C",
        rest: 30,
        items: [
          ex("Pallof press", 2, "10", "1–2", { station: "cable", muscle: "obliques", unilateral: true }),
          frontPlank(),
        ],
      },
      walk(10),
      legStretch(),
    ],
  },
  Sun: {
    title: "Rest day: daily abs only",
    groups: [
      warmup([march(), armCircles()]),
      { label: "Superset Abs", rest: 30, items: [deadBug(2), sidePlank(2)] },
      stretches([hipStretch(), chestOpener()]),
    ],
  },
};

/** Short title without the "#n" prefix, for tight spaces. */
export function shortTitle(title: string): string {
  return title.replace(/^#\d+\s*/, "").replace(/^Optional:\s*/, "");
}

/** Muscles a workout trains in its work sets, in program order. */
export function workMuscles(w: Workout): Muscle[] {
  const out: Muscle[] = [];
  for (const g of w.groups)
    for (const it of g.items) if (it.phase === "work" && it.muscle && !out.includes(it.muscle)) out.push(it.muscle);
  return out;
}
