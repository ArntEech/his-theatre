/**
 * Shared data types for His Theatre.
 *
 * Money is ALWAYS an integer number of pesewas (GH₵1 = 100). Never use decimals for money.
 */

export type Pesewas = number;
/** ISO calendar date, e.g. "2026-11-09". */
export type IsoDate = string;
/** ISO timestamp, e.g. "2026-11-09T14:30:00.000Z". */
export type IsoDateTime = string;

export type MemberCategory = "member" | "executive";
export type Role = "member" | "admin" | "super_admin";
export type Position = "Financial Secretary" | "Treasurer" | "Director" | null;
export type PaymentMethod = "cash" | "momo";
export type IncomeSource =
  | "donation"
  | "offering"
  | "ticket_sales"
  | "fundraising"
  | "levy"
  | "other";

export interface Member {
  id: string;
  /** e.g. "HIS-012" */
  memberCode: string;
  fullName: string;
  phone: string;
  drive: string;
  category: MemberCategory;
  role: Role;
  position: Position;
  isActive: boolean;
  leftOn: IsoDate | null;
  isActivated: boolean;
  isLocked: boolean;
  /**
   * What they do in the group, e.g. "Drama Director" or "Secretary"; "" for most members.
   * Shown under their name. Separate from `position`, which gives finance powers.
   */
  portfolio: string;
  /** Details from the registration form. Seen only by the member and by officers. */
  profile: MemberProfile;
}

export type JoinedAs = "new" | "continuing";

export interface MemberProfile {
  /** Birthday as day and month only; the year is never asked. Both set, or both null. */
  birthDay: number | null;
  birthMonth: number | null;
  /** University level, e.g. 100, 200, 300, 400. */
  level: number | null;
  /** Whether they joined as a new or continuing member. */
  joinedAs: JoinedAs | null;
  course: string;
  hall: string;
  /** Other drives they are interested in, as written on the form. */
  driveInterests: string;
  /** e.g. "None yet", "Some (church/school)", "Experienced". */
  experience: string;
  experienceNotes: string;
}

export const EMPTY_PROFILE: MemberProfile = {
  birthDay: null,
  birthMonth: null,
  level: null,
  joinedAs: null,
  course: "",
  hall: "",
  driveInterests: "",
  experience: "",
  experienceNotes: "",
};

export interface Semester {
  id: string;
  name: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
  isClosed: boolean;
}

export interface SemesterWeek {
  id: string;
  semesterId: string;
  weekNo: number;
  /** Monday of the week, ISO date. */
  weekStart: IsoDate;
  counts: boolean;
  label?: string;
}

export interface DuesRate {
  semesterId: string;
  category: MemberCategory;
  weeklyAmount: Pesewas;
}

export interface MemberSemester {
  memberId: string;
  semesterId: string;
  category: MemberCategory;
  startWeekNo: number;
}

export interface Adjustment {
  id: string;
  memberId: string;
  semesterId: string;
  /** Negative = waiver, positive = extra charge. */
  amount: Pesewas;
  reason: string;
  recordedBy: string;
  createdAt: IsoDateTime;
}

export interface Payment {
  id: string;
  /** e.g. "R-0001" */
  receiptNo: string;
  memberId: string;
  semesterId: string;
  /** Negative for reversals. */
  amount: Pesewas;
  method: PaymentMethod;
  momoReference?: string;
  paidOn: IsoDate;
  note?: string;
  reversesPaymentId?: string;
  idempotencyKey: string;
  recordedBy: string;
  createdAt: IsoDateTime;
}

export interface Expense {
  id: string;
  /** e.g. "E-0001" */
  ref: string;
  description: string;
  category: string;
  /** Negative for reversals. */
  amount: Pesewas;
  paidBy: string;
  approvedBy: string;
  receiptRef?: string;
  date: IsoDate;
  reversesId?: string;
  recordedBy: string;
  createdAt: IsoDateTime;
}

export interface OtherIncome {
  id: string;
  /** e.g. "I-0001" */
  ref: string;
  source: IncomeSource;
  description: string;
  /** Negative for reversals. */
  amount: Pesewas;
  method: PaymentMethod;
  date: IsoDate;
  reversesId?: string;
  recordedBy: string;
  createdAt: IsoDateTime;
}

