import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addDays, dayOf, weekDates, weekStart } from "../src/lib/dates";
import { parseSpokenNumber } from "../src/lib/device";
import { flags, grade, summarize } from "../src/lib/grade";
import { lastWeight, liftKey, logText, previousPerformance, progressionHint, repTop, volume } from "../src/lib/log";
import { mediaFor } from "../src/lib/media";
import { crc32 } from "../src/lib/photos";
import { DAYS, PROGRAM } from "../src/lib/program";
import { buildQueue, logId, slotLabel } from "../src/lib/queue";
import { applySeed, emptyState, mergeStates, newSession, parseState, SEED_ID, type Session, type SetLog } from "../src/lib/store";

const log = (p: Partial<SetLog>): SetLog => ({
  id: "x",
  day: "Mon",
  date: "2026-10-26",
  name: "Flat DB press",
  side: null,
  set: 1,
  weight: "50",
  reps: "10",
  drops: [],
  at: 1,
  ...p,
});

describe("program and queue", () => {
  it("matches the step counts the previous build showed", () => {
    // Tuesday read "41 steps, warm-up through stretches." in the old app.
    expect(buildQueue(PROGRAM.Tue).length).toBe(41);
  });

  it("alternates supersets and doubles unilateral moves", () => {
    const q = buildQueue(PROGRAM.Mon);
    const a = q.filter((s) => s.group === "Superset A").map((s) => `${slotLabel(s.group, s.slot)}${s.side ?? ""}:${s.set}`);
    expect(a.slice(0, 3)).toEqual(["A1:1", "A2L:1", "A2R:1"]);
    expect(q.find((s) => s.group === "Superset A" && s.side === "L")!.restAfter).toBe(15);
    expect(q.find((s) => s.group === "Superset A" && s.side === "R")!.restAfter).toBe(90);
    expect(q[q.length - 1].restAfter).toBe(0);
  });

  it("adds one set per focus muscle", () => {
    const base = buildQueue(PROGRAM.Mon).filter((s) => s.item.muscle === "triceps").length;
    const focused = buildQueue(PROGRAM.Mon, ["triceps"]).filter((s) => s.item.muscle === "triceps").length;
    expect(focused - base).toBe(2); // two triceps exercises, one extra set each
  });

  it("has media for every exercise in the program", () => {
    for (const d of DAYS)
      for (const g of PROGRAM[d].groups)
        for (const it of g.items) {
          const m = mediaFor(it.name);
          expect(m, it.name).toBeTruthy();
          expect(existsSync(`public/${m!.src.slice(2)}`), m!.src).toBe(true);
          expect(existsSync(`public/${m!.still.slice(2)}`), m!.still).toBe(true);
        }
  });

  it("keeps the v2 log id shape", () => {
    expect(logId("2026-10-26", "Mon", "Dead bug", 2, null)).toBe("2026-10-26|Mon|Dead bug|2|");
    expect(logId("2026-10-26", "Mon", "Side plank", 1, "L")).toBe("2026-10-26|Mon|Side plank|1|L");
  });
});

