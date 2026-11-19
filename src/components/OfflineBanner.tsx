import { useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/online";
import { useFlash } from "./Flash";

/** Tells people clearly, but quietly, when the phone has no connection. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const flash = useFlash();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      flash("Back online. Everything is up to date.", "success");
    }
  }, [online, flash]);

  if (online) return null;
  return (
    <div
      role="status"
      className="anim-fade mt-3 mb-1 flex items-start gap-3 rounded-[0.875rem] bg-cell p-3.5 shadow-[var(--shadow)]"
    >
      <span className="inline-flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.45rem] bg-[#8d8a85] text-white">
        <WifiOff aria-hidden className="size-[1.1rem]" strokeWidth={2.2} />
      </span>
      <div>
        <p className="text-headline font-semibold">No Internet Connection</p>
        <p className="text-subhead text-label-2">
          You can still see what was saved on this phone. Recording money needs a connection.
        </p>
      </div>
    </div>
  );
}
