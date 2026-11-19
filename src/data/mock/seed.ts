/**
 * Seed data for the in-memory mock store.
 * ONLY src/data/api.ts may import this file. Screens must go through api.ts.
 */
import type {
  Adjustment,
  AuditEntry,
  DuesRate,
  Expense,
  Handover,
  IsoDate,
  Member,
  MemberCategory,
  MemberSemester,
  OtherIncome,
  Payment,
  PaymentMethod,
  Position,
  Role,
  Semester,
  SemesterWeek,
} from "../types";

export interface Credential {
  pin: string | null;
  failedAttempts: number;
  setupCode: string | null;
  setupCodeExpiresAt: string | null;
}

export interface OfficerLogin {
  email: string;
  password: string;
  memberId: string;
}

export interface MockDb {
  version: number;
  members: Member[];
  credentials: Record<string, Credential>;
  officers: OfficerLogin[];
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
  counters: {
    id: number;
    receipt: number;
    expense: number;
    income: number;
    handover: number;
    member: number;
  };
  session: { memberId: string | null; pendingOfficerId: string | null };
}

export const SEED_VERSION = 4;

/** Demo credentials, shown on the sign-in screen in development builds only. */
export const DEMO_PIN = "1234";
export const DEMO_OFFICER_PASSWORD = "Theatre2026";
export const DEMO_OFFICER_CODE = "246810";

const SEM_ID = "sem-2026-27-1";

type MemberSeed = [
  name: string,
  phone: string,
  drive: string,
  category: MemberCategory,
  role: Role,
  position: Position,
  extra?: Partial<Member> & { startWeekNo?: number },
];

const MEMBERS: MemberSeed[] = [
  ["Kwame Asante-Boateng", "0244 118 302", "Unashamed Voices", "executive", "super_admin", "Director"],
  ["Abena Owusu", "0201 554 917", "His Redeemed Acts", "executive", "admin", "Financial Secretary"],
  ["Kofi Mensah", "0547 230 668", "Anointed Reflections", "executive", "admin", "Treasurer"],
  ["Efua Addo", "0266 410 225", "Tribe of Judah", "executive", "member", null],
  ["Yaw Darko", "0243 902 117", "Unashamed Voices", "executive", "member", null],
  ["Akosua Frimpong", "0559 381 046", "His Redeemed Acts", "executive", "member", null],
  ["Nana Ama Ofori", "0208 776 513", "Anointed Reflections", "member", "member", null],
  ["Kojo Antwi", "0246 615 890", "Tribe of Judah", "member", "member", null],
  ["Esi Quaye", "0275 049 332", "Unashamed Voices", "member", "member", null],
  ["Ama Serwaa Boadu", "0501 263 774", "His Redeemed Acts", "member", "member", null],
  ["Kwabena Osei", "0249 870 451", "Anointed Reflections", "member", "member", null],
  ["Adwoa Pokuaa", "0538 112 609", "Tribe of Judah", "member", "member", null],
  ["Fiifi Arthur", "0204 337 186", "Divine Pulse", "member", "member", null],
  [
    "Maame Yaa Agyeman",
    "0262 908 433",
    "His Redeemed Acts",
    "member",
    "member",
    null,
    { isActive: false, leftOn: "2026-11-18" },
  ],
  ["Kwesi Appiah", "0245 561 720", "Divine Pulse", "member", "member", null],
  ["Afia Nyarko", "0577 284 915", "Tribe of Judah", "member", "member", null],
  ["Selorm Agbeko", "0209 653 078", "Unashamed Voices", "member", "member", null],
  ["Dela Amenyo", "0548 019 362", "His Redeemed Acts", "executive", "member", null, { startWeekNo: 2 }],
  [
    "Yaa Asantewaa Kyei",
    "0240 735 289",
    "Anointed Reflections",
    "member",
    "member",
    null,
    { isLocked: true },
  ],
  ["Ebo Taylor-Hammond", "0268 402 951", "Divine Pulse", "member", "member", null],
  ["Akua Donkor", "0503 816 247", "Unashamed Voices", "member", "member", null],
  ["Elikem Tsikata", "0242 197 586", "His Redeemed Acts", "member", "member", null],
  [
    "Naa Dedei Lamptey",
    "0556 640 813",
    "Anointed Reflections",
    "member",
    "member",
    null,
    { isActivated: false },
  ],
  ["Kobby Ansah", "0207 925 134", "Tribe of Judah", "member", "member", null, { isActivated: false }],
  ["Mawuli Kpodo", "0247 358 690", "Unashamed Voices", "member", "member", null],
];

const mid = (n: number) => `mem-${String(n).padStart(3, "0")}`;
const at = (date: IsoDate, time: string) => new Date(`${date}T${time}:00`).toISOString();

