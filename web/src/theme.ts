import { useSyncExternalStore } from "react";

/** What the learner picked in Settings. System follows the operating system and changes with it. */
export type ThemeMode = "system" | "light" | "dark";

/** Also read by the inline script in index.html, which applies the theme before the app loads. */
const KEY = "pire.theme";
const MODES: readonly ThemeMode[] = ["system", "light", "dark"];
const listeners = new Set<() => void>();
// Dark unless the system asks for light, matching the inline script in index.html.
const prefersLight = () => window.matchMedia("(prefers-color-scheme: light)");

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY);
    return MODES.includes(saved as ThemeMode) ? (saved as ThemeMode) : "system";
  } catch {
    return "system";
  }
}

let mode: ThemeMode = typeof window === "undefined" ? "system" : readMode();

function apply() {
  const light = mode === "light" || (mode === "system" && prefersLight().matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
}

const notify = () => listeners.forEach((l) => l());

export function setThemeMode(next: ThemeMode) {
  mode = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Private browsing can refuse storage; the choice still holds for this visit.
  }
  apply();
  notify();
}

/** Applies the saved theme and keeps System in step with the operating system. Call once at startup. */
export function startTheme() {
  apply();
  prefersLight().addEventListener("change", () => mode === "system" && apply());
  // Another tab changed the setting.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY && e.key !== null) return;
    mode = readMode();
    apply();
    notify();
  });
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode,
  );
}
