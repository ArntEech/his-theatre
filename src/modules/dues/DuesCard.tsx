import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import type { MyDues } from "@/data/types";
import { SummaryCard } from "@/components/Card";
import { BigMoney } from "@/components/Money";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCedi } from "@/lib/money";
import { addDays, formatDay } from "@/lib/dates";

/** The headline dues card. The figure that matters most is the largest thing on the screen. */
export function DuesCard({
  dues,
  to,
  meta,
  label = "Dues",
  children,
}: {
  dues: MyDues;
  to?: string;
  meta?: ReactNode;
  label?: string;
  children?: ReactNode;
}) {
  const lastCovered = [...dues.schedule]
    .reverse()
    .find((w) => w.state === "covered" || w.state === "waived");
  let caption: string;
  let figure: number;
  let line: string;

  if (dues.status === "behind") {
    caption = "You owe";
    figure = dues.owing;
    line = `${dues.weeksBehind} ${dues.weeksBehind === 1 ? "week" : "weeks"} behind. ${formatCedi(dues.dueSoFar)} was due by now and ${formatCedi(dues.paid)} has been paid.`;
  } else if (dues.status === "ahead") {
    caption = "Credit";
    figure = dues.credit;
    line = lastCovered
      ? `Covered up to the week ending ${formatDay(addDays(lastCovered.weekStart, 6))}.`
      : "The extra rolls forward to the coming weeks.";
  } else {
    caption = dues.paid > 0 ? "Paid so far" : "You owe";
    figure = dues.paid > 0 ? dues.paid : 0;
    line = dues.nextDue
      ? `All paid up. The next ${formatCedi(dues.nextDue.amount)} is due on ${formatDay(dues.nextDue.weekStart)}.`
      : "All paid up for the whole semester.";
  }

  return (
    <SummaryCard
      label={label}
      icon={<CalendarDays aria-hidden className="size-4" strokeWidth={2.4} />}
      meta={meta}
      to={to}
    >
      <p className="text-subhead text-label-2">{caption}</p>
      <div className="mt-0.5 mb-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <BigMoney value={figure} />
        <StatusBadge status={dues.status} className="mb-1.5" />
      </div>
      <p className="mb-4 text-subhead text-label-2">{line}</p>
      <ProgressBar value={dues.progressPct} label="Share of this semester's dues paid" />
      <p className="tnum mt-2 flex justify-between gap-3 text-footnote text-label-2">
        <span>
          {formatCedi(dues.paid)} of {formatCedi(dues.semesterTotal)}
        </span>
        <span>{Math.round(dues.progressPct)}%</span>
      </p>
      {children && <div className="mt-4">{children}</div>}
    </SummaryCard>
  );
}
