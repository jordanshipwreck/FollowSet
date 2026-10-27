import { Icon } from "../components/Icon";
import { Num, TickRing } from "../components/ui";
import { addDays, iso, monthDay, weekStart } from "../lib/dates";
import { flags, grade, GRADE_NAME, overall, summarize } from "../lib/grade";
import { compact, volume } from "../lib/log";
import { MUSCLES } from "../lib/program";
import type { Store } from "../lib/useStore";

export function Progress({ store }: { store: Store }) {
  const { state, setSettings } = store;
  const all = state.sessions.flatMap((s) => s.ratings.map((r) => ({ ...r, date: s.date })));
  const grades = summarize(all);
  const avg = overall(grades);
  const warn = flags(grades);
  const focus = state.settings.focus;

  // Weekly volume, last 8 weeks.
  const thisWeek = weekStart(iso());
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, (i - 7) * 7));
  const vols = weeks.map((w) => {
    const end = addDays(w, 7);
    return volume(state.sessions.filter((s) => s.date >= w && s.date < end).flatMap((s) => s.logs));
  });
  const maxVol = Math.max(1, ...vols);

  const toggleFocus = (m: string) => setSettings({ focus: focus.includes(m) ? focus.filter((x) => x !== m) : [...focus, m] });

  return (
    <div className="screen">
      <header className="page-head">
        <h1>Progress</h1>
        <p className="muted">{GRADE_NAME} and training volume</p>
      </header>

      <section className="card grade-hero" data-testid="gains-grade-label">
        <TickRing value={(avg ?? 0) / 100} size={136} ticks={60} length={12} width={2.5}>
          <Num value={avg ?? "—"} className="lg" />
        </TickRing>
        <div>
          <span className="eyebrow">{GRADE_NAME}</span>
          <p className="big-txt">{avg === null ? "No ratings yet" : avg >= 75 ? "Firing well" : avg >= 55 ? "Solid, room to push" : "Something's lagging"}</p>
          <p className="muted small">Average across {grades.length} muscles. Rate each muscle after a workout to fill this in.</p>
        </div>
      </section>

      <section className="card">
        <div className="group-head">
          <span className="eyebrow">Weekly volume</span>
          <span className="muted small">lb × reps</span>
        </div>
        <div className="ticks-chart" role="img" aria-label="Weekly volume for the last 8 weeks">
          {weeks.map((w, i) => {
            const h = vols[i] ? Math.max(6, (vols[i] / maxVol) * 100) : 0;
            return (
              <div className={w === thisWeek ? "tick-col now" : "tick-col"} key={w}>
                <span className="tick-val">{vols[i] ? compact(vols[i]) : ""}</span>
                <div className="tick-track">
                  {Array.from({ length: 14 }, (_, k) => (
                    <i key={k} />
                  ))}
                  {vols[i] > 0 && <b style={{ bottom: `${h}%` }} />}
                </div>
                <span className="tick-lbl">{monthDay(w).replace(/^\w+ /, "")}</span>
              </div>
            );
          })}
        </div>
      </section>

      {warn.length > 0 && (
        <section className="card flags">
          <span className="eyebrow">Needs attention</span>
          {warn.map((f, i) => (
            <div className="flag" key={i}>
              <Icon name="bolt" size={18} />
              <div>
                <strong>{f.muscle}</strong>
                <p className="muted small">{f.reason}</p>
              </div>
              {!focus.includes(f.muscle) && (MUSCLES as readonly string[]).includes(f.muscle) && (
                <button type="button" className="chip lime" onClick={() => toggleFocus(f.muscle)}>
                  Focus
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <span className="eyebrow">By muscle</span>
        {grades.length === 0 && <p className="muted">Finish a workout and rate the muscles to see grades here.</p>}
        <div className="mgrades">
          {grades.map((g) => {
            const history = all.filter((r) => r.muscle === g.muscle).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
            return (
              <div className="mgrade" key={g.muscle}>
                <div className="mgrade-head">
                  <strong>{g.muscle}</strong>
                  <span className="muted small">
                    pump {g.pump.toFixed(1)} · strain {g.strain.toFixed(1)} · {g.samples}×
                  </span>
                  <b className="grade-num">{g.grade}</b>
                </div>
                <div className="meter">
                  <i style={{ width: `${g.grade}%` }} />
                </div>
                <div className="spark" aria-label={`${g.muscle} over time`}>
                  {history.map((r, i) => (
                    <i key={i} style={{ height: `${Math.max(8, grade(r.pump, r.strain))}%` }} title={`${r.date}: ${grade(r.pump, r.strain)}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Focus muscles</span>
        <p className="muted small">Each focus muscle gets one extra set on its work exercises. Applies the next time a workout starts.</p>
        <div className="chips">
          {MUSCLES.map((m) => (
            <button type="button" key={m} className={focus.includes(m) ? "chip lime" : "chip"} onClick={() => toggleFocus(m)} aria-pressed={focus.includes(m)}>
              {m}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
