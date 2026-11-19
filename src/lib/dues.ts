import type {
  Adjustment,
  DuesStatus,
  DuesSummary,
  ISODate,
  MemberSemester,
  Payment,
  Pesewas,
  SemesterWeek,
} from "@/data/types";

/**
 * The single source of truth for what a member owes.
 * Pure: same inputs, same answer. All money in pesewas.
 *
 * - A week counts when counts=true, weekNo >= startWeekNo, and the member had not left before it began.
 * - A week is due from its Monday, so the current week always counts.
 * - Credit rolls over: paying ahead is allowed and shows as "Paid ahead".
 */
export function calculateDues(
  memberSemester: MemberSemester,
  weeks: SemesterWeek[],
  rate: Pesewas,
  adjustments: Adjustment[],
  payments: Payment[],
  today: ISODate,
  leftOn: ISODate | null,
): DuesSummary {
  const counted = weeks.filter(
    (w) =>
      w.semesterId === memberSemester.semesterId &&
      w.counts &&
      w.weekNo >= memberSemester.startWeekNo &&
      (!leftOn || w.weekStart <= leftOn),
  );
  const soFar = counted.filter((w) => w.weekStart <= today);

  const adjustmentSum = adjustments
    .filter((a) => a.memberId === memberSemester.memberId && a.semesterId === memberSemester.semesterId)
    .reduce((sum, a) => sum + a.amount, 0);

  const paid = payments
    .filter((p) => p.memberId === memberSemester.memberId && p.semesterId === memberSemester.semesterId)
    .reduce((sum, p) => sum + p.amount, 0);

  const semesterTotal = Math.max(0, counted.length * rate + adjustmentSum);
  const dueSoFar = Math.max(0, soFar.length * rate + adjustmentSum);
  const owing = Math.max(0, dueSoFar - paid);
  const credit = Math.max(0, paid - dueSoFar);
  const progressPct = semesterTotal > 0 ? Math.min(100, (paid / semesterTotal) * 100) : 100;
  const weeksBehind = rate > 0 ? Math.ceil(owing / rate) : 0;

  return {
    memberId: memberSemester.memberId,
    semesterId: memberSemester.semesterId,
    weeklyRate: rate,
    weeksTotal: counted.length,
    weeksSoFar: soFar.length,
    semesterTotal,
    dueSoFar,
    paid,
    owing,
    credit,
    progressPct: Math.max(0, progressPct),
    weeksBehind,
  };
}

export function duesStatus(summary: DuesSummary): DuesStatus {
  if (summary.owing > 0) return "behind";
  if (summary.credit > 0) return "ahead";
  return "paid_up";
}

export const STATUS_LABEL: Record<DuesStatus, string> = {
  paid_up: "Paid up",
  behind: "Behind",
  ahead: "Paid ahead",
};
