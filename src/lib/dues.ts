import type {
  Adjustment,
  DuesRate,
  DuesStatus,
  DuesSummary,
  IsoDate,
  MemberSemester,
  Payment,
  Pesewas,
  ScheduleWeek,
  SemesterWeek,
} from "@/data/types";

/** Weeks that count towards this member's dues (ISO date strings compare correctly). */
export function countedWeeks(
  memberSemester: MemberSemester,
  weeks: SemesterWeek[],
  leftOn: IsoDate | null,
): SemesterWeek[] {
  return weeks
    .filter(
      (w) =>
        w.semesterId === memberSemester.semesterId &&
        w.counts &&
        w.weekNo >= memberSemester.startWeekNo &&
        (leftOn === null || w.weekStart <= leftOn),
    )
    .sort((a, b) => a.weekNo - b.weekNo);
}

/**
 * The single source of truth for a member's dues in a semester.
 * Pure: no dates are read from the clock; `today` is passed in.
 * A week is due from its Monday, so the current week always counts.
 */
export function calculateDues(
  memberSemester: MemberSemester,
  weeks: SemesterWeek[],
  rate: DuesRate,
  adjustments: Adjustment[],
  payments: Payment[],
  today: IsoDate,
  leftOn: IsoDate | null,
): DuesSummary {
  const { memberId, semesterId } = memberSemester;
  const weeklyRate = rate.weeklyAmount;
  const counted = countedWeeks(memberSemester, weeks, leftOn);
  const soFar = counted.filter((w) => w.weekStart <= today);

  const adjustmentTotal = adjustments
    .filter((a) => a.memberId === memberId && a.semesterId === semesterId)
    .reduce((sum, a) => sum + a.amount, 0);
  // Reversals are stored as negative payments, so a plain sum nets them out.
  const paid = payments
    .filter((p) => p.memberId === memberId && p.semesterId === semesterId)
    .reduce((sum, p) => sum + p.amount, 0);

  const semesterTotal = Math.max(0, counted.length * weeklyRate + adjustmentTotal);
  const dueSoFar = Math.max(0, soFar.length * weeklyRate + adjustmentTotal);
  const owing = Math.max(0, dueSoFar - paid);
  const credit = Math.max(0, paid - dueSoFar);
  const progressPct = semesterTotal > 0 ? Math.min(100, (paid / semesterTotal) * 100) : 100;
  const weeksBehind = weeklyRate > 0 ? Math.ceil(owing / weeklyRate) : 0;

  return {
    memberId,
    semesterId,
    weeklyRate,
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

export function duesStatus(summary: Pick<DuesSummary, "owing" | "credit">): DuesStatus {
  if (summary.owing > 0) return "behind";
  if (summary.credit > 0) return "ahead";
  return "paid_up";
}

export const STATUS_LABELS: Record<DuesStatus, string> = {
  paid_up: "Paid up",
  behind: "Behind",
  ahead: "Paid ahead",
};

/**
 * Week-by-week view of a member's season. Payments cover counted weeks in order, then any
 * waiver covers the next weeks. Extra charges are paid off before weekly dues.
 */
export function buildSchedule(
  memberSemester: MemberSemester,
  weeks: SemesterWeek[],
  summary: DuesSummary,
  adjustmentTotal: Pesewas,
  today: IsoDate,
  leftOn: IsoDate | null,
): ScheduleWeek[] {
  const counted = new Set(countedWeeks(memberSemester, weeks, leftOn).map((w) => w.id));
  const rate = summary.weeklyRate;
  let paidPool = summary.paid - Math.max(0, adjustmentTotal);
  let waiverPool = Math.max(0, -adjustmentTotal);

  return weeks
    .filter((w) => w.semesterId === memberSemester.semesterId)
    .sort((a, b) => a.weekNo - b.weekNo)
    .map((w): ScheduleWeek => {
      const base = { weekNo: w.weekNo, weekStart: w.weekStart, label: w.label };
      if (!w.counts) return { ...base, state: "not_counted", amount: 0 };
      if (!counted.has(w.id)) return { ...base, state: "not_applicable", amount: 0 };
      const fromPaid = Math.min(rate, Math.max(0, paidPool));
      paidPool -= fromPaid;
      const fromWaiver = Math.min(rate - fromPaid, waiverPool);
      waiverPool -= fromWaiver;
      const covered = fromPaid + fromWaiver;
      const isDue = w.weekStart <= today;
      if (covered >= rate)
        return { ...base, state: fromPaid > 0 ? "covered" : "waived", amount: rate };
      if (covered > 0) return { ...base, state: "part_paid", amount: rate };
      return { ...base, state: isDue ? "owing" : "upcoming", amount: rate };
    });
}

/** The next counted week that is not yet covered and not yet due. */
export function nextDueWeek(schedule: ScheduleWeek[], today: IsoDate) {
  const next = schedule.find(
    (w) => w.weekStart > today && (w.state === "upcoming" || w.state === "part_paid"),
  );
  return next ? { weekStart: next.weekStart, amount: next.amount } : null;
}
