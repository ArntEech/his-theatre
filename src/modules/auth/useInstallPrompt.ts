import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

/** Which install steps fit this phone or computer. */
export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /crios|fxios|edgios|opios/i.test(ua) ? "ios-other" : "ios-safari";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * Installing the app on the home screen. Android and computers can show the browser's own
 * install prompt; iPhones can't (Apple doesn't allow it), so they get step-by-step instructions.
 */
export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(Boolean(deferred));
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const platform = detectPlatform();

  useEffect(() => {
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => setCanPrompt(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /** Shows the browser's install prompt. Returns false if this browser can't. */
  async function install(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    setCanPrompt(false);
    return choice.outcome === "accepted";
  }

  return { standalone, platform, isIos: platform.startsWith("ios"), canPrompt, install };
}
