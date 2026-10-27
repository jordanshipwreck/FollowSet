import { useRef, useState } from "react";
import { CoachChat } from "../components/CoachChat";
import { Icon } from "../components/Icon";
import { KnobButton, Sheet } from "../components/ui";
import { CLOUD } from "../lib/cloud";
import { cloudUser, createConnectorLink } from "../lib/cloudAuth";
import { iso, monthDay } from "../lib/dates";
import { dayTotals, health, labFlag, latest, METRICS, parseHealthExport, useHealth, type MetricKey } from "../lib/health";
import { market, plural, useMarket } from "../lib/market";
import { copyText } from "./Summary";
import type { Store } from "../lib/useStore";
import { useVault } from "../lib/vault";

const PROMPTS = ["What's today's workout?", "How am I doing this week?", "How much protein is left?", "How's my recovery?", "Any labs out of range?"];
const LAB_PRESETS: [string, string][] = [
  ["HDL", "mg/dL"],
  ["LDL", "mg/dL"],
  ["ApoB", "mg/dL"],
  ["Triglycerides", "mg/dL"],
  ["Total cholesterol", "mg/dL"],
  ["Vitamin D", "ng/mL"],
  ["Total testosterone", "ng/dL"],
  ["Free testosterone", "pg/mL"],
  ["hs-CRP", "mg/L"],
  ["HbA1c", "%"],
  ["Fasting glucose", "mg/dL"],
];

