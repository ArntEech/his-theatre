import { useSyncExternalStore } from "react";

/**
 * In-app font. "system" is the phone's own font (San Francisco on iPhone, Roboto on Android).
 * The others load from Google Fonts the first time they are chosen; the app keeps a copy,
 * so they still work offline afterwards. A preference for this device only.
 * index.html applies the saved choice before the first paint, using the same list.
 */
export const FONTS = {
  system: { label: "Phone default", family: "", query: "" },
  nunito: { label: "Nunito (rounded)", family: "Nunito", query: "Nunito:wght@400;600;700;800" },
  poppins: { label: "Poppins (modern)", family: "Poppins", query: "Poppins:wght@400;500;600;700" },
  lato: { label: "Lato (clean)", family: "Lato", query: "Lato:wght@400;700;900" },
  lora: { label: "Lora (classic serif)", family: "Lora", query: "Lora:wght@400;600;700" },
  atkinson: {
    label: "Atkinson (easiest to read)",
    family: "Atkinson Hyperlegible",
    query: "Atkinson+Hyperlegible:wght@400;700",
  },
} as const;

export type FontChoice = keyof typeof FONTS;

const STORAGE_KEY = "his-theatre.font";
const listeners = new Set<() => void>();

function read(): FontChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && value in FONTS ? (value as FontChoice) : "system";
  } catch {
    return "system";
  }
}

let current: FontChoice = typeof window !== "undefined" ? read() : "system";

function apply() {
  const root = document.documentElement;
  const font = FONTS[current];
  let link = document.getElementById("his-font") as HTMLLinkElement | null;
  if (current === "system") {
    delete root.dataset.font;
    link?.remove();
  } else {
    const href = `https://fonts.googleapis.com/css2?family=${font.query}&display=swap`;
    if (!link) {
      link = document.createElement("link");
      link.id = "his-font";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
    root.dataset.font = current;
  }
  listeners.forEach((l) => l());
}

export function setFont(next: FontChoice) {
  current = next;
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing: the choice still applies for this visit.
  }
  apply();
}

if (typeof window !== "undefined") apply();

export function useFont() {
  const font = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return { font, setFont };
}
