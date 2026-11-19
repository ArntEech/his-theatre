import type { ISODate, MemberSemester, Pesewas, SemesterWeek } from "@/data/types";

export type WeekState = "covered" | "part" | "unpaid" | "upcoming" | "no_dues" | "not_joined" | "after_leaving";

export interface WeekRow {
  week: SemesterWeek;
  state: WeekState;
  coveredAmount: Pesewas;
}

/**
 * Display-only: spreads what a member has paid across their counted weeks in order,
 * so they can see which weeks are covered. The official numbers always come from calculateDues.
 */
export function weekRows(
  weeks: SemesterWeek[],
  membership: MemberSemester | null,
  rate: Pesewas,
  paid: Pesewas,
  today: ISODate,
  leftOn: ISODate | null,
): WeekRow[] {
  let remaining = Math.max(0, paid);
  return weeks.map((week) => {
    if (!week.counts) return { week, state: "no_dues", coveredAmount: 0 };
    if (!membership || week.weekNo < membership.startWeekNo) return { week, state: "not_joined", coveredAmount: 0 };
    if (leftOn && week.weekStart > leftOn) return { week, state: "after_leaving", coveredAmount: 0 };
    const covered = Math.min(rate, remaining);
    remaining -= covered;
    if (covered >= rate) return { week, state: "covered", coveredAmount: covered };
    if (week.weekStart > today) return { week, state: covered > 0 ? "part" : "upcoming", coveredAmount: covered };
    return { week, state: covered > 0 ? "part" : "unpaid", coveredAmount: covered };
  });
}
