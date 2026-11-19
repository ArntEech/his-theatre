import { Check, ArrowUpRight, Clock } from "lucide-react";

import type { DuesStatus } from "@/data/types";
import { STATUS_LABEL } from "@/lib/dues";
import { cn } from "@/lib/utils";

const styles: Record<DuesStatus, string> = {
  paid_up: "text-status-paid border-status-paid/40 bg-status-paid/10",
  behind: "text-status-behind border-status-behind/40 bg-status-behind/10",
  ahead: "text-status-ahead border-status-ahead/40 bg-status-ahead/10",
};
const icons = { paid_up: Check, behind: Clock, ahead: ArrowUpRight };

/** Status is always shown in words, never colour alone. */
export function StatusBadge({ status, className }: { status: DuesStatus; className?: string }) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold",
        styles[status],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const statusTextClass: Record<DuesStatus, string> = {
  paid_up: "text-status-paid",
  behind: "text-status-behind",
  ahead: "text-status-ahead",
};
