/**
 * Attendance maths, shared by the live and demo data so both give the same answers.
 * Pure functions: no dates from the clock, no data access.
 */
import type {
  AttendanceAccess,
  AttendanceStatus,
  AttendanceSummary,
  ExcuseRequest,
  Rehearsal,
  RehearsalDay,
} from "@/data/community";
import type { IsoDate, IsoDateTime } from "@/data/types";
import { addDays } from "@/lib/dates";

export interface MemberWindow {
  /** The drives they belong to. */
  drives: string[];
  /** First day they're expected (Monday of their start week). */
  from: IsoDate | null;
  /** Their last day, if they left. */
  until: IsoDate | null;
}

export interface OwnMark {
  status: AttendanceStatus;
  markedAt: IsoDateTime | null;
}

/** Their main drive plus the drives listed as interests ("A, B"). */
export function drivesOf(drive: string, interests: string): string[] {
  const all = [drive, ...interests.split(",")].map((d) => d.trim()).filter(Boolean);
  return [...new Set(all)].sort();
}

export function isForMember(r: Rehearsal, w: MemberWindow): boolean {
  if (r.isCancelled) return false;
  if (r.drive && !w.drives.includes(r.drive)) return false;
  if (w.from && r.heldOn < w.from) return false;
  if (w.until && r.heldOn > w.until) return false;
  return true;
}

export function buildDays(
  rehearsals: Rehearsal[],
  marks: Map<string, OwnMark>,
  excuses: Map<string, ExcuseRequest>,
  w: MemberWindow,
  today: IsoDate,
): RehearsalDay[] {
  return [...rehearsals]
    .sort((a, b) => a.heldOn.localeCompare(b.heldOn) || (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    .map((r) => {
      const mark = marks.get(r.id) ?? null;
      const when: RehearsalDay["when"] = r.heldOn > today ? "upcoming" : r.heldOn === today ? "today" : "past";
      const forMe = isForMember(r, w) || Boolean(mark);
      let status: AttendanceStatus | null = mark?.status ?? null;
      // Past rehearsal, roll taken, no tick: they weren't there.
      if (!status && forMe && !r.isCancelled && when === "past" && r.rollTaken) status = "absent";
      return { ...r, status, when, forMe, excuse: excuses.get(r.id) ?? null, markedAt: mark?.markedAt ?? null };
    });
}

export function summarize(days: RehearsalDay[]): AttendanceSummary {
  const counts = { present: 0, excused: 0, absent: 0 };
  const sequence: AttendanceStatus[] = [];
  for (const d of days) {
    if (!d.forMe || d.isCancelled || !d.status || d.when === "upcoming") continue;
    counts[d.status] += 1;
    sequence.push(d.status);
  }
  const attended = counts.present;
  const counted = attended + counts.absent;
  let best = 0;
  let run = 0;
  for (const s of sequence) {
    if (s === "excused") continue;
    run = s === "absent" ? 0 : run + 1;
    best = Math.max(best, run);
  }
  let streak = 0;
  for (let i = sequence.length - 1; i >= 0; i--) {
    const s = sequence[i];
    if (s === "excused") continue;
    if (s === "absent") break;
    streak += 1;
  }
  return { attended, ...counts, counted, rate: counted ? attended / counted : null, streak, best };
}

/** Absences in a row, counting back from the latest rehearsal that counts. */
export function missedInARow(days: RehearsalDay[]): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (!d.forMe || d.isCancelled || !d.status || d.when === "upcoming" || d.status === "excused") continue;
    if (d.status !== "absent") break;
    n += 1;
  }
  return n;
}

export function nextRehearsal(days: RehearsalDay[]): RehearsalDay | null {
  return days.find((d) => d.forMe && !d.isCancelled && d.when !== "past") ?? null;
}

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  excused: "Absent with excuse",
};

/** Tap order on the roll call: nothing → present → absent → absent with excuse → nothing. */
export function nextStatus(s: AttendanceStatus | null): AttendanceStatus | null {
  const order: (AttendanceStatus | null)[] = [null, "present", "absent", "excused"];
  return order[(order.indexOf(s) + 1) % order.length];
}

export function percent(rate: number | null): string {
  return rate === null ? "–" : `${Math.round(rate * 100)}%`;
}

/**
 * Last day this person may mark a rehearsal: drive heads 3 days after, officers 7, the Director
 * until the semester closes (null). Rehearsals before the launch stay open until the catch-up date.
 */
export function markDeadline(heldOn: IsoDate, access: Pick<AttendanceAccess, "isDirector" | "isOfficer" | "rules">): IsoDate | null {
  if (access.isDirector) return null;
  const { rules } = access;
  let d = addDays(heldOn, access.isOfficer ? rules.officerDays : rules.headDays);
  if (rules.catchUpBefore && rules.catchUpUntil && heldOn < rules.catchUpBefore && rules.catchUpUntil > d) d = rules.catchUpUntil;
  return d;
}
