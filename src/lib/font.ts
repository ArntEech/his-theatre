import { useSyncExternalStore } from "react";

/**
 * In-app font. The default, "apple", is Apple's San Francisco (SF Pro), the font in iPhone
 * apps. Apple only allows SF Pro on its own devices, so iPhones and Macs use their built-in
 * copy and other phones get Inter, the closest free match. "system" is the phone's own font
 * (Roboto on Android). The others load from Google Fonts the first time they are chosen; the
 * app keeps a copy, so they still work offline afterwards. A preference for this device only.
 * index.html applies the saved choice before the first paint, using the same list.
 */
export const FONTS = {
  apple: { label: "SF Pro (Apple style)", family: "Inter", query: "Inter:wght@400;500;600;700" },
  system: { label: "Phone's own font", family: "", query: "" },
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
    return value && value in FONTS ? (value as FontChoice) : "apple";
  } catch {
    return "apple";
  }
}

let current: FontChoice = typeof window !== "undefined" ? read() : "apple";

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
    if (next === "apple") localStorage.removeItem(STORAGE_KEY);
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
