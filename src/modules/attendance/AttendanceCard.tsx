import { Flame } from "lucide-react";
import { useCurrentSemester, useMyAttendance } from "@/data/queries";
import { SummaryCard } from "@/components/Card";
import { AttendanceGlyph } from "@/components/TabIcons";
import { formatDay, parseIsoDate } from "@/lib/dates";
import { cx } from "@/lib/cx";
import { STATUS_CELL } from "./AttendanceBits";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Home: this month's rehearsal days, your rate and your streak. */
export function AttendanceCard() {
  const semester = useCurrentSemester();
  const s = semester.data;
  const mine = useMyAttendance(s?.id);
  const a = mine.data;
  const today = s?.today ?? "";
  const month = today.slice(0, 7);
  const days = (a?.days ?? []).filter((d) => d.forMe && d.heldOn.startsWith(month));
  const monthName = today ? parseIsoDate(today).toLocaleString("en-GB", { month: "long", timeZone: "UTC" }) : "";

  return (
    <SummaryCard
      label="Attendance"
      icon={<AttendanceGlyph filled className="size-4" />}
      meta={monthName}
      to="/attendance"
    >
      {!a ? (
        <p className="text-subhead text-label-2">Tuesday and Thursday rehearsals.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-title1 font-bold tnum">
              {a.summary.attended} of {a.summary.counted}
            </span>
            <span className="text-subhead text-label-2 tnum">
              rehearsals{a.summary.rate !== null ? ` · ${Math.round(a.summary.rate * 100)}%` : ""}
            </span>
          </div>
          {a.summary.streak > 1 && (
            <p className="mt-0.5 flex items-center gap-1 text-footnote font-semibold text-behind-text">
              <Flame aria-hidden className="size-3.5" strokeWidth={2.6} /> {a.summary.streak} in a row
            </p>
          )}
          {days.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {days.map((d) => (
                <span key={d.id} className="flex w-9 flex-col items-center gap-0.5">
                  <span className="text-caption2 text-label-3">{DAY[parseIsoDate(d.heldOn).getUTCDay()]}</span>
                  <span
                    className={cx(
                      "flex size-9 items-center justify-center rounded-[0.55rem] text-subhead tnum",
                      d.isCancelled
                        ? "text-label-3 line-through"
                        : d.status
                          ? STATUS_CELL[d.status]
                          : "bg-fill font-semibold text-label",
                      d.heldOn === today && "outline-2 outline-offset-1 outline-label",
                    )}
                  >
                    {Number(d.heldOn.slice(8))}
                  </span>
                </span>
              ))}
            </div>
          )}
          {a.next && (
            <p className="mt-3 text-footnote text-label-2">
              Next: {a.next.heldOn === today ? "today" : formatDay(a.next.heldOn)}
              {a.next.drive ? ` (${a.next.drive})` : ""}
              {a.next.excuse ? ` · excuse ${a.next.excuse.status}` : ""}
            </p>
          )}
        </>
      )}
    </SummaryCard>
  );
}
