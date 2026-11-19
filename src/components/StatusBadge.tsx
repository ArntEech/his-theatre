import { CircleArrowUp, CircleCheck, Clock } from "lucide-react";
import type { DuesStatus } from "@/data/types";
import { STATUS_LABELS } from "@/lib/dues";
import { cx } from "@/lib/cx";

const styles: Record<DuesStatus, string> = {
  paid_up: "bg-paid/14 text-paid-text",
  behind: "bg-behind/14 text-behind-text",
  ahead: "bg-ahead/14 text-ahead-text",
};

const icons = { paid_up: CircleCheck, behind: Clock, ahead: CircleArrowUp };

/** Status is always shown in words as well as colour. */
export function StatusBadge({ status, className }: { status: DuesStatus; className?: string }) {
  const Icon = icons[status];
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-footnote font-semibold whitespace-nowrap",
        styles[status],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={2.6} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const STATUS_TEXT: Record<DuesStatus, string> = {
  paid_up: "text-paid-text",
  behind: "text-behind-text",
  ahead: "text-ahead-text",
};
