import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { Recorder } from "../components/Recorder";
import { CLOUD } from "../lib/cloud";
import { cloudUser } from "../lib/cloudAuth";
import { removeProgram } from "../lib/cloudSync";
import { KnobButton, Sheet, Thumb, Toggle } from "../components/ui";
import { market, ORIGINAL, plural, priceLabel, publishProblems, trainingDays, useMarket, type Level, type Program } from "../lib/market";
import { deleteMedia, putMedia, useMediaUrl } from "../lib/mediaStore";
import { DEFAULT_REST, KINDS, kindOf, phaseOf, relabel, type Kind } from "../lib/blocks";
import { DAYS, type Day, type Group, type Item } from "../lib/program";
import { customItem, itemFromVault, useVault } from "../lib/vault";

const PRICES = [0, 4.99, 9.99, 19.99];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export function Studio({
  editId,
  setEditId,
  toast,
  goToday,
}: {
  editId: string | null;
  setEditId: (id: string | null) => void;
  toast: (t: string) => void;
  goToday: () => void;
}) {
  const m = useMarket();
  const editing = editId ? m.programs.find((p) => p.id === editId) : undefined;
  if (editing) return <Editor program={editing} back={() => setEditId(null)} toast={toast} goToday={goToday} />;
  return <StudioHome open={setEditId} toast={toast} />;
}

