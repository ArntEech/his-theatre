// DEMO DATA. Used when the Supabase settings are missing (see src/data/api.ts and api.live.ts).
//
// Every screen reads and changes data ONLY through the functions exported here.
// The mock keeps its data in memory (mirrored to localStorage so a refresh keeps your test data)
// and waits 400 ms on every call to behave like a network.
// The real server must enforce the same permission rules that are checked below.

import { calculateDues, buildSchedule, duesStatus, nextDueWeek } from "@/lib/dues";
import { addDays, localToday, mondayOf } from "@/lib/dates";
import { formatCedi } from "@/lib/money";
import { isDemo } from "@/lib/env";
import { normalizeMemberCode } from "@/lib/member-code";
import {
  ApiError,
  type Adjustment,
  type AdjustmentInput,
  type AdjustmentRow,
  type AuditEntry,
  type AuditFilters,
  type CashHolder,
  type CashPosition,
  type Dashboard,
  type DriveSummary,
  type DuesStatus,
  type Expense,
  type ExpenseInput,
  type ExpenseRow,
  type Handover,
  type HandoverInput,
  type HandoverRow,
  type IncomeInput,
  type IncomeRow,
  type IncomeSource,
  type IsoDate,
  type Member,
  type MemberDetail,
  type MemberFilters,
  type MemberListItem,
  type MemberUpdate,
  type MyDues,
  type NewMemberInput,
  type OfficerChallenge,
  type OtherIncome,
  type Payment,
  type PaymentRow,
  type Position,
  type RatesInput,
  type RecordPaymentInput,
  type Report,
  type Role,
  type Semester,
  type SemesterDetail,
  type SemesterInput,
  type SemesterWeek,
  type Session,
  type SetupCodeResult,
  type TodayReport,
} from "./types";
import { createSeed, SEED_VERSION, type MockDb } from "./mock/seed";

/* ------------------------------------------------------------------ */
/* Mock plumbing                                                        */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "his-theatre.mock-db";
const DELAY_MS = import.meta.env.MODE === "test" ? 0 : 400;
const MAX_PIN_ATTEMPTS = 5;

const hasStorage = typeof localStorage !== "undefined";
let db: MockDb = loadDb();

function loadDb(): MockDb {
  if (hasStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed.version === SEED_VERSION) return parsed;
      }
    } catch {
      // Corrupt or old data: start fresh.
    }
  }
  return createSeed(today());
}

