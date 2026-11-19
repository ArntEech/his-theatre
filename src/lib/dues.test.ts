import { describe, expect, it } from "vitest";
import { buildSchedule, calculateDues, duesStatus, nextDueWeek } from "./dues";
import type { Adjustment, DuesRate, MemberSemester, Payment, SemesterWeek } from "@/data/types";

const SEM = "sem-1";

// 2026/27 Sem 1: nine Mondays from 9 Nov 2026; 23 Nov and 30 Nov are Interim Assessment (do not count).
const weeks: SemesterWeek[] = [
  "2026-11-09",
  "2026-11-16",
  "2026-11-23",
  "2026-11-30",
  "2026-12-07",
  "2026-12-14",
  "2026-12-21",
  "2026-12-28",
  "2027-01-04",
].map((weekStart, i) => ({
  id: `w${i + 1}`,
  semesterId: SEM,
  weekNo: i + 1,
  weekStart,
  counts: weekStart !== "2026-11-23" && weekStart !== "2026-11-30",
  label:
    weekStart === "2026-11-23" || weekStart === "2026-11-30" ? "Interim Assessment" : undefined,
}));

const execRate: DuesRate = { semesterId: SEM, category: "executive", weeklyAmount: 1000 };
const memberRate: DuesRate = { semesterId: SEM, category: "member", weeklyAmount: 500 };

function ms(
  memberId: string,
  category: "member" | "executive",
  startWeekNo: number,
): MemberSemester {
  return { memberId, semesterId: SEM, category, startWeekNo };
}

let seq = 0;
function pay(memberId: string, amount: number, extra: Partial<Payment> = {}): Payment {
  seq += 1;
  return {
    id: `p${seq}`,
    receiptNo: `R-${String(seq).padStart(4, "0")}`,
    memberId,
    semesterId: SEM,
    amount,
    method: "cash",
    paidOn: "2026-11-10",
    idempotencyKey: `k${seq}`,
    recordedBy: "m2",
    createdAt: "2026-11-10T10:00:00.000Z",
    ...extra,
  };
}

function adj(memberId: string, amount: number): Adjustment {
  return {
    id: `a-${memberId}`,
    memberId,
    semesterId: SEM,
    amount,
    reason: "Hardship waiver",
    recordedBy: "m1",
    createdAt: "2026-11-10T10:00:00.000Z",
  };
}

