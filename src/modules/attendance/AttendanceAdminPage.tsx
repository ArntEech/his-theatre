import { useMemo, useState } from "react";
import { CalendarPlus, ClipboardCheck, Crown } from "lucide-react";
import { decideExcuse, setDriveHead } from "@/data/api";
import {
  useApiMutation,
  useAttendanceOverview,
  useCurrentMember,
  useCurrentSemester,
  useDriveHeads,
  useDrives,
  useMembers,
  useRehearsals,
} from "@/data/queries";
import type { Rehearsal } from "@/data/community";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { SelectField } from "@/components/Field";
import { IconTile, ListItem, ListRow, ListSection } from "@/components/List";
import { Sheet } from "@/components/Sheet";
import { useFlash } from "@/components/Flash";
import { ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { addDays, formatDay } from "@/lib/dates";
import { percent } from "@/lib/attendance";
import { AddRehearsalSheet, RehearsalActionSheet } from "./RehearsalSheets";

/** Officers: everyone's attendance, excuse requests, rehearsals and drive heads. */
export function AttendanceAdminPage() {
  const semester = useCurrentSemester();
  const s = semester.data;
  const overview = useAttendanceOverview(s?.id);
  const rehearsals = useRehearsals(s?.id);
  const drives = useDrives();
  const { data: me } = useCurrentMember();
  const director = me?.role === "super_admin";
  const decide = useApiMutation(decideExcuse);
  const [drive, setDrive] = useState("");
  const [adding, setAdding] = useState(false);
  const [acting, setActing] = useState<Rehearsal | null>(null);
  const [heads, setHeads] = useState(false);
  const t = s?.today ?? "";
  const o = overview.data;

  const rows = useMemo(
    () =>
      (o?.rows ?? [])
        .filter((r) => !drive || r.drive === drive)
        .sort((a, b) => (a.summary.rate ?? 2) - (b.summary.rate ?? 2) || a.fullName.localeCompare(b.fullName)),
    [o, drive],
  );
  const missing = (o?.rows ?? []).filter((r) => r.missedInARow >= 3).sort((a, b) => b.missedInARow - a.missedInARow);
  const upcoming = (rehearsals.data ?? []).filter((r) => r.heldOn >= t && r.heldOn <= addDays(t, 28));

  return (
    <>
      <PageHeader title="Attendance" overline={s?.name} back={{ to: "/admin", label: "Admin" }} />
      {overview.isError && <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />}
      {overview.isPending && <LoadingBlock lines={6} />}

      <ListSection>
        <ListRow leading={<IconTile icon={ClipboardCheck} color="gold" />} title="Take Attendance" to="/attendance/take" />
        <ListRow leading={<IconTile icon={CalendarPlus} color="blue" />} title="Add a Rehearsal" onClick={() => setAdding(true)} />
        <ListRow
          leading={<IconTile icon={Crown} color="charcoal" />}
          title="Drive Heads"
          subtitle={director ? "Choose who takes attendance for each drive" : "Who leads each drive"}
          onClick={() => setHeads(true)}
        />
      </ListSection>

      {o && o.pending.length > 0 && (
        <ListSection header="Asking to Be Excused">
          {o.pending.map((p) => (
            <li key={`${p.rehearsalId}-${p.memberId}`} className="list-row">
              <div className="row-content mx-4 py-3">
                <p className="text-body">
                  {p.fullName} <span className="text-label-2">· {formatDay(p.heldOn)}</span>
                </p>
                <p className="text-subhead text-label-2">{p.reason}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="small" variant="tinted" loading={decide.isPending} onClick={() => decide.mutate([p.rehearsalId, p.memberId, true])}>
                    Approve
                  </Button>
                  <Button size="small" variant="gray" loading={decide.isPending} onClick={() => decide.mutate([p.rehearsalId, p.memberId, false])}>
                    Decline
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ListSection>
      )}
      <InlineError error={decide.error} />

      {missing.length > 0 && (
        <ListSection header="Missing a Lot" footer="Three or more rehearsals missed in a row. Someone could check in on them.">
          {missing.map((r) => (
            <ListRow
              key={r.memberId}
              leading={<Avatar name={r.fullName} size="sm" />}
              title={r.fullName}
              subtitle={`${r.memberCode} · ${r.drive}`}
              trailing={<span className="text-behind-text tnum">{r.missedInARow} missed</span>}
              to={`/admin/members/${r.memberId}`}
            />
          ))}
        </ListSection>
      )}

      {o && (
        <ListSection
          header="Everyone"
          aside={
            <div className="w-44">
              <SelectField label="Drive" value={drive} onChange={(e) => setDrive(e.target.value)}>
                <option value="">All Drives</option>
                {(drives.data ?? []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </SelectField>
            </div>
          }
          footer="Lowest attendance first. Excused rehearsals don't count against anyone."
        >
          {rows.map((r) => (
            <ListRow
              key={r.memberId}
              leading={<Avatar name={r.fullName} size="sm" />}
              title={r.fullName}
              subtitle={`${r.summary.attended} of ${r.summary.counted} · ${r.summary.late} late · ${r.summary.excused} excused`}
              trailing={<span className="font-semibold tnum text-label">{percent(r.summary.rate)}</span>}
              to={`/admin/members/${r.memberId}`}
            />
          ))}
        </ListSection>
      )}

      <ListSection header="Coming Up" footer="Tap a rehearsal to cancel or restore it.">
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
            <p className="text-center text-subhead text-label-2">No rehearsals in the next four weeks.</p>
          </ListItem>
        )}
      </ListSection>

      <AddRehearsalSheet open={adding} onClose={() => setAdding(false)} today={t} drives={drives.data ?? []} isOfficer />
      <RehearsalActionSheet rehearsal={acting} onClose={() => setActing(null)} canChange />
      <DriveHeadsSheet open={heads} onClose={() => setHeads(false)} canEdit={director} drives={drives.data ?? []} />
    </>
  );
}

function DriveHeadsSheet({
  open,
  onClose,
  canEdit,
  drives,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  drives: string[];
}) {
  const heads = useDriveHeads();
  const members = useMembers({});
  const change = useApiMutation(setDriveHead);
  const flash = useFlash();
  const [drive, setDrive] = useState("");
  const [memberId, setMemberId] = useState("");
  const list = heads.data ?? [];
  return (
    <Sheet open={open} onClose={() => { change.reset(); onClose(); }} title="Drive Heads">
      <div className="flex flex-col gap-4">
        <p className="px-1 text-subhead text-label-2">
          Drive heads take attendance on the day and post News to their drive. It gives no money powers.
        </p>
        {drives.map((d) => (
          <section key={d}>
            <h3 className="mb-1.5 px-1 text-subhead font-semibold">{d}</h3>
            <ul className="overflow-hidden rounded-[0.75rem] bg-cell">
              {list.filter((h) => h.drive === d).map((h) => (
                <ListRow
                  key={h.memberId}
                  leading={<Avatar name={h.fullName} size="sm" />}
                  title={h.fullName}
                  trailing={
                    canEdit ? (
                      <button
                        type="button"
                        className="text-subhead font-semibold text-destructive"
                        onClick={() =>
                          change.mutate([h.memberId, d, false], { onSuccess: () => flash(`${h.fullName} is no longer head of ${d}.`, "success") })
                        }
                      >
                        Remove
                      </button>
                    ) : undefined
                  }
                />
              ))}
              {!list.some((h) => h.drive === d) && (
                <ListItem>
                  <p className="text-subhead text-label-2">No head yet.</p>
                </ListItem>
              )}
            </ul>
          </section>
        ))}
        {canEdit && (
          <section className="flex flex-col gap-3 rounded-[0.75rem] bg-cell p-4">
            <h3 className="text-headline font-semibold">Add a Drive Head</h3>
            <SelectField label="Drive" value={drive} onChange={(e) => setDrive(e.target.value)}>
              <option value="">Choose a drive</option>
              {drives.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectField>
            <SelectField label="Member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Choose a member</option>
              {(members.data ?? [])
                .map((x) => x.member)
                .filter((m) => m.isActive)
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberCode})
                  </option>
                ))}
            </SelectField>
            <InlineError error={change.error} />
            <Button
              block
              disabled={!drive || !memberId}
              loading={change.isPending}
              onClick={() =>
                change.mutate([memberId, drive, true], {
                  onSuccess: () => {
                    flash("Drive head added.", "success");
                    setMemberId("");
                  },
                })
              }
            >
              Add
            </Button>
          </section>
        )}
      </div>
    </Sheet>
  );
}