function persist() {
  if (hasStorage) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function delay() {
  return new Promise<void>((resolve) => setTimeout(resolve, DELAY_MS));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function today(): IsoDate {
  return localToday();
}

function now(): string {
  return new Date().toISOString();
}

function nextId(prefix: string) {
  db.counters.id += 1;
  return `${prefix}-${db.counters.id}`;
}

function ref(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Access checks (the real server enforces these with security rules)   */
/* ------------------------------------------------------------------ */

function sessionMember(): Member | null {
  const id = db.session.memberId;
  return id ? (db.members.find((m) => m.id === id) ?? null) : null;
}

function requireMember(): Member {
  const member = sessionMember();
  if (!member) throw new ApiError("Please sign in again.", "unauthenticated");
  return member;
}

function isAdmin(member: Member) {
  return member.role === "admin" || member.role === "super_admin";
}

function requireAdmin(): Member {
  const member = requireMember();
  if (!isAdmin(member)) throw new ApiError("You don't have access to this page.", "forbidden");
  return member;
}

function requireSuperAdmin(): Member {
  const member = requireMember();
  if (member.role !== "super_admin")
    throw new ApiError("Only the Director can do this.", "forbidden");
  return member;
}

function audit(actor: Member, action: string, table: string, summary: string) {
  const entry: AuditEntry = {
    id: nextId("aud"),
    actorName: actor.fullName,
    actorPosition: actor.position,
    action,
    table,
    summary,
    createdAt: now(),
  };
  db.audit.unshift(entry);
}

/* ------------------------------------------------------------------ */
/* Lookups and derived rows                                             */
/* ------------------------------------------------------------------ */

function findMember(id: string): Member {
  const member = db.members.find((m) => m.id === id);
  if (!member) throw new ApiError("That member could not be found.", "not_found");
  return member;
}

function memberName(id: string) {
  return db.members.find((m) => m.id === id)?.fullName ?? "Unknown";
}

function normaliseCode(input: string): string {
  return normalizeMemberCode(input);
}

function findSemester(id: string): Semester {
  const semester = db.semesters.find((s) => s.id === id);
  if (!semester) throw new ApiError("That semester could not be found.", "not_found");
  return semester;
}

function currentSemesterRecord(): Semester | null {
  const t = today();
  const open = db.semesters
    .filter((s) => !s.isClosed)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return (
    open.find((s) => s.startsOn <= t && t <= s.endsOn) ??
    open.find((s) => s.startsOn > t) ??
    open.at(-1) ??
    [...db.semesters].sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] ??
    null
  );
}

function weeksOf(semesterId: string): SemesterWeek[] {
  return db.weeks.filter((w) => w.semesterId === semesterId).sort((a, b) => a.weekNo - b.weekNo);
}

function semesterDetail(semester: Semester): SemesterDetail {
  const weeks = weeksOf(semester.id);
  const t = today();
  const current = weeks.find((w) => w.weekStart <= t && t < addDays(w.weekStart, 7));
  return {
    ...semester,
    weeks,
    rates: db.rates.filter((r) => r.semesterId === semester.id),
    today: t,
    currentWeekNo: current?.weekNo ?? null,
  };
}

function adjustmentRow(a: Adjustment): AdjustmentRow {
  return { ...a, recordedByName: memberName(a.recordedBy) };
}

function paymentRow(p: Payment): PaymentRow {
  const member = db.members.find((m) => m.id === p.memberId);
  const voiding = db.payments.find((r) => r.reversesPaymentId === p.id);
  const original = p.reversesPaymentId
    ? db.payments.find((o) => o.id === p.reversesPaymentId)
    : undefined;
  return {
    ...p,
    memberName: member?.fullName ?? "Unknown",
    memberCode: member?.memberCode ?? "",
    recordedByName: memberName(p.recordedBy),
    voidedBy: voiding?.receiptNo ?? null,
    reversesReceiptNo: original?.receiptNo ?? null,
  };
}

function expenseRow(e: Expense): ExpenseRow {
  const voiding = db.expenses.find((r) => r.reversesId === e.id);
  const original = e.reversesId ? db.expenses.find((o) => o.id === e.reversesId) : undefined;
  return {
    ...e,
    recordedByName: memberName(e.recordedBy),
    voidedBy: voiding?.ref ?? null,
    reversesRef: original?.ref ?? null,
  };
}

function incomeRow(i: OtherIncome): IncomeRow {
  const voiding = db.income.find((r) => r.reversesId === i.id);
  const original = i.reversesId ? db.income.find((o) => o.id === i.reversesId) : undefined;
  return {
    ...i,
    recordedByName: memberName(i.recordedBy),
    voidedBy: voiding?.ref ?? null,
    reversesRef: original?.ref ?? null,
  };
}

function handoverRow(h: Handover): HandoverRow {
  return { ...h, fromName: memberName(h.fromMemberId), toName: memberName(h.toMemberId) };
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) =>
  b.createdAt.localeCompare(a.createdAt);

function duesFor(memberId: string, semesterId: string): MyDues | null {
  const member = findMember(memberId);
  const ms = db.memberSemesters.find((x) => x.memberId === memberId && x.semesterId === semesterId);
  if (!ms) return null;
  const rate = db.rates.find((r) => r.semesterId === semesterId && r.category === ms.category);
  if (!rate) return null;
  const weeks = weeksOf(semesterId);
  const adjustments = db.adjustments.filter(
    (a) => a.memberId === memberId && a.semesterId === semesterId,
  );
  const payments = db.payments.filter(
    (p) => p.memberId === memberId && p.semesterId === semesterId,
  );
  const t = today();
  const summary = calculateDues(ms, weeks, rate, adjustments, payments, t, member.leftOn);
  const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const schedule = buildSchedule(ms, weeks, summary, adjustmentTotal, t, member.leftOn);
  return {
    ...summary,
    status: duesStatus(summary),
    schedule,
    adjustments: adjustments.map(adjustmentRow).sort(byNewest),
    nextDue: nextDueWeek(schedule, t),
  };
}

function listItem(member: Member, semesterId: string | null): MemberListItem {
  const dues = semesterId ? duesFor(member.id, semesterId) : null;
  if (!dues) return { member, dues: null, status: null };
  const { status, schedule: _s, adjustments: _a, nextDue: _n, ...summary } = dues;
  return { member, dues: summary, status };
}

function cashPosition(): CashPosition {
  const officers = db.members.filter(
    (m) =>
      isAdmin(m) ||
      db.payments.some((p) => p.recordedBy === m.id && p.method === "cash") ||
      db.handovers.some((h) => h.toMemberId === m.id || h.fromMemberId === m.id),
  );
  const holders: CashHolder[] = officers.map((m) => {
    const collected =
      db.payments
        .filter((p) => p.recordedBy === m.id && p.method === "cash")
        .reduce((s, p) => s + p.amount, 0) +
      db.income
        .filter((i) => i.recordedBy === m.id && i.method === "cash")
        .reduce((s, i) => s + i.amount, 0);
    const received = db.handovers
      .filter((h) => h.toMemberId === m.id && h.confirmedAt)
      .reduce((s, h) => s + h.amount, 0);
    const handedOver = db.handovers
      .filter((h) => h.fromMemberId === m.id)
      .reduce((s, h) => s + h.amount, 0);
    const spent = db.expenses
      .filter((e) => e.recordedBy === m.id)
      .reduce((s, e) => s + e.amount, 0);
    return {
      memberId: m.id,
      fullName: m.fullName,
      position: m.position,
      collected,
      received,
      handedOver,
      spent,
      holding: collected + received - handedOver - spent,
    };
  });
  const duesIn = db.payments.reduce((s, p) => s + p.amount, 0);
  const incomeIn = db.income.reduce((s, i) => s + i.amount, 0);
  const totalOut = db.expenses.reduce((s, e) => s + e.amount, 0);
  const cashIn = [...db.payments, ...db.income]
    .filter((x) => x.method === "cash")
    .reduce((s, x) => s + x.amount, 0);
  const momoIn = [...db.payments, ...db.income]
    .filter((x) => x.method === "momo")
    .reduce((s, x) => s + x.amount, 0);
  const pending = db.handovers.filter((h) => !h.confirmedAt);
  return {
    totalIn: duesIn + incomeIn,
    totalOut,
    balance: duesIn + incomeIn - totalOut,
    cashIn,
    momoIn,
    inTransit: pending.reduce((s, h) => s + h.amount, 0),
    holders: holders.sort((a, b) => b.holding - a.holding),
    pendingHandovers: pending
      .map(handoverRow)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    handovers: db.handovers
      .map(handoverRow)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
  };
}

function requireText(value: string | undefined, label: string, min = 3): string {
  const text = (value ?? "").trim();
  if (text.length < min) throw new ApiError(`${label} is required.`, "invalid");
  return text;
}

function requirePositiveAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new ApiError("Enter an amount greater than zero.", "invalid");
}

function requireOpenSemester(semesterId: string) {
  const semester = findSemester(semesterId);
  if (semester.isClosed)
    throw new ApiError(
      `${semester.name} is closed. Money can no longer be recorded against it.`,
      "closed",
    );
  return semester;
}

function validatePin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new ApiError("Your PIN must be exactly 4 digits.", "invalid");
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

export async function signInMember(memberCode: string, pin: string): Promise<Session> {
  await delay();
  const code = normaliseCode(memberCode);
  const member = db.members.find((m) => m.memberCode === code);
  if (!member)
    throw new ApiError("We could not find that member ID. Check it and try again.", "not_found");
  if (!member.isActive)
    throw new ApiError(
      "This membership is no longer active. Speak to the Financial Secretary.",
      "inactive",
    );
  if (!member.isActivated)
    throw new ApiError(
      "This account has not been activated yet. Use your setup code to activate it first.",
      "not_activated",
    );
  if (member.isLocked)
    throw new ApiError(
      "Your account is locked after too many wrong PINs. Ask the Financial Secretary to unlock it.",
      "locked",
    );
  const cred = db.credentials[member.id];
  if (cred.pin !== pin) {
    cred.failedAttempts += 1;
    const left = MAX_PIN_ATTEMPTS - cred.failedAttempts;
    if (left <= 0) {
      member.isLocked = true;
      persist();
      throw new ApiError(
        "Too many wrong PINs. Your account is now locked. Ask the Financial Secretary to unlock it.",
        "locked",
      );
    }
    persist();
    throw new ApiError(
      `That PIN is not right. ${left} ${left === 1 ? "try" : "tries"} left.`,
      "wrong_pin",
    );
  }
  cred.failedAttempts = 0;
  db.session = { memberId: member.id, pendingOfficerId: null };
  persist();
  return clone({ member });
}

export async function activateMember(
  memberCode: string,
  setupCode: string,
  newPin: string,
): Promise<Session> {
  await delay();
  const code = normaliseCode(memberCode);
  const member = db.members.find((m) => m.memberCode === code);
  const cred = member ? db.credentials[member.id] : undefined;
  if (!member || !cred || !cred.setupCode || cred.setupCode !== setupCode.trim()) {
    throw new ApiError(
      "That member ID and setup code do not match. Ask the Financial Secretary for a new code.",
      "invalid_code",
    );
  }
  if (cred.setupCodeExpiresAt && cred.setupCodeExpiresAt < now()) {
    throw new ApiError(
      "That setup code has expired. Ask the Financial Secretary for a new one.",
      "expired",
    );
  }
  validatePin(newPin);
  cred.pin = newPin;
  cred.setupCode = null;
  cred.setupCodeExpiresAt = null;
  cred.failedAttempts = 0;
  member.isActivated = true;
  member.isLocked = false;
  db.session = { memberId: member.id, pendingOfficerId: null };
  audit(member, "Activated account", "members", `${member.memberCode} set their PIN`);
  persist();
  return clone({ member });
}

export async function signInOfficer(email: string, password: string): Promise<OfficerChallenge> {
  await delay();
  const login = db.officers.find((o) => o.email.toLowerCase() === email.trim().toLowerCase());
  if (!login || login.password !== password)
    throw new ApiError("That email and password do not match.", "invalid_credentials");
  const member = findMember(login.memberId);
  if (!isAdmin(member) || !member.isActive)
    throw new ApiError("This officer account is no longer active.", "inactive");
  db.session.pendingOfficerId = member.id;
  persist();
  // MOCK: officers already have an authenticator app set up; every code is 246810.
  return {};
}

export async function verifyOfficerCode(code: string): Promise<Session> {
  await delay();
  const pendingId = db.session.pendingOfficerId;
  if (!pendingId) throw new ApiError("Start again with your email and password.", "no_challenge");
  // MOCK: every officer's verification code is 246810.
  if (code.trim() !== "246810")
    throw new ApiError("That code is not right. Check the message and try again.", "invalid_code");
  const member = findMember(pendingId);
  db.session = { memberId: member.id, pendingOfficerId: null };
  audit(
    member,
    "Signed in",
    "sessions",
    `${member.position ?? "Officer"} signed in with email and code`,
  );
  persist();
  return clone({ member });
}

export async function signOut(): Promise<void> {
  await delay();
  db.session = { memberId: null, pendingOfficerId: null };
  persist();
}

export async function getCurrentMember(): Promise<Member | null> {
  await delay();
  return clone(sessionMember());
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  await delay();
  const member = requireMember();
  const cred = db.credentials[member.id];
  if (cred.pin !== currentPin) throw new ApiError("Your current PIN is not right.", "wrong_pin");
  validatePin(newPin);
  if (newPin === currentPin)
    throw new ApiError("Choose a PIN that is different from your current one.", "invalid");
  cred.pin = newPin;
  audit(member, "Changed PIN", "members", `${member.memberCode} changed their PIN`);
  persist();
}

/* ------------------------------------------------------------------ */
/* My dues                                                              */
/* ------------------------------------------------------------------ */

export async function getMyDues(semesterId: string): Promise<MyDues | null> {
  await delay();
  const member = requireMember();
  return clone(duesFor(member.id, semesterId));
}

export async function getMyPayments(semesterId: string): Promise<PaymentRow[]> {
  await delay();
  const member = requireMember();
  return clone(
    db.payments
      .filter((p) => p.memberId === member.id && p.semesterId === semesterId)
      .sort(byNewest)
      .map(paymentRow),
  );
}

export async function listSemesters(): Promise<Semester[]> {
  await delay();
  requireMember();
  return clone([...db.semesters].sort((a, b) => b.startsOn.localeCompare(a.startsOn)));
}

export async function getCurrentSemester(): Promise<SemesterDetail | null> {
  await delay();
  requireMember();
  const semester = currentSemesterRecord();
  return semester ? clone(semesterDetail(semester)) : null;
}

/* ------------------------------------------------------------------ */
/* Members                                                              */
/* ------------------------------------------------------------------ */

export async function listMembers(filters: MemberFilters = {}): Promise<MemberListItem[]> {
  await delay();
  requireAdmin();
  const semesterId = currentSemesterRecord()?.id ?? null;
  const search = filters.search?.trim().toLowerCase() ?? "";
  return clone(
    db.members
      .filter((m) => filters.includeInactive || m.isActive)
      .filter((m) => !filters.drive || m.drive === filters.drive)
      .filter(
        (m) =>
          !search ||
          m.fullName.toLowerCase().includes(search) ||
          m.memberCode.toLowerCase().includes(search) ||
          m.phone.replace(/\s/g, "").includes(search.replace(/\s/g, "")),
      )
      .map((m) => listItem(m, semesterId))
      .filter((item) => !filters.status || item.status === filters.status)
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName)),
  );
}

