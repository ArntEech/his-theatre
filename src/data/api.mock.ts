// MOCK IMPLEMENTATION. To be replaced with Supabase calls. Keep every function signature the same.
//
// Every screen gets and changes data ONLY through the functions in this file.
// The mock keeps an in-memory store (reset on page reload) and a 400 ms fake delay.
// Money is ALWAYS integer pesewas. Money rows are never edited or deleted: mistakes are
// reversed (a negative row pointing at the original) or adjusted with a reason.

import { calculateDues, duesStatus } from "@/lib/dues";
import { formatCedi } from "@/lib/money";
import { normalizeMemberCode } from "@/lib/member-code";
import { addDays, todayISO } from "@/lib/dates";
import { createSeed, MOCK_HINTS, type MockStore } from "./mock/seed";
import type {
  Adjustment,
  AdjustmentInput,
  AuditEntry,
  AuditFilters,
  CashPosition,
  Dashboard,
  DuesRate,
  DuesSummary,
  Expense,
  ExpenseInput,
  Handover,
  HandoverInput,
  IncomeInput,
  IncomeSource,
  ISODate,
  Member,
  MemberCategory,
  MemberFilters,
  MemberRole,
  MemberSemester,
  MemberWithDues,
  NewMemberInput,
  OfficerPosition,
  OfficerSignInResult,
  OtherIncome,
  Payment,
  PreviewRole,
  ReceiptView,
  RecordPaymentInput,
  Report,
  Semester,
  SemesterInput,
  SemesterWeek,
  TodaySummary,
  UpdateMemberInput,
} from "./types";

/** This file is the test-data version. src/data/api.ts decides which version the app uses. */
export const IS_MOCK = true;

import { ApiError } from "./errors";
export { ApiError };

// ---------------------------------------------------------------------------
// Mock plumbing
// ---------------------------------------------------------------------------

const store: MockStore = createSeed();
const DELAY_MS = 400;
const SESSION_KEY = "his-theatre-session";
const MAX_PIN_ATTEMPTS = 5;

let pendingOfficerId: string | null = null;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), DELAY_MS));
}

function readSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}
function writeSession(memberId: string | null) {
  if (typeof window === "undefined") return;
  if (memberId) window.localStorage.setItem(SESSION_KEY, memberId);
  else window.localStorage.removeItem(SESSION_KEY);
}

function me(): Member {
  const id = readSession();
  const member = id ? store.members.find((m) => m.id === id) : undefined;
  if (!member || !member.isActive) throw new ApiError("Please sign in again.");
  return member;
}
function requireAdmin(): Member {
  const m = me();
  if (m.role !== "admin" && m.role !== "super_admin") {
    throw new ApiError("You don't have access to this.");
  }
  return m;
}
function requireSuperAdmin(): Member {
  const m = me();
  if (m.role !== "super_admin") throw new ApiError("Only the Director can do this.");
  return m;
}

function findMember(id: string): Member {
  const m = store.members.find((x) => x.id === id);
  if (!m) throw new ApiError("Member not found.");
  return m;
}
function findSemester(id: string): Semester {
  const s = store.semesters.find((x) => x.id === id);
  if (!s) throw new ApiError("Semester not found.");
  return s;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
function nextRef(prefix: string, existing: { ref?: string; receiptNo?: string }[]) {
  const max = existing.reduce((acc, row) => {
    const value = row.ref ?? row.receiptNo ?? "";
    const num = Number(value.split("-")[1] ?? 0);
    return Math.max(acc, num);
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}
function now() {
  return new Date().toISOString();
}

function audit(action: string, table: string, summary: string) {
  const actor = me();
  const entry: AuditEntry = {
    id: uid("aud"),
    actorName: actor.fullName,
    actorPosition: actor.position ?? (actor.role === "member" ? "Member" : "Admin"),
    action,
    table,
    summary,
    createdAt: now(),
  };
  store.audit.unshift(entry);
}

function assertAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ApiError("Enter an amount greater than zero.");
  }
}
function assertReason(reason: string) {
  if (!reason || reason.trim().length < 3) throw new ApiError("Please give a reason.");
}

function rateFor(semesterId: string, category: MemberCategory) {
  return store.rates.find((r) => r.semesterId === semesterId && r.category === category)?.weeklyAmount ?? 0;
}

function summaryFor(memberId: string, semesterId: string, today = todayISO()): DuesSummary | null {
  const ms = store.memberSemesters.find((x) => x.memberId === memberId && x.semesterId === semesterId);
  if (!ms) return null;
  const member = findMember(memberId);
  return calculateDues(
    ms,
    store.weeks.filter((w) => w.semesterId === semesterId),
    rateFor(semesterId, ms.category),
    store.adjustments,
    store.payments,
    today,
    member.leftOn,
  );
}

function currentSemesterRow(): Semester {
  const today = todayISO();
  const open = store.semesters.filter((s) => !s.isClosed);
  return (
    open.find((s) => s.startsOn <= today && today <= s.endsOn) ??
    open.sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] ??
    (store.semesters[0] as Semester)
  );
}

