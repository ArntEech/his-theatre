import { useSyncExternalStore } from "react";

/**
 * In-app text size. Everything is sized in rem, so scaling the root font size scales the
 * whole app. A preference for this device only, kept in localStorage.
 */
export type TextSize = "smaller" | "small" | "standard" | "large" | "larger";

const SIZES: TextSize[] = ["smaller", "small", "standard", "large", "larger"];

const STORAGE_KEY = "his-theatre.text-size";
const listeners = new Set<() => void>();

function read(): TextSize {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return SIZES.includes(value as TextSize) ? (value as TextSize) : "standard";
  } catch {
    return "standard";
  }
}

let current: TextSize = typeof window !== "undefined" ? read() : "standard";

function apply() {
  const root = document.documentElement;
  if (current === "standard") delete root.dataset.textSize;
  else root.dataset.textSize = current;
  listeners.forEach((l) => l());
}

export function setTextSize(next: TextSize) {
  current = next;
  try {
    if (next === "standard") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing: the choice still applies for this visit.
  }
  apply();
}

if (typeof window !== "undefined") apply();

export function useTextSize() {
  const size = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return { size, setSize: setTextSize };
}
