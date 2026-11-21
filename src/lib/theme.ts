import { useSyncExternalStore } from "react";

/**
 * Appearance, for this device only (kept in localStorage, not in the database).
 *
 *   system   Automatic: Day or Night, following the phone
 *   day      cream and charcoal
 *   night    soft charcoal (the original dark look)
 *   dark     true black, easiest on OLED screens and batteries
 *   clear    iOS-style clear glass over a warm stage backdrop
 *   blur     One UI-style heavy blur
 *   frosted  frosted, grainy glass
 *
 * Eye care is a separate switch: a warm filter over everything, kinder at night.
 * index.html applies both before the first paint, using the same names.
 */
export type ThemePreference = "system" | "day" | "night" | "dark" | "clear" | "blur" | "frosted";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const THEMES: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "Automatic", hint: "Day or Night, following your phone" },
  { value: "day", label: "Day", hint: "Cream and charcoal" },
  { value: "night", label: "Night", hint: "Soft charcoal" },
  { value: "dark", label: "Dark", hint: "True black" },
  { value: "clear", label: "Clear", hint: "See-through glass, like iOS" },
  { value: "blur", label: "Blur", hint: "Soft blurred glass, like One UI" },
  { value: "frosted", label: "Frosted", hint: "Frosted, grainy glass" },
];

const STORAGE_KEY = "his-theatre.appearance";
const OLD_KEY = "his-theatre.theme"; // "light" | "dark" from earlier versions
const EYE_CARE_KEY = "his-theatre.eye-care";
const listeners = new Set<() => void>();
const darkQuery =
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

const isTheme = (v: unknown): v is ThemePreference => THEMES.some((t) => t.value === v);

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isTheme(value)) return value;
    const old = localStorage.getItem(OLD_KEY);
    if (old === "light") return "day";
    if (old === "dark") return "night";
  } catch {
    // No storage: use the default.
  }
  return "system";
}

function readEyeCare(): boolean {
  try {
    return localStorage.getItem(EYE_CARE_KEY) === "on";
  } catch {
    return false;
  }
}

let preference: ThemePreference = typeof window !== "undefined" ? readPreference() : "system";
let eyeCare = typeof window !== "undefined" ? readEyeCare() : false;

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref !== "system") return pref;
  return darkQuery?.matches ? "night" : "day";
}

/** The colour of the phone's status bar for each look. */
const BAR_COLOUR: Record<ResolvedTheme, string> = {
  day: "#FBF8F1",
  night: "#343434",
  dark: "#000000",
  clear: "#2a1f1a",
  blur: "#2a1f1a",
  frosted: "#2a1f1a",
};

function apply() {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  if (eyeCare) root.dataset.eyeCare = "";
  else delete root.dataset.eyeCare;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", BAR_COLOUR[resolve(preference)]);
  listeners.forEach((l) => l());
}

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing: the choice still applies for this visit.
  }
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  save(STORAGE_KEY, next === "system" ? null : next);
  save(OLD_KEY, null);
  apply();
}

export function setEyeCare(on: boolean) {
  eyeCare = on;
  save(EYE_CARE_KEY, on ? "on" : null);
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

/** True for the looks with light text on a dark background. */
export const isDarkLook = (t: ResolvedTheme) => t !== "day";

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, () => preference);
  const resolved = useSyncExternalStore(subscribe, () => resolve(preference));
  const care = useSyncExternalStore(subscribe, () => eyeCare);
  return {
    preference: pref,
    resolved,
    setPreference: setThemePreference,
    eyeCare: care,
    setEyeCare,
  };
}
