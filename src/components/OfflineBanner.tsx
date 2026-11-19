import { WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Shows when the phone has no connection. Screens keep showing the last data they loaded. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    if (online) setSince(null);
    else {
      const d = new Date();
      setSince(`${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`);
    }
  }, [online]);

  if (online) return null;
  return (
    <div role="status" className="bg-stage px-4 py-2 text-stage-foreground print:hidden">
      <p className="mx-auto flex max-w-lg items-center gap-2 font-medium">
        <WifiOff className="size-5 shrink-0 text-gold" aria-hidden />
        You're offline. Showing what was loaded before {since ?? "now"}. Saving is paused.
      </p>
    </div>
  );
}
