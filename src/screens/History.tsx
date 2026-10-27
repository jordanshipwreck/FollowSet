import { useState } from "react";
import { Icon } from "../components/Icon";
import { Sheet, Thumb } from "../components/ui";
import { iso, longDay, monthDay, monthGrid, parseIso } from "../lib/dates";
import { compact, setText, volume } from "../lib/log";
import { PROGRAM } from "../lib/program";
import type { Drop, Session, SetLog } from "../lib/store";
import type { Store } from "../lib/useStore";
import { Summary } from "./Summary";

export function History({ store, openDay, toast }: { store: Store; openDay: (d: string) => void; toast: (t: string) => void }) {
  const { state, ref, putSession } = store;
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [edit, setEdit] = useState<SetLog | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const today = iso();

  const sessions = state.sessions.filter((s) => s.logs.length > 0 || s.finished).sort((a, b) => b.date.localeCompare(a.date));
  const logged = new Set(sessions.map((s) => s.date));
  const grid = monthGrid(ym.y, ym.m);
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shift = (d: number) => {
    const t = new Date(ym.y, ym.m + d, 1);
    setYm({ y: t.getFullYear(), m: t.getMonth() });
  };

  function saveEdit() {
    if (!edit) return;
    const s = ref.current.sessions.find((x) => x.id === `${edit.date}|${edit.day}`);
    if (!s) return;
    putSession({ ...s, logs: s.logs.map((l) => (l.id === edit.id ? { ...edit, drops: edit.drops.filter((d) => d.weight || d.reps) } : l)) });
    setEdit(null);
    toast("Set updated");
  }

  function deleteSet() {
    if (!edit) return;
    const s = ref.current.sessions.find((x) => x.id === `${edit.date}|${edit.day}`);
    if (!s) return;
    putSession({ ...s, logs: s.logs.filter((l) => l.id !== edit.id) });
    setEdit(null);
    toast("Set deleted");
  }

  const reviewSession = review ? state.sessions.find((s) => s.id === review) : null;

  return (
    <div className="screen">
      <header className="page-head">
        <h1>History</h1>
        <p className="muted">
          {sessions.length} sessions · {compact(volume(sessions.flatMap((s) => s.logs)))} lb total
        </p>
      </header>

      <section className="card cal-card">
        <div className="week-head">
          <button type="button" className="icon-btn sm" aria-label="Previous month" onClick={() => shift(-1)}>
            <Icon name="left" size={18} />
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" className="icon-btn sm" aria-label="Next month" onClick={() => shift(1)}>
            <Icon name="right" size={18} />
          </button>
        </div>
        <div className="cal">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span className="dow" key={i}>
              {d}
            </span>
          ))}
          {grid.map((c) => (
            <button
              key={c.iso}
              type="button"
              className={[c.inMonth ? "" : "out", logged.has(c.iso) ? "done" : "", c.iso === today ? "today" : ""].filter(Boolean).join(" ")}
              onClick={() => openDay(c.iso)}
              aria-label={`${longDay(c.iso)} ${monthDay(c.iso)}${logged.has(c.iso) ? ", logged" : ""}`}
            >
              {c.date}
            </button>
          ))}
        </div>
      </section>

      {sessions.length === 0 && (
        <div className="empty">
          <Icon name="history" size={32} />
          <p>No workouts logged yet. Your first session shows up here.</p>
        </div>
      )}

      {sessions.map((s) => (
        <SessionCard key={s.id} s={s} onEdit={(l) => setEdit({ ...l, drops: l.drops.map((d) => ({ ...d })) })} onReview={() => setReview(s.id)} />
      ))}

      {edit && (
        <Sheet title={`${edit.name} · set ${edit.set}${edit.side ? ` ${edit.side}` : ""}`} onClose={() => setEdit(null)}>
          <div className="edit-grid" data-testid="history-edit">
            <label className="field">
              <span>Weight</span>
              <input data-testid="edit-weight" inputMode="decimal" value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: e.target.value })} />
            </label>
            <label className="field">
              <span>Reps</span>
              <input data-testid="edit-reps" value={edit.reps} onChange={(e) => setEdit({ ...edit, reps: e.target.value })} />
            </label>
            <label className="field full">
              <span>Note</span>
              <input value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value || undefined })} />
            </label>
            {edit.drops.map((d: Drop, i) => (
              <div className="drop-row full" key={i}>
                <span>Drop {i + 1}</span>
                <input
                  aria-label={`Edit drop ${i + 1} weight`}
                  value={d.weight}
                  onChange={(e) => setEdit({ ...edit, drops: edit.drops.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })}
                />
                <input
                  aria-label={`Edit drop ${i + 1} reps`}
                  value={d.reps}
                  onChange={(e) => setEdit({ ...edit, drops: edit.drops.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)) })}
                />
              </div>
            ))}
          </div>
          <div className="stack">
            <button type="button" className="btn lime wide" onClick={saveEdit}>
              Save
            </button>
            <button type="button" className="btn danger wide" onClick={deleteSet}>
              <Icon name="trash" size={18} /> Delete set
            </button>
          </div>
        </Sheet>
      )}

      {reviewSession && (
        <Sheet title={PROGRAM[reviewSession.day].title} onClose={() => setReview(null)}>
          <Summary store={store} session={reviewSession} toast={toast} />
        </Sheet>
      )}
    </div>
  );
}

function SessionCard({ s, onEdit, onReview }: { s: Session; onEdit: (l: SetLog) => void; onReview: () => void }) {
  const [open, setOpen] = useState(false);
  const byName = new Map<string, SetLog[]>();
  for (const l of [...s.logs].sort((a, b) => a.at - b.at)) {
    const k = l.side ? `${l.name} ${l.side}` : l.name;
    byName.set(k, [...(byName.get(k) ?? []), l]);
  }
  const d = parseIso(s.date);
  return (
    <section className="card hist" data-testid="history-row">
      <button type="button" className="hist-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="date-badge">
          <span>{d.toLocaleDateString("en-US", { month: "short" })}</span>
          <strong>{d.getDate()}</strong>
        </div>
        <div className="hist-txt">
          <strong>{PROGRAM[s.day].title}</strong>
          <span className="muted small">
            {s.logs.length} {s.logs.length === 1 ? "set" : "sets"} · {compact(volume(s.logs))} lb{s.ratings.length ? ` · rated ${s.ratings.length}` : ""}
          </span>
        </div>
        <Icon name={open ? "up" : "right"} size={18} />
      </button>
      {open && (
        <div className="hist-body">
          {[...byName.entries()].map(([name, logs]) => (
            <div className="hist-ex" key={name}>
              <Thumb name={logs[0].name} size={40} />
              <div className="hist-sets">
                <strong>{name}</strong>
                <div className="set-chips">
                  {logs.map((l) => (
                    <button type="button" key={l.id} className="set-chip" onClick={() => onEdit(l)} title={l.note}>
                      {setText(l)}
                      {l.note ? " *" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {s.logs.length === 0 && <p className="muted">No sets logged.</p>}
          <button type="button" className="btn ghost wide" onClick={onReview}>
            Review & rate
          </button>
        </div>
      )}
    </section>
  );
}