describe("dates", () => {
  it("repeats the program every week", () => {
    expect(dayOf("2026-10-26")).toBe("Mon");
    expect(dayOf("2026-11-01")).toBe("Sun");
    expect(dayOf("2026-11-02")).toBe("Mon");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(weekDates("2026-11-04")[0]).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("store", () => {
  it("parses v2 data from older builds and drops junk", () => {
    const s = parseState({
      version: 2,
      sessions: [{ ...newSession("2026-10-27", "Tue"), logs: [log({ day: "Tue" }), { bad: true }] }, { nope: 1 }],
      settings: { voice: true, focus: ["abs", 3] },
    })!;
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0].logs).toHaveLength(1);
    expect(s.settings).toEqual({ voice: true, focus: ["abs"], weightStep: 5 });
    expect(parseState({ version: 1 })).toBeNull();
  });

  it("seeds Oct 26 once and never over a logged day", () => {
    const seeded = applySeed(emptyState());
    expect(seeded.sessions[0].seedId).toBe(SEED_ID);
    expect(seeded.sessions[0].logs.length).toBe(27);
    expect(applySeed(seeded)).toBe(seeded);
    const mine = { ...emptyState(), sessions: [{ ...newSession("2026-10-26", "Mon"), logs: [log({})] }] };
    expect(applySeed(mine)).toBe(mine);
  });

  it("merges by session, newest change wins, live runs are protected", () => {
    const a: Session = { ...newSession("2026-10-26", "Mon"), logs: [log({ reps: "8" })], updatedAt: 10 };
    const b: Session = { ...a, logs: [log({ reps: "12" })], updatedAt: 20 };
    const other: Session = { ...newSession("2026-10-27", "Tue"), updatedAt: 5 };
    const local = { ...emptyState(), sessions: [a] };
    const { state, changed } = mergeStates(local, { ...emptyState(), sessions: [b, other] });
    expect(changed).toBe(true);
    expect(state.sessions.find((s) => s.id === a.id)!.logs[0].reps).toBe("12");
    expect(state.sessions).toHaveLength(2);
    const live = { ...a, startedAt: 1, finished: false };
    expect(mergeStates({ ...emptyState(), sessions: [live] }, { ...emptyState(), sessions: [b] }).changed).toBe(false);
    expect(mergeStates({ ...emptyState(), sessions: [b] }, { ...emptyState(), sessions: [a] }).changed).toBe(false);
  });
});

describe("grade", () => {
  it("scores pump minus excess strain", () => {
    expect(grade(7, 3)).toBe(70);
    expect(grade(8, 5)).toBe(56);
    expect(grade(20, 0)).toBe(100);
  });
  it("flags laggards and strain without pump", () => {
    const g = summarize([
      { muscle: "chest", pump: 9, strain: 2 },
      { muscle: "back", pump: 8, strain: 3 },
      { muscle: "biceps", pump: 4, strain: 4 },
    ]);
    const f = flags(g);
    expect(f.map((x) => x.muscle)).toEqual(["biceps", "biceps"]);
  });
});

describe("log helpers", () => {
  const sessions: Session[] = [
    { ...newSession("2026-10-19", "Mon"), logs: [log({ date: "2026-10-19", weight: "50", reps: "12", set: 1 }), log({ date: "2026-10-19", weight: "50", reps: "12", set: 2, at: 2 })] },
    { ...newSession("2026-10-26", "Mon"), logs: [log({ weight: "55", reps: "9", at: 5 })] },
  ];

  it("finds the last earlier session for a lift", () => {
    expect(previousPerformance("Flat DB press", sessions, "2026-10-26")!.date).toBe("2026-10-19");
    expect(previousPerformance("Flat DB press", sessions, "2026-10-19")).toBeNull();
    expect(lastWeight("Flat DB press", sessions)).toBe("55");
  });

  it("suggests a jump only when every set hit the top of the range", () => {
    const prev = previousPerformance("Flat DB press", sessions, "2026-10-26");
    expect(progressionHint("8–12", prev, 5)).toMatchObject({ weight: "55", up: true });
    expect(progressionHint("8–15", prev, 5)).toMatchObject({ weight: "50", up: false });
    expect(repTop("30–45 s")).toBeNull();
    expect(repTop("10/side")).toBeNull();
  });

  it("shares history across name variants", () => {
    expect(liftKey("Cable lateral raise (low pulley)")).toBe(liftKey("Cable lateral raise"));
  });

  it("formats the copyable log and volume", () => {
    const logs = [log({ weight: "90", reps: "10", drops: [{ weight: "70", reps: "6" }] }), log({ name: "Dead bug", weight: "BW", reps: "10", at: 2 })];
    expect(logText(logs, "10/26/2026", "#1 Push")).toBe("Workout log 10/26/2026 (#1 Push)\nFlat DB press: 90×10 + 70×6\nDead bug: 10");
    expect(volume(logs)).toBe(900 + 420);
  });
});

describe("device helpers", () => {
  it("parses spoken rep counts", () => {
    expect(parseSpokenNumber("twelve")).toBe("12");
    expect(parseSpokenNumber("twenty two")).toBe("22");
    expect(parseSpokenNumber("I did 8")).toBe("8");
    expect(parseSpokenNumber("banana")).toBeNull();
  });
  it("computes standard CRC-32 for the photo zip", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });
});

describe("catalog", () => {
  it("references files that exist", () => {
    const cat = JSON.parse(readFileSync("public/exercises.json", "utf8")) as { still: string; demoGif: string | null }[];
    for (const e of cat) {
      expect(existsSync(`public/${e.still}`), e.still).toBe(true);
      if (e.demoGif) expect(existsSync(`public/${e.demoGif}`), e.demoGif).toBe(true);
    }
  });
});