function withDues(member: Member, semesterId: string): MemberWithDues {
  const dues = summaryFor(member.id, semesterId);
  return { ...member, dues, status: dues ? duesStatus(dues) : null };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signInMember(memberCode: string, pin: string): Promise<Member> {
  const code = normalizeMemberCode(memberCode);
  const member = store.members.find((m) => m.memberCode === code && m.isActive);
  if (!member) {
    await delay(null);
    throw new ApiError("That member ID or PIN isn't right.");
  }
  if (!member.isActivated) {
    await delay(null);
    throw new ApiError("This account isn't set up yet. Use \"First time here\" with your setup code.");
  }
  if (member.isLocked) {
    await delay(null);
    throw new ApiError("This account is locked. Ask the Financial Secretary to unlock it.");
  }
  if (store.pins[member.id] !== pin) {
    const tries = (store.failedAttempts[member.id] ?? 0) + 1;
    store.failedAttempts[member.id] = tries;
    if (tries >= MAX_PIN_ATTEMPTS) {
      member.isLocked = true;
      await delay(null);
      throw new ApiError("Too many wrong PINs. This account is now locked. Ask the Financial Secretary to unlock it.");
    }
    await delay(null);
    throw new ApiError(`That member ID or PIN isn't right. ${MAX_PIN_ATTEMPTS - tries} tries left.`);
  }
  store.failedAttempts[member.id] = 0;
  writeSession(member.id);
  return delay(member);
}

export async function activateMember(memberCode: string, setupCode: string, newPin: string): Promise<Member> {
  const code = normalizeMemberCode(memberCode);
  const member = store.members.find((m) => m.memberCode === code && m.isActive);
  if (!member || store.setupCodes[member.id] !== setupCode.trim()) {
    await delay(null);
    throw new ApiError("That member ID or setup code isn't right.");
  }
  if (!/^\d{4}$/.test(newPin)) {
    await delay(null);
    throw new ApiError("Your PIN must be 4 digits.");
  }
  store.pins[member.id] = newPin;
  delete store.setupCodes[member.id];
  member.isActivated = true;
  member.isLocked = false;
  store.failedAttempts[member.id] = 0;
  writeSession(member.id);
  return delay(member);
}

export async function signInOfficer(email: string, password: string): Promise<OfficerSignInResult> {
  const officer = store.officers.find(
    (o) => o.email.toLowerCase() === email.trim().toLowerCase() && o.password === password,
  );
  if (!officer) {
    await delay(null);
    throw new ApiError("That email or password isn't right.");
  }
  pendingOfficerId = officer.memberId;
  return delay({ needsCode: true as const, hint: "Enter the 6-digit code we sent to your phone." });
}

export async function verifyOfficerCode(code: string): Promise<Member> {
  if (!pendingOfficerId) {
    await delay(null);
    throw new ApiError("Start again with your email and password.");
  }
  if (code.trim() !== MOCK_HINTS.officerCode) {
    await delay(null);
    throw new ApiError("That code isn't right.");
  }
  const member = findMember(pendingOfficerId);
  pendingOfficerId = null;
  writeSession(member.id);
  return delay(member);
}

export async function signOut(): Promise<void> {
  writeSession(null);
  pendingOfficerId = null;
  return delay(undefined);
}

export async function getCurrentMember(): Promise<Member | null> {
  const id = readSession();
  const member = id ? store.members.find((m) => m.id === id && m.isActive) : undefined;
  return delay(member ?? null);
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  const m = me();
  if (store.pins[m.id] !== currentPin) {
    await delay(null);
    throw new ApiError("Your current PIN isn't right.");
  }
  if (!/^\d{4}$/.test(newPin)) {
    await delay(null);
    throw new ApiError("Your new PIN must be 4 digits.");
  }
  store.pins[m.id] = newPin;
  return delay(undefined);
}

/** DEV ONLY: lets the developer preview the app as each role. Remove when the real backend lands. */
export async function devPreviewAs(role: PreviewRole): Promise<Member> {
  const map: Record<PreviewRole, string> = {
    member: "m-010",
    financial_secretary: "m-002",
    treasurer: "m-003",
    director: "m-001",
  };
  writeSession(map[role]);
  return delay(findMember(map[role]));
}

// ---------------------------------------------------------------------------
// Member-facing dues
// ---------------------------------------------------------------------------

/** One receipt. Members can only open their own; officers can open any. */
export async function getReceipt(paymentId: string): Promise<ReceiptView> {
  const viewer = me();
  const p = store.payments.find((x) => x.id === paymentId);
  // Same message whether it doesn't exist or isn't theirs, so IDs can't be probed.
  if (!p || (p.memberId !== viewer.id && viewer.role === "member")) throw new ApiError("Receipt not found.");
  const member = findMember(p.memberId);
  const recorder = store.members.find((m) => m.id === p.recordedBy);
  return delay({
    payment: p,
    memberName: member.fullName,
    memberCode: member.memberCode,
    recordedByName: recorder?.fullName ?? "An officer",
    recordedByPosition: recorder?.position ?? null,
    reversed: store.payments.some((x) => x.reversesPaymentId === p.id),
  });
}

export async function getMyDues(semesterId: string): Promise<DuesSummary | null> {
  const m = me();
  return delay(summaryFor(m.id, semesterId));
}

export async function getMyMembership(semesterId: string): Promise<MemberSemester | null> {
  const m = me();
  return delay(store.memberSemesters.find((x) => x.memberId === m.id && x.semesterId === semesterId) ?? null);
}

export async function getMyPayments(semesterId: string): Promise<Payment[]> {
  const m = me();
  return delay(
    store.payments
      .filter((p) => p.memberId === m.id && p.semesterId === semesterId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function listSemesters(): Promise<Semester[]> {
  me();
  return delay([...store.semesters].sort((a, b) => b.startsOn.localeCompare(a.startsOn)));
}

export async function getCurrentSemester(): Promise<Semester> {
  me();
  return delay(currentSemesterRow());
}

export async function getSemesterWeeks(semesterId: string): Promise<SemesterWeek[]> {
  me();
  return delay(store.weeks.filter((w) => w.semesterId === semesterId).sort((a, b) => a.weekNo - b.weekNo));
}

export async function getRates(semesterId: string): Promise<DuesRate[]> {
  me();
  return delay(store.rates.filter((r) => r.semesterId === semesterId));
}

// ---------------------------------------------------------------------------
// Members (admin)
// ---------------------------------------------------------------------------

export async function listMembers(filters: MemberFilters = {}): Promise<MemberWithDues[]> {
  requireAdmin();
  const sem = currentSemesterRow();
  const q = filters.search?.trim().toLowerCase();
  const rows = store.members
    .filter((m) => filters.includeInactive || m.isActive)
    .filter((m) => !filters.drive || m.drive === filters.drive)
    .filter((m) => !q || m.fullName.toLowerCase().includes(q) || m.memberCode.toLowerCase().includes(q) || m.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
    .map((m) => withDues(m, sem.id))
    .filter((m) => !filters.status || m.status === filters.status)
    .sort((a, b) => a.memberCode.localeCompare(b.memberCode));
  return delay(rows);
}

export async function listDrives(): Promise<string[]> {
  requireAdmin();
  return delay([...new Set(store.members.map((m) => m.drive))].sort());
}

export async function getMember(
  id: string,
): Promise<MemberWithDues & { payments: Payment[]; adjustments: Adjustment[]; membership: MemberSemester | null }> {
  requireAdmin();
  const sem = currentSemesterRow();
  const member = findMember(id);
  return delay({
    ...withDues(member, sem.id),
    membership: store.memberSemesters.find((x) => x.memberId === id && x.semesterId === sem.id) ?? null,
    payments: store.payments
      .filter((p) => p.memberId === id && p.semesterId === sem.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    adjustments: store.adjustments.filter((a) => a.memberId === id && a.semesterId === sem.id),
  });
}

export async function addMember(input: NewMemberInput): Promise<Member> {
  requireAdmin();
  if (!input.fullName.trim()) throw new ApiError("Enter the member's full name.");
  const n = store.members.length + 1;
  const member: Member = {
    id: `m-${String(n).padStart(3, "0")}`,
    memberCode: `HIS-${String(n).padStart(3, "0")}`,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    drive: input.drive,
    category: input.category,
    role: "member",
    position: null,
    isActive: true,
    leftOn: null,
    isActivated: false,
    isLocked: false,
  };
  store.members.push(member);
  // Join the current semester from this week.
  const sem = currentSemesterRow();
  const today = todayISO();
  const weeks = store.weeks.filter((w) => w.semesterId === sem.id);
  const startWeek = [...weeks].reverse().find((w) => w.weekStart <= today)?.weekNo ?? 1;
  store.memberSemesters.push({ memberId: member.id, semesterId: sem.id, category: member.category, startWeekNo: startWeek });
  audit("create", "members", `Added ${member.fullName} (${member.memberCode})`);
  return delay(member);
}

export async function updateMember(id: string, input: UpdateMemberInput): Promise<Member> {
  requireAdmin();
  const member = findMember(id);
  Object.assign(member, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)));
  if (input.category) {
    const sem = currentSemesterRow();
    const ms = store.memberSemesters.find((x) => x.memberId === id && x.semesterId === sem.id);
    if (ms) ms.category = input.category;
  }
  audit("update", "members", `Updated details for ${member.fullName}`);
  return delay(member);
}

export async function deactivateMember(id: string, leftOn: ISODate): Promise<Member> {
  requireAdmin();
  const member = findMember(id);
  member.isActive = false;
  member.leftOn = leftOn;
  audit("deactivate", "members", `Marked ${member.fullName} as left on ${leftOn}`);
  return delay(member);
}

export async function issueSetupCode(memberId: string): Promise<string> {
  requireAdmin();
  const member = findMember(memberId);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.setupCodes[memberId] = code;
  member.isActivated = false;
  audit("issue_setup_code", "members", `Issued a setup code to ${member.fullName}`);
  return delay(code);
}

export async function unlockMember(memberId: string): Promise<Member> {
  requireAdmin();
  const member = findMember(memberId);
  member.isLocked = false;
  store.failedAttempts[memberId] = 0;
  audit("unlock", "members", `Unlocked ${member.fullName}`);
  return delay(member);
}

export async function setRole(memberId: string, role: MemberRole, position: OfficerPosition | null): Promise<Member> {
  const director = requireSuperAdmin();
  const member = findMember(memberId);
  if (member.id === director.id && role !== "super_admin") {
    throw new ApiError("You can't remove your own Director role.");
  }
  if (role !== "member" && !position) throw new ApiError("Choose their position.");
  member.role = role;
  member.position = position;
  audit("set_role", "members", `Set ${member.fullName} to ${position ?? role}`);
  return delay(member);
}

// ---------------------------------------------------------------------------
// Payments & adjustments
// ---------------------------------------------------------------------------

export async function recordPayment(input: RecordPaymentInput): Promise<Payment> {
  const officer = requireAdmin();
  const existing = store.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
  if (existing) return delay(existing); // same tap twice = one payment
  assertAmount(input.amount);
  const member = findMember(input.memberId);
  const sem = findSemester(input.semesterId);
  if (sem.isClosed) throw new ApiError("This semester is closed.");
  if (input.method === "momo" && !input.momoReference?.trim()) {
    throw new ApiError("Enter the MoMo transaction ID.");
  }
  const payment: Payment = {
    id: uid("pay"),
    receiptNo: nextRef("R", store.payments),
    memberId: member.id,
    semesterId: sem.id,
    amount: input.amount,
    method: input.method,
    ...(input.method === "momo" && input.momoReference ? { momoReference: input.momoReference.trim() } : {}),
    paidOn: input.paidOn,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    idempotencyKey: input.idempotencyKey,
    recordedBy: officer.id,
    createdAt: now(),
  };
  store.payments.push(payment);
  audit("create", "payments", `${payment.receiptNo}: ${formatCedi(payment.amount)} ${payment.method === "momo" ? "MoMo" : "cash"} from ${member.fullName}`);
  return delay(payment);
}

export async function reversePayment(id: string, reason: string): Promise<Payment> {
  const officer = requireAdmin();
  assertReason(reason);
  const original = store.payments.find((p) => p.id === id);
  if (!original) throw new ApiError("Payment not found.");
  if (original.reversesPaymentId) throw new ApiError("A reversal can't be reversed.");
  if (store.payments.some((p) => p.reversesPaymentId === id)) throw new ApiError("This payment has already been reversed.");
  const reversal: Payment = {
    ...original,
    id: uid("pay"),
    receiptNo: nextRef("R", store.payments),
    amount: -original.amount,
    paidOn: todayISO(),
    note: `Reversal of ${original.receiptNo}: ${reason.trim()}`,
    reversesPaymentId: original.id,
    idempotencyKey: uid("rev"),
    recordedBy: officer.id,
    createdAt: now(),
  };
  store.payments.push(reversal);
  audit("reverse", "payments", `Reversed ${original.receiptNo} for ${findMember(original.memberId).fullName}: ${reason.trim()}`);
  return delay(reversal);
}

export async function addAdjustment(input: AdjustmentInput): Promise<Adjustment> {
  const officer = requireAdmin();
  assertReason(input.reason);
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new ApiError("Enter an amount.");
  const adj: Adjustment = {
    id: uid("adj"),
    memberId: input.memberId,
    semesterId: input.semesterId,
    amount: input.amount,
    reason: input.reason.trim(),
    recordedBy: officer.id,
    createdAt: now(),
  };
  store.adjustments.push(adj);
  audit("create", "adjustments", `${input.amount < 0 ? "Waived" : "Added"} ${formatCedi(Math.abs(input.amount))} for ${findMember(input.memberId).fullName}: ${adj.reason}`);
  return delay(adj);
}

// ---------------------------------------------------------------------------
// Expenses, other income, handovers
// ---------------------------------------------------------------------------

export async function listExpenses(): Promise<Expense[]> {
  requireAdmin();
  return delay([...store.expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function recordExpense(input: ExpenseInput): Promise<Expense> {
  const officer = requireAdmin();
  assertAmount(input.amount);
  if (!input.description.trim()) throw new ApiError("Describe what the money was spent on.");
  const expense: Expense = {
    id: uid("exp"),
    ref: nextRef("E", store.expenses),
    ...input,
    description: input.description.trim(),
    recordedBy: officer.id,
    createdAt: now(),
  };
  store.expenses.push(expense);
  audit("create", "expenses", `${expense.ref}: ${formatCedi(expense.amount)} — ${expense.description}`);
  return delay(expense);
}

export async function reverseExpense(id: string, reason: string): Promise<Expense> {
  const officer = requireAdmin();
  assertReason(reason);
  const original = store.expenses.find((e) => e.id === id);
  if (!original) throw new ApiError("Expense not found.");
  if (original.reversesId || store.expenses.some((e) => e.reversesId === id)) {
    throw new ApiError("This expense can't be reversed again.");
  }
  const reversal: Expense = {
    ...original,
    id: uid("exp"),
    ref: nextRef("E", store.expenses),
    amount: -original.amount,
    description: `Reversal of ${original.ref}: ${reason.trim()}`,
    date: todayISO(),
    reversesId: original.id,
    recordedBy: officer.id,
    createdAt: now(),
  };
  store.expenses.push(reversal);
  audit("reverse", "expenses", `Reversed ${original.ref}: ${reason.trim()}`);
  return delay(reversal);
}

export async function listIncome(): Promise<OtherIncome[]> {
  requireAdmin();
  return delay([...store.income].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function recordIncome(input: IncomeInput): Promise<OtherIncome> {
  const officer = requireAdmin();
  assertAmount(input.amount);
  const row: OtherIncome = {
    id: uid("inc"),
    ref: nextRef("I", store.income),
    ...input,
    description: input.description.trim(),
    recordedBy: officer.id,
    createdAt: now(),
  };
  store.income.push(row);
  audit("create", "other_income", `${row.ref}: ${formatCedi(row.amount)} ${row.source.replace("_", " ")}`);
  return delay(row);
}

export async function reverseIncome(id: string, reason: string): Promise<OtherIncome> {
  const officer = requireAdmin();
  assertReason(reason);
  const original = store.income.find((i) => i.id === id);
  if (!original) throw new ApiError("Income not found.");
  if (original.reversesId || store.income.some((i) => i.reversesId === id)) {
    throw new ApiError("This entry can't be reversed again.");
  }
  const reversal: OtherIncome = {
    ...original,
    id: uid("inc"),
    ref: nextRef("I", store.income),
    amount: -original.amount,
    description: `Reversal of ${original.ref}: ${reason.trim()}`,
    date: todayISO(),
    reversesId: original.id,
    recordedBy: officer.id,
    createdAt: now(),
  };
  store.income.push(reversal);
  audit("reverse", "other_income", `Reversed ${original.ref}: ${reason.trim()}`);
  return delay(reversal);
}

export async function listHandovers(): Promise<Handover[]> {
  requireAdmin();
  return delay([...store.handovers].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)));
}

export async function recordHandover(input: HandoverInput): Promise<Handover> {
  const officer = requireAdmin();
  assertAmount(input.amount);
  if (officer.position !== "Financial Secretary") throw new ApiError("Only the Financial Secretary records handovers.");
  if (input.toMemberId === officer.id) throw new ApiError("You can't hand cash to yourself.");
  const to = findMember(input.toMemberId);
  if (to.position !== "Treasurer") throw new ApiError("Cash is handed over to the Treasurer.");
  const row: Handover = {
    id: uid("ho"),
    ref: nextRef("H", store.handovers),
    fromMemberId: officer.id,
    toMemberId: to.id,
    amount: input.amount,
    recordedAt: now(),
    confirmedAt: null,
  };
  store.handovers.push(row);
  audit("create", "handovers", `Handed over ${formatCedi(row.amount)} to ${to.fullName} (${row.ref})`);
  return delay(row);
}

export async function confirmHandover(id: string): Promise<Handover> {
  const officer = requireAdmin();
  const row = store.handovers.find((h) => h.id === id);
  if (!row) throw new ApiError("Handover not found.");
  if (row.toMemberId !== officer.id) throw new ApiError("Only the person receiving the cash can confirm it.");
  if (row.confirmedAt) throw new ApiError("Already confirmed.");
  row.confirmedAt = now();
  audit("confirm", "handovers", `Confirmed receiving ${formatCedi(row.amount)} (${row.ref})`);
  return delay(row);
}

// ---------------------------------------------------------------------------
// Overviews
// ---------------------------------------------------------------------------

/**
 * Mock model of who holds the cash: cash recorded by an officer stays with them until
 * handed over; confirmed handovers move it; cash expenses come out of the Treasurer's cash.
 */
function cashPosition(): CashPosition {
  const cashIn = (memberId: string) =>
    store.payments.filter((p) => p.method === "cash" && p.recordedBy === memberId).reduce((s, p) => s + p.amount, 0) +
    store.income.filter((i) => i.method === "cash" && i.recordedBy === memberId).reduce((s, i) => s + i.amount, 0);
  const spent = (memberId: string) =>
    store.expenses.filter((e) => e.recordedBy === memberId).reduce((s, e) => s + e.amount, 0);

  const officers = store.members.filter((m) => m.role !== "member" && m.isActive);
  const holders = officers.map((o) => {
    const handedOut = store.handovers.filter((h) => h.fromMemberId === o.id).reduce((s, h) => s + h.amount, 0);
    const received = store.handovers.filter((h) => h.toMemberId === o.id && h.confirmedAt).reduce((s, h) => s + h.amount, 0);
    return { memberId: o.id, fullName: o.fullName, position: o.position, cash: cashIn(o.id) - spent(o.id) - handedOut + received };
  });

  const duesCash = store.payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
  const duesMomo = store.payments.filter((p) => p.method === "momo").reduce((s, p) => s + p.amount, 0);
  const incCash = store.income.filter((i) => i.method === "cash").reduce((s, i) => s + i.amount, 0);
  const incMomo = store.income.filter((i) => i.method === "momo").reduce((s, i) => s + i.amount, 0);
  const expenses = store.expenses.reduce((s, e) => s + e.amount, 0);
  const pending = store.handovers.filter((h) => !h.confirmedAt);

  return {
    balance: duesCash + duesMomo + incCash + incMomo - expenses,
    cash: duesCash + incCash - expenses,
    momo: duesMomo + incMomo,
    holders,
    inTransit: pending.reduce((s, h) => s + h.amount, 0),
    pendingHandovers: pending,
  };
}

export async function getCashPosition(): Promise<CashPosition> {
  requireAdmin();
  return delay(cashPosition());
}

export async function getToday(): Promise<TodaySummary> {
  requireAdmin();
  const date = todayISO();
  const payments = store.payments.filter((p) => p.paidOn === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const income = store.income.filter((i) => i.date === date);
  const expenses = store.expenses.filter((e) => e.date === date);
  const handovers = store.handovers.filter((h) => todayISO(new Date(h.recordedAt)) === date || !h.confirmedAt);
  const cash = payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0) + income.filter((i) => i.method === "cash").reduce((s, i) => s + i.amount, 0);
  const momo = payments.filter((p) => p.method === "momo").reduce((s, p) => s + p.amount, 0) + income.filter((i) => i.method === "momo").reduce((s, i) => s + i.amount, 0);
  return delay({
    date,
    collected: cash + momo,
    collectedCash: cash,
    collectedMomo: momo,
    spent: expenses.reduce((s, e) => s + e.amount, 0),
    payments,
    income,
    expenses,
    handovers,
  });
}

export async function getDashboard(semesterId: string): Promise<Dashboard> {
  requireAdmin();
  const semester = findSemester(semesterId);
  const rows = store.members.filter((m) => m.isActive).map((m) => withDues(m, semesterId)).filter((m) => m.dues);
  return delay({
    semester,
    memberCount: rows.length,
    paidUp: rows.filter((r) => r.status === "paid_up").length,
    behind: rows.filter((r) => r.status === "behind").length,
    ahead: rows.filter((r) => r.status === "ahead").length,
    dueSoFar: rows.reduce((s, r) => s + (r.dues?.dueSoFar ?? 0), 0),
    collected: rows.reduce((s, r) => s + (r.dues?.paid ?? 0), 0),
    owing: rows.reduce((s, r) => s + (r.dues?.owing ?? 0), 0),
    semesterTotal: rows.reduce((s, r) => s + (r.dues?.semesterTotal ?? 0), 0),
  });
}

export async function getReport(from: ISODate, to: ISODate): Promise<Report> {
  requireAdmin();
  const inRange = (d: string) => d >= from && d <= to;
  const payments = store.payments.filter((p) => inRange(p.paidOn)).sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const income = store.income.filter((i) => inRange(i.date));
  const expenses = store.expenses.filter((e) => inRange(e.date));
  const incomeBySource = { donation: 0, offering: 0, ticket_sales: 0, fundraising: 0, levy: 0, other: 0 } as Record<IncomeSource, number>;
  for (const i of income) incomeBySource[i.source] += i.amount;
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount;
  const duesCash = payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
  const duesMomo = payments.filter((p) => p.method === "momo").reduce((s, p) => s + p.amount, 0);
  const incomeTotal = income.reduce((s, i) => s + i.amount, 0);
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  // Opening balance = everything in minus everything out before the range starts.
  const openingBalance =
    store.payments.filter((p) => p.paidOn < from).reduce((s, p) => s + p.amount, 0) +
    store.income.filter((i) => i.date < from).reduce((s, i) => s + i.amount, 0) -
    store.expenses.filter((e) => e.date < from).reduce((s, e) => s + e.amount, 0);
  const duesByDrive: Record<string, number> = {};
  for (const p of payments) {
    const drive = findMember(p.memberId).drive || "No drive";
    duesByDrive[drive] = (duesByDrive[drive] ?? 0) + p.amount;
  }
  const net = duesCash + duesMomo + incomeTotal - expensesTotal;
  return delay({
    from,
    to,
    openingBalance,
    closingBalance: openingBalance + net,
    duesByDrive,
    duesCollected: duesCash + duesMomo,
    duesCash,
    duesMomo,
    incomeBySource,
    incomeTotal,
    expensesByCategory,
    expensesTotal,
    net,
    payments,
    income,
    expenses,
  });
}

// ---------------------------------------------------------------------------
// Semester setup
// ---------------------------------------------------------------------------

export async function saveSemester(input: SemesterInput): Promise<Semester> {
  requireSuperAdmin();
  if (input.id) {
    const sem = findSemester(input.id);
    Object.assign(sem, { name: input.name, startsOn: input.startsOn, endsOn: input.endsOn });
    audit("update", "semesters", `Updated semester ${sem.name}`);
    return delay(sem);
  }
  if (!input.name.trim()) throw new ApiError("Give the semester a name.");
  if (input.endsOn <= input.startsOn) throw new ApiError("The end date must be after the start date.");
  // Rates carry over from the most recent semester, so the Director only changes what's new.
  const previous = [...store.semesters].sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
  const sem: Semester = { id: uid("sem"), name: input.name.trim(), startsOn: input.startsOn, endsOn: input.endsOn, isClosed: false };
  store.semesters.push(sem);
  // Weeks are generated Monday by Monday from the week containing the start date.
  let monday = mondayOf(input.startsOn);
  let weekNo = 1;
  while (monday <= input.endsOn) {
    store.weeks.push({ id: uid("wk"), semesterId: sem.id, weekNo, weekStart: monday, counts: true });
    monday = addDays(monday, 7);
    weekNo += 1;
  }
  for (const category of ["executive", "member"] as const) {
    const weeklyAmount = previous ? rateFor(previous.id, category) : category === "executive" ? 1000 : 500;
    store.rates.push({ semesterId: sem.id, category, weeklyAmount });
  }
  // Every active member joins from week 1.
  for (const m of store.members.filter((x) => x.isActive)) {
    store.memberSemesters.push({ memberId: m.id, semesterId: sem.id, category: m.category, startWeekNo: 1 });
  }
  audit("create", "semesters", `Created semester ${sem.name} with ${weekNo - 1} weeks`);
  return delay(sem);
}

/** Adds more weeks to the end of a semester (like "Add more weeks" in HIS Finance). */
export async function addWeeks(semesterId: string, count: number): Promise<SemesterWeek[]> {
  requireSuperAdmin();
  const sem = findSemester(semesterId);
  if (sem.isClosed) throw new ApiError("This semester is closed.");
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new ApiError("Add between 1 and 20 weeks.");
  const weeks = store.weeks.filter((w) => w.semesterId === semesterId).sort((a, b) => a.weekNo - b.weekNo);
  const last = weeks[weeks.length - 1];
  let monday = last ? addDays(last.weekStart, 7) : mondayOf(sem.startsOn);
  let weekNo = last ? last.weekNo + 1 : 1;
  for (let i = 0; i < count; i++) {
    store.weeks.push({ id: uid("wk"), semesterId, weekNo, weekStart: monday, counts: true });
    monday = addDays(monday, 7);
    weekNo += 1;
  }
  sem.endsOn = addDays(monday, -1);
  audit("update", "semester_weeks", `Added ${count} week${count === 1 ? "" : "s"} to ${sem.name}`);
  return delay(store.weeks.filter((w) => w.semesterId === semesterId));
}

/** Changes the week a member starts paying from (late joiners). */
export async function setStartWeek(memberId: string, semesterId: string, startWeekNo: number): Promise<MemberSemester> {
  requireAdmin();
  if (findSemester(semesterId).isClosed) throw new ApiError("This semester is closed.");
  const ms = store.memberSemesters.find((x) => x.memberId === memberId && x.semesterId === semesterId);
  if (!ms) throw new ApiError("This member isn't in that semester.");
  const exists = store.weeks.some((w) => w.semesterId === semesterId && w.weekNo === startWeekNo);
  if (!exists) throw new ApiError("Choose a week in this semester.");
  ms.startWeekNo = startWeekNo;
  audit("update", "member_semesters", `${findMember(memberId).fullName} now starts paying from week ${startWeekNo}`);
  return delay(ms);
}

function mondayOf(date: ISODate): ISODate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export async function setWeekCounts(weekId: string, counts: boolean, label?: string): Promise<SemesterWeek> {
  requireAdmin();
  const week = store.weeks.find((w) => w.id === weekId);
  if (!week) throw new ApiError("Week not found.");
  if (findSemester(week.semesterId).isClosed) throw new ApiError("This semester is closed.");
  week.counts = counts;
  if (counts) delete week.label;
  else week.label = label?.trim() || "No dues this week";
  audit("update", "semester_weeks", `Week ${week.weekNo} ${counts ? "now counts" : `no longer counts (${week.label})`}`);
  return delay(week);
}

export async function setRates(semesterId: string, rates: { category: MemberCategory; weeklyAmount: number }[]): Promise<DuesRate[]> {
  requireSuperAdmin();
  if (findSemester(semesterId).isClosed) throw new ApiError("This semester is closed.");
  for (const r of rates) {
    if (!Number.isInteger(r.weeklyAmount) || r.weeklyAmount < 0) throw new ApiError("Rates must be whole pesewas.");
    const row = store.rates.find((x) => x.semesterId === semesterId && x.category === r.category);
    if (row) row.weeklyAmount = r.weeklyAmount;
    else store.rates.push({ semesterId, ...r });
  }
  audit("update", "dues_rates", `Set rates: ${rates.map((r) => `${r.category} ${formatCedi(r.weeklyAmount)}/week`).join(", ")}`);
  return delay(store.rates.filter((r) => r.semesterId === semesterId));
}

export async function closeSemester(semesterId: string): Promise<Semester> {
  requireSuperAdmin();
  const sem = findSemester(semesterId);
  sem.isClosed = true;
  audit("close", "semesters", `Closed ${sem.name}`);
  return delay(sem);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function listAudit(filters: AuditFilters = {}): Promise<AuditEntry[]> {
  requireSuperAdmin();
  const rows = store.audit
    .filter((a) => !filters.table || a.table === filters.table)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, filters.limit ?? 200);
  return delay(rows);
}

/** Lookup helper for display names (officers, recorders). */
export async function listOfficers(): Promise<Member[]> {
  me();
  return delay(store.members.filter((m) => m.role !== "member" && m.isActive));
}

/** Mock-only sign-in hints for development builds. Not part of the real API. */
export const DEV_SIGN_IN_HINTS = MOCK_HINTS;
