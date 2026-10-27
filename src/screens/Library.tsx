import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { Pills, Sheet } from "../components/ui";
import { liftKey, setText } from "../lib/log";
import type { Store } from "../lib/useStore";
import { useVault, type VaultEntry as Entry } from "../lib/vault";

const PHASES = [
  ["all", "All"],
  ["work", "Lifts"],
  ["warmup", "Warm-ups"],
  ["stretch", "Stretches"],
] as const;

export function Library({ store }: { store: Store }) {
  const { items, failed } = useVault();
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<(typeof PHASES)[number][0]>("all");
  const [muscle, setMuscle] = useState("all");
  const [open, setOpen] = useState<Entry | null>(null);

  const muscles = useMemo(() => [...new Set((items ?? []).flatMap((i) => i.primaryMuscles))].sort(), [items]);
  const shown = (items ?? []).filter(
    (i) =>
      (phase === "all" || i.phase === phase || (phase === "work" && i.phase === "finisher")) &&
      (muscle === "all" || i.primaryMuscles.includes(muscle) || i.secondaryMuscles.includes(muscle)) &&
      (!q.trim() || `${i.name} ${i.equipment} ${i.primaryMuscles.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const best = (name: string) => {
    const key = liftKey(name);
    let top: { w: number; text: string; date: string } | null = null;
    for (const s of store.state.sessions)
      for (const l of s.logs) {
        const w = parseFloat(l.weight);
        if (liftKey(l.name) === key && Number.isFinite(w) && (!top || w > top.w)) top = { w, text: setText(l), date: l.date };
      }
    return top;
  };

  return (
    <div className="screen" data-testid="exercise-library">
      <header className="page-head">
        <h1>Exercise vault</h1>
        <p className="muted" data-testid="library-count">
          {items ? `${shown.length} of ${items.length} exercises` : failed ? "Couldn't load the library offline yet." : "Loading…"}
        </p>
      </header>

      <label className="search">
        <Icon name="search" size={18} />
        <input data-testid="library-search" type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <Pills value={phase} options={PHASES} onChange={setPhase} />
      <div className="chips scroll">
        <button type="button" className={muscle === "all" ? "chip on" : "chip"} onClick={() => setMuscle("all")}>
          All muscles
        </button>
        {muscles.map((m) => (
          <button type="button" key={m} className={muscle === m ? "chip on" : "chip"} onClick={() => setMuscle(m)}>
            {m}
          </button>
        ))}
      </div>

      <div className="lib-grid">
        {shown.map((i) => (
          <button type="button" className="lib-card" data-testid="lib-card" key={i.slug} onClick={() => setOpen(i)}>
            <img src={`./${i.still}`} alt="" loading="lazy" decoding="async" className={i.placeholder ? "ill" : ""} />
            <div>
              <strong>{i.name}</strong>
              <span className="muted small">
                {i.equipment} · {i.primaryMuscles.join(", ")}
              </span>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <div className="lib-demo">
            <img src={`./${open.demoGif ?? open.still}`} alt={`${open.name} demo`} className={open.placeholder ? "ill" : ""} />
          </div>
          <div className="pills">
            <span className="pill">{open.equipment}</span>
            <span className="pill">
              {open.defaultSets} × {open.defaultReps}
            </span>
            <span className="pill">{open.restSeconds}s rest</span>
            {open.unilateral && <span className="pill">each side</span>}
          </div>
          <p className="muted small">
            Muscles: {[...open.primaryMuscles, ...open.secondaryMuscles.map((m) => `${m} (secondary)`)].join(", ") || "—"}
            <br />
            Programmed: {open.days.join(", ") || "—"}
          </p>
          {(() => {
            const b = best(open.name);
            return b ? (
              <div className="hint">
                <div>
                  <span className="eyebrow">Your best</span>
                  <p>
                    {b.text} on {b.date}
                  </p>
                </div>
              </div>
            ) : null;
          })()}
          <ul className="cues">
            {open.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
