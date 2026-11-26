// DEMO DATA. Used when the Supabase settings are missing (see src/data/api.ts and api.live.ts).
//
// Every screen reads and changes data ONLY through the functions exported here.
// The mock keeps its data in memory (mirrored to localStorage so a refresh keeps your test data)
// and waits 400 ms on every call to behave like a network.
// The real server must enforce the same permission rules that are checked below.

import { calculateDues, buildSchedule, duesStatus, nextDueWeek } from "@/lib/dues";
import { addDays, formatDay, localToday, mondayOf, parseIsoDate } from "@/lib/dates";
import { formatCedi } from "@/lib/money";
import { isDemo } from "@/lib/env";
import { normalizeMemberCode } from "@/lib/member-code";
import { isWeakPin, WEAK_PIN_MESSAGE } from "@/lib/pin";
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
  SetupCodeListItem,
} from "./types";
import { EMPTY_PROFILE } from "./types";
import { createSeed, SEED_VERSION, type MockCommunity, type MockDb, type MockPost } from "./mock/seed";
import {
  NOTIFY_DEFAULTS,
  type AttendanceAccess,
  type AttendanceMarkInput,
  type AttendanceOverviewRow,
  type AttendanceTotals,
  type DriveHead,
  type MyAttendance,
  type MySettings,
  type NewRehearsalInput,
  type NewsAccess,
  type PendingExcuse,
  type PersonRef,
  type Post,
  type PostComment,
  type PostInput,
  type PostUpdate,
  type PushSubscriptionInput,
  type Rehearsal,
  type ReportedComment,
  type RollCallEntry,
} from "./community";
import { buildDays, drivesOf, missedInARow, nextRehearsal, summarize } from "@/lib/attendance";

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
  if (!isAdmin(member) || !hasOfficerPin(member)) throw new ApiError("You don't have access to this page.", "forbidden");
  return member;
}

