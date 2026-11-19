import { Check, CircleDashed, CircleSlash, Clock, Minus } from "lucide-react";
import type { IsoDate, ScheduleWeek, ScheduleWeekState } from "@/data/types";
import { ListRow, ListSection } from "@/components/List";
import { addDays, formatDay } from "@/lib/dates";
import { formatCedi } from "@/lib/money";
import { cx } from "@/lib/cx";
import { SCHEDULE_LABELS } from "./labels";

const ICON: Record<ScheduleWeekState, { icon: typeof Check; className: string }> = {
  covered: { icon: Check, className: "bg-paid text-white" },
  waived: { icon: Check, className: "text-paid-text shadow-[inset_0_0_0_2px_currentColor]" },
  owing: { icon: Clock, className: "bg-behind text-white" },
  part_paid: { icon: CircleDashed, className: "text-behind-text" },
  upcoming: { icon: CircleDashed, className: "text-label-3" },
  not_counted: { icon: Minus, className: "bg-fill text-label-2" },
  not_applicable: { icon: CircleSlash, className: "text-label-3" },
};

const STATE_TEXT: Partial<Record<ScheduleWeekState, string>> = {
  covered: "text-paid-text",
  waived: "text-paid-text",
  owing: "text-behind-text",
  part_paid: "text-behind-text",
};

/** One row per week of the semester. */
export function Schedule({
  weeks,
  today,
  header = "Weeks",
}: {
  weeks: ScheduleWeek[];
  today: IsoDate;
  header?: string;
}) {
  return (
    <ListSection header={header}>
      {weeks.map((w) => {
        const { icon: Icon, className } = ICON[w.state];
        const isCurrent = w.weekStart <= today && today < addDays(w.weekStart, 7);
        const muted = w.state === "not_counted" || w.state === "not_applicable";
        return (
          <ListRow
            key={w.weekNo}
            leading={
              <span
                aria-hidden
                className={cx(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full",
                  className,
                )}
              >
                <Icon className="size-4" strokeWidth={2.8} />
              </span>
            }
            title={
              <span className="flex flex-wrap items-center gap-x-2">
                Week {w.weekNo}
                {isCurrent && (
                  <span className="rounded-full bg-tint px-2 py-px text-caption font-semibold text-on-tint">
                    This Week
                  </span>
                )}
              </span>
            }
            subtitle={`${formatDay(w.weekStart)}${w.label ? ` · ${w.label}` : ""}`}
            trailing={
              <span className="flex flex-col items-end">
                <span
                  className={cx(
                    "text-subhead font-semibold",
                    STATE_TEXT[w.state] ?? "text-label-2",
                  )}
                >
                  {SCHEDULE_LABELS[w.state]}
                </span>
                {!muted && (
                  <span className="tnum text-footnote text-label-2">{formatCedi(w.amount)}</span>
                )}
              </span>
            }
          />
        );
      })}
    </ListSection>
  );
}
