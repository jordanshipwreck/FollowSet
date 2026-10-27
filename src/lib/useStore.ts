import { useCallback, useEffect, useRef, useState } from "react";
import { load, save, type AppState, type Session, type Settings } from "./store";

/**
 * App state with a ref that is always current, so timer callbacks and async handlers
 * never write a stale copy over a newer one.
 */
export function useStore() {
  const [state, setState] = useState<AppState>(load);
  const ref = useRef(state);
  const [saveFailed, setSaveFailed] = useState(false);

  const commit = useCallback((next: AppState) => {
    ref.current = next;
    setState(next);
  }, []);

  const putSession = useCallback(
    (s: Session) => {
      const cur = ref.current;
      const next = { ...s, updatedAt: Date.now() };
      const sessions = cur.sessions.some((x) => x.id === s.id)
        ? cur.sessions.map((x) => (x.id === s.id ? next : x))
        : [...cur.sessions, next];
      commit({ ...cur, sessions });
    },
    [commit],
  );

  const removeSession = useCallback(
    (id: string) => commit({ ...ref.current, sessions: ref.current.sessions.filter((s) => s.id !== id) }),
    [commit],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => commit({ ...ref.current, settings: { ...ref.current.settings, ...patch } }),
    [commit],
  );

  useEffect(() => {
    setSaveFailed(!save(state));
  }, [state]);

  return { state, ref, commit, putSession, removeSession, setSettings, saveFailed };
}

export type Store = ReturnType<typeof useStore>;

/** Re-renders the caller every `ms` while `on`. Keeps the 250 ms tick out of the rest of the tree. */
export function useNow(on: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [on, ms]);
  return now;
}
