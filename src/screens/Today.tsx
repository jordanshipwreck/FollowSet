import { useMemo } from "react";
import { Icon } from "../components/Icon";
import { Ring, Sheet, Thumb } from "../components/ui";
import { addDays, clock, dayOf, fmt, iso, longDay, monthDay, weekDates, weekRangeLabel } from "../lib/dates";
import { overall, summarize } from "../lib/grade";
import { compact, volume } from "../lib/log";
import { PROGRAM, shortTitle, workMuscles } from "../lib/program";
import { buildQueue, estimateMinutes, slotLabel } from "../lib/queue";
import { sessionId, type Session } from "../lib/store";
import type { Store } from "../lib/useStore";
import { elapsed } from "./Runner";
import { Summary } from "./Summary";

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Late one" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Today({
  store,
  date,
  setDate,
  onStart,
  active,
  summaryFor,
  setSummaryFor,
  openSettings,
  toast,
}: {
  store: Store;
  date: string;
  setDate: (d: string) => void;
  onStart: (date: string) => void;
  active: Session | null;
  summaryFor: string | null;
  setSummaryFor: (id: string | null) => void;
  openSettings: () => void;
  toast: (t: string) => void;
}) {
  const { state } = store;
  const today = iso();
  const day = dayOf(date);
  const w = PROGRAM[day];
  const session = state.sessions.find((s) => s.id === sessionId(date, day)) ?? null;
  const focus = session?.startedAt ? session.focus : state.settings.focus;
  const queue = useMemo(() => buildQueue(w, focus), [w, focus]);
  const muscles = workMuscles(w);
  const week = weekDates(date);
  const isFuture = date > today;
  const isActive = !!active && !!session && active.id === session.id;
  const otherActive = active && !isActive ? active : null;

  const hasLogs = (d: string) => state.sessions.some((s) => s.date === d && (s.finished || s.logs.length > 0));
  const weekSessions = state.sessions.filter((s) => week.includes(s.date));
  const trainingDays = week.filter((d) => dayOf(d) !== "Sun" && dayOf(d) !== "Fri");
  const doneCount = trainingDays.filter(hasLogs).length;
  const weekVol = volume(weekSessions.flatMap((s) => s.logs));
  const weekSets = weekSessions.reduce((n, s) => n + s.logs.length, 0);
  const avgGrade = overall(summarize(state.sessions.flatMap((s) => s.ratings)));

  const status = session?.finished ? "done" : isActive ? "live" : "ready";
  const summarySession = summaryFor ? state.sessions.find((s) => s.id === summaryFor) : null;

  return (
    <div className="screen today">
      <header className="greet">
        <div className="avatar" aria-hidden="true">
          F
        </div>
        <div>
          <p className="muted">{greeting()}</p>
          <h1 className="brand">Followset</h1>
        </div>
        <button type="button" className="icon-btn" aria-label="Settings" data-testid="open-settings" onClick={openSettings}>
          <Icon name="gear" />
        </button>
      </header>

      <section className="card week-card">
        <div className="week-head">
          <button type="button" className="icon-btn sm" aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}>
            <Icon name="left" size={18} />
          </button>
          <button type="button" className="week-label" onClick={() => setDate(today)} title="Jump to today">
            {weekRangeLabel(date)}
          </button>
          <button type="button" className="icon-btn sm" aria-label="Next week" onClick={() => setDate(addDays(date, 7))}>
            <Icon name="right" size={18} />
          </button>
        </div>
        <div className="week">
          {week.map((d) => (
            <button
              key={d}
              type="button"
              data-testid={`week-${dayOf(d)}`}
              className={[d === date ? "on" : "", d === today ? "today" : "", hasLogs(d) ? "done" : ""].filter(Boolean).join(" ")}
              onClick={() => setDate(d)}
              aria-label={`${longDay(d)} ${monthDay(d)}${hasLogs(d) ? ", logged" : ""}`}
            >
              <span>{fmt(d, { weekday: "narrow" })}</span>
              <strong>{fmt(d, { day: "numeric" })}</strong>
              <i />
            </button>
          ))}
        </div>
      </section>

      {otherActive && (
        <button type="button" className="card resume-card" onClick={() => onStart(otherActive.date)}>
          <span className="live-dot" />
          <span>
            {PROGRAM[otherActive.day].title} is still running from {monthDay(otherActive.date)}
          </span>
          <Icon name="arrow" />
        </button>
      )}

      <section className={`hero ${status}`} data-testid="hero">
        <div className="hero-top">
          <span className="chip ink">{date === today ? "Today" : `${longDay(date)} · ${monthDay(date)}`}</span>
          {w.title.match(/^#\d+/) && <span className="hero-num">{w.title.match(/^#\d+/)![0]}</span>}
        </div>
        <h2 className="hero-title" data-testid="workout-title">
          {shortTitle(w.title)}
        </h2>
        <p className="hero-meta">
          {queue.length} steps · ~{estimateMinutes(queue)} min{muscles.length ? ` · ${muscles.length} muscles` : ""}
        </p>
        {muscles.length > 0 && (
          <div className="hero-muscles">
            {muscles.map((m) => (
              <span key={m} className={focus.includes(m) ? "chip ink on" : "chip ink"}>
                {m}
                {focus.includes(m) ? " +1" : ""}
              </span>
            ))}
          </div>
        )}
        <div className="hero-foot">
          {status === "done" && session ? (
            <>
              <div>
                <p className="hero-stat">
                  <Icon name="check" size={18} /> Done{session.startedAt ? ` in ${clock(elapsed(session, Date.now()) / 1000)}` : ""}
                </p>
                <p className="hero-sub">
                  {session.logs.length} {session.logs.length === 1 ? "set" : "sets"} · {compact(volume(session.logs))} lb
                </p>
              </div>
              <button type="button" className="go dark" aria-label="Review workout" data-testid="review" onClick={() => setSummaryFor(session.id)}>
                <Icon name="arrow" size={26} />
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="hero-stat">{isActive ? "In progress" : isFuture ? "Preview" : date < today ? "Missed? Make it up" : "Ready when you are"}</p>
                <p className="hero-sub">
                  {isFuture ? "This day hasn't arrived, so nothing logs yet." : isActive ? `Step ${Math.min(active!.idx + 1, queue.length)} of ${queue.length}` : "Warm-up through stretches."}
                </p>
              </div>
              <button
                type="button"
                className="go dark"
                data-testid="start-workout"
                aria-label={isActive ? "Resume workout" : date < today ? "Start makeup" : "Start workout"}
                disabled={isFuture || !!otherActive}
                onClick={() => onStart(date)}
              >
                <Icon name={isActive ? "arrow" : "play"} size={26} />
              </button>
            </>
          )}
        </div>
      </section>
      {status === "done" && session && !isFuture && (
        <button type="button" className="link" onClick={() => onStart(date)}>
          Run it again
        </button>
      )}

      <section className="bento">
        <div className="tile big">
          <Ring value={trainingDays.length ? doneCount / trainingDays.length : 0} size={74} stroke={8}>
            <strong>
              {doneCount}/{trainingDays.length}
            </strong>
          </Ring>
          <div>
            <strong>This week</strong>
            <span>main sessions logged</span>
          </div>
        </div>
        <div className="tile lilac">
          <Icon name="flame" size={18} />
          <strong>{compact(weekVol)}</strong>
          <span>lb this week · {weekSets} sets</span>
        </div>
        <div className="tile peach">
          <Icon name="chart" size={18} />
          <strong>{avgGrade ?? "—"}</strong>
          <span>avg Gains Grade</span>
        </div>
      </section>

      <h3 className="section-title">Session plan</h3>
      <div className="plan" data-testid="plan-table">
        {w.groups.map((g, gi) => (
          <div className="card group" key={gi}>
            <div className="group-head">
              <span className="eyebrow">{g.label}</span>
              <span className="muted small">{g.rest}s rest</span>
            </div>
            {g.items.map((it, ii) => (
              <div className="plan-row" key={ii}>
                <Thumb name={it.name} />
                <div className="plan-txt">
                  <strong>{it.name}</strong>
                  <span className="muted small">
                    {slotLabel(g.label, ii)} · {it.sets + (it.phase === "work" && it.muscle && focus.includes(it.muscle) ? 1 : 0)} × {it.reps}
                    {it.rir !== "—" ? ` · RIR ${it.rir}` : ""}
                    {it.unilateral ? " · each side" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {summarySession && (
        <Sheet title={PROGRAM[summarySession.day].title} onClose={() => setSummaryFor(null)}>
          <Summary store={store} session={summarySession} toast={toast} />
        </Sheet>
      )}
    </div>
  );
}
