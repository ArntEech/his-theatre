import { useSyncExternalStore } from "react";

/**
 * Light / dark appearance. This is a preference for this device only, so it lives in
 * localStorage rather than going through the data API.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "his-theatre.theme";
const listeners = new Set<() => void>();
const darkQuery =
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

let preference: ThemePreference = typeof window !== "undefined" ? readPreference() : "system";

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref !== "system") return pref;
  return darkQuery?.matches ? "dark" : "light";
}

function apply() {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  // Keep the browser chrome (status bar on Android) in step with the page.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolve(preference) === "dark" ? "#343434" : "#FBF8F1");
  listeners.forEach((l) => l());
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing: the choice still applies for this visit.
  }
  apply();
}

if (typeof window !== "undefined") {
  apply();
  darkQuery?.addEventListener("change", apply);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, () => preference);
  const resolved = useSyncExternalStore(subscribe, () => resolve(preference));
  return { preference: pref, resolved, setPreference: setThemePreference };
}