function StudioHome({ open, toast }: { open: (id: string) => void; toast: (t: string) => void }) {
  const m = useMarket();
  const [me, setMe] = useState(m.me);
  const mine = m.programs.filter((p) => p.creator.id === m.me.id);
  const dirty = me.name !== m.me.name || me.handle !== m.me.handle || me.bio !== m.me.bio;

  const create = (remix?: Program) => {
    const d = market.draft();
    const p: Program = remix
      ? { ...d, title: `${remix.title} (remix)`, summary: remix.summary, level: remix.level, tags: [...remix.tags], days: JSON.parse(JSON.stringify(remix.days)) }
      : d;
    market.save(p);
    open(p.id);
  };

  return (
    <div className="screen" data-testid="studio">
      <header className="page-head">
        <h1>Creator Studio</h1>
        <p className="muted">Build programs from the exercise vault, or film yourself doing every move.</p>
      </header>

      <section className="glass">
        <span className="label">Your creator profile</span>
        <div className="edit-grid">
          <label className="field">
            <span>Name</span>
            <input data-testid="me-name" value={me.name} placeholder="Jordan" onChange={(e) => setMe({ ...me, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Handle</span>
            <input value={me.handle} placeholder="followset" onChange={(e) => setMe({ ...me, handle: e.target.value.replace(/[^a-z0-9_.]/gi, "").toLowerCase() })} />
          </label>
          <label className="field full">
            <span>Bio</span>
            <input value={me.bio} placeholder="What you train for, and how you coach" onChange={(e) => setMe({ ...me, bio: e.target.value })} />
          </label>
        </div>
        {dirty && (
          <button
            type="button"
            className="btn accent"
            data-testid="me-save"
            onClick={() => {
              market.setMe(me);
              toast("Profile saved");
            }}
          >
            Save profile
          </button>
        )}
      </section>

      <KnobButton testid="new-program" tone="dark" icon="plus" label="New program" onClick={() => create()} />
      <button type="button" className="glass resume-card" onClick={() => create(ORIGINAL)}>
        <Icon name="copy" size={18} />
        <span>Remix Followset Original as a starting point</span>
        <span className="arrow">
          <Icon name="arrowUp" size={16} />
        </span>
      </button>

      <div className="section-head">
        <span className="label">Your programs</span>
        <span className="muted small">{mine.length}</span>
      </div>
      {mine.length === 0 && <p className="muted empty">Nothing yet. Start blank or remix the Original.</p>}
      {mine.map((p) => (
        <button type="button" key={p.id} className="glass studio-card" data-testid="my-program" onClick={() => open(p.id)}>
          <div>
            <strong>{p.title || "Untitled program"}</strong>
            <span className="muted small">
              {plural(trainingDays(p).length, "day")} · {priceLabel(p.price)} · {p.level}
            </span>
          </div>
          <span className={p.published ? "status ok" : "status"}>{p.published ? "Published" : "Draft"}</span>
        </button>
      ))}
    </div>
  );
}

function Editor({ program, back, toast, goToday }: { program: Program; back: () => void; toast: (t: string) => void; goToday: () => void }) {
  const [day, setDay] = useState<Day>(DAYS.find((d) => program.days[d]) ?? "Mon");
  const [picker, setPicker] = useState<number | null>(null);
  const [rec, setRec] = useState<{ g: number; i: number; kind: "video" | "audio" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p = program;
  const w = p.days[day];

  const save = (next: Program) => market.save(next);
  const setDays = (d: Day, groups: Group[] | null, title?: string) => {
    const days = { ...p.days };
    if (groups === null) delete days[d];
    else days[d] = { title: title ?? days[d]?.title ?? "", groups: relabel(groups) };
    save({ ...p, days, published: p.published && !!Object.keys(days).length });
  };
  const groups = w?.groups ?? [];
  const setGroup = (gi: number, g: Group) => setDays(day, groups.map((x, i) => (i === gi ? g : x)));
  const setItem = (gi: number, ii: number, it: Item) => setGroup(gi, { ...groups[gi], items: groups[gi].items.map((x, i) => (i === ii ? it : x)) });
  const move = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };

  async function attach(blob: Blob) {
    if (!rec) return;
    const it = groups[rec.g].items[rec.i];
    const ref = await putMedia(blob);
    const old = rec.kind === "video" ? it.videoRef : it.voiceRef;
    if (old) void deleteMedia(old);
    setItem(rec.g, rec.i, rec.kind === "video" ? { ...it, videoRef: ref } : { ...it, voiceRef: ref });
    setRec(null);
    toast(rec.kind === "video" ? "Demo saved" : "Voice note saved");
  }

  const problems = publishProblems(p);

  return (
    <div className="screen" data-testid="editor">
      <header className="greet">
        <button type="button" className="icon-btn" aria-label="Back to Studio" onClick={back}>
          <Icon name="left" />
        </button>
        <div className="greet-txt">
          <span className="label">Edit program</span>
          <h1 className="brand">{p.title || "Untitled program"}</h1>
        </div>
        <span className={p.published ? "status ok" : "status"}>{p.published ? "Published" : "Draft"}</span>
      </header>

      <section className="glass">
        <span className="label">Details</span>
        <label className="field">
          <span>Title</span>
          <input data-testid="program-title" value={p.title} placeholder="Summer shred, 4 days" onChange={(e) => save({ ...p, title: e.target.value })} />
        </label>
        <label className="field">
          <span>What followers get</span>
          <textarea rows={3} value={p.summary} placeholder="Who it's for, how long sessions run, what equipment" onChange={(e) => save({ ...p, summary: e.target.value })} />
        </label>
        <div className="set-row">
          <strong>Level</strong>
          <div className="seg">
            {LEVELS.map((l) => (
              <button type="button" key={l} className={p.level === l ? "on" : ""} onClick={() => save({ ...p, level: l })}>
                {l[0].toUpperCase() + l.slice(1, 5)}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <strong>Price</strong>
          <div className="seg">
            {PRICES.map((x) => (
              <button type="button" key={x} className={p.price === x ? "on" : ""} onClick={() => save({ ...p, price: x })}>
                {x ? `$${x}` : "Free"}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Tags</span>
          <input
            value={p.tags.join(", ")}
            placeholder="hypertrophy, dumbbells, 45 min"
            onChange={(e) => save({ ...p, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6) })}
          />
        </label>
      </section>

      <section className="glass">
        <div className="row-between">
          <span className="label">Week</span>
          <span className="muted small">{plural(trainingDays(p).length, "training day")}</span>
        </div>
        <div className="daytabs" role="tablist">
          {DAYS.map((d) => (
            <button type="button" key={d} role="tab" aria-selected={d === day} className={[d === day ? "on" : "", p.days[d] ? "has" : ""].join(" ")} onClick={() => setDay(d)}>
              {d}
              <i />
            </button>
          ))}
        </div>

        {!w ? (
          <div className="stack">
            <p className="muted">{day} is a rest day.</p>
            <button type="button" className="btn accent wide" data-testid="add-workout" onClick={() => setDays(day, [], `${day} workout`)}>
              <Icon name="plus" size={18} /> Add a workout on {day}
            </button>
            {trainingDays(p).length > 0 && (
              <div className="row">
                <span className="muted small">or copy</span>
                {trainingDays(p).map((d) => (
                  <button type="button" key={d} className="chip" onClick={() => setDays(day, JSON.parse(JSON.stringify(p.days[d]!.groups)), p.days[d]!.title)}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <label className="field">
              <span>Workout name</span>
              <input data-testid="workout-name" value={w.title} onChange={(e) => setDays(day, groups, e.target.value)} />
            </label>
            {groups.map((g, gi) => {
              const kind = kindOf(g.label);
              return (
                <div className="block" key={gi} data-testid="block">
                  <div className="block-head">
                    <select
                      aria-label="Block type"
                      value={kind}
                      onChange={(e) => {
                        const k = e.target.value as Kind;
                        const ph = phaseOf(k);
                        setGroup(gi, {
                          label: k,
                          rest: DEFAULT_REST[k],
                          items: g.items.map((it) => ({ ...it, phase: ph, muscle: ph === "work" ? it.muscle : null, rir: ph === "work" ? it.rir : "—" })),
                        });
                      }}
                    >
                      {KINDS.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                    <label className="mini">
                      Rest
                      <input inputMode="numeric" value={g.rest} onChange={(e) => setGroup(gi, { ...g, rest: Math.min(600, Number(e.target.value.replace(/\D/g, "")) || 0) })} />s
                    </label>
                    <div className="row tight">
                      <button type="button" className="icon-btn sm" aria-label="Move block up" onClick={() => setDays(day, move(groups, gi, -1))}>
                        <Icon name="up" size={14} />
                      </button>
                      <button type="button" className="icon-btn sm" aria-label="Delete block" onClick={() => setDays(day, groups.filter((_, i) => i !== gi))}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                  {kind === "Superset" && g.items.length < 2 && <p className="muted small">Add a second move to make it a superset.</p>}
                  {g.items.map((it, ii) => (
                    <ItemEditor
                      key={ii}
                      item={it}
                      onChange={(x) => setItem(gi, ii, x)}
                      onUp={() => setGroup(gi, { ...g, items: move(g.items, ii, -1) })}
                      onDelete={() => {
                        if (it.videoRef) void deleteMedia(it.videoRef);
                        if (it.voiceRef) void deleteMedia(it.voiceRef);
                        setGroup(gi, { ...g, items: g.items.filter((_, i) => i !== ii) });
                      }}
                      onRecord={(kind) => setRec({ g: gi, i: ii, kind })}
                    />
                  ))}
                  <button type="button" className="btn ghost sm" data-testid="add-exercise" onClick={() => setPicker(gi)}>
                    <Icon name="plus" size={16} /> Add exercise
                  </button>
                </div>
              );
            })}
            <div className="row">
              {(["Warm-up", "Superset", "Straight", "Finisher", "Stretches"] as Kind[]).map((k) => (
                <button type="button" key={k} className="chip" data-testid={`add-block-${k}`} onClick={() => setDays(day, [...groups, { label: k, rest: DEFAULT_REST[k], items: [] }])}>
                  + {k}
                </button>
              ))}
            </div>
            <button type="button" className="link" onClick={() => setDays(day, null)}>
              Make {day} a rest day
            </button>
          </>
        )}
      </section>

      <section className="glass">
        <span className="label">Publish</span>
        {problems.length > 0 && (
          <ul className="problems">
            {problems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        <div className="set-row">
          <div>
            <strong>Listed in Discover</strong>
            <p className="muted small">{CLOUD.configured && cloudUser() ? "Lists it for everyone, with your videos and voice notes." : CLOUD.configured ? "Sign in on the You tab to list it for everyone." : "Visible on this device now; to everyone once the cloud is connected."}</p>
          </div>
          <Toggle
            label="Published"
            testid="publish"
            checked={p.published}
            onChange={(v) => {
              if (v && problems.length) {
                toast(problems[0]);
                return;
              }
              save({ ...p, published: v });
              toast(v ? "Published" : "Unpublished");
            }}
          />
        </div>
        <div className="stack">
          <KnobButton
            testid="try-program"
            tone="accent"
            icon="play"
            label="Follow it on Today"
            disabled={!trainingDays(p).length}
            onClick={() => {
              market.setActive(p.id);
              goToday();
            }}
          />
          {confirmDelete ? (
            <div className="row">
              <button type="button" className="btn danger" onClick={() => {
                back();
                void removeProgram(p.id).then((ok) => toast(ok ? "Program deleted" : "Deleted here; couldn't remove it from the cloud. Try again online."));
              }}>
                Delete for good
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="btn danger wide" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={18} /> Delete program
            </button>
          )}
        </div>
      </section>

      {picker !== null && (
        <VaultPicker
          onClose={() => setPicker(null)}
          onPick={(it) => {
            const g = groups[picker];
            const ph = phaseOf(kindOf(g.label));
            setGroup(picker, { ...g, items: [...g.items, { ...it, phase: ph, muscle: ph === "work" ? it.muscle : null, rir: ph === "work" ? it.rir : "—" }] });
            setPicker(null);
          }}
        />
      )}
      {rec && (
        <Recorder
          kind={rec.kind}
          title={rec.kind === "video" ? `Film: ${groups[rec.g].items[rec.i].name}` : `Voice note: ${groups[rec.g].items[rec.i].name}`}
          onClose={() => setRec(null)}
          onSave={(b) => void attach(b)}
        />
      )}
    </div>
  );
}

function ItemEditor({
  item,
  onChange,
  onUp,
  onDelete,
  onRecord,
}: {
  item: Item;
  onChange: (i: Item) => void;
  onUp: () => void;
  onDelete: () => void;
  onRecord: (k: "video" | "audio") => void;
}) {
  const [open, setOpen] = useState(false);
  const video = useMediaUrl(item.videoRef);
  const voice = useMediaUrl(item.voiceRef);
  return (
    <div className={open ? "item-ed open" : "item-ed"} data-testid="item">
      <button type="button" className="item-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {video ? <video className="thumb" src={video} muted playsInline /> : <Thumb name={item.name} size={44} />}
        <span className="plan-txt">
          <strong>{item.name}</strong>
          <span className="muted small">
            {item.sets} × {item.reps}
            {item.unilateral ? " · each side" : ""}
            {item.videoRef ? " · your video" : ""}
            {item.voiceRef || item.talk ? " · talks" : ""}
          </span>
        </span>
        <Icon name={open ? "up" : "down"} size={16} />
      </button>
      {open && (
        <div className="item-body">
          <div className="edit-grid three">
            <label className="field">
              <span>Sets</span>
              <input inputMode="numeric" value={item.sets} onChange={(e) => onChange({ ...item, sets: Math.max(1, Math.min(10, Number(e.target.value.replace(/\D/g, "")) || 1)) })} />
            </label>
            <label className="field">
              <span>Reps / time</span>
              <input value={item.reps} onChange={(e) => onChange({ ...item, reps: e.target.value.slice(0, 16) })} />
            </label>
            <label className="field">
              <span>RIR</span>
              <input value={item.rir} onChange={(e) => onChange({ ...item, rir: e.target.value.slice(0, 6) })} />
            </label>
          </div>
          <div className="set-row">
            <span>Each side (left, then right)</span>
            <Toggle label="Each side" checked={!!item.unilateral} onChange={(v) => onChange({ ...item, unilateral: v || undefined })} />
          </div>
          <div className="set-row">
            <span>Bodyweight (no weight field)</span>
            <Toggle label="Bodyweight" checked={!!item.noWeight} onChange={(v) => onChange({ ...item, noWeight: v || undefined })} />
          </div>
          <label className="field">
            <span>Form cues (one per line)</span>
            <textarea
              rows={3}
              value={item.cues.join("\n")}
              onChange={(e) => onChange({ ...item, cues: e.target.value.split("\n").slice(0, 3) })}
            />
          </label>
          <label className="field">
            <span>Mid-set talk (read aloud if you don't record)</span>
            <input value={item.talk ?? ""} placeholder="Slow on the way down. Two more, you've got it." onChange={(e) => onChange({ ...item, talk: e.target.value || undefined })} />
          </label>
          <div className="row">
            <button type="button" className="btn ghost sm" data-testid="film" onClick={() => onRecord("video")}>
              <Icon name="video" size={16} /> {item.videoRef ? "Re-film demo" : "Film yourself"}
            </button>
            {item.videoRef && (
              <button type="button" className="btn ghost sm" onClick={() => {
                void deleteMedia(item.videoRef!);
                onChange({ ...item, videoRef: undefined });
              }}>
                Use vault demo
              </button>
            )}
            <button type="button" className="btn ghost sm" data-testid="voice" onClick={() => onRecord("audio")}>
              <Icon name="mic" size={16} /> {item.voiceRef ? "Re-record note" : "Voice note"}
            </button>
            {voice && <audio src={voice} controls className="mini-audio" />}
          </div>
          <div className="row">
            <button type="button" className="btn ghost sm" onClick={onUp}>
              <Icon name="up" size={14} /> Move up
            </button>
            <button type="button" className="btn danger sm" onClick={onDelete}>
              <Icon name="trash" size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VaultPicker({ onPick, onClose }: { onPick: (i: Item) => void; onClose: () => void }) {
  const { items, failed } = useVault();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter((e) => !s || `${e.name} ${e.equipment} ${e.primaryMuscles.join(" ")}`.toLowerCase().includes(s));
  }, [items, q]);
  return (
    <Sheet title="Add from the vault" onClose={onClose}>
      <label className="search">
        <Icon name="search" size={18} />
        <input data-testid="vault-search" type="search" placeholder="Search 61 exercises" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      {failed && <p className="callout warn">The vault couldn't load. Check the connection.</p>}
      {q.trim().length > 1 && (
        <button type="button" className="glass resume-card" data-testid="custom-exercise" onClick={() => onPick(customItem(q, null))}>
          <Icon name="plus" size={18} />
          <span>
            Add “{q.trim()}” as your own exercise
            <small className="muted"> · film it yourself</small>
          </span>
        </button>
      )}
      <div className="pick-list">
        {shown.map((e) => (
          <button type="button" key={e.slug} className="pick" data-testid="vault-item" onClick={() => onPick(itemFromVault(e))}>
            <Thumb name={e.name} size={44} />
            <span className="plan-txt">
              <strong>{e.name}</strong>
              <span className="muted small">
                {e.equipment} · {e.primaryMuscles.join(", ")}
              </span>
            </span>
            <Icon name="plus" size={18} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