export interface Handover {
  id: string;
  /** e.g. "H-0001" */
  ref: string;
  fromMemberId: string;
  toMemberId: string;
  amount: Pesewas;
  recordedAt: IsoDateTime;
  confirmedAt: IsoDateTime | null;
}

export interface AuditEntry {
  id: string;
  actorName: string;
  actorPosition: Position;
  action: string;
  table: string;
  summary: string;
  createdAt: IsoDateTime;
}

export interface DuesSummary {
  memberId: string;
  semesterId: string;
  weeklyRate: Pesewas;
  weeksTotal: number;
  weeksSoFar: number;
  semesterTotal: Pesewas;
  dueSoFar: Pesewas;
  paid: Pesewas;
  owing: Pesewas;
  credit: Pesewas;
  progressPct: number;
  weeksBehind: number;
}

/* ------------------------------------------------------------------ */
/* View types returned by the API                                       */
/* ------------------------------------------------------------------ */

export type DuesStatus = "paid_up" | "behind" | "ahead";

export interface Session {
  member: Member;
}

export interface OfficerChallenge {
  /**
   * Only on an officer's first sign-in: scan this into an authenticator app
   * (Google Authenticator, Microsoft Authenticator…), then enter the code it shows.
   */
  setup?: { qrCode: string; secret: string };
}

export interface SemesterDetail extends Semester {
  weeks: SemesterWeek[];
  rates: DuesRate[];
  /** Today's date according to the server. */
  today: IsoDate;
  /** The week containing today, or null when outside the semester. */
  currentWeekNo: number | null;
}

export type ScheduleWeekState =
  | "not_counted"
  | "not_applicable"
  | "covered"
  | "waived"
  | "part_paid"
  | "owing"
  | "upcoming";

export interface ScheduleWeek {
  weekNo: number;
  weekStart: IsoDate;
  label?: string;
  state: ScheduleWeekState;
  amount: Pesewas;
}

export interface AdjustmentRow extends Adjustment {
  recordedByName: string;
}

export interface PaymentRow extends Payment {
  memberName: string;
  memberCode: string;
  recordedByName: string;
  /** Receipt number of the reversal that voided this payment, if any. */
  voidedBy: string | null;
  /** Receipt number of the payment this row reverses, if it is a reversal. */
  reversesReceiptNo: string | null;
}

export interface ExpenseRow extends Expense {
  recordedByName: string;
  voidedBy: string | null;
  reversesRef: string | null;
}

export interface IncomeRow extends OtherIncome {
  recordedByName: string;
  voidedBy: string | null;
  reversesRef: string | null;
}

export interface HandoverRow extends Handover {
  fromName: string;
  toName: string;
}

export interface MyDues extends DuesSummary {
  status: DuesStatus;
  schedule: ScheduleWeek[];
  adjustments: AdjustmentRow[];
  nextDue: { weekStart: IsoDate; amount: Pesewas } | null;
}

export interface MemberFilters {
  search?: string;
  drive?: string;
  status?: DuesStatus;
  includeInactive?: boolean;
}

export interface MemberListItem {
  member: Member;
  dues: DuesSummary | null;
  status: DuesStatus | null;
}

export interface MemberDetail {
  member: Member;
  semesterId: string | null;
  memberSemester: MemberSemester | null;
  dues: MyDues | null;
  payments: PaymentRow[];
  adjustments: AdjustmentRow[];
}

export interface CashHolder {
  memberId: string;
  fullName: string;
  position: Position;
  /** Cash dues and cash income this officer recorded. */
  collected: Pesewas;
  /** Confirmed handovers received. */
  received: Pesewas;
  /** Handovers given (pending and confirmed). */
  handedOver: Pesewas;
  /** Expenses this officer recorded (paid out of the cash they hold). */
  spent: Pesewas;
  holding: Pesewas;
}

export interface CashPosition {
  totalIn: Pesewas;
  totalOut: Pesewas;
  balance: Pesewas;
  cashIn: Pesewas;
  momoIn: Pesewas;
  inTransit: Pesewas;
  holders: CashHolder[];
  pendingHandovers: HandoverRow[];
  handovers: HandoverRow[];
}

