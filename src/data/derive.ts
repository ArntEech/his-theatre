// Turns raw records into what the screens show: dues, cash positions, today, dashboard, reports.
// Pure functions over a snapshot of records, so they give the same answer wherever they run.
// The live data layer (api.live.ts) uses these; the numbers match the demo data layer.

import { buildSchedule, calculateDues, duesStatus, nextDueWeek } from "@/lib/dues";
import { addDays } from "@/lib/dates";
import type {
  Adjustment,
  AdjustmentRow,
  CashHolder,
  CashPosition,
  Dashboard,
  DriveSummary,
  DuesRate,
  DuesStatus,
  Expense,
  ExpenseRow,
  Handover,
  HandoverRow,
  IncomeRow,
  IncomeSource,
  IsoDate,
  Member,
  MemberListItem,
  MemberSemester,
  MyDues,
  OtherIncome,
  Payment,
  PaymentRow,
  Report,
  Semester,
  SemesterDetail,
  SemesterWeek,
  TodayReport,
} from "./types";

/** Everything the signed-in person is allowed to see, loaded at one moment. */
export interface Snapshot {
  members: Member[];
  semesters: Semester[];
  weeks: SemesterWeek[];
  rates: DuesRate[];
  memberSemesters: MemberSemester[];
  adjustments: Adjustment[];
  payments: Payment[];
  expenses: Expense[];
  income: OtherIncome[];
  handovers: Handover[];
}

const isAdmin = (m: Member) => m.role === "admin" || m.role === "super_admin";
const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

export const byNewest = <T extends { createdAt: string }>(a: T, b: T) =>
  b.createdAt.localeCompare(a.createdAt);

export function memberName(s: Snapshot, id: string) {
  return s.members.find((m) => m.id === id)?.fullName ?? "Unknown";
}

export function weeksOf(s: Snapshot, semesterId: string): SemesterWeek[] {
  return s.weeks.filter((w) => w.semesterId === semesterId).sort((a, b) => a.weekNo - b.weekNo);
}

/** The running semester; else the next one; else the latest. */
export function currentSemesterRecord(s: Snapshot, today: IsoDate): Semester | null {
  const open = s.semesters
    .filter((x) => !x.isClosed)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return (
    open.find((x) => x.startsOn <= today && today <= x.endsOn) ??
    open.find((x) => x.startsOn > today) ??
    open.at(-1) ??
    [...s.semesters].sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] ??
    null
  );
}

export function semesterDetail(s: Snapshot, semester: Semester, today: IsoDate): SemesterDetail {
  const weeks = weeksOf(s, semester.id);
  const current = weeks.find((w) => w.weekStart <= today && today < addDays(w.weekStart, 7));
  return {
    ...semester,
    weeks,
    rates: s.rates.filter((r) => r.semesterId === semester.id),
    today,
    currentWeekNo: current?.weekNo ?? null,
  };
}

export function adjustmentRow(s: Snapshot, a: Adjustment): AdjustmentRow {
  return { ...a, recordedByName: memberName(s, a.recordedBy) };
}

export function paymentRow(s: Snapshot, p: Payment): PaymentRow {
  const member = s.members.find((m) => m.id === p.memberId);
  const voiding = s.payments.find((r) => r.reversesPaymentId === p.id);
  const original = p.reversesPaymentId
    ? s.payments.find((o) => o.id === p.reversesPaymentId)
    : undefined;
  return {
    ...p,
    memberName: member?.fullName ?? "Unknown",
    memberCode: member?.memberCode ?? "",
    recordedByName: memberName(s, p.recordedBy),
    voidedBy: voiding?.receiptNo ?? null,
    reversesReceiptNo: original?.receiptNo ?? null,
  };
}

export function expenseRow(s: Snapshot, e: Expense): ExpenseRow {
  const voiding = s.expenses.find((r) => r.reversesId === e.id);
  const original = e.reversesId ? s.expenses.find((o) => o.id === e.reversesId) : undefined;
  return {
    ...e,
    recordedByName: memberName(s, e.recordedBy),
    voidedBy: voiding?.ref ?? null,
    reversesRef: original?.ref ?? null,
  };
}

export function incomeRow(s: Snapshot, i: OtherIncome): IncomeRow {
  const voiding = s.income.find((r) => r.reversesId === i.id);
  const original = i.reversesId ? s.income.find((o) => o.id === i.reversesId) : undefined;
  return {
    ...i,
    recordedByName: memberName(s, i.recordedBy),
    voidedBy: voiding?.ref ?? null,
    reversesRef: original?.ref ?? null,
  };
}

export function handoverRow(s: Snapshot, h: Handover): HandoverRow {
  return { ...h, fromName: memberName(s, h.fromMemberId), toName: memberName(s, h.toMemberId) };
}

