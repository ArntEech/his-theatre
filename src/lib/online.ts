import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}

export const OFFLINE_MESSAGE = "You're offline. Connect to the internet to save this.";