export async function getMember(id: string): Promise<MemberDetail> {
  await delay();
  const me = requireMember();
  if (me.id !== id && !isAdmin(me))
    throw new ApiError("You don't have access to this page.", "forbidden");
  const member = findMember(id);
  const semesterId = currentSemesterRecord()?.id ?? null;
  return clone({
    member,
    semesterId,
    memberSemester:
      db.memberSemesters.find((x) => x.memberId === id && x.semesterId === semesterId) ?? null,
    dues: semesterId ? duesFor(id, semesterId) : null,
    payments: db.payments
      .filter((p) => p.memberId === id && (!semesterId || p.semesterId === semesterId))
      .sort(byNewest)
      .map(paymentRow),
    adjustments: db.adjustments
      .filter((a) => a.memberId === id && (!semesterId || a.semesterId === semesterId))
      .sort(byNewest)
      .map(adjustmentRow),
  });
}

export async function addMember(input: NewMemberInput): Promise<Member> {
  await delay();
  const actor = requireAdmin();
  const fullName = requireText(input.fullName, "Full name");
  const drive = requireText(input.drive, "Drive", 1);
  db.counters.member += 1;
  const member: Member = {
    id: nextId("mem"),
    memberCode: `HIS-${String(db.counters.member).padStart(3, "0")}`,
    fullName,
    phone: input.phone.trim(),
    drive,
    category: input.category,
    role: "member",
    position: null,
    isActive: true,
    leftOn: null,
    isActivated: false,
    isLocked: false,
  };
  db.members.push(member);
  db.credentials[member.id] = {
    pin: null,
    failedAttempts: 0,
    setupCode: null,
    setupCodeExpiresAt: null,
  };
  const semester = currentSemesterRecord();
  if (semester) {
    const maxWeek = weeksOf(semester.id).length || 1;
    db.memberSemesters.push({
      memberId: member.id,
      semesterId: semester.id,
      category: input.category,
      startWeekNo: Math.min(Math.max(1, Math.round(input.startWeekNo)), maxWeek),
    });
  }
  audit(
    actor,
    "Added member",
    "members",
    `${member.memberCode} · ${member.fullName} (${member.drive})`,
  );
  persist();
  return clone(member);
}

