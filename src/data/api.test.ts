import { beforeEach, describe, expect, it } from "vitest";
import * as api from "./api";

async function signInAs(code: string) {
  await api.signInMember(code, "1234");
}

describe("mock api money rules", () => {
  beforeEach(async () => {
    await api.signOut();
  });

  it("records a payment once per idempotency key", async () => {
    await signInAs("HIS-002");
    const semester = (await api.getCurrentSemester())!;
    const input = {
      memberId: "mem-009",
      semesterId: semester.id,
      amount: 500,
      method: "cash" as const,
      paidOn: semester.today,
      idempotencyKey: "test-key-1",
    };
    const first = await api.recordPayment(input);
    const retry = await api.recordPayment(input);
    expect(retry.id).toBe(first.id);
    expect(retry.receiptNo).toBe(first.receiptNo);
  });

  it("voids by reversal and refuses to void twice", async () => {
    await signInAs("HIS-002");
    const detail = await api.getMember("mem-025");
    const original = detail.payments.find((p) => !p.reversesPaymentId && !p.voidedBy)!;
    const reversal = await api.reversePayment(original.id, "Counted twice");
    expect(reversal.amount).toBe(-original.amount);
    expect(reversal.reversesReceiptNo).toBe(original.receiptNo);
    await expect(api.reversePayment(original.id, "Again")).rejects.toThrow(/already been voided/);
    await expect(api.reversePayment(reversal.id, "Undo")).rejects.toThrow(
      /cannot itself be voided/,
    );
    const after = await api.getMember("mem-025");
    expect(after.payments.find((p) => p.id === original.id)?.voidedBy).toBe(reversal.receiptNo);
  });

  it("requires a reason to void", async () => {
    await signInAs("HIS-002");
    const detail = await api.getMember("mem-020");
    await expect(api.reversePayment(detail.payments[0].id, " ")).rejects.toThrow(/reason/i);
  });

  it("keeps members out of officer functions", async () => {
    await signInAs("HIS-010");
    await expect(api.listMembers()).rejects.toThrow("You don't have access to this page.");
    await expect(api.getToday()).rejects.toThrow("You don't have access to this page.");
    const dues = await api.getMyDues((await api.getCurrentSemester())!.id);
    expect(dues?.memberId).toBe("mem-010");
  });

  it("lets only the receiving officer confirm a handover", async () => {
    await signInAs("HIS-002");
    const pending = (await api.getCashPosition()).pendingHandovers[0];
    await expect(api.confirmHandover(pending.id)).rejects.toThrow(/Only Kofi Mensah/);
    await signInAs("HIS-003");
    const confirmed = await api.confirmHandover(pending.id);
    expect(confirmed.confirmedAt).not.toBeNull();
  });

  it("locks an account after five wrong PINs", async () => {
    for (let i = 0; i < 4; i++)
      await expect(api.signInMember("HIS-020", "0000")).rejects.toThrow(/not right/);
    await expect(api.signInMember("HIS-020", "0000")).rejects.toThrow(/locked/);
    await expect(api.signInMember("HIS-020", "1234")).rejects.toThrow(/locked/);
  });

  it("turns a no-dues week back into a normal week and charges it", async () => {
    await signInAs("HIS-001");
    const semester = (await api.getCurrentSemester())!;
    const week3 = semester.weeks.find((w) => w.weekNo === 3)!;
    expect(week3.counts).toBe(false);
    const before = (await api.getMember("mem-004")).dues!;

    const updated = await api.setWeekCounts(
      week3.id,
      true,
      "Assessment postponed, rehearsals held",
    );
    expect(updated.counts).toBe(true);
    expect(updated.label).toBe("Assessment postponed, rehearsals held");

    const after = (await api.getMember("mem-004")).dues!;
    expect(after.weeksTotal).toBe(before.weeksTotal + 1);
    expect(after.semesterTotal).toBe(before.semesterTotal + 1000);
    expect(after.schedule.find((w) => w.weekNo === 3)?.state).not.toBe("not_counted");

    // And back again, with the note cleared when none is given.
    const reverted = await api.setWeekCounts(week3.id, false, "Interim Assessment");
    expect(reverted.counts).toBe(false);
    const cleared = await api.setWeekCounts(week3.id, true, "");
    expect(cleared.label).toBeUndefined();
  });
});
