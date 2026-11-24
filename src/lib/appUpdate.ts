import { useSyncExternalStore } from "react";

/**
 * Keeping the app on the newest version. The service worker (made by vite-plugin-pwa) checks
 * for a new version; when there is one it downloads it in the background and the app restarts
 * itself onto it. This file lets the app ask for a check at any moment (the "Check for Updates"
 * row in Settings) and shows what's happening.
 */
export type UpdateStatus = "idle" | "checking" | "current" | "updating" | "offline" | "error";

interface State {
  status: UpdateStatus;
  lastChecked: number | null;
}

let state: State = { status: "idle", lastChecked: null };
let registration: ServiceWorkerRegistration | null = null;
let restart: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** Called once from main.tsx when the service worker is ready. */
export function attachRegistration(r: ServiceWorkerRegistration, restartApp: () => void) {
  registration = r;
  restart = restartApp;
  r.addEventListener("updatefound", () => set({ status: "updating" }));
  if (r.installing || r.waiting) set({ status: "updating" });
}

/**
 * Asks the server whether there's a newer version. `auto` checks (when the app opens, comes
 * back to the front, regains a connection, or every few minutes) are skipped if one ran in the
 * last minute; a tap on "Check for Updates" always runs.
 */
export async function checkForUpdate(auto = false): Promise<UpdateStatus> {
  if (auto && state.lastChecked && Date.now() - state.lastChecked < 60_000) return state.status;
  if (!navigator.onLine) {
    if (!auto) set({ status: "offline" });
    return state.status;
  }
  if (!registration) {
    // No service worker (e.g. a browser that doesn't support it): a reload is always fresh.
    set({ status: "current", lastChecked: Date.now() });
    return state.status;
  }
  if (!auto) set({ status: "checking" });
  try {
    await registration.update();
    const found = Boolean(registration.installing || registration.waiting);
    set({ status: found ? "updating" : "current", lastChecked: Date.now() });
  } catch {
    if (!auto) set({ status: "error" });
  }
  return state.status;
}

/** Switch to a downloaded version now, if it hasn't switched by itself. */
export function restartNow() {
  if (restart) restart();
  else window.location.reload();
}

export function useAppUpdate(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
