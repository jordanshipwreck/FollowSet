import { useMemo } from "react";
import { Icon } from "../components/Icon";
import { DotRow, KnobButton, Num, Sheet, StatCard, Thumb, TickRing } from "../components/ui";
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

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function Today({
  store,
  date,
  setDate,
  onStart,
  active,
  summaryFor,
  setSummaryFor,
  openSettings,
  openTab,
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
  openTab: (t: "history" | "progress") => void;
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
  const num = w.title.match(/^#\d+/)?.[0];

  const hasLogs = (d: string) => state.sessions.some((s) => s.date === d && (s.finished || s.logs.length > 0));
  const weekSessions = state.sessions.filter((s) => week.includes(s.date));
  const trainingDays = week.filter((d) => dayOf(d) !== "Sun" && dayOf(d) !== "Fri");
  const doneCount = trainingDays.filter(hasLogs).length;
  const weekVol = volume(weekSessions.flatMap((s) => s.logs));
  const weekSets = weekSessions.reduce((n, s) => n + s.logs.length, 0);
  const grades = summarize(state.sessions.flatMap((s) => s.ratings));
  const avgGrade = overall(grades);
  const done = !!session?.finished;
  const summarySession = summaryFor ? state.sessions.find((s) => s.id === summaryFor) : null;

  return (
    <div className="screen today">
      <header className="greet">
        <div className="brandmark" aria-hidden="true">
          F
        </div>
        <div className="greet-txt">
          <span className="label">{greeting()}</span>
          <h1 className="brand">Followset</h1>
        </div>
        <button type="button" className="icon-btn" aria-label="Settings" data-testid="open-settings" onClick={openSettings}>
          <Icon name="gear" size={20} />
        </button>
      </header>

      <div className="headline">
        <span className="muted">Today is {fmt(today, { weekday: "long", month: "long", day: "numeric" })}</span>
        <h2 className="display-title">
          <span className="thin">{date === today ? "Today's" : longDay(date) + "'s"}</span> Workout
        </h2>
      </div>

      <section className="glass week-card">
        <div className="row-between">
          <button type="button" className="icon-btn sm" aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}>
            <Icon name="left" size={16} />
          </button>
          <button type="button" className="label week-label" onClick={() => setDate(today)} title="Jump to today">
            {weekRangeLabel(date)}
          </button>
          <button type="button" className="icon-btn sm" aria-label="Next week" onClick={() => setDate(addDays(date, 7))}>
            <Icon name="right" size={16} />
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
              <span>{fmt(d, { weekday: "short" })}</span>
              <strong>{fmt(d, { day: "numeric" })}</strong>
              <i>{hasLogs(d) ? <Icon name="check" size={12} stroke={2.6} /> : null}</i>
            </button>
          ))}
        </div>
      </section>

      {otherActive && (
        <button type="button" className="glass resume-card" onClick={() => onStart(otherActive.date)}>
          <span className="live-dot" />
          <span>
            {PROGRAM[otherActive.day].title} is still running from {monthDay(otherActive.date)}
          </span>
          <span className="arrow">
            <Icon name="arrowUp" size={16} />
          </span>
        </button>
      )}

      <section className={`hero ${done ? "done" : ""}`} data-testid="hero">
        <div className="hero-top">
          <span className="ico">
            <Icon name="dumbbell" size={18} />
          </span>
          <span className="label">{date === today ? "Today" : `${longDay(date)} · ${monthDay(date)}`}</span>
          {done && session ? (
            <button type="button" className="arrow" aria-label="Review workout" data-testid="review" onClick={() => setSummaryFor(session.id)}>
              <Icon name="arrowUp" size={16} />
            </button>
          ) : (
            <span className={isActive ? "status live" : "status"}>{isActive ? "Live" : isFuture ? "Preview" : date < today ? "Makeup" : "Ready"}</span>
          )}
        </div>
        <h2 className="hero-title" data-testid="workout-title">
          {shortTitle(w.title)}
          {num && <sup>{num}</sup>}
        </h2>
        <div className="hero-stats">
          <div>
            <span className="label">Steps</span>
            <Num value={queue.length} />
          </div>
          <div>
            <span className="label">Time</span>
            <Num value={`~${estimateMinutes(queue)}`} unit="min" />
          </div>
          <div>
            <span className="label">Muscles</span>
            <Num value={muscles.length} />
          </div>
        </div>
        {muscles.length > 0 && (
          <div className="chips">
            {muscles.map((m) => (
              <span key={m} className={focus.includes(m) ? "chip on" : "chip"}>
                {m}
                {focus.includes(m) ? " +1" : ""}
              </span>
            ))}
          </div>
        )}
        {done && session ? (
          <div className="done-row">
            <span className="status ok">
              <Icon name="check" size={14} stroke={2.4} /> Done
            </span>
            <span className="muted">
              {session.startedAt ? `${clock(elapsed(session, Date.now()) / 1000)} · ` : ""}
              {plural(session.logs.length, "set")} · {compact(volume(session.logs))} lb
            </span>
          </div>
        ) : (
          <KnobButton
            testid="start-workout"
            label={
              isActive
                ? `Resume · step ${Math.min(active!.idx + 1, queue.length)} of ${queue.length}`
                : isFuture
                  ? "Preview only"
                  : date < today
                    ? "Start makeup"
                    : "Start workout"
            }
            ariaLabel={isActive ? "Resume workout" : date < today ? "Start makeup" : "Start workout"}
            icon={isActive ? "arrow" : "play"}
            tone="dark"
            disabled={isFuture || !!otherActive}
            onClick={() => onStart(date)}
          />
        )}
        {isFuture && <p className="muted small">This day hasn't arrived, so nothing logs yet.</p>}
      </section>
      {done && session && !isFuture && (
        <button type="button" className="link" onClick={() => onStart(date)}>
          Run it again
        </button>
      )}

      <section className="bento">
        <StatCard
          icon="check"
          label="This week"
          value={doneCount}
          unit={`/${trainingDays.length}`}
          foot={<DotRow total={trainingDays.length} filled={doneCount} />}
          onOpen={() => openTab("history")}
        />
        <StatCard
          icon="flame"
          label="Volume"
          value={compact(weekVol)}
          unit="lb"
          tone="accent"
          foot={<span className="small">{plural(weekSets, "set")} this week</span>}
        />
        <div className="stat wide">
          <div className="stat-top">
            <span className="ico">
              <Icon name="chart" size={16} />
            </span>
            <button type="button" className="arrow" aria-label="Open Gains Grade" onClick={() => openTab("progress")}>
              <Icon name="arrowUp" size={16} />
            </button>
          </div>
          <div className="stat-split">
            <div>
              <span className="label">Gains Grade</span>
              <Num value={avgGrade ?? "—"} unit={avgGrade === null ? undefined : "/100"} />
              <span className="muted small">{grades.length ? `across ${plural(grades.length, "muscle")}` : "Rate muscles after a workout"}</span>
            </div>
            <TickRing value={(avgGrade ?? 0) / 100} size={84} ticks={48} length={9} />
          </div>
        </div>
      </section>

      <div className="section-head">
        <span className="label">Session plan</span>
        <span className="muted small">{w.groups.length} blocks</span>
      </div>
      <div className="plan" data-testid="plan-table">
        {w.groups.map((g, gi) => (
          <div className="glass group" key={gi}>
            <div className="row-between">
              <span className="label">{g.label}</span>
              <span className="pill-mini">{g.rest}s rest</span>
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
