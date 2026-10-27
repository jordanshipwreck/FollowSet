import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    window.__fittyBootFail?.(this.state.error);
    return null;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);

// iOS Safari only applies :active styles when a touch listener exists.
document.addEventListener("touchstart", () => {}, { passive: true });
// A short tick on Android when a button is pressed (iOS has no vibrate API).
document.addEventListener(
  "pointerdown",
  (e) => {
    if ((e.target as Element | null)?.closest?.("button:not(:disabled)")) navigator.vibrate?.(6);
  },
  { passive: true },
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Registered after load so it never competes with first paint. No reload on controllerchange:
  // a new build takes over on the next launch.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
