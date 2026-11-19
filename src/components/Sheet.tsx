import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}

const CLOSE_MS = 260;

/**
 * HIG sheet on the native <dialog> (correct focus trapping and Escape).
 * Bottom sheet with a grabber on phones; a centred form sheet on wider screens.
 * Drag the grabber or header down to dismiss. Animates out before closing.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  const [closing, setClosing] = useState(false);
  // Keep showing the last content while the sheet animates away.
  const last = useRef({ title, children });
  if (open) last.current = { title, children };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setClosing(false);
      dialog.showModal();
      // Focus the sheet itself, not its first button, so no focus ring appears on open.
      requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    } else if (!open && dialog.open) {
      setClosing(true);
      const timer = setTimeout(() => {
        dialog.close();
        setClosing(false);
        if (panelRef.current) panelRef.current.style.transform = "";
      }, CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [open]);

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { startY: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (panelRef.current) panelRef.current.style.transition = "none";
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag.current || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = dy;
    panelRef.current.style.transform = `translateY(${dy}px)`;
  }

  function onPointerUp() {
    const panel = panelRef.current;
    if (!drag.current || !panel) return;
    const { dy } = drag.current;
    drag.current = null;
    panel.style.transition = "transform 0.3s var(--ease-ios)";
    if (dy > 110) {
      panel.style.transform = "translateY(100%)";
      onClose();
    } else {
      panel.style.transform = "";
    }
  }

  const show = open || closing;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-label ${closing ? "is-closing" : ""}`}
    >
      {show && (
        <div
          className="flex h-full items-end justify-center md:items-center md:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className="anim-sheet outline-none surface-elevated flex max-h-[92dvh] w-full flex-col rounded-t-[1rem] bg-grouped shadow-[0_-8px_40px_rgb(0_0_0/0.25)] md:max-h-[85dvh] md:max-w-[33.75rem] md:rounded-[1rem]"
          >
            <div
              className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                aria-hidden
                className="mx-auto mt-1.5 h-[0.3125rem] w-9 rounded-full bg-label-3 md:hidden"
              />
              <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center px-2 pt-1.5 pb-2">
                <span />
                <h2 className="truncate text-center text-headline font-semibold">
                  {last.current.title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex size-11 items-center justify-center rounded-full"
                >
                  <span className="inline-flex size-[1.875rem] items-center justify-center rounded-full bg-fill text-label-2">
                    <X aria-hidden className="size-4" strokeWidth={2.8} />
                  </span>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {last.current.children}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
