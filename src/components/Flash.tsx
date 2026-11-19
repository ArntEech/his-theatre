import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cx } from "@/lib/cx";

type Tone = "info" | "success" | "error";
interface FlashMessage {
  id: number;
  text: string;
  tone: Tone;
}

const FlashContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useFlash() {
  return useContext(FlashContext);
}

/** Brief confirmation banners that drop in from the top, like iOS system notices. Tap to dismiss. */
export function FlashProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<FlashMessage[]>([]);
  const seq = useRef(0);
  const recent = useRef(new Map<string, number>());

  const dismiss = useCallback(
    (id: number) => setMessages((list) => list.filter((m) => m.id !== id)),
    [],
  );

  const show = useCallback(
    (text: string, tone: Tone = "info") => {
      // Ignore the same message fired twice in quick succession (e.g. by StrictMode effects).
      const last = recent.current.get(text);
      if (last && Date.now() - last < 1500) return;
      recent.current.set(text, Date.now());
      seq.current += 1;
      const id = seq.current;
      setMessages((list) => [...list.slice(-1), { id, text, tone }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <FlashContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))]"
      >
        {messages.map((m) => {
          const Icon = m.tone === "success" ? CircleCheck : m.tone === "error" ? CircleAlert : Info;
          return (
            <button
              type="button"
              key={m.id}
              role={m.tone === "error" ? "alert" : "status"}
              onClick={() => dismiss(m.id)}
              className="anim-banner material pointer-events-auto flex max-w-md items-start gap-2.5 rounded-[1.375rem] px-4 py-2.5 text-left shadow-[0_8px_30px_rgb(0_0_0/0.18),0_0_0_0.5px_var(--separator)]"
            >
              <Icon
                aria-hidden
                className={cx(
                  "mt-px size-5 shrink-0",
                  m.tone === "success" && "text-paid-text",
                  m.tone === "error" && "text-destructive",
                  m.tone === "info" && "text-tint-text",
                )}
                strokeWidth={2.4}
              />
              <span className="text-subhead font-semibold">{m.text}</span>
            </button>
          );
        })}
      </div>
    </FlashContext.Provider>
  );
}