export async function updateMember(id: string, patch: MemberUpdate): Promise<Member> {
  await delay();
  const actor = requireAdmin();
  const member = findMember(id);
  const changes: string[] = [];
  if (patch.fullName !== undefined && patch.fullName.trim() !== member.fullName) {
    member.fullName = requireText(patch.fullName, "Full name");
    changes.push("name");
  }
  if (patch.phone !== undefined && patch.phone.trim() !== member.phone) {
    member.phone = patch.phone.trim();
    changes.push("phone");
  }
  if (patch.drive !== undefined && patch.drive !== member.drive) {
    member.drive = requireText(patch.drive, "Drive", 1);
    changes.push("drive");
  }
  if (patch.category !== undefined && patch.category !== member.category) {
    member.category = patch.category;
    // The category for the current semester follows, so the right weekly rate applies.
    const semester = currentSemesterRecord();
    const ms =
      semester && db.memberSemesters.find((x) => x.memberId === id && x.semesterId === semester.id);
    if (ms && semester && !semester.isClosed) ms.category = patch.category;
    changes.push("category");
  }
  if (changes.length)
    audit(
      actor,
      "Updated member",
      "members",
      `${member.memberCode}: changed ${changes.join(", ")}`,
    );
  persist();
  return clone(member);
}

export async function deactivateMember(id: string, leftOn: IsoDate): Promise<Member> {
  await delay();
  const actor = requireAdmin();
  const member = findMember(id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leftOn))
    throw new ApiError("Choose the date they left.", "invalid");
  if (member.id === actor.id)
    throw new ApiError("You cannot deactivate your own account.", "invalid");
  member.isActive = false;
  member.leftOn = leftOn;
  audit(
    actor,
    "Deactivated member",
    "members",
    `${member.memberCode} · ${member.fullName} left on ${leftOn}`,
  );
  persist();
  return clone(member);
}

/* ------------------------------------------------------------------ */
/* Money: dues payments and adjustments                                 */
/* ------------------------------------------------------------------ */

export async function recordPayment(input: RecordPaymentInput): Promise<PaymentRow> {
  await delay();
  const actor = requireAdmin();
  // Idempotency: a retried submission returns the payment that was already recorded.
  const existing = db.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
  if (existing) return clone(paymentRow(existing));

  requirePositiveAmount(input.amount);
  requireOpenSemester(input.semesterId);
  const member = findMember(input.memberId);
  if (
    !db.memberSemesters.some((x) => x.memberId === member.id && x.semesterId === input.semesterId)
  ) {
    throw new ApiError(`${member.fullName} is not on the roll for this semester.`, "invalid");
  }
  const momoReference = input.momoReference?.trim();
  if (input.method === "momo" && !momoReference)
    throw new ApiError("Enter the MoMo transaction ID.", "invalid");
  if (input.paidOn > today())
    throw new ApiError("The payment date cannot be in the future.", "invalid");

  db.counters.receipt += 1;
  const payment: Payment = {
    id: nextId("pay"),
    receiptNo: ref("R", db.counters.receipt),
    memberId: member.id,
    semesterId: input.semesterId,
    amount: input.amount,
    method: input.method,
    ...(input.method === "momo" ? { momoReference } : {}),
    paidOn: input.paidOn,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    idempotencyKey: input.idempotencyKey,
    recordedBy: actor.id,
    createdAt: now(),
  };
  db.payments.push(payment);
  audit(
    actor,
    "Recorded payment",
    "payments",
    `${payment.receiptNo} · ${member.fullName} · ${formatCedi(payment.amount)} ${payment.method === "momo" ? "MoMo" : "cash"}`,
  );
  persist();
  return clone(paymentRow(payment));
}

