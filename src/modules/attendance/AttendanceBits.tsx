import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AttendanceStatus, RehearsalDay } from "@/data/community";
import { STATUS_LABEL } from "@/lib/attendance";
import { parseIsoDate } from "@/lib/dates";
import { cx } from "@/lib/cx";

/** Colours for each mark: green present, orange outline absent, blue absent with excuse. */
export const STATUS_CELL: Record<AttendanceStatus, string> = {
  present: "bg-paid/20 text-paid-text",
  excused: "bg-ahead/18 text-ahead-text",
  absent: "text-behind-text ring-[1.5px] ring-inset ring-behind",
};

export function StatusPill({ status, className }: { status: AttendanceStatus | null; className?: string }) {
  if (!status)
    return (
      <span className={cx("rounded-full bg-fill px-2.5 py-0.5 text-caption font-semibold text-label-2", className)}>
        Not marked
      </span>
    );
  return (
    <span className={cx("rounded-full px-2.5 py-0.5 text-caption font-semibold", STATUS_CELL[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-caption text-label-2">
      {(["present", "absent", "excused"] as AttendanceStatus[]).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cx("inline-block size-3 rounded-[0.25rem]", STATUS_CELL[s])} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A month calendar: rehearsal days are coloured by your mark; other days are faded. */
export function AttendanceCalendar({
  days,
  today,
  onSelect,
}: {
  days: RehearsalDay[];
  today: string;
  onSelect?: (day: RehearsalDay) => void;
}) {
  const months = useMemo(() => [...new Set(days.map((d) => d.heldOn.slice(0, 7)))].sort(), [days]);
  const initial = months.includes(today.slice(0, 7)) ? today.slice(0, 7) : (months.at(-1) ?? today.slice(0, 7));
  const [month, setMonth] = useState(initial);
  const i = months.indexOf(month);
  const first = parseIsoDate(`${month}-01`);
  const blanks = first.getUTCDay();
  const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const byDate = new Map<string, RehearsalDay>();
  for (const d of days) {
    if (!d.forMe && !d.status) continue;
    const prev = byDate.get(d.heldOn);
    // A day with two rehearsals shows the one that counts most.
    if (!prev || (!prev.status && d.status) || (prev.isCancelled && !d.isCancelled)) byDate.set(d.heldOn, d);
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={i <= 0}
          onClick={() => setMonth(months[i - 1])}
          className="inline-flex size-9 items-center justify-center rounded-full text-tint-text active:bg-fill disabled:opacity-25"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-headline font-semibold">
          {MONTHS[first.getUTCMonth()]} {first.getUTCFullYear()}
        </span>
        <button
          type="button"
          aria-label="Next month"
          disabled={i < 0 || i >= months.length - 1}
          onClick={() => setMonth(months[i + 1])}
          className="inline-flex size-9 items-center justify-center rounded-full text-tint-text active:bg-fill disabled:opacity-25"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d} className="pb-1 text-caption text-label-3">
            {d}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, k) => (
          <span key={`b${k}`} />
        ))}
        {Array.from({ length }, (_, k) => {
          const iso = `${month}-${String(k + 1).padStart(2, "0")}`;
          const d = byDate.get(iso);
          const isToday = iso === today;
          const cls = cx(
            "flex aspect-square items-center justify-center rounded-[0.6rem] text-subhead tnum",
            !d && "text-label-3/70",
            d && d.isCancelled && "text-label-3 line-through",
            d && !d.isCancelled && d.status && STATUS_CELL[d.status],
            d && !d.isCancelled && !d.status && "bg-fill font-semibold text-label",
            isToday && "outline-2 outline-offset-1 outline-label",
          );
          return d && onSelect ? (
            <button key={iso} type="button" onClick={() => onSelect(d)} className={cx(cls, "active:opacity-60")}>
              {k + 1}
            </button>
          ) : (
            <span key={iso} className={cls}>
              {k + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}