export function Coach({ store, toast }: { store: Store; toast: (t: string) => void }) {
  useMarket();
  const h = useHealth();
  const { items: vault } = useVault();
  const [sheet, setSheet] = useState<null | "food" | "labs" | "goals" | "connect">(null);
  const file = useRef<HTMLInputElement>(null);
  const today = iso();
  const t = dayTotals(h, today);
  const g = h.goals;
  const metricKeys: MetricKey[] = ["weight", "bodyFat", "restingHr", "hrv", "sleep", "steps"];
  const flagged = h.labs.filter((l) => labFlag(l));

  async function importFile(f: File) {
    try {
      const { metrics, count } = parseHealthExport(JSON.parse(await f.text()));
      if (!count) {
        toast("No health metrics found in that file.");
        return;
      }
      health.importMetrics(metrics);
      toast(`Imported ${count} readings`);
    } catch {
      toast("That isn't a Health Auto Export JSON file.");
    }
  }

  return (
    <div className="screen coach" data-testid="coach">
      <header className="page-head">
        <h1>Coach</h1>
        <p className="muted">Knows your workouts, food, recovery, and labs. Ask anything, even mid-set.</p>
      </header>

      <div className="coach-grid">
        <section className="glass">
          <CoachChat
            prompts={PROMPTS}
            speak={store.state.settings.voice}
            ctx={() => ({ app: store.ref.current, program: market.active(), health: health.get(), vault: vault ?? [], today })}
          />
          <p className="muted small">
            {CLOUD.configured && cloudUser() ? "Answers come from Claude with your data as context." : "Built-in coach: answers from your data on this device. Connect the cloud for the full Claude coach."} General fitness guidance, not medical advice.
          </p>
        </section>

        <div className="coach-side">
          <section className="glass">
            <div className="row-between">
              <span className="label">Food today</span>
              <button type="button" className="arrow" aria-label="Log food" data-testid="open-food" onClick={() => setSheet("food")}>
                <Icon name="plus" size={16} />
              </button>
            </div>
            {(["cal", "protein", "carbs", "fat"] as const).map((k) => (
              <div className="macro" key={k}>
                <div className="row-between">
                  <span>{k === "cal" ? "Calories" : k[0].toUpperCase() + k.slice(1)}</span>
                  <span className="muted small">
                    {t[k]} / {g[k]}
                    {k === "cal" ? "" : " g"}
                  </span>
                </div>
                <div className="meter">
                  <i style={{ width: `${Math.min(100, (t[k] / Math.max(1, g[k])) * 100)}%` }} className={t[k] > g[k] * 1.05 ? "over" : ""} />
                </div>
              </div>
            ))}
            <button type="button" className="link" onClick={() => setSheet("goals")}>
              Edit goals
            </button>
          </section>

          <section className="glass">
            <div className="row-between">
              <span className="label">Health</span>
              <span className="muted small">{h.importedAt ? `Imported ${new Date(h.importedAt).toLocaleDateString()}` : "No data yet"}</span>
            </div>
            <div className="metric-grid">
              {metricKeys.map((k) => {
                const p = latest(h, k);
                return (
                  <div className="metric" key={k}>
                    <span className="label">{METRICS[k].label}</span>
                    <strong>
                      {p ? (k === "steps" ? Math.round(p.value).toLocaleString() : p.value) : "—"}
                      {p && METRICS[k].unit && <sup>{METRICS[k].unit}</sup>}
                    </strong>
                    <span className="muted small">{p ? monthDay(p.date) : ""}</span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn ghost wide" data-testid="import-health" onClick={() => file.current?.click()}>
              <Icon name="upload" size={18} /> Import Health Auto Export JSON
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importFile(f);
              }}
            />
            <p className="muted small">Apple Health, Hume band and scale, and Apple Watch data arrive through Health Auto Export. A direct Apple Health connection comes with the native iPhone app.</p>
          </section>

          <section className="glass">
            <div className="row-between">
              <span className="label">Labs</span>
              <button type="button" className="arrow" aria-label="Add lab results" data-testid="open-labs" onClick={() => setSheet("labs")}>
                <Icon name="plus" size={16} />
              </button>
            </div>
            {h.labs.length === 0 ? (
              <p className="muted small">Add results from Rythm or any lab report. Nothing leaves this device.</p>
            ) : (
              <p className="small">
                {plural(h.labs.length, "marker")} saved{flagged.length ? ` · ${flagged.length} out of range: ${flagged.map((l) => l.name).join(", ")}` : " · all in range"}
              </p>
            )}
          </section>

          <section className="glass">
            <div className="row-between">
              <span className="label">Use your own AI</span>
              <button type="button" className="arrow" aria-label="Connect an AI" data-testid="open-connect" onClick={() => setSheet("connect")}>
                <Icon name="arrowUp" size={16} />
              </button>
            </div>
            <p className="muted small">Let Claude, ChatGPT, or Grok read your Followset data and plan your training.</p>
          </section>
        </div>
      </div>

      {sheet === "food" && <FoodSheet onClose={() => setSheet(null)} toast={toast} />}
      {sheet === "goals" && <GoalsSheet onClose={() => setSheet(null)} />}
      {sheet === "labs" && <LabsSheet onClose={() => setSheet(null)} />}
      {sheet === "connect" && <ConnectSheet onClose={() => setSheet(null)} toast={toast} />}
    </div>
  );
}

function FoodSheet({ onClose, toast }: { onClose: () => void; toast: (t: string) => void }) {
  const h = useHealth();
  const today = iso();
  const [f, setF] = useState({ name: "", cal: "", protein: "", carbs: "", fat: "" });
  const entries = h.food.filter((x) => x.date === today);
  const recent = [...new Map([...h.food].reverse().map((x) => [x.name.toLowerCase(), x])).values()].slice(0, 6);
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const add = () => {
    if (!f.name.trim()) return;
    health.addFood({ date: today, name: f.name.trim(), cal: num(f.cal), protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat) });
    setF({ name: "", cal: "", protein: "", carbs: "", fat: "" });
    toast("Logged");
  };
  return (
    <Sheet title="Food today" onClose={onClose}>
      {recent.length > 0 && (
        <div className="chips scroll">
          {recent.map((r) => (
            <button type="button" className="chip" key={r.id} onClick={() => health.addFood({ date: today, name: r.name, cal: r.cal, protein: r.protein, carbs: r.carbs, fat: r.fat })}>
              + {r.name}
            </button>
          ))}
        </div>
      )}
      <div className="edit-grid">
        <label className="field full">
          <span>Food</span>
          <input data-testid="food-name" value={f.name} placeholder="Chipotle chicken bowl" onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        {(["cal", "protein", "carbs", "fat"] as const).map((k) => (
          <label className="field" key={k}>
            <span>{k === "cal" ? "Calories" : `${k} (g)`}</span>
            <input data-testid={`food-${k}`} inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^0-9.]/g, "") })} />
          </label>
        ))}
      </div>
      <button type="button" className="btn accent wide" data-testid="food-add" onClick={add} disabled={!f.name.trim()}>
        <Icon name="plus" size={18} /> Log it
      </button>
      <p className="muted small">Numbers are estimates. Photo logging comes with the cloud coach.</p>
      <div className="stack">
        {entries.map((x) => (
          <div className="row-between food-row" key={x.id}>
            <span>
              <strong>{x.name}</strong>
              <span className="muted small">
                {" "}
                {x.cal} kcal · {x.protein} g protein
              </span>
            </span>
            <button type="button" className="icon-btn sm" aria-label={`Remove ${x.name}`} onClick={() => health.removeFood(x.id)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function GoalsSheet({ onClose }: { onClose: () => void }) {
  const h = useHealth();
  const [g, setG] = useState(h.goals);
  return (
    <Sheet title="Daily goals" onClose={onClose}>
      <div className="edit-grid">
        {(["cal", "protein", "carbs", "fat"] as const).map((k) => (
          <label className="field" key={k}>
            <span>{k === "cal" ? "Calories" : `${k} (g)`}</span>
            <input inputMode="numeric" value={g[k]} onChange={(e) => setG({ ...g, [k]: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn accent wide"
        onClick={() => {
          health.setGoals(g);
          onClose();
        }}
      >
        Save goals
      </button>
    </Sheet>
  );
}

function LabsSheet({ onClose }: { onClose: () => void }) {
  const h = useHealth();
  const [l, setL] = useState({ date: iso(), name: "", value: "", unit: "", low: "", high: "" });
  const n = (v: string) => (v.trim() === "" ? undefined : Number(v));
  return (
    <Sheet title="Lab results" onClose={onClose}>
      <div className="chips scroll">
        {LAB_PRESETS.map(([name, unit]) => (
          <button type="button" key={name} className={l.name === name ? "chip on" : "chip"} onClick={() => setL({ ...l, name, unit })}>
            {name}
          </button>
        ))}
      </div>
      <div className="edit-grid">
        <label className="field">
          <span>Marker</span>
          <input data-testid="lab-name" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={l.date} onChange={(e) => setL({ ...l, date: e.target.value })} />
        </label>
        <label className="field">
          <span>Value</span>
          <input data-testid="lab-value" inputMode="decimal" value={l.value} onChange={(e) => setL({ ...l, value: e.target.value })} />
        </label>
        <label className="field">
          <span>Unit</span>
          <input value={l.unit} onChange={(e) => setL({ ...l, unit: e.target.value })} />
        </label>
        <label className="field">
          <span>Range low</span>
          <input data-testid="lab-low" inputMode="decimal" value={l.low} onChange={(e) => setL({ ...l, low: e.target.value })} />
        </label>
        <label className="field">
          <span>Range high</span>
          <input inputMode="decimal" value={l.high} onChange={(e) => setL({ ...l, high: e.target.value })} />
        </label>
      </div>
      <button
        type="button"
        className="btn accent wide"
        data-testid="lab-add"
        disabled={!l.name.trim() || !Number.isFinite(Number(l.value)) || l.value.trim() === ""}
        onClick={() => {
          health.addLab({ date: l.date, name: l.name.trim(), value: Number(l.value), unit: l.unit.trim(), low: n(l.low), high: n(l.high) });
          setL({ ...l, name: "", value: "", unit: "", low: "", high: "" });
        }}
      >
        <Icon name="plus" size={18} /> Save result
      </button>
      <p className="muted small">Use the reference range printed on your report. Rythm has no public API, so results are typed in (PDF import comes with the cloud coach).</p>
      <div className="stack">
        {h.labs.map((x) => (
          <div className="row-between food-row" key={x.id}>
            <span>
              <strong>{x.name}</strong>{" "}
              <span className={labFlag(x) ? "flag-txt" : "muted"}>
                {x.value} {x.unit}
                {labFlag(x) ? ` · ${labFlag(x)}` : ""}
              </span>
              <span className="muted small"> · {x.date}</span>
            </span>
            <button type="button" className="icon-btn sm" aria-label={`Remove ${x.name}`} onClick={() => health.removeLab(x.id)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function ConnectSheet({ onClose, toast }: { onClose: () => void; toast: (t: string) => void }) {
  const signedIn = CLOUD.configured && !!cloudUser();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      setUrl(await createConnectorLink());
    } catch (e) {
      toast((e as Error).message || "Couldn't create a link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Use your own AI" onClose={onClose}>
      <p>
        Followset speaks <strong>MCP</strong>, the open standard Claude, ChatGPT, and Grok use to connect to apps. Add Followset as a connector and your assistant can read your workouts, progress, food, health, and labs, and build you a program. Programs it builds land in
        Studio as drafts; nothing changes until you follow one.
      </p>
      {!CLOUD.configured ? (
        <p className="callout">This needs the Followset cloud, which isn't connected yet. Your data stays on this device until then.</p>
      ) : !signedIn ? (
        <p className="callout">Sign in to the Followset cloud on the You tab first. Your data syncs there so your assistant can read it.</p>
      ) : url ? (
        <>
          <label className="field">
            <span>Your connector link</span>
            <input readOnly value={url} data-testid="connector-url" onFocus={(e) => e.currentTarget.select()} />
          </label>
          <button type="button" className="btn accent wide" onClick={async () => toast((await copyText(url)) ? "Copied" : "Copy blocked")}>
            <Icon name="copy" size={18} /> Copy link
          </button>
          <ol className="steps">
            <li>Claude: Settings → Connectors → Add custom connector → paste the link.</li>
            <li>ChatGPT: Settings → Connectors → Create → paste the link.</li>
            <li>Grok or any other MCP app: add a remote MCP server with this link.</li>
          </ol>
          <p className="muted small">The link is a password: anyone who has it can read your data. It's shown once. Making a new link turns this one off.</p>
        </>
      ) : (
        <KnobButton testid="create-connector" tone="dark" icon="spark" label={busy ? "Creating…" : "Create connector link"} onClick={() => void create()} disabled={busy} />
      )}
    </Sheet>
  );
}
