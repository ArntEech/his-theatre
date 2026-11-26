import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { CalendarPlus, Check, CloudOff } from "lucide-react";
import { decideExcuse, markAttendance } from "@/data/api";
import {
  useApiMutation,
  useAttendanceAccess,
  useCurrentSemester,
  useRehearsals,
  useRollCall,
} from "@/data/queries";
import type { AttendanceStatus, Rehearsal } from "@/data/community";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { SearchField, SelectField } from "@/components/Field";
import { ListItem, ListRow, ListSection } from "@/components/List";
import { useFlash } from "@/components/Flash";
import { ContentUnavailable, ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { addDays, formatDay } from "@/lib/dates";
import { nextStatus } from "@/lib/attendance";
import { enqueue, pendingFor } from "@/lib/attendanceQueue";
import { isOnline, useOnlineStatus } from "@/lib/online";
import { cx } from "@/lib/cx";
import { StatusPill } from "./AttendanceBits";
import { AddRehearsalSheet, RehearsalActionSheet } from "./RehearsalSheets";

type Filter = "mine" | "all";

export function RollCallPage() {
  const semester = useCurrentSemester();
  const s = semester.data;
  const access = useAttendanceAccess();
  const rehearsals = useRehearsals(s?.id);
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [acting, setActing] = useState<Rehearsal | null>(null);
  const t = s?.today ?? "";
  const acc = access.data;

  // Any rehearsal from the start of the semester up to today, like dues for past weeks.
  // Drive heads see everyone's rehearsals plus their own drive's extras.
  const markable = useMemo(() => {
    if (!acc || !rehearsals.data) return [];
    return rehearsals.data.filter(
      (r) => !r.isCancelled && r.heldOn <= t && (!r.drive || acc.isOfficer || acc.ledDrives.includes(r.drive)),
    );
  }, [acc, rehearsals.data, t]);

  const relevant = (r: Rehearsal) => !r.drive || acc?.isOfficer || acc?.ledDrives.includes(r.drive);
  const fallback =
    markable.filter((r) => r.heldOn === t).find((r) => r.drive && acc?.ledDrives.includes(r.drive)) ??
    markable.filter((r) => r.heldOn === t).find(relevant) ??
    markable.at(-1);
  const selectedId = params.get("r") ?? fallback?.id;
  const selected = rehearsals.data?.find((r) => r.id === selectedId);
  const upcoming = (rehearsals.data ?? []).filter((r) => r.heldOn >= t && r.heldOn <= addDays(t, 21) && relevant(r));

  return (
    <>
      <PageHeader
        title="Take Attendance"
        back={{ to: "/attendance", label: "Attendance" }}
        action={
          acc?.canTake ? (
            <button
              type="button"
              aria-label="Add a rehearsal"
              onClick={() => setAdding(true)}
              className="inline-flex size-10 items-center justify-center rounded-full text-tint-text active:bg-fill"
            >
              <CalendarPlus className="size-[1.35rem]" strokeWidth={2.2} />
            </button>
          ) : undefined
        }
      />
      {(semester.isPending || access.isPending || rehearsals.isPending) && <LoadingBlock lines={6} />}
      {rehearsals.isError && <ErrorNotice error={rehearsals.error} onRetry={() => rehearsals.refetch()} />}
      {acc && !acc.canTake && (
        <ContentUnavailable title="Not for You" description="Only officers and drive heads take attendance." />
      )}

      {acc?.canTake && rehearsals.data && (
        <>
          {markable.length > 1 && (
            <div className="mb-4">
              <SelectField
                label="Rehearsal"
                value={selectedId ?? ""}
                onChange={(e) => setParams({ r: e.target.value }, { replace: true })}
              >
                {[...markable].reverse().map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatDay(r.heldOn)}
                    {r.drive ? ` · ${r.drive}` : ""}
                    {r.title ? ` · ${r.title}` : ""}
                  </option>
                ))}
              </SelectField>
            </div>
          )}
          {selected && markable.some((r) => r.id === selected.id) ? (
            <Roll key={selected.id} rehearsal={selected} myDrives={[...new Set([...acc.ledDrives, ...acc.myDrives])]} />
          ) : (
            <ContentUnavailable
              title="Nothing to Mark Yet"
              description="Rehearsals from the start of the semester up to today appear here. Add one if a rehearsal is happening."
            />
          )}

          <ListSection header="Coming Up" footer="Tap a rehearsal to cancel it. Officers cancel any; drive heads their own drive's extra rehearsals.">
            {upcoming.map((r) => (
              <ListRow
                key={r.id}
                title={formatDay(r.heldOn)}
                subtitle={[r.title || (r.kind === "extra" ? "Extra rehearsal" : "Rehearsal"), r.drive ?? "Everyone", r.startsAt]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={r.isCancelled ? "Cancelled" : undefined}
                onClick={() => setActing(r)}
              />
            ))}
            {upcoming.length === 0 && (
              <ListItem>
                <p className="text-center text-subhead text-label-2">Nothing in the next three weeks.</p>
              </ListItem>
            )}
          </ListSection>

          <AddRehearsalSheet
            open={adding}
            onClose={() => setAdding(false)}
            today={t}
            drives={acc.isOfficer ? [...new Set([...acc.myDrives, ...acc.ledDrives, ...driveNames(rehearsals.data)])].sort() : acc.ledDrives}
            isOfficer={acc.isOfficer}
          />
          <RehearsalActionSheet
            rehearsal={acting}
            onClose={() => setActing(null)}
            canChange={Boolean(
              acting && (acc.isOfficer || (acting.kind === "extra" && acting.drive && acc.ledDrives.includes(acting.drive))),
            )}
          />
        </>
      )}
    </>
  );
}

