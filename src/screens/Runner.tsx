import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Aura, KnobButton, Sheet, Stepper, Thumb, TickRing } from "../components/ui";
import { clock } from "../lib/dates";
import { beep, buzz, canListen, keepAwake, listenForNumber, say, stopSpeech, unlockAudio } from "../lib/device";
import { lastWeight, previousPerformance, progressionHint, repTop, setText } from "../lib/log";
import { mediaFor } from "../lib/media";
import { PROGRAM } from "../lib/program";
import { buildQueue, isDropSet, logId, slotLabel, SWITCH_REST, type Step } from "../lib/queue";
import type { Drop, Session, SetLog, Timer } from "../lib/store";
import { useNow, type Store } from "../lib/useStore";

const blankDrops = (): Drop[] => [
  { weight: "", reps: "" },
  { weight: "", reps: "" },
  { weight: "", reps: "" },
];

function spokenStep(s: Step): string {
  const ord = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"][s.set] ?? `${s.set}th`;
  const name = s.item.name.replace(/\s*\([^)]*\)/g, "");
  const raw = s.item.reps.replace(/[–—]/g, " to ");
  const reps = /\/side/.test(raw) ? raw.replace("/side", " per side") : /\bmin\b|\d\s*s\b/.test(raw) ? raw : `${raw} reps`;
  const side = s.side === "L" ? "left side" : s.side === "R" ? "right side" : "";
  return [name, `${ord} set`, side, reps].filter(Boolean).join(", ");
}

function draftKey(date: string, s: Step) {
  return `fitty-draft:${logId(date, "", s.item.name, s.set, s.side)}`;
}

export function elapsed(s: Session, now: number): number {
  if (!s.startedAt) return 0;
  // Older finished runs have no endedAt; their last logged set is the best end we have.
  const end = s.finished ? (s.endedAt ?? Math.max(s.startedAt, ...s.logs.map((l) => l.at))) : now;
  const paused = s.pauseStarted ? Math.max(0, end - s.pauseStarted) : 0;
  return Math.max(0, end - s.startedAt - s.pausedMs - paused);
}

