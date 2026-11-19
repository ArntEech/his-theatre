// MOCK DATA ONLY. Imported by src/data/api.ts and nothing else.
import type {
  Adjustment,
  AuditEntry,
  DuesRate,
  Expense,
  Handover,
  Member,
  MemberSemester,
  OtherIncome,
  Payment,
  Semester,
  SemesterWeek,
} from "../types";

export interface MockStore {
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
  audit: AuditEntry[];
  /** memberId -> PIN (mock only; the real server stores hashes) */
  pins: Record<string, string>;
  /** memberId -> one-time setup code */
  setupCodes: Record<string, string>;
  /** memberId -> failed PIN attempts */
  failedAttempts: Record<string, number>;
  officers: { memberId: string; email: string; password: string }[];
}

const SEM = "sem-2026-27-1";

export const DRIVES = ["Unashamed Voices", "His Redeemed Acts", "Anointed Reflections", "Tribe of Judah", "Divine Pulse"];

const people: [string, string][] = [
  ["Kwame Asante", "0244 101 001"],
  ["Abena Owusu", "0244 101 002"],
  ["Kofi Mensah", "0244 101 003"],
  ["Efua Boateng", "0244 101 004"],
  ["Yaw Darko", "0244 101 005"],
  ["Akosua Frimpong", "0244 101 006"],
  ["Kojo Appiah", "0244 101 007"],
  ["Ama Sarpong", "0244 101 008"],
  ["Nana Agyeman", "0244 101 009"],
  ["Adwoa Ofori", "0244 101 010"],
  ["Kwabena Osei", "0244 101 011"],
  ["Esi Quaye", "0244 101 012"],
  ["Fiifi Annan", "0244 101 013"],
  ["Afia Badu", "0244 101 014"],
  ["Kwesi Tetteh", "0244 101 015"],
  ["Yaa Antwi", "0244 101 016"],
  ["Selorm Kpodo", "0244 101 017"],
  ["Dzifa Amegah", "0244 101 018"],
  ["Elikem Agbeko", "0244 101 019"],
  ["Naa Adjeley", "0244 101 020"],
  ["Ekow Hammond", "0244 101 021"],
  ["Araba Mills", "0244 101 022"],
  ["Paa Kwesi Nyarko", "0244 101 023"],
  ["Maame Serwaa", "0244 101 024"],
  ["Kweku Bonsu", "0244 101 025"],
];

function code(i: number) {
  return `HIS-${String(i).padStart(3, "0")}`;
}

