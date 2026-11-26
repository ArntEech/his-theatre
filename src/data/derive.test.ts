// The live data layer computes with derive.ts; the demo data layer has its own copy of the
// same rules. This test runs both on the same demo records and checks every number agrees.
import { describe, expect, it } from "vitest";
import * as mock from "./api.mock";
import { createSeed } from "./mock/seed";
import { cashPosition, dashboard, duesFor, report, todayReport } from "./derive";
import { localToday, addDays } from "@/lib/dates";

const t = localToday();
const s = createSeed(t);
const strip = <T,>(x: T) => JSON.parse(JSON.stringify(x)) as T;

describe("derive.ts matches the demo data layer", () => {
  it("gives the same dues for every member", async () => {
    await mock.signInMember("HIS-001", "258036");
    const semester = (await mock.getCurrentSemester())!;
    for (const m of s.members) {
      const detail = await mock.getMember(m.id);
      expect(strip(duesFor(s, m.id, semester.id, t))).toEqual(strip(detail.dues));
    }
  });

  it("gives the same cash position, today, dashboard and report", async () => {
    await mock.signInMember("HIS-001", "258036");
    const me = (await mock.getCurrentMember())!;
    const semester = (await mock.getCurrentSemester())!;
    expect(strip(cashPosition(s))).toEqual(strip(await mock.getCashPosition()));
    expect(strip(todayReport(s, me.id, t))).toEqual(strip(await mock.getToday()));
    const sem = s.semesters.find((x) => x.id === semester.id)!;
    expect(strip(dashboard(s, sem, t))).toEqual(strip(await mock.getDashboard(semester.id)));
    const from = addDays(t, -60);
    expect(strip(report(s, from, t))).toEqual(strip(await mock.getReport(from, t)));
  });
});