export function Runner({
  store,
  session,
  onMinimize,
  onFinished,
  toast,
}: {
  store: Store;
  session: Session;
  onMinimize: () => void;
  onFinished: (s: Session) => void;
  toast: (t: string) => void;
}) {
  const { ref, putSession, state } = store;
  const workout = PROGRAM[session.day];
  const queue = useMemo(() => buildQueue(workout, session.focus), [workout, session.focus]);
  const idx = Math.min(session.idx, queue.length - 1);
  const step = queue[idx];
  const next = queue[idx + 1];
  const paused = !!session.pauseStarted;
  const now = useNow(true);
  const voice = state.settings.voice;
  const timer = session.timer;
  const remaining = timer ? (timer.running && timer.endsAt && !paused ? Math.max(0, timer.endsAt - now) : Math.max(0, timer.remainingMs)) : 0;
  const resting = !!(timer && timer.kind === "rest" && (timer.running || remaining > 0 || timer.beeped));

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [drops, setDrops] = useState<Drop[]>(blankDrops);
  const [menu, setMenu] = useState<null | "menu" | "plan" | "discard">(null);
  const [listening, setListening] = useState(false);
  const [mediaBad, setMediaBad] = useState(false);
  const [cuesOpen, setCuesOpen] = useState(true);
  const logging = useRef(false);

  const cur = () => ref.current.sessions.find((s) => s.id === session.id) ?? session;
  const stepKey = `${session.id}|${idx}`;

  const prev = useMemo(
    () => (step ? previousPerformance(step.item.name, state.sessions, session.date) : null),
    // Previous sessions don't change mid-run; recompute only per step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepKey],
  );
  const hint = step && !step.item.noWeight ? progressionHint(step.item.reps, prev, state.settings.weightStep) : null;
  const prevSameSet = prev?.sets.find((l) => l.set === step?.set && l.side === step?.side) ?? prev?.sets[0];

  // Prefill fields whenever the step changes.
  useEffect(() => {
    if (!step) return;
    setMediaBad(false);
    const existing = cur().logs.find((l) => l.id === logId(session.date, session.day, step.item.name, step.set, step.side));
    if (existing) {
      setWeight(existing.weight === "BW" || existing.weight === "—" ? "" : existing.weight);
      setReps(existing.reps);
      setDrops(existing.drops.length ? existing.drops.map((d) => ({ ...d })) : blankDrops());
      return;
    }
    let draft: { weight?: string; reps?: string } | null = null;
    try {
      draft = JSON.parse(sessionStorage.getItem(draftKey(session.date, step)) || "null");
    } catch {
      /* none */
    }
    const today = lastWeight(step.item.name, [cur()]);
    const w = step.item.noWeight ? "" : draft?.weight || today || lastWeight(step.item.name, ref.current.sessions);
    const top = repTop(step.item.reps);
    const r = draft?.reps ?? (step.item.noWeight || step.item.timerSec ? "" : prevSameSet?.reps && /^\d+$/.test(prevSameSet.reps) ? prevSameSet.reps : top ? String(top) : "");
    setWeight(w);
    setReps(r);
    setDrops(blankDrops());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  // Screen stays on while the run is live.
  useEffect(() => {
    void keepAwake(!paused);
    return () => void keepAwake(false);
  }, [paused]);

  // Countdown side effects: voice cues at 10 s and 5 s, beep at zero.
  const lastBeep = useRef(0);
  useEffect(() => {
    const s = cur();
    const t = s.timer;
    if (!t?.running || !t.endsAt || s.pauseStarted) return;
    const left = t.endsAt - Date.now();
    const upcoming = queue[s.idx];
    if (t.kind === "rest" && t.total >= 20 && voice && upcoming) {
      if (left <= 10000 && left > 5000 && !t.cued10) {
        say(`10 seconds. ${upcoming.item.cues[0] ?? ""}`, true);
        putSession({ ...s, timer: { ...t, cued10: true } });
        return;
      }
      if (left <= 5000 && left > 0 && !t.cued5) {
        say(`5 seconds. ${upcoming.item.cues[1] ?? upcoming.item.cues[0] ?? ""}`, true);
        putSession({ ...s, timer: { ...t, cued5: true } });
        return;
      }
    }
    if (left <= 0) {
      if (!t.beeped && Date.now() - lastBeep.current > 800) {
        lastBeep.current = Date.now();
        beep();
        say(t.kind === "rest" ? "Go" : "Time's up", voice);
      }
      putSession({ ...s, timer: { ...t, beeped: true, running: false, remainingMs: 0, endsAt: null } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  if (!step) return null;

  const announce = (s: Step, kind: "start" | "rest", rest = 0) => {
    const cues = s.item.cues.join(" ");
    const lead = kind === "rest" ? `Rest. ${rest} seconds. Next: ${s.item.name}, set ${s.set}${s.side ? `, ${s.side === "L" ? "left" : "right"} side` : ""}.` : `${spokenStep(s)}.`;
    say(`${lead} ${cues}`, ref.current.settings.voice);
  };

  const saveDraft = (w: string, r: string) => {
    try {
      sessionStorage.setItem(draftKey(session.date, step), JSON.stringify({ weight: w, reps: r }));
    } catch {
      /* none */
    }
  };

  function finish(s: Session) {
    stopSpeech();
    void keepAwake(false);
    const done = { ...s, finished: true, pauseStarted: null, timer: null, runBase: undefined, endedAt: Date.now() };
    putSession(done);
    say("Workout complete. Rate each muscle.", ref.current.settings.voice);
    onFinished(done);
  }

  async function logSet() {
    if (logging.current || paused || listening) return;
    logging.current = true;
    try {
      let r = reps.trim();
      const needsReps = !step.item.noWeight && !step.item.timerSec;
      if (needsReps && !r && ref.current.settings.voice && canListen()) {
        setListening(true);
        say("How many reps?", true);
        const heard = await listenForNumber();
        setListening(false);
        if (!heard) {
          toast("Didn't catch that. Type the reps.");
          return;
        }
        r = heard;
        setReps(heard);
      }
      if (needsReps && !r) {
        toast("Enter reps first");
        buzz(40);
        return;
      }
      if (!r) r = step.item.reps;
      const s = cur();
      const log: SetLog = {
        id: logId(s.date, s.day, step.item.name, step.set, step.side),
        day: s.day,
        date: s.date,
        name: step.item.name,
        side: step.side,
        set: step.set,
        weight: step.item.noWeight ? "BW" : weight.trim() || "—",
        reps: r,
        drops: isDropSet(step.item, step.set) ? drops.filter((d) => d.weight.trim() || d.reps.trim()).slice(0, 5) : [],
        at: Date.now(),
      };
      const logs = s.logs.some((l) => l.id === log.id) ? s.logs.map((l) => (l.id === log.id ? log : l)) : [...s.logs, log];
      try {
        sessionStorage.removeItem(draftKey(session.date, step));
      } catch {
        /* none */
      }
      const ni = s.idx + 1;
      if (ni >= queue.length) {
        finish({ ...s, logs });
        return;
      }
      const upcoming = queue[ni];
      let t: Timer | null = null;
      if (step.restAfter > 0) {
        t = {
          kind: "rest",
          label: step.restAfter === SWITCH_REST ? "Switch to the next move" : "Rest",
          total: step.restAfter,
          remainingMs: step.restAfter * 1000,
          running: true,
          endsAt: Date.now() + step.restAfter * 1000,
          beeped: false,
        };
        announce(upcoming, "rest", step.restAfter);
      } else announce(upcoming, "start");
      putSession({ ...s, logs, idx: ni, timer: t });
      buzz(15);
      window.scrollTo(0, 0);
    } finally {
      logging.current = false;
    }
  }

  function go(to: number) {
    const s = cur();
    if (to < 0) return;
    if (to >= queue.length) {
      finish(s);
      return;
    }
    stopSpeech();
    putSession({ ...s, idx: to, timer: null });
    announce(queue[to], "start");
    setMenu(null);
    window.scrollTo(0, 0);
  }

  function pause() {
    const s = cur();
    stopSpeech();
    const t = s.timer;
    putSession({
      ...s,
      pauseStarted: Date.now(),
      timer: t && t.running && t.endsAt ? { ...t, running: false, endsAt: null, remainingMs: Math.max(0, t.endsAt - Date.now()) } : t,
    });
  }

  function resume() {
    const s = cur();
    if (!s.pauseStarted) return;
    unlockAudio();
    const t = s.timer;
    putSession({
      ...s,
      pausedMs: s.pausedMs + (Date.now() - s.pauseStarted),
      pauseStarted: null,
      timer: t && t.remainingMs > 0 && !t.beeped ? { ...t, running: true, endsAt: Date.now() + t.remainingMs } : t,
    });
  }

  function addRest(sec: number) {
    const s = cur();
    const t = s.timer;
    if (!t) return;
    const base = t.endsAt ? Math.max(t.endsAt, Date.now()) : Date.now() + Math.max(0, t.remainingMs);
    const endsAt = base + sec * 1000;
    putSession({ ...s, timer: { ...t, total: t.total + sec, running: true, beeped: false, endsAt, remainingMs: endsAt - Date.now() } });
  }

  function startWorkTimer() {
    const s = cur();
    if (!step.item.timerSec || s.pauseStarted) return;
    unlockAudio();
    const sec = step.item.timerSec;
    putSession({
      ...s,
      timer: { kind: "work", label: step.item.name, total: sec, remainingMs: sec * 1000, running: true, endsAt: Date.now() + sec * 1000, beeped: false },
    });
  }

  function discard() {
    const s = cur();
    const logs = (s.runBase ?? s.logs.filter((l) => l.seedId || (s.startedAt && l.at < s.startedAt))).map((l) => ({
      ...l,
      drops: l.drops.map((d) => ({ ...d })),
    }));
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(`fitty-draft:${s.date}|`))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* none */
    }
    stopSpeech();
    void keepAwake(false);
    putSession({ ...s, logs, runBase: undefined, finished: logs.length > 0, startedAt: null, endedAt: undefined, pausedMs: 0, pauseStarted: null, idx: 0, timer: null });
    setMenu(null);
    onMinimize();
    toast("Workout discarded");
  }

  const media = mediaBad ? undefined : mediaFor(step.item.name);
  const workTimer = timer?.kind === "work" ? timer : null;
  const drop = isDropSet(step.item, step.set);
  const progress = (idx + (resting ? 1 : 0)) / queue.length;
  const loggedHere = new Set(cur().logs.map((l) => l.id));
  const rangeNote = step.item.note?.toLowerCase().includes("pain");

  return (
    <div className="runner" data-testid="runner">
      <Aura image={media && !media.illustration ? media.still : undefined} />
      <header className="run-top">
        <button type="button" className="icon-btn" aria-label="Minimize workout" data-testid="minimize" onClick={onMinimize}>
          <Icon name="left" />
        </button>
        <div className="run-progress">
          <div className="run-meta">
            <span data-testid="step-count">
              {idx + 1}/{queue.length}
            </span>
            <strong className="run-clock" data-testid="session-clock">
              {clock(elapsed(cur(), now) / 1000)}
            </strong>
          </div>
          <div className="bar">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label={paused ? "Resume" : "Pause"} data-testid={paused ? "resume" : "pause"} onClick={paused ? resume : pause}>
          <Icon name={paused ? "play" : "pause"} />
        </button>
        <button type="button" className="icon-btn" aria-label="Workout menu" data-testid="run-menu" onClick={() => setMenu("menu")}>
          <Icon name="list" />
        </button>
      </header>

      <div className="media-card" key={`m-${stepKey}-${resting ? "r" : "a"}`}>
        {media ? (
          <img
            key={media.src}
            data-testid="hero-image"
            className={media.illustration ? "ill" : ""}
            src={media.src}
            alt={`${step.item.name} demo`}
            decoding="async"
            fetchPriority="high"
            onError={(e) => {
              const img = e.currentTarget;
              if (media.animated && !img.dataset.fb) {
                img.dataset.fb = "1";
                img.src = media.still;
              } else setMediaBad(true);
            }}
          />
        ) : (
          <div className="media-empty" data-testid="placeholder-card">
            <span>{step.item.phase === "stretch" ? "Stretch" : step.item.phase === "warmup" ? "Warm-up" : "Form"}</span>
            <strong>{step.item.name}</strong>
          </div>
        )}
        <div className="media-chips">
          <span className="chip dark" data-testid="set-kicker">
            {slotLabel(step.group, step.slot)} · Set {step.set} of {step.item.sets}
          </span>
          {step.side && (
            <span className="chip accent" data-testid="side-chip">
              {step.side === "L" ? "LEFT" : "RIGHT"}
            </span>
          )}
        </div>
      </div>

      <section className="run-body" key={`b-${stepKey}-${resting ? "r" : "a"}`}>
        <p className="eyebrow">{step.group}</p>
        <h1 className="ex-name" data-testid="exercise-name">
          {step.item.name}
        </h1>
        <div className="pills">
          <span className="pill">
            <Icon name="bolt" size={15} />
            {step.item.reps}
          </span>
          {step.item.rir !== "—" && <span className="pill">RIR {step.item.rir}</span>}
          {step.restAfter > 0 && (
            <span className="pill">
              <Icon name="timer" size={15} />
              {step.restAfter}s rest
            </span>
          )}
          {drop && <span className="pill hot">Drop set</span>}
        </div>
        {step.item.note && <p className={rangeNote ? "callout warn" : "callout"}>{step.item.note}</p>}

        {(prev || hint) && (
          <div className="hint" data-testid="last-time">
            <div>
              <span className="eyebrow">Last time</span>
              <p>{prev ? prev.sets.map(setText).join(" · ") : "—"}</p>
              {hint && <p className={hint.up ? "hint-up" : "muted"}>{hint.text}</p>}
            </div>
            {hint?.up && weight !== hint.weight && (
              <button type="button" className="chip accent" onClick={() => setWeight(hint.weight)}>
                <Icon name="up" size={14} stroke={2.4} /> Use {hint.weight}
              </button>
            )}
          </div>
        )}

        <button type="button" className="cues-toggle" aria-expanded={cuesOpen} onClick={() => setCuesOpen(!cuesOpen)}>
          Form cues <Icon name={cuesOpen ? "up" : "right"} size={16} />
        </button>
        {cuesOpen && (
          <ul className="cues">
            {step.item.cues.map((c) => (
              <li key={c} data-testid="cue">
                {c}
              </li>
            ))}
          </ul>
        )}

        {step.item.timerSec && (
          <div className="work-timer">
            {workTimer ? (
              <TickRing value={remaining / (workTimer.total * 1000)} size={150} ticks={60} length={10}>
                <strong className="dotnum" data-testid="timer-digits">
                  {clock(remaining / 1000)}
                </strong>
              </TickRing>
            ) : (
              <button type="button" className="btn ghost wide" data-testid="start-timer" onClick={startWorkTimer} disabled={paused}>
                <Icon name="play" size={18} /> Start {clock(step.item.timerSec)}
              </button>
            )}
          </div>
        )}

        <div className="fields">
          {!step.item.noWeight && (
            <Stepper
              label="Weight"
              unit="lb"
              value={weight}
              step={state.settings.weightStep}
              testid="weight"
              disabled={paused}
              onChange={(v) => {
                setWeight(v);
                saveDraft(v, reps);
              }}
            />
          )}
          <Stepper
            label={step.item.timerSec ? "Time / reps" : "Reps"}
            value={reps}
            step={1}
            inputMode="numeric"
            testid="reps"
            disabled={paused}
            placeholder={step.item.noWeight || step.item.timerSec ? step.item.reps : ""}
            onChange={(v) => {
              setReps(v);
              saveDraft(weight, v);
            }}
          />
        </div>

        {drop && (
          <div className="drops" data-testid="drops">
            <p className="muted">Log each drop, lightest last.</p>
            {drops.map((d, i) => (
              <div className="drop-row" key={i}>
                <span>Drop {i + 1}</span>
                <input
                  inputMode="decimal"
                  aria-label={`Drop ${i + 1} weight`}
                  placeholder="lb"
                  value={d.weight}
                  onChange={(e) => setDrops(drops.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))}
                />
                <input
                  inputMode="numeric"
                  aria-label={`Drop ${i + 1} reps`}
                  placeholder="reps"
                  value={d.reps}
                  onChange={(e) => setDrops(drops.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))}
                />
              </div>
            ))}
            <div className="row">
              {drops.length < 5 && (
                <button type="button" className="btn ghost sm" onClick={() => setDrops([...drops, { weight: "", reps: "" }])}>
                  Add drop
                </button>
              )}
              {drops.length > 3 && (
                <button type="button" className="btn ghost sm" onClick={() => setDrops(drops.slice(0, -1))}>
                  Remove drop
                </button>
              )}
            </div>
          </div>
        )}

        {next && (
          <div className="up-next">
            <Thumb name={next.item.name} size={44} />
            <div>
              <span className="eyebrow">Up next</span>
              <p>
                {next.item.name}
                {next.side ? ` · ${next.side}` : ""}
              </p>
            </div>
          </div>
        )}
      </section>

      <footer className="dock">
        <button type="button" className="round" aria-label="Back" data-testid="back" onClick={() => go(idx - 1)} disabled={idx === 0}>
          <Icon name="back" />
        </button>
        <KnobButton
          testid="log-set"
          tone="accent"
          icon={listening ? "mic" : "check"}
          label={listening ? "Listening…" : "Log set"}
          onClick={() => void logSet()}
          disabled={paused || listening}
        />
        <button type="button" className="round" aria-label="Skip" data-testid="skip" onClick={() => go(idx + 1)}>
          <Icon name="skip" />
        </button>
      </footer>

      {paused && (
        <div className="overlay paused-ov" data-testid="paused">
          <p className="eyebrow">Paused</p>
          <strong className="display">{clock(elapsed(cur(), now) / 1000)}</strong>
          <button type="button" className="btn accent big" onClick={resume}>
            <Icon name="play" /> Resume
          </button>
          <button type="button" className="btn ghost" onClick={() => setMenu("menu")}>
            End or discard
          </button>
        </div>
      )}

      {resting && !paused && timer && (
        <div className={remaining <= 0 ? "overlay rest-ov up" : "overlay rest-ov"} data-testid="live-timer">
          <p className="eyebrow" data-testid="timer-label">
            {remaining <= 0 ? "Time's up. Go." : timer.label}
          </p>
          <TickRing
            sweep
            value={timer.total ? remaining / (timer.total * 1000) : 0}
            size={250}
            ticks={72}
            length={16}
            width={3}
            on={remaining <= 0 ? "var(--ink)" : "var(--accent)"}
            off={remaining <= 0 ? "rgba(14,14,12,.15)" : "rgba(255,255,255,.12)"}
          >
            <strong className="dotnum big" data-testid="timer-digits">
              {clock(remaining / 1000)}
            </strong>
          </TickRing>
          <div className="up-next big">
            <Thumb name={step.item.name} size={56} />
            <div>
              <span className="eyebrow">Next · set {step.set} of {step.item.sets}</span>
              <p>
                {step.item.name}
                {step.side ? ` · ${step.side === "L" ? "left" : "right"}` : ""}
              </p>
            </div>
          </div>
          <div className="row center">
            <button type="button" className="btn ghost" onClick={() => addRest(15)}>
              +15s
            </button>
            <button type="button" className="btn accent" data-testid="skip-rest" onClick={() => putSession({ ...cur(), timer: null })}>
              {remaining <= 0 ? "Start set" : "Skip rest"}
            </button>
          </div>
        </div>
      )}

      {menu === "menu" && (
        <Sheet title="This workout" onClose={() => setMenu(null)}>
          <p className="muted">End keeps the sets you logged. Discard removes this run and leaves other days alone.</p>
          <div className="stack">
            <button type="button" className="btn ghost wide" onClick={() => setMenu("plan")}>
              <Icon name="list" /> Jump to a step
            </button>
            <button type="button" className="btn accent wide" data-testid="confirm-end" onClick={() => finish(cur())}>
              <Icon name="check" /> End workout
            </button>
            <button type="button" className="btn danger wide" data-testid="discard-workout" onClick={() => setMenu("discard")}>
              <Icon name="trash" /> Discard workout
            </button>
          </div>
        </Sheet>
      )}
      {menu === "discard" && (
        <Sheet title="Discard this workout?" onClose={() => setMenu(null)}>
          <p className="muted">Sets from this run are removed. Other days stay.</p>
          <div className="stack">
            <button type="button" className="btn danger wide" data-testid="confirm-discard" onClick={discard}>
              Discard workout
            </button>
            <button type="button" className="btn ghost wide" data-testid="cancel-discard" onClick={() => setMenu(null)}>
              Keep going
            </button>
          </div>
        </Sheet>
      )}
      {menu === "plan" && (
        <Sheet title={workout.title} onClose={() => setMenu(null)}>
          <ol className="jump">
            {queue.map((q, i) => {
              const done = loggedHere.has(logId(session.date, session.day, q.item.name, q.set, q.side));
              return (
                <li key={i}>
                  <button type="button" className={i === idx ? "on" : done ? "done" : ""} onClick={() => go(i)}>
                    <span className="jump-slot">{slotLabel(q.group, q.slot)}</span>
                    <span className="jump-name">
                      {q.item.name}
                      <small>
                        Set {q.set}/{q.item.sets}
                        {q.side ? ` · ${q.side}` : ""}
                      </small>
                    </span>
                    {done && <Icon name="check" size={18} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </Sheet>
      )}
    </div>
  );
}
