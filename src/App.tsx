import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./components/Icon";
import { Aura } from "./components/ui";
import { dayOf, iso } from "./lib/dates";
import { keepAwake, say, setWakeVideo, unlockAudio } from "./lib/device";
import { openDrive, wasSignedIn } from "./lib/drive";
import { PROGRAM } from "./lib/program";
import { buildQueue } from "./lib/queue";
import { mergeStates, newSession, parseState, sessionId, type Session } from "./lib/store";
import { useStore } from "./lib/useStore";
import { History } from "./screens/History";
import { Library } from "./screens/Library";
import { Me } from "./screens/Me";
import { Progress } from "./screens/Progress";
import { Runner } from "./screens/Runner";
import { Today } from "./screens/Today";

type Tab = "today" | "history" | "progress" | "library" | "me";
const TABS: [Tab, string, string][] = [
  ["today", "Today", "home"],
  ["history", "History", "history"],
  ["progress", "Progress", "chart"],
  ["library", "Library", "library"],
  ["me", "You", "user"],
];

/** The live run, if any. Several can exist in old data; the most recently touched wins. */
function liveSession(sessions: Session[]): Session | null {
  const live = sessions.filter((s) => s.startedAt && !s.finished);
  return live.sort((a, b) => (b.updatedAt ?? b.startedAt ?? 0) - (a.updatedAt ?? a.startedAt ?? 0))[0] ?? null;
}

export function App() {
  const store = useStore();
  const { state, ref, putSession, commit } = store;
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(iso);
  const [runnerOpen, setRunnerOpen] = useState(() => !!liveSession(ref.current.sessions));
  const [summaryFor, setSummaryFor] = useState<string | null>(null);
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
        runBase: existing.logs.map((l) => ({ ...l, drops: l.drops.map((x) => ({ ...x })) })),
      };
      putSession(s);
      const first = buildQueue(PROGRAM[day], s.focus)[0];
      if (first) say(`${PROGRAM[day].title}. ${first.item.name}. ${first.item.cues.join(" ")}`, ref.current.settings.voice);
    }
    setDate(d);
    setRunnerOpen(true);
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
                openTab={(t) => {
                  setTab(t);
                  window.scrollTo(0, 0);
                }}
                toast={toast}
              />
            )}
            {tab === "history" && (
              <History
                store={store}
                toast={toast}
                openDay={(d) => {
                  setDate(d);
                  setTab("today");
                }}
              />
            )}
            {tab === "progress" && <Progress store={store} />}
            {tab === "library" && <Library store={store} />}
            {tab === "me" && <Me store={store} sync={sync} syncMsg={syncMsg} toast={toast} />}
          </main>
          {active && (
            <button type="button" className="live-bar" data-testid="resume-bar" onClick={() => start(active.date)}>
              <span className="live-dot" />
              <span>
                <strong>{PROGRAM[active.day].title}</strong>
                <small>{active.pauseStarted ? "Paused" : "In progress"} · tap to return</small>
              </span>
              <Icon name="arrow" />
            </button>
          )}
          <nav className="nav" aria-label="Sections">
            {TABS.map(([k, label, icon]) => (
              <button key={k} type="button" data-testid={`tab-${k}`} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} onClick={() => {
                setTab(k);
                window.scrollTo(0, 0);
              }}>
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
