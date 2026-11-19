import { describe, expect, it } from "vitest";

import type { Adjustment, MemberSemester, Payment, SemesterWeek } from "@/data/types";
import { calculateDues, duesStatus } from "./dues";

// 2026/27 Sem 1: Mondays from 9 Nov 2026, 23 & 30 Nov are Interim Assessment (do not count).
const weekStarts = [
  "2026-11-09",
  "2026-11-16",
  "2026-11-23",
  "2026-11-30",
  "2026-12-07",
  "2026-12-14",
  "2026-12-21",
  "2026-12-28",
  "2027-01-04",
];
const weeks: SemesterWeek[] = weekStarts.map((weekStart, i) => ({
  id: `w${i + 1}`,
  semesterId: "s1",
  weekNo: i + 1,
  weekStart,
  counts: weekStart !== "2026-11-23" && weekStart !== "2026-11-30",
}));

const EXEC_RATE = 1000; // GH₵10 a week
const MEMBER_RATE = 500; // GH₵5 a week

const ms = (memberId: string, startWeekNo: number, category: "member" | "executive" = "executive"): MemberSemester => ({
  memberId,
  semesterId: "s1",
  category,
  startWeekNo,
});

let n = 0;
const pay = (memberId: string, amount: number, reversesPaymentId?: string): Payment => ({
  id: `p${++n}`,
  receiptNo: `R-${String(n).padStart(4, "0")}`,
  memberId,
  semesterId: "s1",
  amount,
  method: "cash",
  paidOn: "2026-11-10",
  ...(reversesPaymentId ? { reversesPaymentId } : {}),
  idempotencyKey: `k${n}`,
  recordedBy: "fs",
  createdAt: "2026-11-10T10:00:00Z",
});

const adj = (memberId: string, amount: number): Adjustment => ({
  id: `a${++n}`,
  memberId,
  semesterId: "s1",
  amount,
  reason: "Hardship waiver",
  recordedBy: "fs",
  createdAt: "2026-11-10T10:00:00Z",
});

describe("calculateDues", () => {
  it("an on-time executive owes nothing after paying two weeks", () => {
    const s = calculateDues(ms("e1", 1), weeks, EXEC_RATE, [], [pay("e1", 2000)], "2026-11-19", null);
    expect(s.weeksTotal).toBe(7);
    expect(s.weeksSoFar).toBe(2);
    expect(s.semesterTotal).toBe(7000);
    expect(s.dueSoFar).toBe(2000);
    expect(s.owing).toBe(0);
    expect(s.credit).toBe(0);
    expect(duesStatus(s)).toBe("paid_up");
  });

  it("the current week is due from its Monday", () => {
    const s = calculateDues(ms("e1", 1), weeks, EXEC_RATE, [], [], "2026-11-16", null);
    expect(s.weeksSoFar).toBe(2);
    expect(s.dueSoFar).toBe(2000);
  });

  it("a late joiner only owes from their start week", () => {
    const s = calculateDues(ms("m1", 2, "member"), weeks, MEMBER_RATE, [], [], "2026-11-19", null);
    expect(s.weeksTotal).toBe(6);
    expect(s.weeksSoFar).toBe(1);
    expect(s.dueSoFar).toBe(500);
    expect(s.owing).toBe(500);
    expect(s.weeksBehind).toBe(1);
    expect(duesStatus(s)).toBe("behind");
  });

  it("a member who paid ahead carries credit", () => {
    const s = calculateDues(ms("e2", 1), weeks, EXEC_RATE, [], [pay("e2", 5000)], "2026-11-19", null);
    expect(s.owing).toBe(0);
    expect(s.credit).toBe(3000);
    expect(s.progressPct).toBeCloseTo((5000 / 7000) * 100);
    expect(duesStatus(s)).toBe("ahead");
  });

  it("a waiver reduces what is due", () => {
    const s = calculateDues(ms("e3", 1), weeks, EXEC_RATE, [adj("e3", -1000)], [], "2026-11-19", null);
    expect(s.dueSoFar).toBe(1000);
    expect(s.semesterTotal).toBe(6000);
    expect(s.owing).toBe(1000);
  });

  it("a reversed payment no longer counts as paid", () => {
    const original = pay("e4", 2000);
    const reversal = pay("e4", -2000, original.id);
    const s = calculateDues(ms("e4", 1), weeks, EXEC_RATE, [], [original, reversal], "2026-11-19", null);
    expect(s.paid).toBe(0);
    expect(s.owing).toBe(2000);
    expect(s.weeksBehind).toBe(2);
  });

  it("a member who left mid-semester stops owing after they left", () => {
    const s = calculateDues(ms("e5", 1), weeks, EXEC_RATE, [], [], "2026-12-20", "2026-12-10");
    // Counted: 9 Nov, 16 Nov, 7 Dec (23 & 30 Nov don't count; 14 Dec onwards is after leaving)
    expect(s.weeksTotal).toBe(3);
    expect(s.semesterTotal).toBe(3000);
    expect(s.dueSoFar).toBe(3000);
  });

  it("never reports a negative amount due", () => {
    const s = calculateDues(ms("e6", 1), weeks, EXEC_RATE, [adj("e6", -50000)], [], "2026-11-19", null);
    expect(s.dueSoFar).toBe(0);
    expect(s.semesterTotal).toBe(0);
    expect(s.progressPct).toBe(100);
  });
});