function driveNames(rs: Rehearsal[]) {
  return rs.map((r) => r.drive).filter((d): d is string => Boolean(d));
}

function Roll({ rehearsal, myDrives }: { rehearsal: Rehearsal; myDrives: string[] }) {
  const roll = useRollCall(rehearsal.id);
  const save = useApiMutation(markAttendance);
  const decide = useApiMutation(decideExcuse);
  const flash = useFlash();
  const online = useOnlineStatus();
  const [draft, setDraft] = useState<Map<string, AttendanceStatus | null>>(
    () => new Map(pendingFor(rehearsal.id).map((m) => [m.memberId, m.status])),
  );
  const [filter, setFilter] = useState<Filter>(rehearsal.drive || myDrives.length ? "mine" : "all");
  const [query, setQuery] = useState("");
  const forDrive = rehearsal.drive ? [rehearsal.drive] : myDrives;

  useEffect(() => {
    if (roll.data && !roll.data.some((r) => forDrive.some((d) => r.drives.includes(d)))) setFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll.data]);

  if (roll.isPending) return <LoadingBlock lines={6} />;
  if (roll.isError) return <ErrorNotice error={roll.error} onRetry={() => roll.refetch()} />;

  const people = roll.data ?? [];
  const statusOf = (id: string, server: AttendanceStatus | null) => (draft.has(id) ? draft.get(id)! : server);
  const q = query.trim().toLowerCase();
  const shown = people.filter(
    (p) =>
      (filter === "all" || forDrive.some((d) => p.drives.includes(d))) &&
      (!q || p.fullName.toLowerCase().includes(q) || p.memberCode.toLowerCase().includes(q)),
  );
  const counts = { present: 0, excused: 0, absent: 0, none: 0 };
  for (const p of people) {
    const st = statusOf(p.memberId, p.status);
    counts[st ?? "none"] += 1;
  }
  const changes = people
    .filter((p) => draft.has(p.memberId) && draft.get(p.memberId) !== p.status)
    .map((p) => ({ memberId: p.memberId, status: draft.get(p.memberId) ?? null }));

  function tap(id: string, server: AttendanceStatus | null) {
    setDraft((d) => new Map(d).set(id, nextStatus(statusOf(id, server))));
  }
  function restAbsent() {
    setDraft((d) => {
      const n = new Map(d);
      for (const p of shown) if (!statusOf(p.memberId, p.status)) n.set(p.memberId, "absent");
      return n;
    });
  }
  function submit() {
    if (!changes.length) return;
    if (!isOnline()) {
      enqueue({ rehearsalId: rehearsal.id, label: formatDay(rehearsal.heldOn), marks: changes, savedAt: new Date().toISOString() });
      flash("Saved on this phone. It'll be sent as soon as you're back online.", "info");
      return;
    }
    save.mutate([rehearsal.id, changes], {
      onSuccess: (r) => {
        setDraft(new Map());
        flash(`Saved: ${r.present} present, ${r.absent} absent, ${r.excused} with excuse.`, "success");
      },
    });
  }

  return (
    <>
      <div className="mb-3 flex gap-2">
        {(forDrive.length ? (["mine", "all"] as Filter[]) : (["all"] as Filter[])).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cx(
              "min-h-9 rounded-full px-3.5 text-subhead font-semibold",
              filter === f ? "bg-tint text-on-tint" : "bg-fill text-label",
            )}
          >
            {f === "all" ? "Everyone" : forDrive.length === 1 ? forDrive[0] : "My Drives"}
          </button>
        ))}
      </div>
      <div className="mb-3">
        <SearchField value={query} onChange={setQuery} placeholder="Search by name or ID" label="Search the roll" />
      </div>
      <p className="mb-2 px-1 text-footnote text-label-2">
        Tap a name to mark: Present → Absent → Absent with excuse → clear.
      </p>

      <ListSection
        header={formatDay(rehearsal.heldOn)}
        aside={<span className="text-subhead text-label-2 tnum">{shown.length}</span>}
      >
        {shown.map((p) => {
          const st = statusOf(p.memberId, p.status);
          const pendingExcuse = p.excuse?.status === "pending";
          return (
            <li key={p.memberId} className="list-row">
              <button
                type="button"
                onClick={() => tap(p.memberId, p.status)}
                className="flex w-full items-center gap-3 pl-4 text-left active:bg-highlight"
              >
                <Avatar name={p.fullName} size="sm" />
                <span className="row-content flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body">{p.fullName}</span>
                    <span className="block truncate text-footnote text-label-2">
                      {p.memberCode} · {p.drives.join(", ") || "No drive"}
                    </span>
                    {p.excuse && (
                      <span className="block text-footnote text-ahead-text">
                        Excuse ({p.excuse.status}): {p.excuse.reason}
                      </span>
                    )}
                    {p.markedByName && !draft.has(p.memberId) && (
                      <span className="block text-caption text-label-3">Marked by {p.markedByName}</span>
                    )}
                  </span>
                  <StatusPill status={st} className={draft.has(p.memberId) && st !== p.status ? "ring-2 ring-tint" : undefined} />
                </span>
              </button>
              {pendingExcuse && (
                <div className="flex gap-2 px-4 pb-3 pl-[3.75rem]">
                  <Button
                    size="small"
                    variant="tinted"
                    loading={decide.isPending}
                    onClick={() => decide.mutate([rehearsal.id, p.memberId, true])}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    variant="gray"
                    loading={decide.isPending}
                    onClick={() => decide.mutate([rehearsal.id, p.memberId, false])}
                  >
                    Decline
                  </Button>
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <ListItem>
            <p className="text-center text-subhead text-label-2">No one matches.</p>
          </ListItem>
        )}
      </ListSection>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 mb-8 rounded-[1rem] bg-cell/95 p-3 shadow-[var(--shadow)] backdrop-blur md:bottom-4">
        <p className="mb-2 text-center text-footnote text-label-2 tnum">
          {counts.present} present · {counts.absent} absent · {counts.excused} with excuse · {counts.none} not marked
        </p>
        <InlineError error={save.error ?? decide.error} />
        <div className="flex gap-2">
          <Button variant="gray" size="medium" className="flex-1" onClick={restAbsent} disabled={!shown.some((p) => !statusOf(p.memberId, p.status))}>
            Rest Absent
          </Button>
          <Button
            size="medium"
            className="flex-1"
            loading={save.isPending}
            disabled={!changes.length}
            onClick={submit}
            icon={online ? <Check aria-hidden className="size-5" /> : <CloudOff aria-hidden className="size-5" />}
          >
            {online ? `Save${changes.length ? ` (${changes.length})` : ""}` : "Save on Phone"}
          </Button>
        </div>
      </div>
    </>
  );
}