export function createSeed(): MockStore {
  const members: Member[] = people.map(([fullName, phone], idx) => {
    const n = idx + 1;
    const executive = n <= 5;
    return {
      id: `m-${String(n).padStart(3, "0")}`,
      memberCode: code(n),
      fullName,
      phone,
      drive: DRIVES[idx % DRIVES.length]!,
      category: executive ? "executive" : "member",
      role: n === 1 ? "super_admin" : n === 2 || n === 3 ? "admin" : "member",
      position: n === 1 ? "Director" : n === 2 ? "Financial Secretary" : n === 3 ? "Treasurer" : null,
      isActive: true,
      leftOn: null,
      isActivated: n !== 23 && n !== 24, // HIS-023 and HIS-024 have not activated yet
      isLocked: n === 25, // HIS-025 is locked out
    };
  });
  const id = (n: number) => members[n - 1]!.id;

  const semesters: Semester[] = [
    { id: SEM, name: "2026/27 Sem 1", startsOn: "2026-11-09", endsOn: "2027-01-10", isClosed: false },
  ];

  const mondays = [
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
  const weeks: SemesterWeek[] = mondays.map((weekStart, i) => {
    const interim = weekStart === "2026-11-23" || weekStart === "2026-11-30";
    return {
      id: `wk-${i + 1}`,
      semesterId: SEM,
      weekNo: i + 1,
      weekStart,
      counts: !interim,
      ...(interim ? { label: "Interim Assessment" } : {}),
    };
  });

  const rates: DuesRate[] = [
    { semesterId: SEM, category: "executive", weeklyAmount: 1000 },
    { semesterId: SEM, category: "member", weeklyAmount: 500 },
  ];

  const memberSemesters: MemberSemester[] = members.map((m) => ({
    memberId: m.id,
    semesterId: SEM,
    category: m.category,
    startWeekNo: m.category === "executive" ? 1 : 2,
  }));

  const fs = id(2);
  let r = 0;
  const payments: Payment[] = [];
  const p = (
    n: number,
    amount: number,
    method: "cash" | "momo",
    paidOn: string,
    extra: Partial<Payment> = {},
  ) => {
    r += 1;
    const payment: Payment = {
      id: `pay-${r}`,
      receiptNo: `R-${String(r).padStart(4, "0")}`,
      memberId: id(n),
      semesterId: SEM,
      amount,
      method,
      ...(method === "momo" ? { momoReference: `MP2611${String(1000 + r)}` } : {}),
      paidOn,
      idempotencyKey: `seed-${r}`,
      recordedBy: fs,
      createdAt: `${paidOn}T${String(9 + (r % 8)).padStart(2, "0")}:${String((r * 7) % 60).padStart(2, "0")}:00.000Z`,
      ...extra,
    };
    payments.push(payment);
    return payment;
  };

  // Executives (GH₵10/week, 2 weeks due by 19 Nov)
  p(1, 2000, "cash", "2026-11-10"); // Director: paid up
  p(2, 3000, "momo", "2026-11-11"); // Fin Sec: paid ahead
  p(3, 1000, "cash", "2026-11-10"); // Treasurer: behind 1 week
  p(4, 2000, "cash", "2026-11-12"); // Efua: paid up…
  const wrong = p(4, 1000, "cash", "2026-11-12", { note: "Entered twice by mistake" });
  p(4, -1000, "cash", "2026-11-12", {
    reversesPaymentId: wrong.id,
    note: "Reversal: duplicate entry",
  }); // …with one reversed payment
  // Yaw (HIS-005): nothing yet — behind 2 weeks

  // Members (GH₵5/week, 1 week due by 19 Nov)
  p(6, 500, "cash", "2026-11-16");
  p(7, 500, "momo", "2026-11-17");
  p(8, 1500, "momo", "2026-11-16"); // paid ahead
  p(9, 500, "cash", "2026-11-18");
  p(11, 500, "cash", "2026-11-16");
  p(12, 2500, "cash", "2026-11-17"); // paid ahead
  p(14, 500, "momo", "2026-11-18");
  p(15, 500, "cash", "2026-11-19");
  p(17, 1000, "cash", "2026-11-19"); // paid ahead
  p(18, 500, "momo", "2026-11-19");
  p(20, 500, "cash", "2026-11-16");
  p(21, 250, "cash", "2026-11-17", { note: "Part payment" }); // behind (part)
  p(25, 500, "cash", "2026-11-16");
  // 10, 13, 16, 19, 22, 23, 24 have not paid — behind

  const adjustments: Adjustment[] = [
    {
      id: "adj-1",
      memberId: id(13),
      semesterId: SEM,
      amount: -500,
      reason: "Waiver: away on church mission week of 16 Nov",
      recordedBy: fs,
      createdAt: "2026-11-16T12:00:00.000Z",
    },
  ];

  const expenses: Expense[] = [
    {
      id: "exp-1",
      ref: "E-0001",
      description: "Fabric for Esther costumes",
      category: "Costumes & props",
      amount: 4500,
      paidBy: "Kofi Mensah",
      approvedBy: "Kwame Asante",
      receiptRef: "Makola #2231",
      date: "2026-11-14",
      recordedBy: id(3),
      createdAt: "2026-11-14T15:20:00.000Z",
    },
    {
      id: "exp-2",
      ref: "E-0002",
      description: "Trotro fares to Sunday outreach",
      category: "Transport",
      amount: 1250,
      paidBy: "Kofi Mensah",
      approvedBy: "Kwame Asante",
      date: "2026-11-17",
      recordedBy: id(3),
      createdAt: "2026-11-17T18:05:00.000Z",
    },
  ];

  const income: OtherIncome[] = [
    {
      id: "inc-1",
      ref: "I-0001",
      source: "donation",
      description: "Donation from Elder Ansah for the Christmas production",
      amount: 20000,
      method: "momo",
      date: "2026-11-15",
      recordedBy: fs,
      createdAt: "2026-11-15T11:00:00.000Z",
    },
  ];

  const handovers: Handover[] = [
    {
      id: "ho-1",
      ref: "H-0001",
      fromMemberId: fs,
      toMemberId: id(3),
      amount: 5000,
      recordedAt: "2026-11-18T19:30:00.000Z",
      confirmedAt: null,
    },
  ];

  const audit: AuditEntry[] = [
    {
      id: "aud-1",
      actorName: "Abena Owusu",
      actorPosition: "Financial Secretary",
      action: "create",
      table: "handovers",
      summary: "Handed over GH₵50 to Kofi Mensah (H-0001)",
      createdAt: "2026-11-18T19:30:00.000Z",
    },
    {
      id: "aud-2",
      actorName: "Abena Owusu",
      actorPosition: "Financial Secretary",
      action: "reverse",
      table: "payments",
      summary: "Reversed R-0005 for Efua Boateng: duplicate entry",
      createdAt: "2026-11-12T10:00:00.000Z",
    },
  ];

  const pins: Record<string, string> = {};
  for (const m of members) if (m.isActivated) pins[m.id] = "1234";

  return {
    members,
    semesters,
    weeks,
    rates,
    memberSemesters,
    adjustments,
    payments,
    expenses,
    income,
    handovers,
    audit,
    pins,
    setupCodes: { [id(23)]: "482913", [id(24)]: "771205" },
    failedAttempts: {},
    officers: [
      { memberId: id(1), email: "director@histheatre.org", password: "theatre123" },
      { memberId: id(2), email: "finsec@histheatre.org", password: "theatre123" },
      { memberId: id(3), email: "treasurer@histheatre.org", password: "theatre123" },
    ],
  };
}

/** Mock-only sign-in hints shown on the sign-in screen in development builds. */
export const MOCK_HINTS = {
  memberPin: "1234",
  officerPassword: "theatre123",
  officerCode: "123456",
  setupCodes: "HIS-023 → 482913, HIS-024 → 771205",
};