describe("calculateDues", () => {
  it("on-time executive: owes nothing after paying every counted week so far", () => {
    // Tue 15 Dec: counted weeks so far are 9 Nov, 16 Nov, 7 Dec, 14 Dec (the current week counts).
    const summary = calculateDues(
      ms("e1", "executive", 1),
      weeks,
      execRate,
      [],
      [pay("e1", 4000)],
      "2026-12-15",
      null,
    );
    expect(summary.weeksTotal).toBe(7);
    expect(summary.weeksSoFar).toBe(4);
    expect(summary.semesterTotal).toBe(7000);
    expect(summary.dueSoFar).toBe(4000);
    expect(summary.paid).toBe(4000);
    expect(summary.owing).toBe(0);
    expect(summary.credit).toBe(0);
    expect(summary.weeksBehind).toBe(0);
    expect(summary.progressPct).toBeCloseTo((4000 / 7000) * 100);
    expect(duesStatus(summary)).toBe("paid_up");
  });

  it("counts the current week from its Monday", () => {
    const monday = calculateDues(
      ms("e1", "executive", 1),
      weeks,
      execRate,
      [],
      [],
      "2026-12-07",
      null,
    );
    const sunday = calculateDues(
      ms("e1", "executive", 1),
      weeks,
      execRate,
      [],
      [],
      "2026-12-06",
      null,
    );
    expect(monday.weeksSoFar).toBe(3);
    expect(sunday.weeksSoFar).toBe(2);
  });

  it("late joiner: weeks before their start week are not charged", () => {
    // Member starting week 6 (14 Dec): counted weeks 6, 7, 8, 9.
    const summary = calculateDues(
      ms("m9", "member", 6),
      weeks,
      memberRate,
      [],
      [],
      "2026-12-22",
      null,
    );
    expect(summary.weeksTotal).toBe(4);
    expect(summary.weeksSoFar).toBe(2);
    expect(summary.semesterTotal).toBe(2000);
    expect(summary.dueSoFar).toBe(1000);
    expect(summary.owing).toBe(1000);
    expect(summary.weeksBehind).toBe(2);
    expect(duesStatus(summary)).toBe("behind");
  });

  it("paid ahead: extra money becomes credit that rolls forward", () => {
    // Member starts week 2: counted weeks 2,5,6,7,8,9 = 6 weeks = GH₵30. By 19 Nov only week 2 is due.
    const summary = calculateDues(
      ms("m1", "member", 2),
      weeks,
      memberRate,
      [],
      [pay("m1", 2000)],
      "2026-11-19",
      null,
    );
    expect(summary.semesterTotal).toBe(3000);
    expect(summary.dueSoFar).toBe(500);
    expect(summary.owing).toBe(0);
    expect(summary.credit).toBe(1500);
    expect(summary.progressPct).toBeCloseTo((2000 / 3000) * 100);
    expect(duesStatus(summary)).toBe("ahead");
  });

  it("waiver: a negative adjustment lowers what is due and never goes below zero", () => {
    const summary = calculateDues(
      ms("m2", "member", 2),
      weeks,
      memberRate,
      [adj("m2", -1500)],
      [],
      "2026-12-08",
      null,
    );
    // Due so far would be weeks 2 and 5 = GH₵10, minus GH₵15 waiver -> 0.
    expect(summary.dueSoFar).toBe(0);
    expect(summary.semesterTotal).toBe(1500);
    expect(summary.owing).toBe(0);
    expect(summary.credit).toBe(0);
    expect(duesStatus(summary)).toBe("paid_up");

    const fullWaiver = calculateDues(
      ms("m2", "member", 2),
      weeks,
      memberRate,
      [adj("m2", -9999)],
      [],
      "2026-12-08",
      null,
    );
    expect(fullWaiver.semesterTotal).toBe(0);
    expect(fullWaiver.progressPct).toBe(100);
  });

  it("reversed payment: the negative reversal cancels the original", () => {
    const original = pay("m3", 1000);
    const reversal = pay("m3", -1000, {
      reversesPaymentId: original.id,
      note: "Recorded against the wrong member",
    });
    const summary = calculateDues(
      ms("m3", "member", 2),
      weeks,
      memberRate,
      [],
      [original, reversal],
      "2026-12-08",
      null,
    );
    expect(summary.paid).toBe(0);
    expect(summary.dueSoFar).toBe(1000);
    expect(summary.owing).toBe(1000);
    expect(summary.weeksBehind).toBe(2);
    expect(summary.progressPct).toBe(0);
  });

  it("member who left mid-semester: weeks after leaving are not charged", () => {
    // Left on Wed 9 Dec: counted weeks 2 (16 Nov) and 5 (7 Dec). Weeks from 14 Dec are not charged.
    const summary = calculateDues(
      ms("m4", "member", 2),
      weeks,
      memberRate,
      [],
      [pay("m4", 500)],
      "2027-01-10",
      "2026-12-09",
    );
    expect(summary.weeksTotal).toBe(2);
    expect(summary.weeksSoFar).toBe(2);
    expect(summary.semesterTotal).toBe(1000);
    expect(summary.dueSoFar).toBe(1000);
    expect(summary.owing).toBe(500);
    expect(summary.weeksBehind).toBe(1);
  });

  it("ignores payments and adjustments for other members or semesters", () => {
    const summary = calculateDues(
      ms("e2", "executive", 1),
      weeks,
      execRate,
      [adj("someone-else", -5000)],
      [pay("someone-else", 9000), pay("e2", 1000, { semesterId: "other" })],
      "2026-11-10",
      null,
    );
    expect(summary.paid).toBe(0);
    expect(summary.owing).toBe(1000);
  });
});

describe("buildSchedule", () => {
  it("marks weeks paid in order, skips non-counting weeks and shows what is next", () => {
    const memberSemester = ms("m1", "member", 2);
    const summary = calculateDues(
      memberSemester,
      weeks,
      memberRate,
      [],
      [pay("m1", 1250)],
      "2026-12-08",
      null,
    );
    const schedule = buildSchedule(memberSemester, weeks, summary, 0, "2026-12-08", null);
    expect(schedule.map((w) => w.state)).toEqual([
      "not_applicable", // week 1: members start week 2
      "covered",
      "not_counted",
      "not_counted",
      "covered",
      "part_paid", // GH₵2.50 of week 6 is paid
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(nextDueWeek(schedule, "2026-12-08")).toEqual({ weekStart: "2026-12-14", amount: 500 });
  });

  it("shows weeks covered by a waiver as waived, after weeks covered by payments", () => {
    const memberSemester = ms("m2", "member", 2);
    const adjustments = [adj("m2", -1000)];
    const summary = calculateDues(
      memberSemester,
      weeks,
      memberRate,
      adjustments,
      [pay("m2", 500)],
      "2026-12-08",
      null,
    );
    const schedule = buildSchedule(memberSemester, weeks, summary, -1000, "2026-12-08", null);
    const counted = schedule.filter(
      (w) => w.state !== "not_counted" && w.state !== "not_applicable",
    );
    expect(counted.map((w) => w.state)).toEqual([
      "covered",
      "waived",
      "waived",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("flags due weeks that are not covered as owing", () => {
    const memberSemester = ms("e1", "executive", 1);
    const summary = calculateDues(memberSemester, weeks, execRate, [], [], "2026-11-17", null);
    const schedule = buildSchedule(memberSemester, weeks, summary, 0, "2026-11-17", null);
    expect(schedule.slice(0, 2).map((w) => w.state)).toEqual(["owing", "owing"]);
    expect(schedule[4].state).toBe("upcoming");
  });
});