export function duesFor(
  s: Snapshot,
  memberId: string,
  semesterId: string,
  today: IsoDate,
): MyDues | null {
  const member = s.members.find((m) => m.id === memberId);
  if (!member) return null;
  const ms = s.memberSemesters.find((x) => x.memberId === memberId && x.semesterId === semesterId);
  if (!ms) return null;
  const rate = s.rates.find((r) => r.semesterId === semesterId && r.category === ms.category);
  if (!rate) return null;
  const weeks = weeksOf(s, semesterId);
  const adjustments = s.adjustments.filter(
    (a) => a.memberId === memberId && a.semesterId === semesterId,
  );
  const payments = s.payments.filter((p) => p.memberId === memberId && p.semesterId === semesterId);
  const summary = calculateDues(ms, weeks, rate, adjustments, payments, today, member.leftOn);
  const schedule = buildSchedule(ms, weeks, summary, sum(adjustments), today, member.leftOn);
  return {
    ...summary,
    status: duesStatus(summary),
    schedule,
    adjustments: adjustments.map((a) => adjustmentRow(s, a)).sort(byNewest),
    nextDue: nextDueWeek(schedule, today),
  };
}

export function listItem(
  s: Snapshot,
  member: Member,
  semesterId: string | null,
  today: IsoDate,
): MemberListItem {
  const dues = semesterId ? duesFor(s, member.id, semesterId, today) : null;
  if (!dues) return { member, dues: null, status: null };
  const { status, schedule: _s, adjustments: _a, nextDue: _n, ...summary } = dues;
  return { member, dues: summary, status };
}

/** Who is holding the group's cash right now, and what is still being handed over. */
export function cashPosition(s: Snapshot): CashPosition {
  const people = s.members.filter(
    (m) =>
      isAdmin(m) ||
      s.payments.some((p) => p.recordedBy === m.id && p.method === "cash") ||
      s.handovers.some((h) => h.toMemberId === m.id || h.fromMemberId === m.id),
  );
  const holders: CashHolder[] = people.map((m) => {
    const collected =
      sum(s.payments.filter((p) => p.recordedBy === m.id && p.method === "cash")) +
      sum(s.income.filter((i) => i.recordedBy === m.id && i.method === "cash"));
    const received = sum(s.handovers.filter((h) => h.toMemberId === m.id && h.confirmedAt));
    const handedOver = sum(s.handovers.filter((h) => h.fromMemberId === m.id));
    const spent = sum(s.expenses.filter((e) => e.recordedBy === m.id));
    return {
      memberId: m.id,
      fullName: m.fullName,
      position: m.position,
      collected,
      received,
      handedOver,
      spent,
      holding: collected + received - handedOver - spent,
    };
  });
  const duesIn = sum(s.payments);
  const incomeIn = sum(s.income);
  const totalOut = sum(s.expenses);
  const moneyIn = [...s.payments, ...s.income];
  const pending = s.handovers.filter((h) => !h.confirmedAt);
  const newestFirst = (a: HandoverRow, b: HandoverRow) => b.recordedAt.localeCompare(a.recordedAt);
  return {
    totalIn: duesIn + incomeIn,
    totalOut,
    balance: duesIn + incomeIn - totalOut,
    cashIn: sum(moneyIn.filter((x) => x.method === "cash")),
    momoIn: sum(moneyIn.filter((x) => x.method === "momo")),
    inTransit: sum(pending),
    holders: holders.sort((a, b) => b.holding - a.holding),
    pendingHandovers: pending.map((h) => handoverRow(s, h)).sort(newestFirst),
    handovers: s.handovers.map((h) => handoverRow(s, h)).sort(newestFirst),
  };
}

export function todayReport(s: Snapshot, actorId: string, today: IsoDate): TodayReport {
  const payments = s.payments.filter((p) => p.paidOn === today).sort(byNewest);
  const income = s.income.filter((i) => i.date === today).sort(byNewest);
  const expenses = s.expenses.filter((e) => e.date === today).sort(byNewest);
  const duesCash = sum(payments.filter((p) => p.method === "cash"));
  const duesMomo = sum(payments.filter((p) => p.method === "momo"));
  const incomeTotal = sum(income);
  const expensesTotal = sum(expenses);
  const position = cashPosition(s);
  return {
    date: today,
    net: duesCash + duesMomo + incomeTotal - expensesTotal,
    duesTotal: duesCash + duesMomo,
    duesCash,
    duesMomo,
    incomeTotal,
    expensesTotal,
    payments: payments.map((p) => paymentRow(s, p)),
    income: income.map((i) => incomeRow(s, i)),
    expenses: expenses.map((e) => expenseRow(s, e)),
    handovers: s.handovers
      .filter((h) => localDay(h.recordedAt) === today)
      .map((h) => handoverRow(s, h)),
    pendingHandovers: position.pendingHandovers,
    myCashHolding: position.holders.find((h) => h.memberId === actorId)?.holding ?? 0,
  };
}