export function createSeed(today: IsoDate): MockDb {
  const members: Member[] = [];
  const credentials: Record<string, Credential> = {};
  const memberSemesters: MemberSemester[] = [];

  MEMBERS.forEach(([fullName, phone, drive, category, role, position, extra = {}], i) => {
    const n = i + 1;
    const { startWeekNo, ...memberExtra } = extra;
    const member: Member = {
      id: mid(n),
      memberCode: `HIS-${String(n).padStart(3, "0")}`,
      fullName,
      phone,
      drive,
      category,
      role,
      position,
      isActive: true,
      leftOn: null,
      isActivated: true,
      isLocked: false,
      ...memberExtra,
    };
    members.push(member);
    credentials[member.id] = {
      pin: member.isActivated ? DEMO_PIN : null,
      failedAttempts: member.isLocked ? 5 : 0,
      setupCode: n === 23 ? "482913" : null,
      setupCodeExpiresAt: n === 23 ? at("2027-01-31", "23:59") : null,
    };
    memberSemesters.push({
      memberId: member.id,
      semesterId: SEM_ID,
      category,
      // Executives start week 1; members start week 2 (16 Nov).
      startWeekNo: startWeekNo ?? (category === "executive" ? 1 : 2),
    });
  });

  const semesters: Semester[] = [
    {
      id: SEM_ID,
      name: "2026/27 Sem 1",
      startsOn: "2026-11-09",
      endsOn: "2027-01-10",
      isClosed: false,
    },
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
      semesterId: SEM_ID,
      weekNo: i + 1,
      weekStart,
      counts: !interim,
      ...(interim ? { label: "Interim Assessment" } : {}),
    };
  });

  const rates: DuesRate[] = [
    { semesterId: SEM_ID, category: "executive", weeklyAmount: 1000 },
    { semesterId: SEM_ID, category: "member", weeklyAmount: 500 },
  ];

  const payments: Payment[] = [];
  let receipt = 0;
  const addPayment = (
    date: IsoDate,
    time: string,
    member: number,
    amount: number,
    method: PaymentMethod,
    recordedBy: number,
    extra: Partial<Payment> = {},
  ) => {
    receipt += 1;
    const p: Payment = {
      id: `pay-${receipt}`,
      receiptNo: `R-${String(receipt).padStart(4, "0")}`,
      memberId: mid(member),
      semesterId: SEM_ID,
      amount,
      method,
      paidOn: date,
      idempotencyKey: `seed-${receipt}`,
      recordedBy: mid(recordedBy),
      createdAt: at(date, time),
      ...extra,
    };
    payments.push(p);
    return p;
  };

  addPayment("2026-11-09", "18:05", 1, 7000, "momo", 3, {
    momoReference: "61109184417",
    note: "Full semester",
  });
  addPayment("2026-11-09", "18:20", 2, 1000, "cash", 3);
  addPayment("2026-11-10", "17:45", 4, 1000, "cash", 2);
  addPayment("2026-11-10", "17:52", 6, 4000, "momo", 2, { momoReference: "61110175203" });
  addPayment("2026-11-11", "18:10", 3, 1000, "cash", 2);
  addPayment("2026-11-12", "17:30", 8, 3000, "momo", 2, {
    momoReference: "61112173011",
    note: "Whole semester",
  });
  addPayment("2026-11-12", "17:41", 10, 1500, "cash", 2);
  const mistaken = addPayment("2026-11-16", "17:35", 11, 500, "cash", 2);
  addPayment("2026-11-16", "17:58", 11, -500, "cash", 2, {
    reversesPaymentId: mistaken.id,
    note: "Recorded against the wrong member. It was Adwoa Pokuaa (HIS-012).",
    idempotencyKey: `reverse:${mistaken.id}`,
  });
  addPayment("2026-11-16", "18:00", 12, 500, "cash", 2);
  addPayment("2026-11-16", "18:06", 4, 1000, "cash", 2);
  addPayment("2026-11-16", "18:15", 2, 1000, "cash", 3);
  addPayment("2026-11-17", "17:40", 14, 500, "cash", 2);
  addPayment("2026-11-17", "17:48", 18, 1000, "momo", 2, { momoReference: "61117174822" });
  addPayment("2026-11-17", "17:55", 20, 500, "cash", 2);
  addPayment("2026-11-18", "17:33", 22, 1500, "momo", 2, { momoReference: "61118173390" });
  addPayment("2026-11-18", "17:44", 23, 500, "cash", 2, { note: "Paid before activating the app" });
  addPayment("2026-11-18", "17:50", 17, 500, "cash", 2);
  // Today's takings, so the Today screen always has something on it.
  addPayment(today, "17:32", 25, 500, "cash", 2);
  addPayment(today, "17:40", 16, 1000, "momo", 2, { momoReference: "61119174015" });
  addPayment(today, "17:47", 7, 500, "cash", 2);

  const adjustments: Adjustment[] = [
    {
      id: "adj-1",
      memberId: mid(13),
      semesterId: SEM_ID,
      amount: -1500,
      reason: "Hardship waiver for three weeks, approved by the Director",
      recordedBy: mid(1),
      createdAt: at("2026-11-12", "19:00"),
    },
  ];

  const expenses: Expense[] = [
    {
      id: "exp-1",
      ref: "E-0001",
      description: "Fabric and thread for Christmas production costumes",
      category: "Costumes",
      amount: 3500,
      paidBy: "Kofi Mensah",
      approvedBy: "Kwame Asante-Boateng",
      receiptRef: "Makola 4471",
      date: "2026-11-14",
      recordedBy: mid(3),
      createdAt: at("2026-11-14", "13:20"),
    },
    {
      id: "exp-2",
      ref: "E-0002",
      description: "Trotro fares to the Saturday rehearsal venue",
      category: "Transport",
      amount: 1200,
      paidBy: "Kofi Mensah",
      approvedBy: "Kwame Asante-Boateng",
      date: "2026-11-17",
      recordedBy: mid(3),
      createdAt: at("2026-11-17", "20:10"),
    },
  ];

  const income: OtherIncome[] = [
    {
      id: "inc-1",
      ref: "I-0001",
      source: "donation",
      description: "Gift from the Mensah family towards the Christmas production",
      amount: 20000,
      method: "momo",
      date: "2026-11-14",
      recordedBy: mid(3),
      createdAt: at("2026-11-14", "11:05"),
    },
  ];

  const handovers: Handover[] = [
    {
      id: "ho-1",
      ref: "H-0001",
      fromMemberId: mid(2),
      toMemberId: mid(3),
      amount: 5000,
      recordedAt: at("2026-11-13", "19:30"),
      confirmedAt: at("2026-11-13", "19:42"),
    },
    {
      id: "ho-2",
      ref: "H-0002",
      fromMemberId: mid(2),
      toMemberId: mid(3),
      amount: 2500,
      recordedAt: at("2026-11-18", "19:15"),
      confirmedAt: null,
    },
  ];

  const byId = new Map(members.map((m) => [m.id, m]));
  const audit: AuditEntry[] = [];
  let auditSeq = 0;
  const log = (
    actorId: string,
    action: string,
    table: string,
    summary: string,
    createdAt: string,
  ) => {
    const actor = byId.get(actorId)!;
    auditSeq += 1;
    audit.push({
      id: `aud-${auditSeq}`,
      actorName: actor.fullName,
      actorPosition: actor.position,
      action,
      table,
      summary,
      createdAt,
    });
  };
  for (const p of payments) {
    const m = byId.get(p.memberId)!;
    if (p.reversesPaymentId) {
      const original = payments.find((o) => o.id === p.reversesPaymentId)!;
      log(
        p.recordedBy,
        "Voided payment",
        "payments",
        `${p.receiptNo} reverses ${original.receiptNo} for ${m.fullName}. Reason: ${p.note}`,
        p.createdAt,
      );
    } else {
      log(
        p.recordedBy,
        "Recorded payment",
        "payments",
        `${p.receiptNo} · ${m.fullName} · ${(p.amount / 100).toFixed(2)} cedis ${p.method === "momo" ? "MoMo" : "cash"}`,
        p.createdAt,
      );
    }
  }
  for (const a of adjustments)
    log(
      a.recordedBy,
      "Added adjustment",
      "adjustments",
      `${byId.get(a.memberId)!.fullName}: waiver of ${(-a.amount / 100).toFixed(2)} cedis. ${a.reason}`,
      a.createdAt,
    );
  for (const e of expenses)
    log(e.recordedBy, "Recorded expense", "expenses", `${e.ref} · ${e.description}`, e.createdAt);
  for (const i of income)
    log(
      i.recordedBy,
      "Recorded income",
      "other_income",
      `${i.ref} · ${i.description}`,
      i.createdAt,
    );
  for (const h of handovers) {
    log(
      h.fromMemberId,
      "Recorded handover",
      "handovers",
      `${h.ref} · ${(h.amount / 100).toFixed(2)} cedis to the Treasurer`,
      h.recordedAt,
    );
    if (h.confirmedAt)
      log(h.toMemberId, "Confirmed handover", "handovers", `${h.ref} received`, h.confirmedAt);
  }
  audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    version: SEED_VERSION,
    members,
    credentials,
    officers: [
      { email: "director@histheatre.org", password: DEMO_OFFICER_PASSWORD, memberId: mid(1) },
      { email: "finsec@histheatre.org", password: DEMO_OFFICER_PASSWORD, memberId: mid(2) },
      { email: "treasurer@histheatre.org", password: DEMO_OFFICER_PASSWORD, memberId: mid(3) },
    ],
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
    counters: { id: 1000, receipt, expense: 2, income: 1, handover: 2, member: MEMBERS.length },
    session: { memberId: null, pendingOfficerId: null },
  };
}
