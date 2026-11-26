import { describe, expect, it } from "vitest";
import type { Rehearsal } from "@/data/community";
import { buildDays, drivesOf, markDeadline, missedInARow, nextRehearsal, nextStatus, summarize } from "./attendance";
import { DEFAULT_ATTENDANCE_RULES as rules } from "@/data/community";

const r = (id: string, heldOn: string, extra: Partial<Rehearsal> = {}): Rehearsal => ({
  id,
  semesterId: "s",
  heldOn,
  kind: "regular",
  drive: null,
  title: "",
  startsAt: null,
  isCancelled: false,
  cancelReason: null,
  rollTaken: true,
  ...extra,
});
const w = { drives: ["Tribe of Judah"], from: "2026-11-09", until: null };
const today = "2026-11-24";

describe("attendance", () => {
  it("reads drives from the main drive and interests", () => {
    expect(drivesOf("Tribe of Judah", "Divine Pulse, Tribe of Judah ,")).toEqual(["Divine Pulse", "Tribe of Judah"]);
  });

  it("counts present; an absence with excuse doesn't count against you", () => {
    const days = buildDays(
      [r("a", "2026-11-10"), r("b", "2026-11-12"), r("c", "2026-11-17"), r("d", "2026-11-19")],
      new Map([
        ["a", { status: "present" as const, markedAt: null }],
        ["b", { status: "present" as const, markedAt: null }],
        ["c", { status: "excused" as const, markedAt: null }],
      ]),
      new Map(),
      w,
      today,
    );
    const s = summarize(days);
    expect(s.attended).toBe(2);
    expect(s.absent).toBe(1); // d: roll taken, not ticked
    expect(s.counted).toBe(3);
    expect(s.rate).toBeCloseTo(2 / 3);
    expect(s.streak).toBe(0);
    expect(s.best).toBe(2);
  });

  it("a rehearsal with no roll taken doesn't count", () => {
    const days = buildDays([r("a", "2026-11-10", { rollTaken: false })], new Map(), new Map(), w, today);
    expect(summarize(days).counted).toBe(0);
    expect(summarize(days).rate).toBeNull();
  });

  it("ignores other drives, cancelled ones and days before joining", () => {
    const days = buildDays(
      [
        r("a", "2026-11-03"),
        r("b", "2026-11-10", { drive: "Divine Pulse", kind: "extra" }),
        r("c", "2026-11-12", { isCancelled: true }),
        r("d", "2026-11-17"),
      ],
      new Map([["d", { status: "present" as const, markedAt: null }]]),
      new Map(),
      w,
      today,
    );
    const s = summarize(days);
    expect(s.counted).toBe(1);
    expect(s.streak).toBe(1);
  });

  it("excused doesn't break a streak; absences in a row are counted", () => {
    const marks = new Map([
      ["a", { status: "present" as const, markedAt: null }],
      ["b", { status: "excused" as const, markedAt: null }],
      ["c", { status: "present" as const, markedAt: null }],
    ]);
    const days = buildDays([r("a", "2026-11-10"), r("b", "2026-11-12"), r("c", "2026-11-17")], marks, new Map(), w, today);
    expect(summarize(days).streak).toBe(2);
    const missed = buildDays([r("a", "2026-11-10"), r("b", "2026-11-12"), r("c", "2026-11-17")], new Map(), new Map(), w, today);
    expect(missedInARow(missed)).toBe(3);
  });

  it("finds the next rehearsal and cycles marks", () => {
    const days = buildDays([r("a", "2026-11-17"), r("b", "2026-11-26", { rollTaken: false })], new Map(), new Map(), w, today);
    expect(nextRehearsal(days)?.id).toBe("b");
    expect(nextStatus(null)).toBe("present");
    expect(nextStatus("present")).toBe("absent");
    expect(nextStatus("absent")).toBe("excused");
    expect(nextStatus("excused")).toBeNull();
  });

  it("gives drive heads 3 days, officers 7, the Director no deadline, and a catch-up for old weeks", () => {
    expect(markDeadline("2026-12-01", { isDirector: false, isOfficer: false, rules })).toBe("2026-12-04");
    expect(markDeadline("2026-12-01", { isDirector: false, isOfficer: true, rules })).toBe("2026-12-08");
    expect(markDeadline("2026-12-01", { isDirector: true, isOfficer: true, rules })).toBeNull();
    expect(markDeadline("2026-11-10", { isDirector: false, isOfficer: false, rules })).toBe("2026-12-06");
  });
});