export function dashboard(
  s: Snapshot,
  semester: Semester,
  today: IsoDate,
): Dashboard {
  const semesterId = semester.id;
  const rows = s.members
    .filter((m) => s.memberSemesters.some((x) => x.memberId === m.id && x.semesterId === semesterId))
    .map((m) => listItem(s, m, semesterId, today));
  const active = rows.filter((r) => r.member.isActive);
  const counts: Record<DuesStatus, number> = { paid_up: 0, behind: 0, ahead: 0 };
  for (const r of active) if (r.status) counts[r.status] += 1;
  const drives = new Map<string, DriveSummary>();
  for (const r of active) {
    const d = drives.get(r.member.drive) ?? {
      drive: r.member.drive,
      members: 0,
      paidUp: 0,
      behind: 0,
      ahead: 0,
      owing: 0,
      paid: 0,
    };
    d.members += 1;
    if (r.status === "paid_up") d.paidUp += 1;
    if (r.status === "behind") d.behind += 1;
    if (r.status === "ahead") d.ahead += 1;
    d.owing += r.dues?.owing ?? 0;
    d.paid += r.dues?.paid ?? 0;
    drives.set(r.member.drive, d);
  }
  const total = (f: (r: MemberListItem) => number) => rows.reduce((acc, r) => acc + f(r), 0);
  return {
    semester: semesterDetail(s, semester, today),
    activeMembers: active.length,
    dueSoFar: total((r) => r.dues?.dueSoFar ?? 0),
    semesterTotal: total((r) => r.dues?.semesterTotal ?? 0),
    collected: sum(s.payments.filter((p) => p.semesterId === semesterId)),
    owingTotal: total((r) => r.dues?.owing ?? 0),
    creditTotal: total((r) => r.dues?.credit ?? 0),
    counts,
    drives: [...drives.values()].sort((a, b) => a.drive.localeCompare(b.drive)),
    mostBehind: active
      .filter((r) => r.status === "behind")
      .sort((a, b) => (b.dues?.owing ?? 0) - (a.dues?.owing ?? 0))
      .slice(0, 5),
    balance: cashPosition(s).balance,
    pendingHandovers: s.handovers.filter((h) => !h.confirmedAt).length,
    collectedToday: sum(s.payments.filter((p) => p.paidOn === today)),
  };
}

export function report(s: Snapshot, from: IsoDate, to: IsoDate): Report {
  const inRange = (d: string) => from <= d && d <= to;
  const payments = s.payments.filter((p) => inRange(p.paidOn)).sort(byNewest);
  const income = s.income.filter((i) => inRange(i.date)).sort(byNewest);
  const expenses = s.expenses.filter((e) => inRange(e.date)).sort(byNewest);
  const sources = new Map<IncomeSource, number>();
  for (const i of income) sources.set(i.source, (sources.get(i.source) ?? 0) + i.amount);
  const categories = new Map<string, number>();
  for (const e of expenses) categories.set(e.category, (categories.get(e.category) ?? 0) + e.amount);
  const duesNet = sum(payments);
  const incomeTotal = sum(income);
  const expensesTotal = sum(expenses);
  return {
    from,
    to,
    dues: {
      cash: sum(payments.filter((p) => p.method === "cash" && !p.reversesPaymentId)),
      momo: sum(payments.filter((p) => p.method === "momo" && !p.reversesPaymentId)),
      reversals: sum(payments.filter((p) => p.reversesPaymentId)),
      net: duesNet,
      receipts: payments.filter((p) => !p.reversesPaymentId).length,
    },
    income: {
      bySource: [...sources].map(([source, amount]) => ({ source, amount })),
      total: incomeTotal,
    },
    expenses: {
      byCategory: [...categories].map(([category, amount]) => ({ category, amount })),
      total: expensesTotal,
    },
    totalIn: duesNet + incomeTotal,
    totalOut: expensesTotal,
    net: duesNet + incomeTotal - expensesTotal,
    payments: payments.map((p) => paymentRow(s, p)),
    incomeRows: income.map((i) => incomeRow(s, i)),
    expenseRows: expenses.map((e) => expenseRow(s, e)),
    handovers: s.handovers
      .filter((h) => inRange(localDay(h.recordedAt)))
      .map((h) => handoverRow(s, h)),
  };
}

/** The local (Ghana) calendar day of a stored timestamp. */
export function localDay(isoDateTime: string): IsoDate {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