export async function reversePayment(id: string, reason: string): Promise<PaymentRow> {
  await delay();
  const actor = requireAdmin();
  const original = db.payments.find((p) => p.id === id);
  if (!original) throw new ApiError("That payment could not be found.", "not_found");
  if (original.reversesPaymentId)
    throw new ApiError(
      "A reversal cannot itself be voided. Record a new payment instead.",
      "invalid",
    );
  if (db.payments.some((p) => p.reversesPaymentId === id))
    throw new ApiError(`${original.receiptNo} has already been voided.`, "invalid");
  const why = requireText(reason, "A reason");
  requireOpenSemester(original.semesterId);

  db.counters.receipt += 1;
  const reversal: Payment = {
    id: nextId("pay"),
    receiptNo: ref("R", db.counters.receipt),
    memberId: original.memberId,
    semesterId: original.semesterId,
    amount: -original.amount,
    method: original.method,
    ...(original.momoReference ? { momoReference: original.momoReference } : {}),
    paidOn: today(),
    note: why,
    reversesPaymentId: original.id,
    idempotencyKey: `reverse:${original.id}`,
    recordedBy: actor.id,
    createdAt: now(),
  };
  db.payments.push(reversal);
  audit(
    actor,
    "Voided payment",
    "payments",
    `${reversal.receiptNo} reverses ${original.receiptNo} for ${memberName(original.memberId)}. Reason: ${why}`,
  );
  persist();
  return clone(paymentRow(reversal));
}

export async function addAdjustment(input: AdjustmentInput): Promise<AdjustmentRow> {
  await delay();
  const actor = requireAdmin();
  if (!Number.isSafeInteger(input.amount) || input.amount === 0)
    throw new ApiError("Enter an amount greater than zero.", "invalid");
  const why = requireText(input.reason, "A reason");
  requireOpenSemester(input.semesterId);
  const member = findMember(input.memberId);
  const adjustment: Adjustment = {
    id: nextId("adj"),
    memberId: member.id,
    semesterId: input.semesterId,
    amount: input.amount,
    reason: why,
    recordedBy: actor.id,
    createdAt: now(),
  };
  db.adjustments.push(adjustment);
  const kind =
    input.amount < 0
      ? `waiver of ${formatCedi(-input.amount)}`
      : `extra charge of ${formatCedi(input.amount)}`;
  audit(actor, "Added adjustment", "adjustments", `${member.fullName}: ${kind}. ${why}`);
  persist();
  return clone(adjustmentRow(adjustment));
}

/* ------------------------------------------------------------------ */
/* Money: expenses, other income, handovers                             */
/* ------------------------------------------------------------------ */

export async function recordExpense(input: ExpenseInput): Promise<ExpenseRow> {
  await delay();
  const actor = requireAdmin();
  requirePositiveAmount(input.amount);
  if (input.date > today())
    throw new ApiError("The expense date cannot be in the future.", "invalid");
  db.counters.expense += 1;
  const expense: Expense = {
    id: nextId("exp"),
    ref: ref("E", db.counters.expense),
    description: requireText(input.description, "A description"),
    category: requireText(input.category, "A category", 1),
    amount: input.amount,
    paidBy: requireText(input.paidBy, "Who paid", 2),
    approvedBy: requireText(input.approvedBy, "Who approved it", 2),
    ...(input.receiptRef?.trim() ? { receiptRef: input.receiptRef.trim() } : {}),
    date: input.date,
    recordedBy: actor.id,
    createdAt: now(),
  };
  db.expenses.push(expense);
  audit(
    actor,
    "Recorded expense",
    "expenses",
    `${expense.ref} · ${expense.description} · ${formatCedi(expense.amount)}`,
  );
  persist();
  return clone(expenseRow(expense));
}

export async function reverseExpense(id: string, reason: string): Promise<ExpenseRow> {
  await delay();
  const actor = requireAdmin();
  const original = db.expenses.find((e) => e.id === id);
  if (!original) throw new ApiError("That expense could not be found.", "not_found");
  if (original.reversesId) throw new ApiError("A reversal cannot itself be voided.", "invalid");
  if (db.expenses.some((e) => e.reversesId === id))
    throw new ApiError(`${original.ref} has already been voided.`, "invalid");
  const why = requireText(reason, "A reason");
  db.counters.expense += 1;
  const reversal: Expense = {
    ...original,
    id: nextId("exp"),
    ref: ref("E", db.counters.expense),
    description: why,
    amount: -original.amount,
    date: today(),
    reversesId: original.id,
    recordedBy: actor.id,
    createdAt: now(),
  };
  db.expenses.push(reversal);
  audit(
    actor,
    "Voided expense",
    "expenses",
    `${reversal.ref} reverses ${original.ref}. Reason: ${why}`,
  );
  persist();
  return clone(expenseRow(reversal));
}

export async function recordIncome(input: IncomeInput): Promise<IncomeRow> {
  await delay();
  const actor = requireAdmin();
  requirePositiveAmount(input.amount);
  if (input.date > today()) throw new ApiError("The date cannot be in the future.", "invalid");
  db.counters.income += 1;
  const income: OtherIncome = {
    id: nextId("inc"),
    ref: ref("I", db.counters.income),
    source: input.source,
    description: requireText(input.description, "A description"),
    amount: input.amount,
    method: input.method,
    date: input.date,
    recordedBy: actor.id,
    createdAt: now(),
  };
  db.income.push(income);
  audit(
    actor,
    "Recorded income",
    "other_income",
    `${income.ref} · ${income.description} · ${formatCedi(income.amount)}`,
  );
  persist();
  return clone(incomeRow(income));
}

