import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "./components/Icon";
import { Aura, Pills } from "./components/ui";
import { useCloudSync } from "./lib/cloudSync";
import { dayOf, iso } from "./lib/dates";
import { keepAwake, say, setWakeVideo, unlockAudio } from "./lib/device";
import { openDrive, wasSignedIn } from "./lib/drive";
import { market, useMarket, workoutFor } from "./lib/market";
import { buildQueue } from "./lib/queue";
import { mergeStates, newSession, parseState, sessionId, type Session } from "./lib/store";
import { applyTheme, watchSystemTheme } from "./lib/theme";
import { useStore } from "./lib/useStore";
import { Coach } from "./screens/Coach";
import { Discover } from "./screens/Discover";
import { History } from "./screens/History";
import { Library } from "./screens/Library";
import { Me } from "./screens/Me";
import { Progress } from "./screens/Progress";
import { Runner } from "./screens/Runner";
import { Studio } from "./screens/Studio";
import { Today } from "./screens/Today";

type Tab = "today" | "discover" | "coach" | "progress" | "me" | "studio";
const TABS: [Tab, string, string][] = [
  ["today", "Today", "home"],
  ["discover", "Discover", "compass"],
  ["coach", "Coach", "spark"],
  ["progress", "Progress", "chart"],
  ["me", "You", "user"],
];
/** Studio lives under Discover in the tab bar. */
const NAV_OF: Partial<Record<Tab, Tab>> = { studio: "discover" };

/** The live run, if any. Several can exist in old data; the most recently touched wins. */
function liveSession(sessions: Session[]): Session | null {
  const live = sessions.filter((s) => s.startedAt && !s.finished);
  return live.sort((a, b) => (b.updatedAt ?? b.startedAt ?? 0) - (a.updatedAt ?? a.startedAt ?? 0))[0] ?? null;
}

