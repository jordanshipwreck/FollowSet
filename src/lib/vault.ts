// The exercise vault: public/exercises.json, shared by the Library and the Studio.
import { useEffect, useState } from "react";
import { MUSCLES, type Item, type Muscle, type Phase } from "./program";

export interface VaultEntry {
  slug: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  station: string;
  equipment: string;
  unilateral: boolean;
  defaultReps: string;
  defaultSets: number;
  restSeconds: number;
  cues: string[];
  phase: string;
  days: string[];
  drop: boolean;
  demoGif: string | null;
  still: string;
  placeholder?: boolean;
}

let cache: VaultEntry[] | null = null;
let pending: Promise<VaultEntry[]> | null = null;

export function loadVault(): Promise<VaultEntry[]> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch("./exercises.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: unknown) => {
      cache = Array.isArray(d) ? (d as VaultEntry[]) : [];
      return cache;
    })
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}

export function useVault(): { items: VaultEntry[] | null; failed: boolean } {
  const [items, setItems] = useState<VaultEntry[] | null>(cache);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadVault()
      .then((v) => alive && setItems(v))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);
  return { items, failed };
}

/** Seconds for timed rep targets: "30 s" → 30, "2 min" → 120, "8–12" → undefined. */
export function timedSeconds(reps: string): number | undefined {
  const min = /(\d+)(?:\s*[–-]\s*(\d+))?\s*min/.exec(reps);
  if (min) return Number(min[2] ?? min[1]) * 60;
  const sec = /(\d+)(?:\s*[–-]\s*(\d+))?\s*s\b/.exec(reps);
  if (sec) return Number(sec[2] ?? sec[1]);
  return undefined;
}

const BODYWEIGHT = new Set(["Bodyweight", "None", "Treadmill"]);

/** A program item with the vault's defaults; the creator edits it from there. */
export function itemFromVault(e: VaultEntry): Item {
  const phase = (["warmup", "work", "finisher", "stretch"].includes(e.phase) ? e.phase : "work") as Phase;
  const muscle = (MUSCLES as readonly string[]).includes(e.primaryMuscles[0]) ? (e.primaryMuscles[0] as Muscle) : null;
  const timerSec = timedSeconds(e.defaultReps);
  return {
    name: e.name,
    sets: e.defaultSets || (phase === "work" ? 3 : 1),
    reps: e.defaultReps || "10",
    rir: phase === "work" ? "1–2" : "—",
    station: e.station,
    muscle: phase === "work" ? muscle : null,
    phase,
    cues: e.cues.slice(0, 3),
    ...(timerSec ? { timerSec } : {}),
    ...(BODYWEIGHT.has(e.equipment) ? { noWeight: true } : {}),
    ...(e.unilateral ? { unilateral: true } : {}),
  };
}

/** A creator's own exercise that isn't in the vault. */
export function customItem(name: string, muscle: Muscle | null): Item {
  return { name: name.trim(), sets: 3, reps: "10–12", rir: "1–2", station: "custom", muscle, phase: "work", cues: [] };
}