export async function reverseIncome(id: string, reason: string): Promise<IncomeRow> {
  await delay();
  const actor = requireAdmin();
  const original = db.income.find((i) => i.id === id);
  if (!original) throw new ApiError("That income could not be found.", "not_found");
  if (original.reversesId) throw new ApiError("A reversal cannot itself be voided.", "invalid");
  if (db.income.some((i) => i.reversesId === id))
    throw new ApiError(`${original.ref} has already been voided.`, "invalid");
  const why = requireText(reason, "A reason");
  db.counters.income += 1;
  const reversal: OtherIncome = {
    ...original,
    id: nextId("inc"),
    ref: ref("I", db.counters.income),
    description: why,
    amount: -original.amount,
    date: today(),
    reversesId: original.id,
    recordedBy: actor.id,
    createdAt: now(),
  };
  db.income.push(reversal);
  audit(
    actor,
    "Voided income",
    "other_income",
    `${reversal.ref} reverses ${original.ref}. Reason: ${why}`,
  );
  persist();
  return clone(incomeRow(reversal));
}

export async function recordHandover(input: HandoverInput): Promise<HandoverRow> {
  await delay();
  const actor = requireAdmin();
  requirePositiveAmount(input.amount);
  const to = findMember(input.toMemberId);
  if (to.id === actor.id) throw new ApiError("Choose someone other than yourself.", "invalid");
  if (!isAdmin(to)) throw new ApiError("Cash can only be handed to an officer.", "invalid");
  const holding = cashPosition().holders.find((h) => h.memberId === actor.id)?.holding ?? 0;
  if (input.amount > holding)
    throw new ApiError(
      `You are only holding ${formatCedi(Math.max(0, holding))} in cash.`,
      "invalid",
    );
  db.counters.handover += 1;
  const handover: Handover = {
    id: nextId("ho"),
    ref: ref("H", db.counters.handover),
    fromMemberId: actor.id,
    toMemberId: to.id,
    amount: input.amount,
    recordedAt: now(),
    confirmedAt: null,
  };
  db.handovers.push(handover);
  audit(
    actor,
    "Recorded handover",
    "handovers",
    `${handover.ref} · ${formatCedi(handover.amount)} to ${to.fullName}`,
  );
  persist();
  return clone(handoverRow(handover));
}

export async function confirmHandover(id: string): Promise<HandoverRow> {
  await delay();
  const actor = requireAdmin();
  const handover = db.handovers.find((h) => h.id === id);
  if (!handover) throw new ApiError("That handover could not be found.", "not_found");
  if (handover.toMemberId !== actor.id)
    throw new ApiError(
      `Only ${memberName(handover.toMemberId)} can confirm receiving this cash.`,
      "forbidden",
    );
  if (handover.confirmedAt) throw new ApiError(`${handover.ref} was already confirmed.`, "invalid");
  handover.confirmedAt = now();
  audit(
    actor,
    "Confirmed handover",
    "handovers",
    `${handover.ref} · received ${formatCedi(handover.amount)} from ${memberName(handover.fromMemberId)}`,
  );
  persist();
  return clone(handoverRow(handover));
}

export async function getCashPosition(): Promise<CashPosition> {
  await delay();
  requireAdmin();
  return clone(cashPosition());
}

/* ------------------------------------------------------------------ */
/* Today, dashboard and reports                                         */
/* ------------------------------------------------------------------ */

export async function getToday(): Promise<TodayReport> {
  await delay();
  const actor = requireAdmin();
  const t = today();
  const payments = db.payments.filter((p) => p.paidOn === t).sort(byNewest);
  const income = db.income.filter((i) => i.date === t).sort(byNewest);
  const expenses = db.expenses.filter((e) => e.date === t).sort(byNewest);
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
  const duesCash = sum(payments.filter((p) => p.method === "cash"));
  const duesMomo = sum(payments.filter((p) => p.method === "momo"));
  const incomeTotal = sum(income);
  const expensesTotal = sum(expenses);
  const position = cashPosition();
  return clone({
    date: t,
    net: duesCash + duesMomo + incomeTotal - expensesTotal,
    duesTotal: duesCash + duesMomo,
    duesCash,
    duesMomo,
    incomeTotal,
    expensesTotal,
    payments: payments.map(paymentRow),
    income: income.map(incomeRow),
    expenses: expenses.map(expenseRow),
    handovers: db.handovers.filter((h) => h.recordedAt.slice(0, 10) === t).map(handoverRow),
    pendingHandovers: position.pendingHandovers,
    myCashHolding: position.holders.find((h) => h.memberId === actor.id)?.holding ?? 0,
  });
}