function requireSuperAdmin(): Member {
  const member = requireMember();
  if (member.role !== "super_admin" || !hasOfficerPin(member))
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

/** Members choose 4 digits; officers 6 (the same rule as the database). */
function pinDigitsFor(member: Member): number {
  return isAdmin(member) ? 6 : 4;
}

function validatePin(pin: string, digits = 4) {
  if (digits === 6 && !/^\d{6}$/.test(pin))
    throw new ApiError("Officers choose a 6-digit PIN.", "invalid");
  if (digits === 4 && !/^\d{4}$/.test(pin)) throw new ApiError("Choose a 4-digit PIN.", "invalid");
  if (isWeakPin(pin)) throw new ApiError(WEAK_PIN_MESSAGE, "weak_pin");
}

/** An officer whose PIN is still 4 digits has only member powers until they choose 6. */
function hasOfficerPin(member: Member): boolean {
  return (db.credentials[member.id]?.pin ?? "").length === 6;
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
  validatePin(newPin, pinDigitsFor(member));
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

/** MOCK: demo data lives on this phone only, so there is nothing to listen for. */
export function subscribeToChanges(_onChange: () => void): () => void {
  return () => {};
}

export async function signOut(): Promise<void> {
  await delay();
  db.session = { memberId: null, pendingOfficerId: null };
  persist();
}

export async function getCurrentMember(): Promise<Member | null> {
  await delay();
  const member = sessionMember();
  if (member && isAdmin(member) && !hasOfficerPin(member))
    return clone({ ...member, role: "member" as const, position: null, officerPending: true });
  return clone(member);
}

/** MOCK: pictures live in the demo data on this phone. Officers see everyone's. */
export async function getMemberPhotos(): Promise<Record<string, string>> {
  await delay();
  const me = requireMember();
  const photos = db.photos ?? {};
  if (isAdmin(me) && hasOfficerPin(me)) return { ...photos };
  return photos[me.id] ? { [me.id]: photos[me.id] } : {};
}

export async function setMyPhoto(image: string | null): Promise<void> {
  await delay();
  const me = requireMember();
  db.photos ??= {};
  if (image === null) delete db.photos[me.id];
  else {
    if (!/^data:image\/(webp|jpeg|png);base64,/.test(image) || image.length > 150_000)
      throw new ApiError("That picture couldn't be used. Try another one.", "invalid");
    db.photos[me.id] = image;
  }
  persist();
}

/** MOCK: there are no other phones in the demo. */
export async function signOutOtherDevices(): Promise<void> {
  await delay();
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  await delay();
  const member = requireMember();
  const cred = db.credentials[member.id];
  if (cred.pin !== currentPin) throw new ApiError("Your current PIN is not right.", "wrong_pin");
  validatePin(newPin, pinDigitsFor(member));
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
    portfolio: (input.portfolio ?? "").trim().slice(0, 60),
    profile: { ...EMPTY_PROFILE },
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
  if (patch.startWeekNo !== undefined) {
    const semester = currentSemesterRecord();
    const ms = semester && db.memberSemesters.find((x) => x.memberId === id && x.semesterId === semester.id);
    const weeks = semester ? weeksOf(semester.id).length : 0;
    if (semester && ms && patch.startWeekNo !== ms.startWeekNo) {
      if (!Number.isInteger(patch.startWeekNo) || patch.startWeekNo < 1 || patch.startWeekNo > weeks)
        throw new ApiError(`Choose a week from 1 to ${weeks}.`, "invalid");
      ms.startWeekNo = patch.startWeekNo;
      changes.push("dues start week");
    }
  }
  if (patch.portfolio !== undefined && patch.portfolio.trim() !== member.portfolio) {
    member.portfolio = patch.portfolio.trim().slice(0, 60);
    changes.push("portfolio");
  }
  if (patch.profile) {
    const next = { ...member.profile, ...patch.profile };
    if ((next.birthDay === null) !== (next.birthMonth === null))
      throw new ApiError("Give both the day and month of the birthday.", "invalid");
    if (next.level !== null && (!Number.isInteger(next.level) || next.level < 100 || next.level > 900))
      throw new ApiError("Level should be like 100, 200, 300 or 400.", "invalid");
    if (JSON.stringify(next) !== JSON.stringify(member.profile)) {
      member.profile = next;
      changes.push("profile");
    }
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
  // Any officer may start a semester or change its name and dates; rates stay with the Director.
  const actor = requireAdmin();
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
  const actor = requireAdmin();
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
  const result = newSetupCode(actor, findMember(memberId));
  persist();
  return result;
}

/** Setup codes for many people at once, e.g. everyone who hasn't signed in yet. */
export async function issueSetupCodes(memberIds: string[]): Promise<SetupCodeListItem[]> {
  await delay();
  const actor = requireAdmin();
  const out = memberIds
    .map((id) => findMember(id))
    .filter((m) => m.isActive)
    .map((m) => ({
      memberId: m.id,
      memberCode: m.memberCode,
      fullName: m.fullName,
      phone: m.phone,
      ...newSetupCode(actor, m),
    }));
  persist();
  return out;
}

function newSetupCode(actor: Member, member: Member): SetupCodeResult {
  if (!member.isActive) throw new ApiError("This member is no longer active.", "inactive");
  if (isAdmin(member) && actor.role !== "super_admin")
    throw new ApiError("Only the Director can give an officer a setup code.", "forbidden");
  if (member.id === actor.id)
    throw new ApiError("Change your own PIN in Settings instead.", "invalid");
  const setupCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const cred = db.credentials[member.id];
  cred.setupCode = setupCode;
  cred.setupCodeExpiresAt = expiresAt;
  // A new setup code is also how a forgotten PIN is reset.
  cred.pin = null;
  cred.failedAttempts = 0;
  member.isActivated = false;
  member.isLocked = false;
  audit(actor, "Issued setup code", "members", `${member.memberCode} · ${member.fullName}`);
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

/* ------------------------------------------------------------------ */
/* Attendance, drive heads, News, settings (demo)                       */
/* ------------------------------------------------------------------ */

function community(): MockCommunity {
  if (!db.community) {
    db.community = {
      rehearsals: [],
      attendance: [],
      excuses: [],
      driveHeads: [],
      posts: [],
      images: {},
      likes: [],
      views: [],
      comments: [],
      reports: [],
      settings: {},
      push: [],
    };
    seedCommunity(db.community);
    persist();
  }
  return db.community;
}

function memberDrives(m: Member): string[] {
  return drivesOf(m.drive, m.profile.driveInterests);
}

function ledDrives(m: Member): string[] {
  return community()
    .driveHeads.filter((h) => h.memberId === m.id)
    .map((h) => h.drive)
    .sort();
}

function isOfficerNow(m: Member) {
  return isAdmin(m) && hasOfficerPin(m);
}

/** Tuesdays and Thursdays in weeks with dues; days that no longer fit go unless marked. */
function syncRehearsals(semesterId: string) {
  const c = community();
  const s = db.semesters.find((x) => x.id === semesterId);
  if (!s || s.isClosed) return;
  const weeks = weeksOf(semesterId).filter((w) => w.counts);
  const fits = (d: IsoDate) => {
    const dow = parseIsoDate(d).getUTCDay();
    return (
      (dow === 2 || dow === 4) &&
      d >= s.startsOn &&
      d <= s.endsOn &&
      weeks.some((w) => d >= w.weekStart && d < addDays(w.weekStart, 7))
    );
  };
  for (let d = s.startsOn; d <= s.endsOn; d = addDays(d, 1)) {
    if (fits(d) && !c.rehearsals.some((r) => r.semesterId === s.id && r.kind === "regular" && r.heldOn === d)) {
      c.rehearsals.push({
        id: `reh-${s.id}-${d}`,
        semesterId: s.id,
        heldOn: d,
        kind: "regular",
        drive: null,
        title: "",
        startsAt: null,
        isCancelled: false,
        cancelReason: null,
        rollTaken: false,
      });
    }
  }
  c.rehearsals = c.rehearsals.filter(
    (r) =>
      r.semesterId !== s.id ||
      r.kind !== "regular" ||
      fits(r.heldOn) ||
      c.attendance.some((a) => a.rehearsalId === r.id),
  );
}

function seedCommunity(c: MockCommunity) {
  const t = today();
  const sem = currentSemesterRecord();
  const byCode = (code: string) => db.members.find((m) => m.memberCode === code);
  const efua = byCode("HIS-004");
  const nana = byCode("HIS-007");
  if (efua) c.driveHeads.push({ memberId: efua.id, drive: efua.drive });
  if (nana) c.driveHeads.push({ memberId: nana.id, drive: nana.drive });
  if (sem) {
    db.community = c;
    syncRehearsals(sem.id);
    // Past rehearsals: most people came, a few were away (some with an excuse).
    const roll = db.memberSemesters.filter((ms) => ms.semesterId === sem.id);
    const marker = byCode("HIS-002")?.id ?? db.members[0].id;
    c.rehearsals
      .filter((r) => r.semesterId === sem.id && r.heldOn < t)
      .forEach((r, ri) => {
        r.rollTaken = true;
        roll.forEach((ms, mi) => {
          const m = db.members.find((x) => x.id === ms.memberId);
          if (!m || (m.leftOn && r.heldOn > m.leftOn)) return;
          const n = (ri * 7 + mi * 13) % 20;
          if (n >= 17) return; // not ticked: counts as absent
          const status = n >= 15 ? "excused" : "present";
          c.attendance.push({ rehearsalId: r.id, memberId: m.id, status, markedBy: marker, markedAt: `${r.heldOn}T17:30:00.000Z` });
        });
      });
  }
  const dir = byCode("HIS-001");
  const fs = byCode("HIS-002");
  const at = (daysAgo: number, time = "09:00:00") => `${addDays(t, -daysAgo)}T${time}.000Z`;
  const post = (p: Partial<MockPost> & { id: string; body: string }): MockPost => ({
    authorId: null,
    authorLabel: "His Theatre",
    kind: "post",
    tags: [],
    drive: null,
    urgent: false,
    eventAt: null,
    commentsOff: false,
    pinnedAt: null,
    birthdayOn: null,
    birthdayMembers: [],
    createdAt: at(1),
    editedAt: null,
    ...p,
  });
  c.posts.push(
    post({
      id: "post-1",
      authorId: dir?.id ?? null,
      authorLabel: "Director",
      body: "Christmas production auditions this Thursday after rehearsal. Come with a 1-minute monologue. Everyone is welcome.",
      tags: ["Event", "Rehearsal"],
      pinnedAt: at(0, "08:00:00"),
      eventAt: `${addDays(t, 2)}T17:00:00.000Z`,
      createdAt: at(0, "08:00:00"),
    }),
    post({
      id: "post-2",
      authorId: fs?.id ?? null,
      authorLabel: "Financial Secretary",
      body: "Dues for this week are now due. Pay in cash at rehearsal or by MoMo, and check your balance on the Dues tab.",
      tags: ["Dues"],
      createdAt: at(0, "06:30:00"),
    }),
    post({
      id: "post-3",
      authorId: efua?.id ?? null,
      authorLabel: `Head, ${efua?.drive ?? "Tribe of Judah"}`,
      body: "Extra practice on Saturday at 3 PM in the auditorium. Bring your scripts.",
      tags: ["Boosters"],
      drive: efua?.drive ?? "Tribe of Judah",
      commentsOff: true,
      createdAt: at(1, "19:10:00"),
    }),
    post({
      id: "post-4",
      authorId: dir?.id ?? null,
      authorLabel: "Director",
      body: "Welcome to His Theatre on the app! Dues, attendance and news are all here now. Pull down on any screen to refresh.",
      tags: ["General"],
      createdAt: at(3, "10:00:00"),
    }),
  );
  const people = db.members.filter((m) => m.isActive).slice(3, 15);
  people.forEach((m, i) => {
    c.views.push({ postId: "post-1", memberId: m.id, at: at(0, "09:00:00") });
    if (i % 2 === 0) c.likes.push({ postId: "post-1", memberId: m.id, at: at(0, "09:10:00") });
    if (i < 8) c.views.push({ postId: "post-2", memberId: m.id, at: at(0, "07:00:00") });
    if (i % 3 === 0) c.likes.push({ postId: "post-4", memberId: m.id, at: at(3, "11:00:00") });
  });
  if (people[2])
    c.comments.push({ id: "com-1", postId: "post-2", memberId: people[2].id, parentId: null, body: "Paid mine by MoMo this morning", createdAt: at(0, "07:05:00"), editedAt: null });
  if (fs)
    c.comments.push({ id: "com-2", postId: "post-2", memberId: fs.id, parentId: "com-1", body: "Received, thank you!", createdAt: at(0, "07:20:00"), editedAt: null });
  if (people[4])
    c.comments.push({ id: "com-3", postId: "post-1", memberId: people[4].id, parentId: null, body: "Can we do a duet piece instead?", createdAt: at(0, "08:40:00"), editedAt: null });
}

function rehearsalDaysFor(member: Member, semesterId: string): MyAttendance {
  syncRehearsals(semesterId);
  const c = community();
  const ms = db.memberSemesters.find((x) => x.memberId === member.id && x.semesterId === semesterId);
  const start = ms ? (weeksOf(semesterId).find((w) => w.weekNo === ms.startWeekNo)?.weekStart ?? null) : null;
  const ids = new Set(c.rehearsals.filter((r) => r.semesterId === semesterId).map((r) => r.id));
  const days = buildDays(
    c.rehearsals.filter((r) => ids.has(r.id)),
    new Map(
      c.attendance
        .filter((a) => a.memberId === member.id && ids.has(a.rehearsalId))
        .map((a) => [a.rehearsalId, { status: a.status, markedAt: a.markedAt }]),
    ),
    new Map(
      c.excuses
        .filter((e) => e.memberId === member.id && ids.has(e.rehearsalId))
        .map((e) => [e.rehearsalId, { reason: e.reason, status: e.status }]),
    ),
    { drives: memberDrives(member), from: start, until: member.leftOn },
    today(),
  );
  return { semesterId, days, summary: summarize(days), next: nextRehearsal(days) };
}

function requireTaker(): Member {
  const me = requireMember();
  if (!isOfficerNow(me) && ledDrives(me).length === 0)
    throw new ApiError("Only officers and drive heads take attendance.", "forbidden");
  return me;
}

function markProblem(me: Member, r: Rehearsal): string | null {
  const t = today();
  if (findSemester(r.semesterId).isClosed) return "This semester is closed.";
  if (r.isCancelled) return "This rehearsal was cancelled.";
  if (r.heldOn > t) return "You can take attendance on the day of the rehearsal.";
  if (isOfficerNow(me) || ledDrives(me).length) return null;
  return "Only officers and drive heads take attendance.";
}

/** On the roll for a rehearsal: dues started by that week, not left. */
function onRoll(m: Member, r: Rehearsal): boolean {
  const ms = db.memberSemesters.find((x) => x.memberId === m.id && x.semesterId === r.semesterId);
  if (!ms || !m.isActive || (m.leftOn && m.leftOn < r.heldOn)) return false;
  const start = weeksOf(r.semesterId).find((w) => w.weekNo === ms.startWeekNo)?.weekStart;
  return !start || r.heldOn >= start;
}

function findRehearsal(id: string): Rehearsal {
  const r = community().rehearsals.find((x) => x.id === id);
  if (!r) throw new ApiError("Rehearsal not found.", "not_found");
  return r;
}

export async function getAttendanceAccess(): Promise<AttendanceAccess> {
  await delay();
  const me = requireMember();
  const led = ledDrives(me);
  const isOfficer = isOfficerNow(me);
  return { canTake: isOfficer || led.length > 0, isOfficer, ledDrives: led, myDrives: memberDrives(me) };
}

export async function getMyAttendance(semesterId: string): Promise<MyAttendance> {
  await delay();
  return clone(rehearsalDaysFor(requireMember(), semesterId));
}

export async function getMemberAttendance(memberId: string, semesterId: string): Promise<MyAttendance> {
  await delay();
  requireAdmin();
  return clone(rehearsalDaysFor(findMember(memberId), semesterId));
}

export async function listRehearsals(semesterId: string): Promise<Rehearsal[]> {
  await delay();
  requireMember();
  syncRehearsals(semesterId);
  return clone(
    community()
      .rehearsals.filter((r) => r.semesterId === semesterId)
      .sort((a, b) => a.heldOn.localeCompare(b.heldOn) || (a.startsAt ?? "").localeCompare(b.startsAt ?? "")),
  );
}

export async function getRollCall(rehearsalId: string): Promise<RollCallEntry[]> {
  await delay();
  requireTaker();
  const c = community();
  const r = findRehearsal(rehearsalId);
  return db.memberSemesters
    .filter((ms) => ms.semesterId === r.semesterId)
    .map((ms) => findMember(ms.memberId))
    .filter((m) => {
      const marked = c.attendance.some((a) => a.rehearsalId === r.id && a.memberId === m.id);
      return marked || onRoll(m, r);
    })
    .map((m) => {
      const a = c.attendance.find((x) => x.rehearsalId === r.id && x.memberId === m.id);
      const e = c.excuses.find((x) => x.rehearsalId === r.id && x.memberId === m.id);
      return {
        memberId: m.id,
        memberCode: m.memberCode,
        fullName: m.fullName,
        drives: memberDrives(m),
        status: a?.status ?? null,
        markedByName: a ? memberName(a.markedBy) : null,
        markedAt: a?.markedAt ?? null,
        excuse: e ? { reason: e.reason, status: e.status } : null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function markAttendance(rehearsalId: string, marks: AttendanceMarkInput[]): Promise<AttendanceTotals> {
  await delay();
  const me = requireTaker();
  const c = community();
  const r = findRehearsal(rehearsalId);
  const problem = markProblem(me, r);
  if (problem) throw new ApiError(problem, "forbidden");
  let changed = 0;
  for (const m of marks) {
    const member = db.members.find((x) => x.id === m.memberId);
    const i = c.attendance.findIndex((a) => a.rehearsalId === r.id && a.memberId === m.memberId);
    if (!member || (!onRoll(member, r) && i < 0)) continue;
    if (m.status === null) {
      if (i >= 0) {
        c.attendance.splice(i, 1);
        changed++;
      }
    } else if (i < 0 || c.attendance[i].status !== m.status) {
      const row = { rehearsalId: r.id, memberId: m.memberId, status: m.status, markedBy: me.id, markedAt: now() };
      if (i >= 0) c.attendance[i] = row;
      else c.attendance.push(row);
      changed++;
    }
  }
  const rows = c.attendance.filter((a) => a.rehearsalId === r.id);
  r.rollTaken = rows.length > 0;
  const totals = {
    present: rows.filter((a) => a.status === "present").length,
    excused: rows.filter((a) => a.status === "excused").length,
    absent: rows.filter((a) => a.status === "absent").length,
    changed,
  };
  if (changed)
    audit(
      me,
      "insert",
      "attendance",
      `took attendance for ${formatDay(r.heldOn)}${r.drive ? ` (${r.drive})` : ""}: ${totals.present} present, ${totals.absent} absent, ${totals.excused} absent with excuse`,
    );
  persist();
  return totals;
}

function requireRehearsalPower(me: Member, drive: string | null) {
  if (isOfficerNow(me)) return;
  if (drive && ledDrives(me).includes(drive)) return;
  if (ledDrives(me).length)
    throw new ApiError("Drive heads can only add or cancel rehearsals for their own drive.", "forbidden");
  throw new ApiError("Only officers and drive heads can do that.", "forbidden");
}

export async function addRehearsal(input: NewRehearsalInput): Promise<string> {
  await delay();
  const me = requireMember();
  const drive = input.drive?.trim() || null;
  requireRehearsalPower(me, drive);
  if (input.heldOn < today()) throw new ApiError("Choose today or a later date.", "invalid");
  const s = db.semesters
    .filter((x) => !x.isClosed && x.startsOn <= input.heldOn && input.heldOn <= x.endsOn)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
  if (!s) throw new ApiError("That date isn't in an open semester.", "invalid");
  const id = nextId("reh");
  community().rehearsals.push({
    id,
    semesterId: s.id,
    heldOn: input.heldOn,
    kind: "extra",
    drive,
    title: input.title.trim().slice(0, 60),
    startsAt: input.startsAt,
    isCancelled: false,
    cancelReason: null,
    rollTaken: false,
  });
  audit(me, "insert", "rehearsals", `added a rehearsal on ${formatDay(input.heldOn)}${drive ? ` for ${drive}` : ""}`);
  persist();
  return id;
}

export async function cancelRehearsal(id: string, reason: string, cancel = true): Promise<void> {
  await delay();
  const me = requireMember();
  const r = findRehearsal(id);
  if (r.kind === "regular") {
    if (!isOfficerNow(me)) throw new ApiError("Only officers can cancel a regular rehearsal.", "forbidden");
  } else requireRehearsalPower(me, r.drive);
  if (cancel && r.heldOn < today()) throw new ApiError("That rehearsal has already happened.", "invalid");
  const was = r.isCancelled;
  r.isCancelled = cancel;
  r.cancelReason = cancel ? reason.trim() || null : null;
  audit(me, "insert", "rehearsals", `${cancel ? "cancelled" : "restored"} the rehearsal on ${formatDay(r.heldOn)}${r.cancelReason ? `: ${r.cancelReason}` : ""}`);
  if (cancel && !was) {
    community().posts.push(newMockPost({
      authorId: me.id,
      authorLabel: me.position ?? "His Theatre",
      kind: "notice",
      body: `Rehearsal cancelled: ${formatDay(r.heldOn)}${r.drive ? ` (${r.drive})` : ""}.${r.cancelReason ? ` ${r.cancelReason}` : ""}`,
      tags: ["Rehearsal"],
      drive: r.drive,
      urgent: true,
    }));
  }
  persist();
}

export async function requestExcuse(rehearsalId: string, reason: string): Promise<void> {
  await delay();
  const me = requireMember();
  const r = findRehearsal(rehearsalId);
  if (r.isCancelled) throw new ApiError("Rehearsal not found.", "not_found");
  if (r.heldOn < today()) throw new ApiError("Ask before the rehearsal, or speak to your drive head.", "invalid");
  if (reason.trim().length < 3) throw new ApiError("Say briefly why you can't come.", "invalid");
  const c = community();
  const e = c.excuses.find((x) => x.rehearsalId === r.id && x.memberId === me.id);
  if (e && e.status !== "pending") throw new ApiError("Your request was already answered.", "invalid");
  if (e) e.reason = reason.trim();
  else c.excuses.push({ rehearsalId: r.id, memberId: me.id, reason: reason.trim(), status: "pending" });
  persist();
}

export async function decideExcuse(rehearsalId: string, memberId: string, approve: boolean): Promise<void> {
  await delay();
  const me = requireTaker();
  const c = community();
  const r = findRehearsal(rehearsalId);
  const e = c.excuses.find((x) => x.rehearsalId === rehearsalId && x.memberId === memberId);
  if (!e) throw new ApiError("Request not found.", "not_found");
  e.status = approve ? "approved" : "declined";
  if (approve) {
    const row = { rehearsalId, memberId, status: "excused" as const, markedBy: me.id, markedAt: now() };
    const i = c.attendance.findIndex((a) => a.rehearsalId === rehearsalId && a.memberId === memberId);
    if (i >= 0) c.attendance[i] = row;
    else c.attendance.push(row);
  }
  audit(me, "insert", "attendance", `${approve ? "approved" : "declined"} ${memberName(memberId)}'s excuse for ${formatDay(r.heldOn)}`);
  persist();
}

export async function getAttendanceOverview(
  semesterId: string,
): Promise<{ rows: AttendanceOverviewRow[]; pending: PendingExcuse[] }> {
  await delay();
  requireAdmin();
  syncRehearsals(semesterId);
  const t = today();
  const people = db.memberSemesters
    .filter((ms) => ms.semesterId === semesterId)
    .map((ms) => findMember(ms.memberId))
    .filter((m) => m.isActive || m.leftOn);
  const rows = people.map((m) => {
    const a = rehearsalDaysFor(m, semesterId);
    return {
      memberId: m.id,
      memberCode: m.memberCode,
      fullName: m.fullName,
      drive: m.drive,
      summary: a.summary,
      missedInARow: missedInARow(a.days),
    };
  });
  const c = community();
  const pending = c.excuses
    .filter((e) => e.status === "pending")
    .map((e) => ({ e, r: c.rehearsals.find((r) => r.id === e.rehearsalId) }))
    .filter(({ r }) => r && r.semesterId === semesterId && r.heldOn >= t)
    .map(({ e, r }) => ({ rehearsalId: e.rehearsalId, heldOn: r!.heldOn, memberId: e.memberId, fullName: memberName(e.memberId), reason: e.reason }))
    .sort((a, b) => a.heldOn.localeCompare(b.heldOn));
  return clone({ rows, pending });
}

export async function listDriveHeads(): Promise<DriveHead[]> {
  await delay();
  requireMember();
  return community()
    .driveHeads.map((h) => ({ memberId: h.memberId, fullName: memberName(h.memberId), drive: h.drive }))
    .sort((a, b) => a.drive.localeCompare(b.drive) || a.fullName.localeCompare(b.fullName));
}

export async function setDriveHead(memberId: string, drive: string, on: boolean): Promise<void> {
  await delay();
  const me = requireSuperAdmin();
  const m = findMember(memberId);
  const d = drive.trim();
  if (!d) throw new ApiError("Choose a drive.", "invalid");
  const c = community();
  c.driveHeads = c.driveHeads.filter((h) => !(h.memberId === memberId && h.drive === d));
  if (on) c.driveHeads.push({ memberId, drive: d });
  audit(me, "insert", "drive_heads", on ? `made ${m.fullName} head of ${d}` : `removed ${m.fullName} as head of ${d}`);
  persist();
}

export async function listDrives(): Promise<string[]> {
  await delay();
  const me = requireMember();
  const set = new Set(ledDrives(me));
  const visible = isOfficerNow(me) ? db.members.filter((m) => m.isActive) : [me];
  for (const m of visible) for (const d of memberDrives(m)) set.add(d);
  return [...set].sort();
}

/* ---------- News ---------- */

function newMockPost(p: Partial<MockPost> & { body: string }): MockPost {
  return {
    id: nextId("post"),
    authorId: null,
    authorLabel: "His Theatre",
    kind: "post",
    tags: [],
    drive: null,
    urgent: false,
    eventAt: null,
    commentsOff: false,
    pinnedAt: null,
    birthdayOn: null,
    birthdayMembers: [],
    createdAt: now(),
    editedAt: null,
    ...p,
  };
}

function canSeePost(me: Member, p: MockPost) {
  return !p.drive || isOfficerNow(me) || memberDrives(me).includes(p.drive) || ledDrives(me).includes(p.drive);
}

function findPost(id: string): MockPost {
  const p = community().posts.find((x) => x.id === id);
  if (!p) throw new ApiError("Post not found.", "not_found");
  return p;
}

function postLabels(me: Member): string[] {
  const out = new Set<string>();
  const led = ledDrives(me);
  if (isOfficerNow(me)) {
    if (me.position) out.add(me.position);
    out.add("Officer");
  }
  if ((isOfficerNow(me) || led.length) && me.portfolio.trim()) out.add(me.portfolio.trim());
  for (const d of led) out.add(`Head, ${d}`);
  return [...out];
}

function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t || t.length > 24 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.slice(0, 5);
}

function ensureBirthdayPost() {
  const t = today();
  const c = community();
  if (c.posts.some((p) => p.kind === "birthday" && p.birthdayOn === t)) return;
  const d = parseIsoDate(t);
  const people = db.members
    .filter(
      (m) =>
        m.isActive &&
        m.profile.birthDay === d.getUTCDate() &&
        m.profile.birthMonth === d.getUTCMonth() + 1 &&
        (c.settings[m.id]?.birthdayPost ?? true),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  if (!people.length) return;
  const names = people.map((p) => p.fullName);
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  c.posts.push(
    newMockPost({
      kind: "birthday",
      body: `Happy birthday, ${who}! 🎉 Wishing you a blessed year ahead, from all of us at His Theatre.`,
      tags: ["Birthday"],
      birthdayOn: t,
      birthdayMembers: people.map((p) => p.id),
      createdAt: `${t}T00:00:00.000Z`,
    }),
  );
  persist();
}

function toPostView(me: Member, p: MockPost): Post {
  const c = community();
  const author = p.authorId ? db.members.find((m) => m.id === p.authorId) : undefined;
  return {
    id: p.id,
    authorId: p.authorId,
    authorName: author?.fullName ?? "His Theatre",
    authorLabel: p.authorLabel,
    authorPhoto: (p.authorId && db.photos?.[p.authorId]) || null,
    kind: p.kind,
    body: p.body,
    tags: p.tags,
    drive: p.drive,
    urgent: p.urgent,
    eventAt: p.eventAt,
    commentsOff: p.commentsOff,
    pinned: Boolean(p.pinnedAt),
    isTodaysBirthday: p.kind === "birthday" && p.birthdayOn === today(),
    birthdayNames: p.birthdayMembers.map(memberName),
    imageCount: c.images[p.id]?.length ?? 0,
    createdAt: p.createdAt,
    editedAt: p.editedAt,
    likes: c.likes.filter((l) => l.postId === p.id).length,
    comments: c.comments.filter((x) => x.postId === p.id).length,
    views: c.views.filter((v) => v.postId === p.id).length,
    likedByMe: c.likes.some((l) => l.postId === p.id && l.memberId === me.id),
    seenByMe: c.views.some((v) => v.postId === p.id && v.memberId === me.id),
  };
}

export async function getNewsAccess(): Promise<NewsAccess> {
  await delay();
  const me = requireMember();
  const led = ledDrives(me);
  const isOfficer = isOfficerNow(me);
  const drives = isOfficer
    ? [...new Set(db.members.filter((m) => m.isActive).flatMap(memberDrives))].sort()
    : led;
  return {
    canPost: isOfficer || led.length > 0,
    isOfficer,
    isDirector: me.role === "super_admin" && hasOfficerPin(me),
    labels: postLabels(me),
    drives,
  };
}

export async function getNewsFeed(opts: { before?: string | null; tag?: string | null } = {}): Promise<Post[]> {
  await delay();
  const me = requireMember();
  ensureBirthdayPost();
  const t = today();
  const top = (p: MockPost) => (p.kind === "birthday" && p.birthdayOn === t ? 2 : p.pinnedAt && !opts.before ? 1 : 0);
  return clone(
    community()
      .posts.filter((p) => canSeePost(me, p))
      .filter((p) => !opts.tag || p.tags.some((x) => x.toLowerCase() === opts.tag!.toLowerCase()))
      .filter((p) => !opts.before || (p.createdAt < opts.before && !p.pinnedAt && top(p) < 2))
      .sort(
        (a, b) =>
          top(b) - top(a) ||
          (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "") ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 20)
      .map((p) => toPostView(me, p)),
  );
}

export async function getPostImages(postId: string): Promise<string[]> {
  await delay();
  const me = requireMember();
  if (!canSeePost(me, findPost(postId))) throw new ApiError("Post not found.", "not_found");
  return [...(community().images[postId] ?? [])];
}

export async function createPost(input: PostInput): Promise<string> {
  await delay();
  const me = requireMember();
  const isOfficer = isOfficerNow(me);
  const led = ledDrives(me);
  if (!isOfficer && !led.length) throw new ApiError("Only officers and drive heads can post.", "forbidden");
  const body = input.body.trim();
  if (!body) throw new ApiError("Write something to post.", "invalid");
  if (body.length > 2000) throw new ApiError("Posts can be up to 2,000 letters.", "invalid");
  if (input.images.length > 4) throw new ApiError("Up to 4 pictures.", "invalid");
  const drive = input.drive?.trim() || null;
  if (!isOfficer && (!drive || !led.includes(drive))) throw new ApiError("Drive heads post to their own drive.", "forbidden");
  const labels = postLabels(me);
  const p = newMockPost({
    authorId: me.id,
    authorLabel: labels.includes(input.authorLabel) ? input.authorLabel : labels[0],
    body,
    tags: cleanTags(input.tags),
    drive,
    urgent: input.urgent,
    eventAt: input.eventAt,
  });
  const c = community();
  c.posts.push(p);
  if (input.images.length) c.images[p.id] = [...input.images];
  persist();
  return p.id;
}

export async function updatePost(id: string, patch: PostUpdate): Promise<void> {
  await delay();
  const me = requireMember();
  const p = findPost(id);
  if (p.authorId !== me.id) throw new ApiError("Only the person who posted can change it.", "forbidden");
  if (patch.body !== undefined) {
    const b = patch.body.trim();
    if (!b) throw new ApiError("Write something to post.", "invalid");
    if (b !== p.body) {
      p.body = b;
      p.editedAt = now();
    }
  }
  if (patch.tags !== undefined) {
    const tags = cleanTags(patch.tags);
    if (tags.join("|") !== p.tags.join("|")) {
      p.tags = tags;
      p.editedAt = now();
    }
  }
  if (patch.eventAt !== undefined && patch.eventAt !== p.eventAt) {
    p.eventAt = patch.eventAt;
    p.editedAt = now();
  }
  if (patch.commentsOff !== undefined) p.commentsOff = patch.commentsOff;
  persist();
}

export async function deletePost(id: string): Promise<void> {
  await delay();
  const me = requireMember();
  const p = findPost(id);
  const director = me.role === "super_admin" && hasOfficerPin(me);
  if (p.authorId !== me.id && !director) throw new ApiError("You can't remove this post.", "forbidden");
  const c = community();
  if (p.authorId !== me.id)
    audit(me, "delete", "posts", `removed a post by ${p.authorId ? memberName(p.authorId) : "His Theatre"}: ${p.body.slice(0, 60)}`);
  c.posts = c.posts.filter((x) => x.id !== id);
  c.comments = c.comments.filter((x) => x.postId !== id);
  c.likes = c.likes.filter((x) => x.postId !== id);
  c.views = c.views.filter((x) => x.postId !== id);
  delete c.images[id];
  persist();
}

export async function pinPost(id: string, pin: boolean): Promise<void> {
  await delay();
  const me = requireMember();
  if (!isOfficerNow(me)) throw new ApiError("Only officers can pin posts.", "forbidden");
  const c = community();
  if (pin && c.posts.filter((p) => p.pinnedAt && p.id !== id).length >= 3)
    throw new ApiError("Up to 3 posts can be pinned. Unpin one first.", "invalid");
  findPost(id).pinnedAt = pin ? now() : null;
  persist();
}

export async function likePost(id: string, like: boolean): Promise<void> {
  await delay();
  const me = requireMember();
  if (!canSeePost(me, findPost(id))) throw new ApiError("Post not found.", "not_found");
  const c = community();
  c.likes = c.likes.filter((l) => !(l.postId === id && l.memberId === me.id));
  if (like) c.likes.push({ postId: id, memberId: me.id, at: now() });
  persist();
}

export async function markPostsSeen(ids: string[]): Promise<void> {
  const me = sessionMember();
  if (!me) return;
  const c = community();
  for (const id of ids) {
    if (!c.views.some((v) => v.postId === id && v.memberId === me.id)) c.views.push({ postId: id, memberId: me.id, at: now() });
  }
  persist();
}

function commentLabel(m: Member): string {
  if (isAdmin(m) && m.position) return m.position;
  const led = community().driveHeads.find((h) => h.memberId === m.id);
  return led ? `Head, ${led.drive}` : "";
}

export async function getComments(postId: string): Promise<PostComment[]> {
  await delay();
  const me = requireMember();
  if (!canSeePost(me, findPost(postId))) throw new ApiError("Post not found.", "not_found");
  return community()
    .comments.filter((x) => x.postId === postId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((x) => {
      const m = findMember(x.memberId);
      const showPhoto = isAdmin(m) || community().driveHeads.some((h) => h.memberId === m.id);
      return {
        id: x.id,
        parentId: x.parentId,
        memberId: x.memberId,
        fullName: m.fullName,
        label: commentLabel(m),
        photo: showPhoto ? (db.photos?.[m.id] ?? null) : null,
        body: x.body,
        createdAt: x.createdAt,
        editedAt: x.editedAt,
      };
    });
}

export async function addComment(postId: string, body: string, parentId: string | null = null): Promise<void> {
  await delay();
  const me = requireMember();
  const p = findPost(postId);
  if (!canSeePost(me, p)) throw new ApiError("Post not found.", "not_found");
  if (p.commentsOff) throw new ApiError("Comments are turned off for this post.", "invalid");
  const t = body.trim();
  if (!t) throw new ApiError("Write a comment first.", "invalid");
  if (t.length > 500) throw new ApiError("Comments can be up to 500 letters.", "invalid");
  const c = community();
  let parent: string | null = null;
  if (parentId) {
    const pc = c.comments.find((x) => x.id === parentId && x.postId === postId);
    if (!pc) throw new ApiError("Comment not found.", "not_found");
    parent = pc.parentId ?? pc.id;
  }
  c.comments.push({ id: nextId("com"), postId, memberId: me.id, parentId: parent, body: t, createdAt: now(), editedAt: null });
  persist();
}

export async function editComment(id: string, body: string): Promise<void> {
  await delay();
  const me = requireMember();
  const x = community().comments.find((c) => c.id === id);
  if (!x || x.memberId !== me.id) throw new ApiError("You can only edit your own comment.", "forbidden");
  const t = body.trim();
  if (!t) throw new ApiError("Write a comment first.", "invalid");
  if (t !== x.body) {
    x.body = t;
    x.editedAt = now();
  }
  persist();
}

export async function deleteComment(id: string): Promise<void> {
  await delay();
  const me = requireMember();
  const c = community();
  const x = c.comments.find((y) => y.id === id);
  if (!x) throw new ApiError("Comment not found.", "not_found");
  const p = findPost(x.postId);
  if (x.memberId !== me.id && !isOfficerNow(me) && p.authorId !== me.id)
    throw new ApiError("You can't remove this comment.", "forbidden");
  if (x.memberId !== me.id) audit(me, "delete", "post_comments", `removed a comment by ${memberName(x.memberId)}: ${x.body.slice(0, 60)}`);
  c.comments = c.comments.filter((y) => y.id !== id && y.parentId !== id);
  persist();
}

export async function reportComment(id: string, reason: string): Promise<void> {
  await delay();
  const me = requireMember();
  const c = community();
  if (!c.comments.some((x) => x.id === id)) throw new ApiError("Comment not found.", "not_found");
  if (!c.reports.some((r) => r.commentId === id && r.memberId === me.id))
    c.reports.push({ commentId: id, memberId: me.id, reason: reason.trim().slice(0, 200) });
  persist();
}

export async function getLikers(postId: string): Promise<PersonRef[]> {
  await delay();
  const me = requireMember();
  if (!canSeePost(me, findPost(postId))) throw new ApiError("Post not found.", "not_found");
  return community()
    .likes.filter((l) => l.postId === postId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((l) => ({ memberId: l.memberId, fullName: memberName(l.memberId) }));
}

export async function getViewers(postId: string): Promise<PersonRef[]> {
  await delay();
  const me = requireMember();
  if (!isOfficerNow(me)) throw new ApiError("Only officers can see who viewed a post.", "forbidden");
  return community()
    .views.filter((v) => v.postId === postId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((v) => ({ memberId: v.memberId, fullName: memberName(v.memberId), at: v.at }));
}

export async function getReportedComments(): Promise<ReportedComment[]> {
  await delay();
  requireAdmin();
  const c = community();
  const ids = [...new Set(c.reports.map((r) => r.commentId))];
  return ids
    .map((id) => c.comments.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((x) => ({
      commentId: x.id,
      postId: x.postId,
      authorName: memberName(x.memberId),
      body: x.body,
      reports: c.reports.filter((r) => r.commentId === x.id).length,
      reasons: c.reports.filter((r) => r.commentId === x.id && r.reason).map((r) => r.reason),
    }));
}

export async function getUnreadNews(): Promise<number> {
  await delay();
  const me = requireMember();
  ensureBirthdayPost();
  const seen = community().settings[me.id]?.newsSeenAt ?? "";
  return community().posts.filter((p) => canSeePost(me, p) && p.createdAt > seen && p.authorId !== me.id).length;
}

export async function markNewsSeen(): Promise<void> {
  const me = sessionMember();
  if (!me) return;
  const c = community();
  c.settings[me.id] = { ...settingsRow(me.id), newsSeenAt: now() };
  persist();
}

/* ---------- Settings and notifications ---------- */

function settingsRow(memberId: string) {
  return community().settings[memberId] ?? { birthdayPost: true, notify: {}, newsSeenAt: null };
}

export async function getMySettings(): Promise<MySettings> {
  await delay();
  const me = requireMember();
  const row = settingsRow(me.id);
  return { birthdayPost: row.birthdayPost, notify: { ...NOTIFY_DEFAULTS, ...row.notify } };
}

export async function saveMySettings(patch: Partial<MySettings>): Promise<MySettings> {
  await delay();
  const me = requireMember();
  const row = settingsRow(me.id);
  const next = {
    birthdayPost: patch.birthdayPost ?? row.birthdayPost,
    notify: { ...NOTIFY_DEFAULTS, ...row.notify, ...(patch.notify ?? {}) },
  };
  community().settings[me.id] = { ...row, ...next };
  persist();
  return next;
}

export async function savePushSubscription(sub: PushSubscriptionInput): Promise<void> {
  await delay();
  const me = requireMember();
  const c = community();
  c.push = c.push.filter((p) => p.endpoint !== sub.endpoint);
  c.push.push({ endpoint: sub.endpoint, memberId: me.id });
  persist();
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await delay();
  const c = community();
  c.push = c.push.filter((p) => p.endpoint !== endpoint);
  persist();
}

export async function getPushPublicKey(): Promise<string | null> {
  return null;
}
