// Shared data types for His Theatre.
// MONEY RULE: every amount is an integer number of pesewas (GH₵1 = 100). Never decimals.

export type Pesewas = number;
export type ISODate = string; // "2026-11-09"
export type ISODateTime = string; // full ISO timestamp

export type MemberCategory = "member" | "executive";
export type MemberRole = "member" | "admin" | "super_admin";
export type OfficerPosition = "Financial Secretary" | "Treasurer" | "Director";
export type PaymentMethod = "cash" | "momo";

export interface Member {
  id: string;
  memberCode: string; // "HIS-012"
  fullName: string;
  phone: string;
  drive: string;
  category: MemberCategory;
  role: MemberRole;
  position: OfficerPosition | null;
  isActive: boolean;
  leftOn: ISODate | null;
  isActivated: boolean;
  isLocked: boolean;
}

export interface Semester {
  id: string;
  name: string;
  startsOn: ISODate;
  endsOn: ISODate;
  isClosed: boolean;
}

export interface SemesterWeek {
  id: string;
  semesterId: string;
  weekNo: number;
  weekStart: ISODate; // Monday
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
  amount: Pesewas; // negative = waiver
  reason: string;
  recordedBy: string;
  createdAt: ISODateTime;
}

export interface Payment {
  id: string;
  receiptNo: string; // "R-0001"
  memberId: string;
  semesterId: string;
  amount: Pesewas; // negative when it reverses another payment
  method: PaymentMethod;
  momoReference?: string;
  paidOn: ISODate;
  note?: string;
  reversesPaymentId?: string;
  idempotencyKey: string;
  recordedBy: string;
  createdAt: ISODateTime;
}

export interface Expense {
  id: string;
  ref: string; // "E-0001"
  description: string;
  category: string;
  amount: Pesewas;
  paidBy: string;
  approvedBy: string;
  receiptRef?: string;
  date: ISODate;
  reversesId?: string;
  recordedBy: string;
  createdAt: ISODateTime;
}

export type IncomeSource =
  | "donation"
  | "offering"
  | "ticket_sales"
  | "fundraising"
  | "levy"
  | "other";

export interface OtherIncome {
  id: string;
  ref: string; // "I-0001"
  source: IncomeSource;
  description: string;
  amount: Pesewas;
  method: PaymentMethod;
  date: ISODate;
  reversesId?: string;
  recordedBy: string;
  createdAt: ISODateTime;
}

export interface Handover {
  id: string;
  ref: string; // "H-0001"
  fromMemberId: string;
  toMemberId: string;
  amount: Pesewas;
  recordedAt: ISODateTime;
  confirmedAt: ISODateTime | null;
}

export interface AuditEntry {
  id: string;
  actorName: string;
  actorPosition: string;
  action: string;
  table: string;
  summary: string;
  createdAt: ISODateTime;
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

export type DuesStatus = "paid_up" | "behind" | "ahead";

// ----- API input / output shapes -----

export interface MemberFilters {
  search?: string;
  drive?: string;
  status?: DuesStatus;
  includeInactive?: boolean;
}

export interface MemberWithDues extends Member {
  dues: DuesSummary | null;
  status: DuesStatus | null;
}

export interface NewMemberInput {
  fullName: string;
  phone: string;
  drive: string;
  category: MemberCategory;
}

export interface UpdateMemberInput {
  fullName?: string;
  phone?: string;
  drive?: string;
  category?: MemberCategory;
}

export interface RecordPaymentInput {
  memberId: string;
  semesterId: string;
  amount: Pesewas;
  method: PaymentMethod;
  momoReference?: string;
  paidOn: ISODate;
  note?: string;
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
  date: ISODate;
}

export interface IncomeInput {
  source: IncomeSource;
  description: string;
  amount: Pesewas;
  method: PaymentMethod;
  date: ISODate;
}

export interface HandoverInput {
  toMemberId: string;
  amount: Pesewas;
}

export interface CashHolder {
  memberId: string;
  fullName: string;
  position: OfficerPosition | null;
  cash: Pesewas;
}

export interface CashPosition {
  balance: Pesewas; // everything in minus everything out
  cash: Pesewas;
  momo: Pesewas;
  holders: CashHolder[];
  inTransit: Pesewas; // handovers not yet confirmed
  pendingHandovers: Handover[];
}

export interface TodaySummary {
  date: ISODate;
  collected: Pesewas;
  collectedCash: Pesewas;
  collectedMomo: Pesewas;
  spent: Pesewas;
  payments: Payment[];
  income: OtherIncome[];
  expenses: Expense[];
  handovers: Handover[];
}

export interface Dashboard {
  semester: Semester;
  memberCount: number;
  paidUp: number;
  behind: number;
  ahead: number;
  dueSoFar: Pesewas;
  collected: Pesewas;
  owing: Pesewas;
  semesterTotal: Pesewas;
}

export interface Report {
  from: ISODate;
  to: ISODate;
  openingBalance: Pesewas;
  closingBalance: Pesewas;
  duesByDrive: Record<string, Pesewas>;
  duesCollected: Pesewas;
  duesCash: Pesewas;
  duesMomo: Pesewas;
  incomeBySource: Record<IncomeSource, Pesewas>;
  incomeTotal: Pesewas;
  expensesByCategory: Record<string, Pesewas>;
  expensesTotal: Pesewas;
  net: Pesewas;
  payments: Payment[];
  income: OtherIncome[];
  expenses: Expense[];
}

export interface SemesterInput {
  id?: string;
  name: string;
  startsOn: ISODate;
  endsOn: ISODate;
}

export type OfficerSignInResult = { needsCode: true; hint: string };

export interface AuditFilters {
  table?: string;
  limit?: number;
}

export interface ReceiptView {
  payment: Payment;
  memberName: string;
  memberCode: string;
  recordedByName: string;
  recordedByPosition: OfficerPosition | null;
  reversed: boolean;
}

export type PreviewRole = "member" | "financial_secretary" | "treasurer" | "director";
