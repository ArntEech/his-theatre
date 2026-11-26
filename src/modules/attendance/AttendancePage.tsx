import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CalendarPlus, ClipboardCheck, Flame, Users } from "lucide-react";
import {
  useApiMutation,
  useAttendanceAccess,
  useCurrentSemester,
  useMyAttendance,
} from "@/data/queries";
import { requestExcuse } from "@/data/api";
import type { RehearsalDay } from "@/data/community";
import { PageHeader } from "@/components/PageHeader";
import { SummaryCard } from "@/components/Card";
import { IconTile, ListItem, ListRow, ListSection } from "@/components/List";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { TextAreaField } from "@/components/Field";
import { useFlash } from "@/components/Flash";
import { ContentUnavailable, ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { formatDateLong, formatDay, formatTime } from "@/lib/dates";
import { percent } from "@/lib/attendance";
import { AttendanceCalendar, Legend, StatusPill } from "./AttendanceBits";

export function AttendancePage() {
  const semester = useCurrentSemester();
  const s = semester.data;
  const mine = useMyAttendance(s?.id);
  const access = useAttendanceAccess();
  const [open, setOpen] = useState<RehearsalDay | null>(null);
  const [excuseFor, setExcuseFor] = useState<RehearsalDay | null>(null);
  const a = mine.data;
  const today = s?.today ?? "";

  return (
    <>
      <PageHeader
        title="Attendance"
        overline={s?.name}
        action={
          access.data?.canTake ? (
            <Link
              to="/attendance/take"
              aria-label="Take attendance"
              className="inline-flex size-10 items-center justify-center rounded-full text-tint-text active:bg-fill"
            >
              <ClipboardCheck className="size-[1.35rem]" strokeWidth={2.2} />
            </Link>
          ) : undefined
        }
      />
      {semester.isError && <ErrorNotice error={semester.error} onRetry={() => semester.refetch()} />}
      {mine.isError && <ErrorNotice error={mine.error} onRetry={() => mine.refetch()} />}
      {(semester.isPending || (s && mine.isPending)) && <LoadingBlock lines={5} />}
      {s === null && (
        <ContentUnavailable title="No Semester Yet" description="Rehearsals appear here once a semester is set up." />
      )}

      {a && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <SummaryCard label="This Semester" icon={<ClipboardCheck aria-hidden className="size-4" strokeWidth={2.4} />}>
              <p className="text-title1 font-bold tnum">{percent(a.summary.rate)}</p>
              <p className="text-footnote text-label-2 tnum">
                {a.summary.attended} of {a.summary.counted} rehearsals
              </p>
            </SummaryCard>
            <SummaryCard
              label="Streak"
              accent="text-behind-text"
              icon={<Flame aria-hidden className="size-4" strokeWidth={2.4} />}
            >
              <p className="text-title1 font-bold tnum">{a.summary.streak}</p>
              <p className="text-footnote text-label-2 tnum">Best: {a.summary.best} in a row</p>
            </SummaryCard>
          </div>

          {a.next && (
            <NextRehearsal day={a.next} onExcuse={() => setExcuseFor(a.next)} today={today} />
          )}

          <ListSection padded header="Calendar">
            <AttendanceCalendar days={a.days} today={today} onSelect={setOpen} />
            <Legend />
          </ListSection>

          <ListSection
            header="Rehearsals"
            footer="Tuesdays and Thursdays, plus any extra rehearsals for your drives. Tap one for details."
          >
            {a.days
              .filter((d) => (d.forMe || d.status) && d.when !== "upcoming")
              .reverse()
              .map((d) => (
                <ListRow
                  key={d.id}
                  title={
                    <span>
                      {formatDay(d.heldOn)}
                      {d.when === "today" && <span className="text-label-2"> · today</span>}
                    </span>
                  }
                  subtitle={rehearsalLine(d)}
                  trailing={d.isCancelled ? <span className="text-subhead">Cancelled</span> : <StatusPill status={d.status} />}
                  onClick={() => setOpen(d)}
                  chevron={false}
                />
              ))}
            {!a.days.some((d) => (d.forMe || d.status) && d.when !== "upcoming") && (
              <ListItem>
                <p className="text-center text-subhead text-label-2">No rehearsals yet this semester.</p>
              </ListItem>
            )}
          </ListSection>
        </>
      )}

      {access.data?.canTake && (
        <ListSection header={access.data.isOfficer ? "Officers" : "Drive Heads"}>
          <ListRow
            leading={<IconTile icon={ClipboardCheck} color="gold" />}
            title="Take Attendance"
            subtitle={access.data.isOfficer ? "Any rehearsal this week" : "Today's rehearsal"}
            to="/attendance/take"
          />
          {access.data.isOfficer && (
            <ListRow
              leading={<IconTile icon={Users} color="charcoal" />}
              title="Everyone's Attendance"
              subtitle="Rates, excuses, missing a lot"
              to="/admin/attendance"
            />
          )}
        </ListSection>
      )}

      <DaySheet day={open} onClose={() => setOpen(null)} onExcuse={(d) => { setOpen(null); setExcuseFor(d); }} />
      <ExcuseSheet day={excuseFor} onClose={() => setExcuseFor(null)} />
    </>
  );
}