export interface TodayReport {
  date: IsoDate;
  /** Net money in today: dues + other income − expenses. */
  net: Pesewas;
  duesTotal: Pesewas;
  duesCash: Pesewas;
  duesMomo: Pesewas;
  incomeTotal: Pesewas;
  expensesTotal: Pesewas;
  payments: PaymentRow[];
  income: IncomeRow[];
  expenses: ExpenseRow[];
  handovers: HandoverRow[];
  pendingHandovers: HandoverRow[];
  myCashHolding: Pesewas;
}

export interface DriveSummary {
  drive: string;
  members: number;
  paidUp: number;
  behind: number;
  ahead: number;
  owing: Pesewas;
  paid: Pesewas;
}

export interface Dashboard {
  semester: SemesterDetail;
  activeMembers: number;
  dueSoFar: Pesewas;
  semesterTotal: Pesewas;
  collected: Pesewas;
  owingTotal: Pesewas;
  creditTotal: Pesewas;
  counts: Record<DuesStatus, number>;
  drives: DriveSummary[];
  mostBehind: MemberListItem[];
  balance: Pesewas;
  pendingHandovers: number;
  collectedToday: Pesewas;
}

export interface Report {
  from: IsoDate;
  to: IsoDate;
  dues: { cash: Pesewas; momo: Pesewas; reversals: Pesewas; net: Pesewas; receipts: number };
  income: { bySource: { source: IncomeSource; amount: Pesewas }[]; total: Pesewas };
  expenses: { byCategory: { category: string; amount: Pesewas }[]; total: Pesewas };
  totalIn: Pesewas;
  totalOut: Pesewas;
  net: Pesewas;
  payments: PaymentRow[];
  incomeRows: IncomeRow[];
  expenseRows: ExpenseRow[];
  handovers: HandoverRow[];
}

export interface AuditFilters {
  table?: string;
  search?: string;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export interface NewMemberInput {
  fullName: string;
  phone: string;
  drive: string;
  category: MemberCategory;
  /** e.g. "Drama Director"; leave out for most members. */
  portfolio?: string;
  /** Week of the current semester their dues start. */
  startWeekNo: number;
}

export type MemberUpdate = Partial<
  Pick<Member, "fullName" | "phone" | "drive" | "category" | "portfolio">
> & {
  profile?: Partial<MemberProfile>;
};

export interface RecordPaymentInput {
  memberId: string;
  semesterId: string;
  amount: Pesewas;
  method: PaymentMethod;
  momoReference?: string;
  paidOn: IsoDate;
  note?: string;
  /** Generated once per payment form; retrying with the same key never double-records. */
  idempotencyKey: string;
}

export interface AdjustmentInput {
  memberId: string;
  semesterId: string;
  amount: Pesewas;
  reason: string;
}

export interface ExpenseInput {
  description: string;
  category: string;
  amount: Pesewas;
  paidBy: string;
  approvedBy: string;
  receiptRef?: string;
  date: IsoDate;
}

export interface IncomeInput {
  source: IncomeSource;
  description: string;
  amount: Pesewas;
  method: PaymentMethod;
  date: IsoDate;
}

export interface HandoverInput {
  toMemberId: string;
  amount: Pesewas;
}

export interface SemesterInput {
  id?: string;
  name: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
}

export interface RatesInput {
  executive: Pesewas;
  member: Pesewas;
}

export interface SetupCodeResult {
  setupCode: string;
  expiresAt: IsoDateTime;
}

/** One line of a batch of setup codes, ready to send to each person. */
export interface SetupCodeListItem extends SetupCodeResult {
  memberId: string;
  memberCode: string;
  fullName: string;
  phone: string;
}

export class ApiError extends Error {
  code: string;
  constructor(message: string, code = "error") {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  donation: "Donation",
  offering: "Offering",
  ticket_sales: "Ticket sales",
  fundraising: "Fundraising",
  levy: "Levy",
  other: "Other",
};

export const EXPENSE_CATEGORIES = [
  "Costumes",
  "Props & set",
  "Transport",
  "Venue",
  "Refreshments",
  "Printing",
  "Sound & lighting",
  "Welfare",
  "Other",
] as const;