export function App() {
  const store = useStore();
  useMarket();
  const { state, ref, putSession, commit } = store;
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(iso);
  const [runnerOpen, setRunnerOpen] = useState(() => !!liveSession(ref.current.sessions));
  const [summaryFor, setSummaryFor] = useState<string | null>(null);
  const [progressView, setProgressView] = useState<"progress" | "history">("progress");
  const [discoverView, setDiscoverView] = useState<"programs" | "vault">("programs");
  const [studioEdit, setStudioEdit] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wake = useRef<HTMLVideoElement>(null);
  const active = liveSession(state.sessions);

  const toast = useCallback((t: string) => {
    setToastMsg(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);
  useCloudSync(store, toast);

  const sync = useCallback(
    async (interactive: boolean) => {
      if (!interactive && !wasSignedIn()) return;
      try {
        if (interactive) setSyncMsg("Connecting to Google…");
        const drive = await openDrive(interactive);
        const remote = parseState(drive.remote);
        if (remote) {
          const { state: merged, changed } = mergeStates(ref.current, remote);
          if (changed) commit(merged);
        }
        await drive.push(ref.current);
        setSyncMsg(interactive ? "Synced to Drive." : "");
      } catch (e) {
        if (interactive) setSyncMsg((e as Error).message || "Sync failed");
      }
    },
    [ref, commit],
  );

  useEffect(() => {
    setWakeVideo(wake.current);
    window.__fittyBootDone?.();
    const t = setTimeout(() => void sync(false), 1500);
    return () => clearTimeout(t);
  }, [sync]);

  useEffect(() => applyTheme(state.settings.theme), [state.settings.theme]);
  useEffect(() => watchSystemTheme(() => ref.current.settings.theme), [ref]);

  // Follow the calendar: if the app stays open past midnight, Today moves with it.
  useEffect(() => {
    let last = iso();
    const check = () => {
      const now = iso();
      if (now !== last) {
        setDate((d) => (d === last ? now : d));
        last = now;
      }
    };
    const id = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  function start(d: string) {
    const cur = liveSession(ref.current.sessions);
    if (cur && cur.date !== d) {
      setDate(cur.date);
      setRunnerOpen(true);
      return;
    }
    const day = dayOf(d);
    if (d > iso()) return;
    unlockAudio();
    void keepAwake(true);
    const existing = ref.current.sessions.find((s) => s.id === sessionId(d, day)) ?? newSession(d, day, ref.current.settings.focus);
    let s: Session = existing;
    if (!existing.startedAt || existing.finished) {
      s = {
        ...existing,
        startedAt: Date.now(),
        endedAt: undefined,
        pausedMs: 0,
        pauseStarted: null,
        idx: 0,
        finished: false,
        focus: [...ref.current.settings.focus],
        timer: null,
        programId: existing.startedAt || existing.logs.length ? existing.programId : market.get().activeId,
        runBase: existing.logs.map((l) => ({ ...l, drops: l.drops.map((x) => ({ ...x })) })),
      };
      putSession(s);
      const w = workoutFor(s.programId, day);
      const first = buildQueue(w, s.focus)[0];
      if (!first) return;
      say(`${w.title}. ${first.item.name}. ${first.item.cues.join(" ")}`, ref.current.settings.voice);
    }
    setDate(d);
    setRunnerOpen(true);
    window.scrollTo(0, 0);
  }

  /** Switch tabs; "history" is the History view inside Progress. */
  function go(t: Tab | "history") {
    if (t === "history") {
      setProgressView("history");
      t = "progress";
    } else if (t === "progress") setProgressView("progress");
    setTab(t);
    window.scrollTo(0, 0);
  }

  const showRunner = runnerOpen && active;

  return (
    <div className="app">
      <video ref={wake} className="wake" src="./wake.mp4" muted playsInline loop preload="auto" />
      {showRunner ? (
        <Runner
          key={active.id}
          store={store}
          session={active}
          toast={toast}
          onMinimize={() => setRunnerOpen(false)}
          onFinished={(s) => {
            setRunnerOpen(false);
            setTab("today");
            setDate(s.date);
            setSummaryFor(s.id);
            void sync(false);
          }}
        />
      ) : (
        <>
          <Aura />
          <main>
            {tab === "today" && (
              <Today
                store={store}
                date={date}
                setDate={setDate}
                onStart={start}
                active={active}
                summaryFor={summaryFor}
                setSummaryFor={setSummaryFor}
                openSettings={() => setTab("me")}
                openTab={(t) => go(t)}
                toast={toast}
              />
            )}
            {tab === "discover" && (
              <>
                <div className="screen-tabs">
                  <Pills
                    value={discoverView}
                    options={[
                      ["programs", "Programs"],
                      ["vault", "Exercise vault"],
                    ]}
                    onChange={setDiscoverView}
                  />
                </div>
                {discoverView === "programs" ? (
                  <Discover
                    toast={toast}
                    openStudio={(id) => {
                      setStudioEdit(id);
                      go("studio");
                    }}
                    goToday={() => go("today")}
                  />
                ) : (
                  <Library store={store} />
                )}
              </>
            )}
            {tab === "studio" && <Studio editId={studioEdit} setEditId={setStudioEdit} toast={toast} goToday={() => go("today")} />}
            {tab === "coach" && <Coach store={store} toast={toast} />}
            {tab === "progress" && (
              <>
                <div className="screen-tabs">
                  <Pills
                    value={progressView}
                    options={[
                      ["progress", "Progress"],
                      ["history", "History"],
                    ]}
                    onChange={setProgressView}
                  />
                </div>
                {progressView === "progress" ? (
                  <Progress store={store} />
                ) : (
                  <History
                    store={store}
                    toast={toast}
                    openDay={(d) => {
                      setDate(d);
                      go("today");
                    }}
                  />
                )}
              </>
            )}
            {tab === "me" && (
              <Me
                store={store}
                sync={sync}
                syncMsg={syncMsg}
                toast={toast}
                openStudio={() => {
                  setStudioEdit(null);
                  go("studio");
                }}
              />
            )}
          </main>
          {active && (
            <button type="button" className="live-bar" data-testid="resume-bar" onClick={() => start(active.date)}>
              <span className="live-dot" />
              <span>
                <strong>{workoutFor(active.programId, active.day).title}</strong>
                <small>{active.pauseStarted ? "Paused" : "In progress"} · tap to return</small>
              </span>
              <Icon name="arrow" />
            </button>
          )}
          <nav className="nav" aria-label="Sections" style={{ "--i": TABS.findIndex(([k]) => k === (NAV_OF[tab] ?? tab)) } as CSSProperties}>
            <i className="nav-pill" aria-hidden="true" />
            {TABS.map(([k, label, icon]) => (
              <button key={k} type="button" data-testid={`tab-${k}`} className={(NAV_OF[tab] ?? tab) === k ? "on" : ""} aria-current={(NAV_OF[tab] ?? tab) === k ? "page" : undefined} onClick={() => go(k)}>
                <Icon name={icon} size={22} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
      <div className={toastMsg ? "toast show" : "toast"} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}