export async function getDashboard(semesterId: string): Promise<Dashboard> {
  await delay();
  requireAdmin();
  const semester = findSemester(semesterId);
  const rows = db.members
    .filter((m) =>
      db.memberSemesters.some((x) => x.memberId === m.id && x.semesterId === semesterId),
    )
    .map((m) => listItem(m, semesterId));
  const active = rows.filter((r) => r.member.isActive);
  const counts: Record<DuesStatus, number> = { paid_up: 0, behind: 0, ahead: 0 };
  for (const r of active) if (r.status) counts[r.status] += 1;
  const drivesMap = new Map<string, DriveSummary>();
  for (const r of active) {
    const d = drivesMap.get(r.member.drive) ?? {
      drive: r.member.drive,
      members: 0,
      paidUp: 0,
      behind: 0,
      ahead: 0,
      owing: 0,
      paid: 0,
    };
    d.members += 1;
    if (r.status === "paid_up") d.paidUp += 1;
    if (r.status === "behind") d.behind += 1;
    if (r.status === "ahead") d.ahead += 1;
    d.owing += r.dues?.owing ?? 0;
    d.paid += r.dues?.paid ?? 0;
    drivesMap.set(r.member.drive, d);
  }
  const sum = (f: (r: MemberListItem) => number, list = rows) => list.reduce((s, r) => s + f(r), 0);
  const t = today();
  return clone({
    semester: semesterDetail(semester),
    activeMembers: active.length,
    dueSoFar: sum((r) => r.dues?.dueSoFar ?? 0),
    semesterTotal: sum((r) => r.dues?.semesterTotal ?? 0),
    collected: db.payments
      .filter((p) => p.semesterId === semesterId)
      .reduce((s, p) => s + p.amount, 0),
    owingTotal: sum((r) => r.dues?.owing ?? 0),
    creditTotal: sum((r) => r.dues?.credit ?? 0),
    counts,
    drives: [...drivesMap.values()].sort((a, b) => a.drive.localeCompare(b.drive)),
    mostBehind: active
      .filter((r) => r.status === "behind")
      .sort((a, b) => (b.dues?.owing ?? 0) - (a.dues?.owing ?? 0))
      .slice(0, 5),
    balance: cashPosition().balance,
    pendingHandovers: db.handovers.filter((h) => !h.confirmedAt).length,
    collectedToday: db.payments.filter((p) => p.paidOn === t).reduce((s, p) => s + p.amount, 0),
  });
}

export async function getReport(from: IsoDate, to: IsoDate): Promise<Report> {
  await delay();
  requireAdmin();
  if (from > to) throw new ApiError("The start date must be on or before the end date.", "invalid");
  const inRange = (d: string) => from <= d && d <= to;
  const payments = db.payments.filter((p) => inRange(p.paidOn)).sort(byNewest);
  const income = db.income.filter((i) => inRange(i.date)).sort(byNewest);
  const expenses = db.expenses.filter((e) => inRange(e.date)).sort(byNewest);
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

  const sources = new Map<IncomeSource, number>();
  for (const i of income) sources.set(i.source, (sources.get(i.source) ?? 0) + i.amount);
  const categories = new Map<string, number>();
  for (const e of expenses)
    categories.set(e.category, (categories.get(e.category) ?? 0) + e.amount);

  const duesNet = sum(payments);
  const incomeTotal = sum(income);
  const expensesTotal = sum(expenses);
  return clone({
    from,
    to,
    dues: {
      cash: sum(payments.filter((p) => p.method === "cash" && !p.reversesPaymentId)),
      momo: sum(payments.filter((p) => p.method === "momo" && !p.reversesPaymentId)),
      reversals: sum(payments.filter((p) => p.reversesPaymentId)),
      net: duesNet,
      receipts: payments.filter((p) => !p.reversesPaymentId).length,
    },
    income: {
      bySource: [...sources].map(([source, amount]) => ({ source, amount })),
      total: incomeTotal,
    },
    expenses: {
      byCategory: [...categories].map(([category, amount]) => ({ category, amount })),
      total: expensesTotal,
    },
    totalIn: duesNet + incomeTotal,
    totalOut: expensesTotal,
    net: duesNet + incomeTotal - expensesTotal,
    payments: payments.map(paymentRow),
    incomeRows: income.map(incomeRow),
    expenseRows: expenses.map(expenseRow),
    handovers: db.handovers.filter((h) => inRange(h.recordedAt.slice(0, 10))).map(handoverRow),
  });
}

/* ------------------------------------------------------------------ */
/* Semester settings                                                    */
/* ------------------------------------------------------------------ */

export async function saveSemester(input: SemesterInput): Promise<SemesterDetail> {
  await delay();
  const actor = requireSuperAdmin();
  const name = requireText(input.name, "A name", 2);
  if (!input.startsOn || !input.endsOn || input.startsOn > input.endsOn) {
    throw new ApiError("The semester must end after it starts.", "invalid");
  }
  // One row per Monday from the week containing the start date to the end date.
  const mondays: IsoDate[] = [];
  for (let d = mondayOf(input.startsOn); d <= input.endsOn; d = addDays(d, 7)) mondays.push(d);
  if (mondays.length > 30)
    throw new ApiError("A semester cannot be longer than 30 weeks.", "invalid");

  let semester: Semester;
  if (input.id) {
    semester = findSemester(input.id);
    if (semester.isClosed) throw new ApiError("A closed semester cannot be changed.", "closed");
    const previous = weeksOf(semester.id);
    semester.name = name;
    semester.startsOn = input.startsOn;
    semester.endsOn = input.endsOn;
    db.weeks = db.weeks.filter((w) => w.semesterId !== semester.id);
    mondays.forEach((weekStart, i) => {
      const kept = previous.find((w) => w.weekStart === weekStart);
      db.weeks.push(
        kept
          ? { ...kept, weekNo: i + 1 }
          : { id: nextId("wk"), semesterId: semester.id, weekNo: i + 1, weekStart, counts: true },
      );
    });
    audit(
      actor,
      "Updated semester",
      "semesters",
      `${name}: ${input.startsOn} to ${input.endsOn}, ${mondays.length} weeks`,
    );
  } else {
    const previous = currentSemesterRecord();
    semester = {
      id: nextId("sem"),
      name,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      isClosed: false,
    };
    db.semesters.push(semester);
    mondays.forEach((weekStart, i) => {
      db.weeks.push({
        id: nextId("wk"),
        semesterId: semester.id,
        weekNo: i + 1,
        weekStart,
        counts: true,
      });
    });
    for (const category of ["executive", "member"] as const) {
      const prevRate =
        previous && db.rates.find((r) => r.semesterId === previous.id && r.category === category);
      db.rates.push({
        semesterId: semester.id,
        category,
        weeklyAmount: prevRate?.weeklyAmount ?? (category === "executive" ? 1000 : 500),
      });
    }
    for (const m of db.members.filter((x) => x.isActive)) {
      db.memberSemesters.push({
        memberId: m.id,
        semesterId: semester.id,
        category: m.category,
        startWeekNo: 1,
      });
    }
    audit(
      actor,
      "Created semester",
      "semesters",
      `${name}: ${input.startsOn} to ${input.endsOn}, ${mondays.length} weeks`,
    );
  }
  persist();
  return clone(semesterDetail(semester));
}

