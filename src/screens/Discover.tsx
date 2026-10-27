import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { KnobButton, Sheet, Thumb } from "../components/ui";
import { CLOUD } from "../lib/cloud";
import { pullCloudPrograms } from "../lib/cloudSync";
import { market, plural, priceLabel, programExercises, trainingDays, useMarket, type Program } from "../lib/market";
import { mediaFor } from "../lib/media";
import { DAYS } from "../lib/program";
import { buildQueue, estimateMinutes } from "../lib/queue";

const FILTERS = [
  ["all", "All"],
  ["free", "Free"],
  ["paid", "Paid"],
  ["following", "Following"],
] as const;

function Cover({ p, size = "md" }: { p: Program; size?: "md" | "lg" }) {
  const names = programExercises(p);
  const still = names.map((n) => mediaFor(n)).find((m) => m && !m.illustration)?.still;
  return (
    <div className={`cover ${size}`}>
      {still ? <img src={still} alt="" loading="lazy" /> : <span className="cover-mono">{(p.title || "?").slice(0, 1)}</span>}
      <span className="chip dark price">{priceLabel(p.price)}</span>
    </div>
  );
}

export function Discover({ toast, openStudio, goToday }: { toast: (t: string) => void; openStudio: (id: string | null) => void; goToday: () => void }) {
  const m = useMarket();
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof FILTERS)[number][0]>("all");
  const [open, setOpen] = useState<Program | null>(null);
  useEffect(() => {
    if (CLOUD.configured) void pullCloudPrograms().catch(() => {});
  }, []);

  const listed = useMemo(() => market.all().filter((p) => p.published || market.isMine(p)), [m]);
  const shown = listed.filter((p) => {
    const s = q.trim().toLowerCase();
    if (s && !`${p.title} ${p.summary} ${p.creator.name} ${p.tags.join(" ")}`.toLowerCase().includes(s)) return false;
    if (f === "free") return p.price === 0;
    if (f === "paid") return p.price > 0;
    if (f === "following") return p.id === m.activeId || market.subscribed(p.id);
    return true;
  });
  const active = market.active();

  return (
    <div className="screen" data-testid="discover">
      <header className="page-head">
        <h1>Discover</h1>
        <p className="muted">Programs from creators. Follow one and Today runs it.</p>
      </header>

      <button type="button" className="glass following" onClick={() => setOpen(active)}>
        <Cover p={active} />
        <div>
          <span className="label">Following</span>
          <strong>{active.title}</strong>
          <span className="muted small">
            by {active.creator.name || "you"} · {plural(trainingDays(active).length, "day")} a week
          </span>
        </div>
        <span className="arrow">
          <Icon name="arrowUp" size={16} />
        </span>
      </button>

      <label className="search">
        <Icon name="search" size={18} />
        <input data-testid="discover-search" type="search" placeholder="Search programs, creators, tags" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="chips scroll">
        {FILTERS.map(([k, l]) => (
          <button type="button" key={k} className={f === k ? "chip on" : "chip"} onClick={() => setF(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="program-grid">
        {shown.map((p) => (
          <button type="button" key={p.id} className="program-card" data-testid="program-card" onClick={() => setOpen(p)}>
            <Cover p={p} />
            <div className="program-txt">
              <strong>{p.title || "Untitled program"}</strong>
              <span className="muted small">
                {p.creator.name || "You"} · {plural(trainingDays(p).length, "day")}
              </span>
              <div className="row tight">
                {p.id === m.activeId && <span className="status live">Following</span>}
                {!p.published && <span className="status">Draft</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="muted empty">No programs match.</p>}

      <button type="button" className="glass resume-card" data-testid="open-studio" onClick={() => openStudio(null)}>
        <Icon name="video" size={18} />
        <span>
          <strong>Create a program</strong>
          <small className="muted"> · build from the vault or film your own moves</small>
        </span>
        <span className="arrow">
          <Icon name="arrowUp" size={16} />
        </span>
      </button>
      {!CLOUD.configured && (
        <p className="muted small center">Programs live on this device until the Followset cloud is connected. Then creators publish to everyone.</p>
      )}

      {open && (
        <ProgramSheet
          p={open}
          onClose={() => setOpen(null)}
          toast={toast}
          openStudio={openStudio}
          goToday={() => {
            setOpen(null);
            goToday();
          }}
        />
      )}
    </div>
  );
}

function ProgramSheet({
  p,
  onClose,
  toast,
  openStudio,
  goToday,
}: {
  p: Program;
  onClose: () => void;
  toast: (t: string) => void;
  openStudio: (id: string | null) => void;
  goToday: () => void;
}) {
  const m = useMarket();
  const following = m.activeId === p.id;
  const subscribed = p.price === 0 || market.subscribed(p.id) || market.isMine(p);
  const [paying, setPaying] = useState(false);
  const days = trainingDays(p);
  const avgMin = days.length ? Math.round(days.reduce((n, d) => n + estimateMinutes(buildQueue(p.days[d]!)), 0) / days.length) : 0;

  const follow = () => {
    market.setActive(p.id);
    toast(`Following ${p.title}`);
    goToday();
  };

  return (
    <Sheet title={p.title || "Untitled program"} onClose={onClose}>
      <Cover p={p} size="lg" />
      <div className="creator-row">
        <span className="brandmark sm">{(p.creator.name || "?").slice(0, 1)}</span>
        <div>
          <strong>{p.creator.name || "You"}</strong>
          <span className="muted small">{p.creator.handle ? `@${p.creator.handle}` : "Creator"}</span>
        </div>
      </div>
      {p.summary && <p>{p.summary}</p>}
      <div className="pills">
        <span className="pill">{priceLabel(p.price)}</span>
        <span className="pill">{plural(days.length, "day")} / week</span>
        {avgMin > 0 && <span className="pill">~{avgMin} min</span>}
        <span className="pill">{p.level}</span>
        {p.tags.map((t) => (
          <span className="pill" key={t}>
            {t}
          </span>
        ))}
      </div>

      <div className="week-list">
        {DAYS.map((d) => {
          const w = p.days[d];
          return (
            <div className={w && w.groups.length ? "wk" : "wk rest"} key={d}>
              <span className="label">{d}</span>
              <span>{w && w.groups.length ? w.title || "Workout" : "Rest"}</span>
              {w && w.groups.length > 0 && <span className="muted small">{buildQueue(w).length} steps</span>}
            </div>
          );
        })}
      </div>

      <div className="thumb-row">
        {programExercises(p)
          .slice(0, 8)
          .map((n) => (
            <Thumb key={n} name={n} size={52} />
          ))}
      </div>

      <div className="stack">
        {following ? (
          <span className="status live center">You're following this</span>
        ) : subscribed ? (
          <KnobButton testid="follow" tone="dark" icon="play" label="Follow this program" onClick={follow} disabled={!days.length} />
        ) : paying ? (
          <div className="checkout" data-testid="checkout">
            <p>
              <strong>{priceLabel(p.price)}</strong> to {p.creator.name || "the creator"}, cancel anytime.
            </p>
            <p className="muted small">Test mode: no card is charged until Stripe is connected.</p>
            <KnobButton
              testid="confirm-subscribe"
              tone="accent"
              icon="lock"
              label="Subscribe (test)"
              onClick={() => {
                market.subscribeTo(p);
                toast("Subscribed (test mode)");
                setPaying(false);
              }}
            />
          </div>
        ) : (
          <KnobButton testid="subscribe" tone="dark" icon="star" label={`Subscribe · ${priceLabel(p.price)}`} onClick={() => setPaying(true)} />
        )}
        {market.isMine(p) ? (
          <button type="button" className="btn ghost wide" onClick={() => openStudio(p.id)}>
            <Icon name="edit" size={18} /> Edit in Studio
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost wide"
            data-testid="remix"
            onClick={() => {
              const d = market.draft();
              market.save({ ...d, title: `${p.title} (remix)`, summary: p.summary, level: p.level, tags: [...p.tags], days: JSON.parse(JSON.stringify(p.days)) });
              openStudio(d.id);
            }}
          >
            <Icon name="copy" size={18} /> Remix in Studio
          </button>
        )}
        {market.subscribed(p.id) && (
          <button
            type="button"
            className="link"
            onClick={() => {
              market.unsubscribe(p.id);
              toast("Subscription cancelled");
            }}
          >
            Cancel subscription
          </button>
        )}
      </div>
    </Sheet>
  );
}
