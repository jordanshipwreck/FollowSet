// Applies the light/dark theme. "system" follows the phone. index.html runs the same logic
// before first paint so the page never flashes the wrong theme.
import type { Theme } from "./store";

const META: Record<"light" | "dark", string> = { light: "#ecebe7", dark: "#0d0d0c" };

export function resolveTheme(t: Theme): "light" | "dark" {
  if (t !== "system") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: Theme): void {
  const r = resolveTheme(t);
  document.documentElement.dataset.theme = r;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[r]);
}

/** Re-applies when the phone switches between light and dark, while the setting is "system". */
export function watchSystemTheme(get: () => Theme): () => void {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return () => {};
  const on = () => get() === "system" && applyTheme("system");
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
}