export function rehearsalLine(d: RehearsalDay) {
  const bits = [
    d.title || (d.kind === "extra" ? "Extra rehearsal" : "Rehearsal"),
    d.drive,
    d.startsAt,
  ].filter(Boolean);
  return bits.join(" · ");
}

function NextRehearsal({ day, onExcuse, today }: { day: RehearsalDay; onExcuse: () => void; today: string }) {
  return (
    <ListSection header="Next Rehearsal">
      <ListRow
        leading={<IconTile icon={CalendarPlus} color="blue" />}
        title={day.heldOn === today ? `Today, ${formatDay(day.heldOn)}` : formatDateLong(day.heldOn).replace(/ \d{4}$/, "")}
        subtitle={
          day.excuse
            ? `You asked to be excused: ${day.excuse.status === "pending" ? "waiting for an answer" : day.excuse.status}`
            : rehearsalLine(day)
        }
        trailing={
          !day.excuse || day.excuse.status === "pending" ? (
            <button
              type="button"
              onClick={onExcuse}
              className="rounded-full bg-fill px-3 py-1.5 text-subhead font-semibold text-tint-text active:bg-fill-strong"
            >
              {day.excuse ? "Change" : "I Can't Come"}
            </button>
          ) : undefined
        }
      />
    </ListSection>
  );
}

function DaySheet({
  day,
  onClose,
  onExcuse,
}: {
  day: RehearsalDay | null;
  onClose: () => void;
  onExcuse: (d: RehearsalDay) => void;
}) {
  return (
    <Sheet open={Boolean(day)} onClose={onClose} title={day ? formatDateLong(day.heldOn) : ""}>
      {day && (
        <div className="flex flex-col gap-4">
          <ul className="overflow-hidden rounded-[0.75rem] bg-cell">
            <ListRow title="Rehearsal" trailing={rehearsalLine(day)} />
            <ListRow
              title="Your mark"
              trailing={day.isCancelled ? "Cancelled" : day.when === "upcoming" ? "Upcoming" : <StatusPill status={day.status} />}
            />
            {day.markedAt && <ListRow title="Marked" trailing={formatTime(day.markedAt)} />}
            {day.isCancelled && day.cancelReason && <ListRow title="Why" subtitle={day.cancelReason} />}
            {day.excuse && <ListRow title="Excuse" subtitle={`${day.excuse.reason} (${day.excuse.status})`} />}
          </ul>
          {!day.status && day.when === "past" && !day.isCancelled && !day.rollTaken && (
            <p className="px-1 text-footnote text-label-2">Attendance wasn't taken for this rehearsal, so it doesn't count.</p>
          )}
          {day.status === "absent" && (
            <p className="px-1 text-footnote text-label-2">
              Think this is wrong? Speak to your drive head or an officer. They can correct it until the end of that week.
            </p>
          )}
          {day.when !== "past" && !day.isCancelled && day.forMe && (!day.excuse || day.excuse.status === "pending") && (
            <Button variant="gray" block onClick={() => onExcuse(day)}>
              I Can't Come
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ExcuseSheet({ day, onClose }: { day: RehearsalDay | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const send = useApiMutation(requestExcuse);
  const flash = useFlash();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!day) return;
    send.mutate([day.id, reason], {
      onSuccess: () => {
        flash("Sent. Your drive head or an officer will answer.", "success");
        setReason("");
        onClose();
      },
    });
  }
  return (
    <Sheet open={Boolean(day)} onClose={() => { send.reset(); onClose(); }} title="Ask to Be Excused">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="px-1 text-subhead text-label-2">
          {day ? formatDateLong(day.heldOn) : ""}. If it's approved, the rehearsal won't count against you.
        </p>
        <TextAreaField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="Exam that evening"
        />
        <InlineError error={send.error} />
        <Button type="submit" block loading={send.isPending} disabled={reason.trim().length < 3}>
          Send
        </Button>
      </form>
    </Sheet>
  );
}
