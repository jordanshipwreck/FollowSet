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

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Registered after load so it never competes with first paint. No reload on controllerchange:
  // a new build takes over on the next launch.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
