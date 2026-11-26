/**
 * Phone notifications (Web Push). The server's public notification key comes from the
 * database: it only lets the push services check that messages really come from His Theatre.
 * The private half never leaves the server.
 */
import { getPushPublicKey, removePushSubscription, savePushSubscription } from "@/data/api";
import { usesLiveData } from "@/lib/env";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function b64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Ask permission, subscribe this phone and save it. */
export async function turnOnPush(): Promise<PushState> {
  if (!supported()) throw new Error(isIos() ? "Add His Theatre to your Home Screen first, then open it from there." : "This browser can't show notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
  if (!usesLiveData) return "on"; // Demo: nothing to send.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = await getPushPublicKey();
    if (!key) throw new Error("Notifications aren't ready on the server yet. Try again in a minute.");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key) as BufferSource,
    });
  }
  await savePushSubscription({ endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) });
  return "on";
}

export async function turnOffPush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await removePushSubscription(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

/** After signing in on a phone that already allowed notifications, attach it to this person. */
export async function refreshPushOwner(): Promise<void> {
  if (!usesLiveData || !supported() || Notification.permission !== "granted") return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await savePushSubscription({ endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) });
}
