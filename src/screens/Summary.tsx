import { useState } from "react";
import { Icon } from "../components/Icon";
import { Num, TickRing } from "../components/ui";
import { clock, fmt } from "../lib/dates";
import { grade, GRADE_NAME } from "../lib/grade";
import { compact, logText, volume } from "../lib/log";
import { PROGRAM, workMuscles } from "../lib/program";
import type { Rating, Session } from "../lib/store";
import type { Store } from "../lib/useStore";
import { elapsed } from "./Runner";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function Summary({ store, session, toast }: { store: Store; session: Session; toast: (t: string) => void }) {
  const w = PROGRAM[session.day];
  const muscles = workMuscles(w);
  const [showLog, setShowLog] = useState(false);
  const text = logText(session.logs, fmt(session.date, { month: "numeric", day: "numeric", year: "numeric" }), w.title);
  const vol = volume(session.logs);
  const mins = session.startedAt ? clock(elapsed(session, Date.now()) / 1000) : "—";

  const rate = (muscle: string, patch: Partial<Rating>) => {
    const s = store.ref.current.sessions.find((x) => x.id === session.id) ?? session;
    const r = { ...(s.ratings.find((x) => x.muscle === muscle) ?? { muscle, pump: 7, strain: 3 }), ...patch, muscle };
    const ratings = s.ratings.some((x) => x.muscle === muscle) ? s.ratings.map((x) => (x.muscle === muscle ? r : x)) : [...s.ratings, r];
    store.putSession({ ...s, ratings });
  };

  return (
    <div className="summary" data-testid="session-done">
      <div className="bento three">
        <div className="tile">
          <Icon name="clock" size={18} />
          <Num value={mins} />
          <span>Time</span>
        </div>
        <div className="tile">
          <Icon name="check" size={18} />
          <Num value={session.logs.length} />
          <span>Sets</span>
        </div>
        <div className="tile">
          <Icon name="flame" size={18} />
          <Num value={compact(vol)} unit="lb" />
          <span>Volume</span>
        </div>
      </div>

      <div className="row">
        <button
          type="button"
          className="btn ghost"
          data-testid="copy-log"
          disabled={!text}
          onClick={async () => toast((await copyText(text)) ? "Log copied" : "Copy blocked. Long-press the log to copy.")}
        >
          <Icon name="copy" size={18} /> Copy log
        </button>
        <button type="button" className="btn ghost" onClick={() => setShowLog(!showLog)} disabled={!text}>
          {showLog ? "Hide log" : "Show log"}
        </button>
      </div>
      {showLog && <pre className="log-pre" data-testid="summary">{text}</pre>}

      <h3 className="section-title">
        Rate today · <span className="muted">{GRADE_NAME}</span>
      </h3>
      <p className="muted small">Pump 1–10, strain 1–5. Grade = pump × 10, minus 12 per strain point over 3.</p>
      <div className="rate-list" data-testid="gains-grade">
        {muscles.map((m) => {
          const r = session.ratings.find((x) => x.muscle === m);
          const pump = r?.pump ?? 7;
          const strain = r?.strain ?? 3;
          const g = grade(pump, strain);
          return (
            <div className={r ? "rate-card rated" : "rate-card"} key={m}>
              <div className="rate-head">
                <strong>{m}</strong>
                <TickRing value={g / 100} size={52} ticks={36} length={6} on={r ? "var(--accent-deep)" : "var(--muted)"}>
                  <span className="grade-num">{g}</span>
                </TickRing>
              </div>
              <label className="slider">
                <span>
                  Pump <b>{pump}</b>
                </span>
                <input data-testid={`pump-${m}`} type="range" min={1} max={10} value={pump} onChange={(e) => rate(m, { pump: +e.target.value, strain })} />
              </label>
              <label className="slider">
                <span>
                  Strain <b>{strain}</b>
                </span>
                <input data-testid={`strain-${m}`} type="range" min={1} max={5} value={strain} onChange={(e) => rate(m, { pump, strain: +e.target.value })} />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