export async function setWeekCounts(
  weekId: string,
  counts: boolean,
  label?: string,
): Promise<SemesterWeek> {
  await delay();
  const actor = requireSuperAdmin();
  const week = db.weeks.find((w) => w.id === weekId);
  if (!week) throw new ApiError("That week could not be found.", "not_found");
  const semester = requireOpenSemester(week.semesterId);
  week.counts = counts;
  const text = label?.trim();
  if (text) week.label = text;
  else delete week.label;
  audit(
    actor,
    counts ? "Counted week" : "Skipped week",
    "semester_weeks",
    `${semester.name} week ${week.weekNo} (${week.weekStart})${text ? `: ${text}` : ""}`,
  );
  persist();
  return clone(week);
}

export async function setRates(semesterId: string, rates: RatesInput): Promise<SemesterDetail> {
  await delay();
  const actor = requireSuperAdmin();
  const semester = requireOpenSemester(semesterId);
  for (const category of ["executive", "member"] as const) {
    const amount = rates[category];
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new ApiError("Rates must be zero or more.", "invalid");
    const existing = db.rates.find((r) => r.semesterId === semesterId && r.category === category);
    if (existing) existing.weeklyAmount = amount;
    else db.rates.push({ semesterId, category, weeklyAmount: amount });
  }
  audit(
    actor,
    "Set dues rates",
    "dues_rates",
    `${semester.name}: executives ${formatCedi(rates.executive)}, members ${formatCedi(rates.member)} a week`,
  );
  persist();
  return clone(semesterDetail(semester));
}

export async function closeSemester(semesterId: string): Promise<Semester> {
  await delay();
  const actor = requireSuperAdmin();
  const semester = findSemester(semesterId);
  if (semester.isClosed) throw new ApiError(`${semester.name} is already closed.`, "invalid");
  semester.isClosed = true;
  audit(
    actor,
    "Closed semester",
    "semesters",
    `${semester.name} closed. No more money can be recorded against it.`,
  );
  persist();
  return clone(semester);
}

/* ------------------------------------------------------------------ */
/* Accounts and roles                                                   */
/* ------------------------------------------------------------------ */

export async function issueSetupCode(memberId: string): Promise<SetupCodeResult> {
  await delay();
  const actor = requireAdmin();
  const member = findMember(memberId);
  if (!member.isActive) throw new ApiError("This member is no longer active.", "inactive");
  const setupCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const cred = db.credentials[member.id];
  cred.setupCode = setupCode;
  cred.setupCodeExpiresAt = expiresAt;
  // A new setup code is also how a forgotten PIN is reset.
  cred.pin = null;
  cred.failedAttempts = 0;
  member.isActivated = false;
  member.isLocked = false;
  audit(actor, "Issued setup code", "members", `${member.memberCode} · ${member.fullName}`);
  persist();
  return { setupCode, expiresAt };
}

export async function unlockMember(memberId: string): Promise<Member> {
  await delay();
  const actor = requireAdmin();
  const member = findMember(memberId);
  member.isLocked = false;
  db.credentials[member.id].failedAttempts = 0;
  audit(actor, "Unlocked member", "members", `${member.memberCode} · ${member.fullName}`);
  persist();
  return clone(member);
}

export async function setRole(memberId: string, role: Role, position: Position): Promise<Member> {
  await delay();
  const actor = requireSuperAdmin();
  const member = findMember(memberId);
  const finalPosition = role === "member" ? null : position;
  if (
    member.id === actor.id &&
    role !== "super_admin" &&
    !db.members.some((m) => m.id !== actor.id && m.role === "super_admin")
  ) {
    throw new ApiError("There must always be at least one Director with full access.", "invalid");
  }
  // Each office is held by one person at a time.
  if (finalPosition) {
    for (const other of db.members)
      if (other.id !== member.id && other.position === finalPosition) other.position = null;
  }
  member.role = role;
  member.position = finalPosition;
  audit(
    actor,
    "Changed role",
    "members",
    `${member.memberCode} · ${member.fullName} is now ${finalPosition ?? (role === "member" ? "a member" : role)}`,
  );
  persist();
  return clone(member);
}

export async function listAudit(filters: AuditFilters = {}): Promise<AuditEntry[]> {
  await delay();
  requireSuperAdmin();
  const search = filters.search?.trim().toLowerCase() ?? "";
  return clone(
    db.audit
      .filter((a) => !filters.table || a.table === filters.table)
      .filter(
        (a) => !search || `${a.actorName} ${a.action} ${a.summary}`.toLowerCase().includes(search),
      )
      .slice(0, 300),
  );
}

/* ------------------------------------------------------------------ */
/* Development only                                                     */
/* ------------------------------------------------------------------ */

/**
 * DEV ONLY. Powers the "Preview as" switch in development builds.
 * The Supabase version should keep this export as a function that throws,
 * because the switch is never rendered in production builds (see src/lib/env.ts).
 */
export async function devPreviewAs(memberCode: string): Promise<Session> {
  if (!isDemo) throw new ApiError("Preview is only available in development.", "forbidden");
  await delay();
  const member = db.members.find((m) => m.memberCode === memberCode);
  if (!member) throw new ApiError("Unknown member.", "not_found");
  db.session = { memberId: member.id, pendingOfficerId: null };
  persist();
  return clone({ member });
}

/** DEV ONLY. Restores the demo data. */
export async function devResetMockData(): Promise<void> {
  if (!isDemo) throw new ApiError("Reset is only available in development.", "forbidden");
  await delay();
  const memberId = db.session.memberId;
  db = createSeed(today());
  db.session.memberId = memberId;
  persist();
}
