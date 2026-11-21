import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator } from "./ActivityIndicator";
import { useFlash } from "./Flash";
import { cx } from "@/lib/cx";

const TRIGGER = 72; // how far (px) to pull before letting go refreshes
const MAX = 110;

/**
 * Pull down from the top of any page to fetch the latest data.
 *
 * Only the data is fetched again. The page is NOT reloaded, so anything being typed,
 * an open form or a half-filled payment stays exactly as it was. The browser's own
 * pull-to-reload is switched off in index.css (overscroll-behavior), because that one
 * reloads the whole page and loses what was typed.
 */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const flash = useFlash();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let startY: number | null = null;
    let startX = 0;
    let active = false;

    const set = (px: number) => {
      pullRef.current = px;
      setPull(px);
    };

    function onStart(e: TouchEvent) {
      startY = null;
      active = false;
      if (busy.current || e.touches.length !== 1 || window.scrollY > 0) return;
      // Not while a sheet is open, or when the finger starts on a field or a sideways list.
      if (document.querySelector("dialog[open]")) return;
      const target = e.target as Element | null;
      if (target?.closest("input, textarea, select, [data-no-pull]")) return;
      startY = e.touches[0]!.clientY;
      startX = e.touches[0]!.clientX;
    }

    function onMove(e: TouchEvent) {
      if (startY === null) return;
      const dy = e.touches[0]!.clientY - startY;
      const dx = e.touches[0]!.clientX - startX;
      if (!active) {
        if (dy < 0 || Math.abs(dx) > 12 || window.scrollY > 0) {
          startY = null; // scrolling up or sideways: not a pull
          return;
        }
        if (dy < 8 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
        active = true;
      }
      if (e.cancelable) e.preventDefault();
      set(Math.min(MAX, (dy - 8) * 0.55));
    }

    async function onEnd() {
      const pulled = pullRef.current;
      startY = null;
      if (!active) return;
      active = false;
      if (pulled < TRIGGER) {
        set(0);
        return;
      }
      if (!navigator.onLine) {
        set(0);
        flash("You're offline. Showing what was saved on this phone.", "error");
        return;
      }
      busy.current = true;
      setRefreshing(true);
      set(TRIGGER * 0.75);
      try {
        await queryClient.invalidateQueries();
      } finally {
        busy.current = false;
        setRefreshing(false);
        set(0);
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [queryClient, flash]);

  const progress = Math.min(1, pull / TRIGGER);
  const visible = pull > 0 || refreshing;

  return (
    <div
      aria-hidden={!refreshing}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center md:pl-[17.5rem]"
      style={{
        transform: `translateY(calc(env(safe-area-inset-top) + ${pull - 44}px))`,
        transition: pullRef.current === 0 || refreshing ? "transform 200ms ease" : "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <span
        role={refreshing ? "status" : undefined}
        className={cx(
          "mt-2 flex size-10 items-center justify-center rounded-full bg-cell shadow-md",
          !refreshing && progress < 1 && "opacity-70",
        )}
        style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
      >
        <ActivityIndicator className="size-5" label={refreshing ? "Refreshing" : undefined} />
      </span>
    </div>
  );
}
