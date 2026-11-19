import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, Eye } from "lucide-react";
import { devPreviewAs, devResetMockData } from "@/data/api";
import { useCurrentMember, useSessionMutation } from "@/data/queries";
import { useFlash } from "./Flash";
import { cx } from "@/lib/cx";

const PERSONAS = [
  { label: "Member", code: "HIS-010" },
  { label: "Financial Secretary", code: "HIS-002" },
  { label: "Treasurer", code: "HIS-003" },
  { label: "Director", code: "HIS-001" },
] as const;

/**
 * Development-only role switcher. Rendered only when isDemo (src/lib/env.ts) is true,
 * so it is stripped from production builds.
 */
export function PreviewAs() {
  const [open, setOpen] = useState(false);
  const { data: me } = useCurrentMember();
  const navigate = useNavigate();
  const flash = useFlash();
  const preview = useSessionMutation(devPreviewAs);
  const reset = useSessionMutation(devResetMockData);
  const current = PERSONAS.find((p) => p.code === me?.memberCode);

  return (
    <div className="no-print border-b-[0.5px] border-separator bg-fill">
      <div className="mx-auto max-w-[44rem] px-4 sm:px-6 md:px-10">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center gap-2 text-left text-footnote font-semibold"
        >
          <Eye aria-hidden className="size-4 text-tint-text" />
          <span className="flex-1">
            Preview as: {current?.label ?? (me ? me.fullName : "Signed out")}
            <span className="font-normal text-label-2"> · development only</span>
          </span>
          <ChevronDown
            aria-hidden
            className={cx("size-5 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="flex flex-wrap gap-2 pb-3">
            {PERSONAS.map((p) => (
              <button
                key={p.code}
                type="button"
                disabled={preview.isPending}
                aria-pressed={current?.code === p.code}
                onClick={() =>
                  preview.mutate([p.code], {
                    onSuccess: () => {
                      setOpen(false);
                      navigate("/", { replace: true });
                    },
                  })
                }
                className={cx(
                  "min-h-11 rounded-full px-4 text-subhead font-semibold",
                  current?.code === p.code ? "bg-tint text-on-tint" : "bg-cell",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              disabled={reset.isPending}
              onClick={() =>
                reset.mutate([], {
                  onSuccess: () => {
                    flash("Demo data restored.", "success");
                    setOpen(false);
                  },
                })
              }
              className="min-h-11 rounded-full px-4 text-subhead font-semibold text-tint-text"
            >
              Reset demo data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
