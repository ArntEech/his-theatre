// LIVE IMPLEMENTATION: the real His Theatre data, in Supabase.
//
// Same functions, same shapes as api.mock.ts. The screens can't tell which one they use.
// Security does NOT live here: the database's own rules decide who may read or change what
// (see supabase/migrations/0001_his_theatre.sql). This file only asks politely and turns the
// database's answers into the app's shapes and friendly messages.
//
// Money is always integer pesewas.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { addDays, todayISO } from "@/lib/dates";
import { DRIVES } from "@/lib/drives";
import { calculateDues, duesStatus } from "@/lib/dues";
import { normalizeMemberCode } from "@/lib/member-code";
import { ApiError } from "./errors";
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

export { ApiError };
export const IS_MOCK = false;

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let client: SupabaseClient | null = null;

/** The Supabase connection. Uses only the public (publishable) key; never a secret key. */
function sb(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) throw new ApiError("The app isn't connected to its database yet.");
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "his-theatre-auth" },
    });
  }
  return client;
}

type DbError = { message: string; code?: string } | null;

/** Database messages → words for people. Rule messages written in the database pass through as they are. */
function friendly(message: string): string {
  if (/row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that. Officers: sign out and sign in again with your authenticator code.";
  }
  if (/JWT|not authenticated|session/i.test(message)) return "Your session has ended. Please sign in again.";
  if (/Failed to fetch|NetworkError|network|fetch failed/i.test(message)) {
    return "No connection. Check your internet and try again.";
  }
  if (/violates check constraint|invalid input/i.test(message)) return "Some details aren't valid. Check the form and try again.";
  if (/PGRST116|0 rows|multiple \(or no\) rows/i.test(message)) return "That record wasn't found, or you can't change it.";
  return message;
}

function fail(error: DbError): never {
  throw new ApiError(friendly(error?.message ?? "Something went wrong. Please try again."));
}

// Rows from the database are loosely typed; the to*() mappers below give them the app's shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function run<T = any>(query: PromiseLike<{ data: unknown; error: DbError }>): Promise<T> {
  const { data, error } = await query;
  if (error) fail(error);
  return data as T;
}

function assertAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new ApiError("Enter an amount greater than zero.");
}
function assertReason(reason: string) {
  if (!reason || reason.trim().length < 3) throw new ApiError("Please give a reason.");
}
function newKey(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Row → app shapes
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toMember = (r: Row): Member => ({
  id: r.id,
  memberCode: r.member_code,
  fullName: r.full_name,
  phone: r.phone ?? "",
  drive: r.drive ?? "",
  category: r.category,
  role: r.role,
  position: r.position ?? null,
  isActive: r.is_active,
  leftOn: r.left_on ?? null,
  isActivated: r.is_activated,
  isLocked: r.is_locked,
});
const toSemester = (r: Row): Semester => ({
  id: r.id,
  name: r.name,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  isClosed: r.is_closed,
});
const toWeek = (r: Row): SemesterWeek => ({
  id: r.id,
  semesterId: r.semester_id,
  weekNo: r.week_no,
  weekStart: r.week_start,
  counts: r.counts,
  ...(r.label ? { label: r.label as string } : {}),
});
const toRate = (r: Row): DuesRate => ({ semesterId: r.semester_id, category: r.category, weeklyAmount: r.weekly_amount });
const toMemberSemester = (r: Row): MemberSemester => ({
  memberId: r.member_id,
  semesterId: r.semester_id,
  category: r.category,
  startWeekNo: r.start_week_no,
});
const toAdjustment = (r: Row): Adjustment => ({
  id: r.id,
  memberId: r.member_id,
  semesterId: r.semester_id,
  amount: r.amount,
  reason: r.reason,
  recordedBy: r.recorded_by,
  createdAt: r.created_at,
});
const toPayment = (r: Row): Payment => ({
  id: r.id,
  receiptNo: r.receipt_no,
  memberId: r.member_id,
  semesterId: r.semester_id,
  amount: r.amount,
  method: r.method,
  ...(r.momo_reference ? { momoReference: r.momo_reference as string } : {}),
  paidOn: r.paid_on,
  ...(r.note ? { note: r.note as string } : {}),
  ...(r.reverses_payment_id ? { reversesPaymentId: r.reverses_payment_id as string } : {}),
  idempotencyKey: r.idempotency_key,
  recordedBy: r.recorded_by,
  createdAt: r.created_at,
});
const toExpense = (r: Row): Expense => ({
  id: r.id,
  ref: r.ref,
  description: r.description,
  category: r.category,
  amount: r.amount,
  paidBy: r.paid_by,
  approvedBy: r.approved_by,
  ...(r.receipt_ref ? { receiptRef: r.receipt_ref as string } : {}),
  date: r.date,
  ...(r.reverses_id ? { reversesId: r.reverses_id as string } : {}),
  recordedBy: r.recorded_by,
  createdAt: r.created_at,
});
const toIncome = (r: Row): OtherIncome => ({
  id: r.id,
  ref: r.ref,
  source: r.source,
  description: r.description,
  amount: r.amount,
  method: r.method,
  date: r.date,
  ...(r.reverses_id ? { reversesId: r.reverses_id as string } : {}),
  recordedBy: r.recorded_by,
  createdAt: r.created_at,
});
const toHandover = (r: Row): Handover => ({
  id: r.id,
  ref: r.ref,
  fromMemberId: r.from_member_id,
  toMemberId: r.to_member_id,
  amount: r.amount,
  recordedAt: r.recorded_at,
  confirmedAt: r.confirmed_at ?? null,
});
const toAudit = (r: Row): AuditEntry => ({
  id: String(r.id),
  actorName: r.actor_name,
  actorPosition: r.actor_position,
  action: r.action,
  table: r.table_name,
  summary: r.summary,
  createdAt: r.created_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Reads the "aal" claim: "aal2" means the authenticator-code check was passed in this session. */
function aalOf(accessToken: string): string {
  try {
    const payload = accessToken.split(".")[1] ?? "";
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return String(json.aal ?? "aal1");
  } catch {
    return "aal1";
  }
}

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

export async function getCurrentMember(): Promise<Member | null> {
  const {
    data: { session },
  } = await sb().auth.getSession();
  if (!session) return null;
  const { data: row, error } = await sb().from("members").select("*").eq("auth_user_id", session.user.id).maybeSingle();
  if (error || !row || !row.is_active) return null;
  const member = toMember(row);
  // Officer powers only count after the authenticator code. Otherwise show the member view
  // (the database refuses officer actions anyway).
  if (member.role !== "member" && aalOf(session.access_token) !== "aal2") {
    return { ...member, role: "member", position: null };
  }
  return member;
}

async function me(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) throw new ApiError("Please sign in again.");
  return member;
}

async function pinAuth(body: Record<string, string>): Promise<Member> {
  await sb().auth.signOut({ scope: "local" });
  const { data, error } = await sb().functions.invoke("pin-auth", { body });
  if (error) throw new ApiError("Sign-in isn't working right now. Please try again in a minute.");
  if (!data?.ok) throw new ApiError(data?.error ?? "That member ID or PIN isn't right.");
  const { error: sessionError } = await sb().auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError) throw new ApiError("Sign-in isn't working right now. Please try again in a minute.");
  return me();
}

export async function signInMember(memberCode: string, pin: string): Promise<Member> {
  return pinAuth({ action: "login", memberCode: normalizeMemberCode(memberCode), pin });
}

export async function activateMember(memberCode: string, setupCode: string, newPin: string): Promise<Member> {
  return pinAuth({ action: "activate", memberCode: normalizeMemberCode(memberCode), setupCode, pin: newPin });
}

let pendingFactorId: string | null = null;

export async function signInOfficer(email: string, password: string): Promise<OfficerSignInResult> {
  pendingFactorId = null;
  const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw new ApiError("That email or password isn't right.");

  const { data: row } = await sb().from("members").select("role, is_active").eq("auth_user_id", data.user.id).maybeSingle();
  if (!row || !row.is_active || row.role === "member") {
    await sb().auth.signOut({ scope: "local" });
    throw new ApiError("This account isn't set up as an officer. Ask the Director.");
  }

  const { data: factors, error: factorError } = await sb().auth.mfa.listFactors();
  if (factorError) fail(factorError);
  const verified = factors.totp.find((f) => f.status === "verified");
  if (verified) {
    pendingFactorId = verified.id;
    return { needsCode: true, hint: "Open your authenticator app and enter the 6-digit code for His Theatre." };
  }

  // First officer sign-in: set up the authenticator app. Clear any half-finished attempt first.
  for (const f of factors.all.filter((x) => x.status !== "verified")) {
    await sb().auth.mfa.unenroll({ factorId: f.id });
  }
  const { data: enrolled, error: enrollError } = await sb().auth.mfa.enroll({ factorType: "totp", friendlyName: "His Theatre" });
  if (enrollError || !enrolled) fail(enrollError);
  pendingFactorId = enrolled.id;
  return {
    needsEnrollment: true,
    hint: "Scan this with Google Authenticator (or any authenticator app), then enter the 6-digit code it shows.",
    qrCode: enrolled.totp.qr_code,
    secret: enrolled.totp.secret,
  };
}

export async function verifyOfficerCode(code: string): Promise<Member> {
  if (!pendingFactorId) throw new ApiError("Start again with your email and password.");
  const { error } = await sb().auth.mfa.challengeAndVerify({ factorId: pendingFactorId, code: code.trim() });
  if (error) throw new ApiError("That code isn't right. Use the newest code in your app, and check your phone's time is automatic.");
  pendingFactorId = null;
  return me();
}

export async function signOut(): Promise<void> {
  pendingFactorId = null;
  await sb().auth.signOut({ scope: "local" });
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  await run(sb().rpc("change_pin", { p_current: currentPin, p_new: newPin }));
}

export async function devPreviewAs(_role: PreviewRole): Promise<Member> {
  throw new ApiError("Preview is only available with test data.");
}

// ---------------------------------------------------------------------------
// Semesters
// ---------------------------------------------------------------------------

export async function listSemesters(): Promise<Semester[]> {
  const rows = await run(sb().from("semesters").select("*").order("starts_on", { ascending: false }));
  return rows.map(toSemester);
}

export async function getCurrentSemester(): Promise<Semester> {
  const all = await listSemesters();
  const today = todayISO();
  const open = all.filter((s) => !s.isClosed);
  const sem = open.find((s) => s.startsOn <= today && today <= s.endsOn) ?? open[0] ?? all[0];
  if (!sem) throw new ApiError("No semester has been set up yet. The Director sets one up under Admin → Semester.");
  return sem;
}

export async function getSemesterWeeks(semesterId: string): Promise<SemesterWeek[]> {
  const rows = await run(sb().from("semester_weeks").select("*").eq("semester_id", semesterId).order("week_no"));
  return rows.map(toWeek);
}

export async function getRates(semesterId: string): Promise<DuesRate[]> {
  const rows = await run(sb().from("dues_rates").select("*").eq("semester_id", semesterId));
  return rows.map(toRate);
}

/** Everything needed to work out dues for a semester (only rows this person may see come back). */
async function semesterBundle(semesterId: string) {
  const [weeks, rates, memberships, adjustments, payments] = await Promise.all([
    getSemesterWeeks(semesterId),
    getRates(semesterId),
    run(sb().from("member_semesters").select("*").eq("semester_id", semesterId)).then((r) => r.map(toMemberSemester)),
    run(sb().from("adjustments").select("*").eq("semester_id", semesterId)).then((r) => r.map(toAdjustment)),
    run(sb().from("payments").select("*").eq("semester_id", semesterId)).then((r) => r.map(toPayment)),
  ]);
  return { weeks, rates, memberships, adjustments, payments };
}

type Bundle = Awaited<ReturnType<typeof semesterBundle>>;

function duesFor(member: Member, b: Bundle): DuesSummary | null {
  const ms = b.memberships.find((x) => x.memberId === member.id);
  if (!ms) return null;
  const rate = b.rates.find((r) => r.category === ms.category)?.weeklyAmount ?? 0;
  return calculateDues(ms, b.weeks, rate, b.adjustments, b.payments, todayISO(), member.leftOn);
}

function withDues(member: Member, b: Bundle): MemberWithDues {
  const dues = duesFor(member, b);
  return { ...member, dues, status: dues ? duesStatus(dues) : null };
}

// ---------------------------------------------------------------------------
// Member-facing dues
// ---------------------------------------------------------------------------

export async function getMyDues(semesterId: string): Promise<DuesSummary | null> {
  const member = await me();
  return duesFor(member, await semesterBundle(semesterId));
}

export async function getMyMembership(semesterId: string): Promise<MemberSemester | null> {
  const member = await me();
  const row = await run(
    sb().from("member_semesters").select("*").eq("semester_id", semesterId).eq("member_id", member.id).maybeSingle(),
  );
  return row ? toMemberSemester(row) : null;
}

export async function getMyPayments(semesterId: string): Promise<Payment[]> {
  const member = await me();
  const rows = await run(
    sb()
      .from("payments")
      .select("*")
      .eq("semester_id", semesterId)
      .eq("member_id", member.id)
      .order("created_at", { ascending: false }),
  );
  return rows.map(toPayment);
}

export async function getReceipt(paymentId: string): Promise<ReceiptView> {
  const viewer = await me();
  const row = await run(sb().from("payments").select("*").eq("id", paymentId).maybeSingle());
  if (!row) throw new ApiError("Receipt not found.");
  const payment = toPayment(row);
  const owner =
    payment.memberId === viewer.id
      ? viewer
      : toMember(await run(sb().from("members").select("*").eq("id", payment.memberId).single()));
  const officers = await listOfficers();
  const recorder = officers.find((o) => o.id === payment.recordedBy);
  const reversal = await run(sb().from("payments").select("id").eq("reverses_payment_id", payment.id));
  return {
    payment,
    memberName: owner.fullName,
    memberCode: owner.memberCode,
    recordedByName: recorder?.fullName ?? "An officer",
    recordedByPosition: (recorder?.position as OfficerPosition | null) ?? null,
    reversed: reversal.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Members (officers)
// ---------------------------------------------------------------------------

export async function listMembers(filters: MemberFilters = {}): Promise<MemberWithDues[]> {
  const sem = await getCurrentSemester();
  let query = sb().from("members").select("*");
  if (!filters.includeInactive) query = query.eq("is_active", true);
  const [rows, bundle] = await Promise.all([run(query), semesterBundle(sem.id)]);
  const q = filters.search?.trim().toLowerCase();
  const digits = q?.replace(/\s/g, "");
  return rows
    .map(toMember)
    .filter((m) => !filters.drive || m.drive === filters.drive)
    .filter(
      (m) =>
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        (!!digits && m.phone.replace(/\s/g, "").includes(digits)),
    )
    .map((m) => withDues(m, bundle))
    .filter((m) => !filters.status || m.status === filters.status)
    .sort((a, b) => a.memberCode.localeCompare(b.memberCode));
}

export async function listDrives(): Promise<string[]> {
  const rows = await run(sb().from("members").select("drive"));
  const used = rows.map((r: { drive: string }) => r.drive).filter(Boolean);
  return [...new Set([...DRIVES, ...used])];
}

export async function getMember(
  id: string,
): Promise<MemberWithDues & { payments: Payment[]; adjustments: Adjustment[]; membership: MemberSemester | null }> {
  const sem = await getCurrentSemester();
  const [row, bundle] = await Promise.all([
    run(sb().from("members").select("*").eq("id", id).maybeSingle()),
    semesterBundle(sem.id),
  ]);
  if (!row) throw new ApiError("Member not found.");
  const member = toMember(row);
  return {
    ...withDues(member, bundle),
    membership: bundle.memberships.find((x) => x.memberId === id) ?? null,
    payments: bundle.payments
      .filter((p) => p.memberId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    adjustments: bundle.adjustments.filter((a) => a.memberId === id),
  };
}

export async function addMember(input: NewMemberInput): Promise<Member> {
  if (!input.fullName.trim()) throw new ApiError("Enter the member's full name.");
  const sem = await getCurrentSemester();
  const row = await run(
    sb()
      .from("members")
      .insert({ full_name: input.fullName.trim(), phone: input.phone.trim(), drive: input.drive, category: input.category })
      .select("*")
      .single(),
  );
  const member = toMember(row);
  // They join the current semester from this week.
  const weeks = await getSemesterWeeks(sem.id);
  const today = todayISO();
  const startWeek = [...weeks].reverse().find((w) => w.weekStart <= today)?.weekNo ?? 1;
  await run(
    sb()
      .from("member_semesters")
      .insert({ member_id: member.id, semester_id: sem.id, category: member.category, start_week_no: startWeek }),
  );
  return member;
}

export async function updateMember(id: string, input: UpdateMemberInput): Promise<Member> {
  const patch: Record<string, string> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName.trim();
  if (input.phone !== undefined) patch.phone = input.phone.trim();
  if (input.drive !== undefined) patch.drive = input.drive;
  if (input.category !== undefined) patch.category = input.category;
  const row = await run(sb().from("members").update(patch).eq("id", id).select("*").single());
  if (input.category) {
    const sem = await getCurrentSemester();
    await run(sb().from("member_semesters").update({ category: input.category }).eq("member_id", id).eq("semester_id", sem.id));
  }
  return toMember(row);
}

export async function deactivateMember(id: string, leftOn: ISODate): Promise<Member> {
  const row = await run(sb().from("members").update({ is_active: false, left_on: leftOn }).eq("id", id).select("*").single());
  return toMember(row);
}

export async function issueSetupCode(memberId: string): Promise<string> {
  return run(sb().rpc("issue_setup_code", { p_member: memberId }));
}

export async function unlockMember(memberId: string): Promise<Member> {
  await run(sb().rpc("unlock_member", { p_member: memberId }));
  return toMember(await run(sb().from("members").select("*").eq("id", memberId).single()));
}

export async function setRole(memberId: string, role: MemberRole, position: OfficerPosition | null): Promise<Member> {
  if (role !== "member" && !position) throw new ApiError("Choose their position.");
  const row = await run(
    sb()
      .from("members")
      .update({ role, position: role === "member" ? null : position })
      .eq("id", memberId)
      .select("*")
      .single(),
  );
  return toMember(row);
}

// ---------------------------------------------------------------------------
// Payments & adjustments
// ---------------------------------------------------------------------------

export async function recordPayment(input: RecordPaymentInput): Promise<Payment> {
  assertAmount(input.amount);
  if (input.method === "momo" && !input.momoReference?.trim()) throw new ApiError("Enter the MoMo transaction ID.");
  const officer = await me();
  const { data, error } = await sb()
    .from("payments")
    .insert({
      member_id: input.memberId,
      semester_id: input.semesterId,
      amount: input.amount,
      method: input.method,
      momo_reference: input.method === "momo" ? input.momoReference?.trim() : null,
      paid_on: input.paidOn,
      note: input.note?.trim() || null,
      idempotency_key: input.idempotencyKey,
      recorded_by: officer.id, // the database replaces this with the signed-in officer
    })
    .select("*")
    .single();
  if (error) {
    // Same tap twice: return the payment that was already saved.
    if (/idempotency_key/.test(error.message)) {
      const existing = await run(sb().from("payments").select("*").eq("idempotency_key", input.idempotencyKey).single());
      return toPayment(existing);
    }
    fail(error);
  }
  return toPayment(data);
}

export async function reversePayment(id: string, reason: string): Promise<Payment> {
  assertReason(reason);
  const officer = await me();
  const original = toPayment(await run(sb().from("payments").select("*").eq("id", id).single()));
  if (original.reversesPaymentId) throw new ApiError("A reversal can't be reversed.");
  const row = await run(
    sb()
      .from("payments")
      .insert({
        member_id: original.memberId,
        semester_id: original.semesterId,
        amount: -original.amount,
        method: original.method,
        momo_reference: original.momoReference ?? null,
        paid_on: todayISO(),
        note: `Reversal of ${original.receiptNo}: ${reason.trim()}`.slice(0, 300),
        reverses_payment_id: original.id,
        idempotency_key: newKey(),
        recorded_by: officer.id,
      })
      .select("*")
      .single(),
  ).catch((e: Error) => {
    if (/reverses_payment_id/.test(e.message)) throw new ApiError("This payment has already been reversed.");
    throw e;
  });
  return toPayment(row);
}

export async function addAdjustment(input: AdjustmentInput): Promise<Adjustment> {
  assertReason(input.reason);
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new ApiError("Enter an amount.");
  const officer = await me();
  const row = await run(
    sb()
      .from("adjustments")
      .insert({
        member_id: input.memberId,
        semester_id: input.semesterId,
        amount: input.amount,
        reason: input.reason.trim(),
        recorded_by: officer.id,
      })
      .select("*")
      .single(),
  );
  return toAdjustment(row);
}

// ---------------------------------------------------------------------------
// Expenses, other income, handovers
// ---------------------------------------------------------------------------

export async function listExpenses(): Promise<Expense[]> {
  const rows = await run(sb().from("expenses").select("*").order("created_at", { ascending: false }));
  return rows.map(toExpense);
}

export async function recordExpense(input: ExpenseInput): Promise<Expense> {
  assertAmount(input.amount);
  const officer = await me();
  const row = await run(
    sb()
      .from("expenses")
      .insert({
        description: input.description.trim(),
        category: input.category,
        amount: input.amount,
        paid_by: input.paidBy.trim(),
        approved_by: input.approvedBy.trim(),
        receipt_ref: input.receiptRef?.trim() || null,
        date: input.date,
        recorded_by: officer.id,
      })
      .select("*")
      .single(),
  );
  return toExpense(row);
}

export async function reverseExpense(id: string, reason: string): Promise<Expense> {
  assertReason(reason);
  const officer = await me();
  const original = toExpense(await run(sb().from("expenses").select("*").eq("id", id).single()));
  const row = await run(
    sb()
      .from("expenses")
      .insert({
        description: `Reversal of ${original.ref}: ${reason.trim()}`.slice(0, 200),
        category: original.category,
        amount: -original.amount,
        paid_by: original.paidBy,
        approved_by: original.approvedBy,
        date: todayISO(),
        reverses_id: original.id,
        recorded_by: officer.id,
      })
      .select("*")
      .single(),
  ).catch((e: Error) => {
    if (/reverses_id/.test(e.message)) throw new ApiError("This entry has already been reversed.");
    throw e;
  });
  return toExpense(row);
}

export async function listIncome(): Promise<OtherIncome[]> {
  const rows = await run(sb().from("other_income").select("*").order("created_at", { ascending: false }));
  return rows.map(toIncome);
}

export async function recordIncome(input: IncomeInput): Promise<OtherIncome> {
  assertAmount(input.amount);
  const officer = await me();
  const row = await run(
    sb()
      .from("other_income")
      .insert({
        source: input.source,
        description: input.description.trim(),
        amount: input.amount,
        method: input.method,
        date: input.date,
        recorded_by: officer.id,
      })
      .select("*")
      .single(),
  );
  return toIncome(row);
}

export async function reverseIncome(id: string, reason: string): Promise<OtherIncome> {
  assertReason(reason);
  const officer = await me();
  const original = toIncome(await run(sb().from("other_income").select("*").eq("id", id).single()));
  const row = await run(
    sb()
      .from("other_income")
      .insert({
        source: original.source,
        description: `Reversal of ${original.ref}: ${reason.trim()}`.slice(0, 200),
        amount: -original.amount,
        method: original.method,
        date: todayISO(),
        reverses_id: original.id,
        recorded_by: officer.id,
      })
      .select("*")
      .single(),
  ).catch((e: Error) => {
    if (/reverses_id/.test(e.message)) throw new ApiError("This entry has already been reversed.");
    throw e;
  });
  return toIncome(row);
}

export async function listHandovers(): Promise<Handover[]> {
  const rows = await run(sb().from("handovers").select("*").order("recorded_at", { ascending: false }));
  return rows.map(toHandover);
}

export async function recordHandover(input: HandoverInput): Promise<Handover> {
  assertAmount(input.amount);
  const officer = await me();
  if (officer.position !== "Financial Secretary") throw new ApiError("Only the Financial Secretary records handovers.");
  const row = await run(
    sb()
      .from("handovers")
      .insert({ from_member_id: officer.id, to_member_id: input.toMemberId, amount: input.amount })
      .select("*")
      .single(),
  );
  return toHandover(row);
}

export async function confirmHandover(id: string): Promise<Handover> {
  const { data, error } = await sb()
    .from("handovers")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) fail(error);
  if (!data) throw new ApiError("Only the person receiving the cash can confirm it.");
  return toHandover(data);
}

// ---------------------------------------------------------------------------
// Overviews (worked out from the rows officers can read)
// ---------------------------------------------------------------------------

async function allMoney() {
  const [payments, income, expenses, handovers] = await Promise.all([
    run(sb().from("payments").select("*")).then((r) => r.map(toPayment)),
    listIncome(),
    listExpenses(),
    listHandovers(),
  ]);
  return { payments, income, expenses, handovers };
}

/**
 * Who holds the cash: cash an officer recorded stays with them until handed over;
 * confirmed handovers move it; cash expenses come out of whoever recorded them.
 */
export async function getCashPosition(): Promise<CashPosition> {
  const [{ payments, income, expenses, handovers }, officers] = await Promise.all([allMoney(), listOfficers()]);
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
  const holders = officers.map((o) => {
    const cashIn =
      sum(payments.filter((p) => p.method === "cash" && p.recordedBy === o.id)) +
      sum(income.filter((i) => i.method === "cash" && i.recordedBy === o.id));
    const spent = sum(expenses.filter((e) => e.recordedBy === o.id));
    const handedOut = sum(handovers.filter((h) => h.fromMemberId === o.id));
    const received = sum(handovers.filter((h) => h.toMemberId === o.id && h.confirmedAt));
    return { memberId: o.id, fullName: o.fullName, position: o.position, cash: cashIn - spent - handedOut + received };
  });
  const duesCash = sum(payments.filter((p) => p.method === "cash"));
  const duesMomo = sum(payments.filter((p) => p.method === "momo"));
  const incCash = sum(income.filter((i) => i.method === "cash"));
  const incMomo = sum(income.filter((i) => i.method === "momo"));
  const spentAll = sum(expenses);
  const pending = handovers.filter((h) => !h.confirmedAt);
  return {
    balance: duesCash + duesMomo + incCash + incMomo - spentAll,
    cash: duesCash + incCash - spentAll,
    momo: duesMomo + incMomo,
    holders,
    inTransit: sum(pending),
    pendingHandovers: pending,
  };
}

export async function getToday(): Promise<TodaySummary> {
  const date = todayISO();
  const { payments: allPayments, income: allIncome, expenses: allExpenses, handovers: allHandovers } = await allMoney();
  const payments = allPayments.filter((p) => p.paidOn === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const income = allIncome.filter((i) => i.date === date);
  const expenses = allExpenses.filter((e) => e.date === date);
  const handovers = allHandovers.filter((h) => todayISO(new Date(h.recordedAt)) === date || !h.confirmedAt);
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
  const cash = sum(payments.filter((p) => p.method === "cash")) + sum(income.filter((i) => i.method === "cash"));
  const momo = sum(payments.filter((p) => p.method === "momo")) + sum(income.filter((i) => i.method === "momo"));
  return { date, collected: cash + momo, collectedCash: cash, collectedMomo: momo, spent: sum(expenses), payments, income, expenses, handovers };
}

export async function getDashboard(semesterId: string): Promise<Dashboard> {
  const [sems, memberRows, bundle] = await Promise.all([
    listSemesters(),
    run(sb().from("members").select("*").eq("is_active", true)),
    semesterBundle(semesterId),
  ]);
  const semester = sems.find((s) => s.id === semesterId);
  if (!semester) throw new ApiError("Semester not found.");
  const rows = memberRows.map(toMember).map((m) => withDues(m, bundle)).filter((m) => m.dues);
  const total = (k: keyof DuesSummary) => rows.reduce((s, r) => s + Number(r.dues?.[k] ?? 0), 0);
  return {
    semester,
    memberCount: rows.length,
    paidUp: rows.filter((r) => r.status === "paid_up").length,
    behind: rows.filter((r) => r.status === "behind").length,
    ahead: rows.filter((r) => r.status === "ahead").length,
    dueSoFar: total("dueSoFar"),
    collected: total("paid"),
    owing: total("owing"),
    semesterTotal: total("semesterTotal"),
  };
}

export async function getReport(from: ISODate, to: ISODate): Promise<Report> {
  const [{ payments: allPayments, income: allIncome, expenses: allExpenses }, memberRows] = await Promise.all([
    allMoney(),
    run(sb().from("members").select("id, drive")),
  ]);
  const driveOf = new Map<string, string>(memberRows.map((m: { id: string; drive: string }) => [m.id, m.drive] as [string, string]));
  const inRange = (d: string) => d >= from && d <= to;
  const payments = allPayments.filter((p) => inRange(p.paidOn)).sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const income = allIncome.filter((i) => inRange(i.date));
  const expenses = allExpenses.filter((e) => inRange(e.date));
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

  const incomeBySource = { donation: 0, offering: 0, ticket_sales: 0, fundraising: 0, levy: 0, other: 0 } as Record<IncomeSource, number>;
  for (const i of income) incomeBySource[i.source] += i.amount;
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount;
  const duesByDrive: Record<string, number> = {};
  for (const p of payments) {
    const drive = driveOf.get(p.memberId) || "No drive";
    duesByDrive[drive] = (duesByDrive[drive] ?? 0) + p.amount;
  }
  const duesCash = sum(payments.filter((p) => p.method === "cash"));
  const duesMomo = sum(payments.filter((p) => p.method === "momo"));
  const incomeTotal = sum(income);
  const expensesTotal = sum(expenses);
  const openingBalance =
    sum(allPayments.filter((p) => p.paidOn < from)) + sum(allIncome.filter((i) => i.date < from)) - sum(allExpenses.filter((e) => e.date < from));
  const net = duesCash + duesMomo + incomeTotal - expensesTotal;
  return {
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
  };
}

// ---------------------------------------------------------------------------
// Semester setup (Director)
// ---------------------------------------------------------------------------

function mondayOf(date: ISODate): ISODate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export async function saveSemester(input: SemesterInput): Promise<Semester> {
  if (!input.name.trim()) throw new ApiError("Give the semester a name.");
  if (input.endsOn <= input.startsOn) throw new ApiError("The end date must be after the start date.");
  if (input.id) {
    const row = await run(
      sb()
        .from("semesters")
        .update({ name: input.name.trim(), starts_on: input.startsOn, ends_on: input.endsOn })
        .eq("id", input.id)
        .select("*")
        .single(),
    );
    return toSemester(row);
  }
  const previous = (await listSemesters())[0];
  const previousRates = previous ? await getRates(previous.id) : [];
  const sem = toSemester(
    await run(
      sb().from("semesters").insert({ name: input.name.trim(), starts_on: input.startsOn, ends_on: input.endsOn }).select("*").single(),
    ),
  );
  const weeks: { semester_id: string; week_no: number; week_start: string; counts: boolean }[] = [];
  for (let monday = mondayOf(input.startsOn), n = 1; monday <= input.endsOn; monday = addDays(monday, 7), n++) {
    weeks.push({ semester_id: sem.id, week_no: n, week_start: monday, counts: true });
  }
  await run(sb().from("semester_weeks").insert(weeks));
  const rateOf = (c: MemberCategory) => previousRates.find((r) => r.category === c)?.weeklyAmount ?? (c === "executive" ? 1000 : 500);
  await run(
    sb()
      .from("dues_rates")
      .insert((["executive", "member"] as const).map((category) => ({ semester_id: sem.id, category, weekly_amount: rateOf(category) }))),
  );
  const active = (await run(sb().from("members").select("id, category").eq("is_active", true))) as { id: string; category: MemberCategory }[];
  if (active.length) {
    await run(
      sb()
        .from("member_semesters")
        .insert(active.map((m) => ({ member_id: m.id, semester_id: sem.id, category: m.category, start_week_no: 1 }))),
    );
  }
  return sem;
}

export async function addWeeks(semesterId: string, count: number): Promise<SemesterWeek[]> {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new ApiError("Add between 1 and 20 weeks.");
  const [weeks, sems] = await Promise.all([getSemesterWeeks(semesterId), listSemesters()]);
  const sem = sems.find((s) => s.id === semesterId);
  if (!sem) throw new ApiError("Semester not found.");
  const last = weeks[weeks.length - 1];
  let monday = last ? addDays(last.weekStart, 7) : mondayOf(sem.startsOn);
  let weekNo = last ? last.weekNo + 1 : 1;
  const rows: { semester_id: string; week_no: number; week_start: string; counts: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({ semester_id: semesterId, week_no: weekNo, week_start: monday, counts: true });
    monday = addDays(monday, 7);
    weekNo += 1;
  }
  await run(sb().from("semester_weeks").insert(rows));
  await run(sb().from("semesters").update({ ends_on: addDays(monday, -1) }).eq("id", semesterId));
  return getSemesterWeeks(semesterId);
}

export async function setStartWeek(memberId: string, semesterId: string, startWeekNo: number): Promise<MemberSemester> {
  const row = await run(
    sb()
      .from("member_semesters")
      .update({ start_week_no: startWeekNo })
      .eq("member_id", memberId)
      .eq("semester_id", semesterId)
      .select("*")
      .single(),
  );
  return toMemberSemester(row);
}

export async function setWeekCounts(weekId: string, counts: boolean, label?: string): Promise<SemesterWeek> {
  const row = await run(
    sb()
      .from("semester_weeks")
      .update({ counts, label: counts ? null : label?.trim() || "No dues this week" })
      .eq("id", weekId)
      .select("*")
      .single(),
  );
  return toWeek(row);
}

export async function setRates(
  semesterId: string,
  rates: { category: MemberCategory; weeklyAmount: number }[],
): Promise<DuesRate[]> {
  for (const r of rates) {
    if (!Number.isInteger(r.weeklyAmount) || r.weeklyAmount < 0) throw new ApiError("Rates must be whole pesewas.");
  }
  await run(
    sb()
      .from("dues_rates")
      .upsert(rates.map((r) => ({ semester_id: semesterId, category: r.category, weekly_amount: r.weeklyAmount })), {
        onConflict: "semester_id,category",
      }),
  );
  return getRates(semesterId);
}

export async function closeSemester(semesterId: string): Promise<Semester> {
  const row = await run(sb().from("semesters").update({ is_closed: true }).eq("id", semesterId).select("*").single());
  return toSemester(row);
}

// ---------------------------------------------------------------------------
// Audit and officers
// ---------------------------------------------------------------------------

export async function listAudit(filters: AuditFilters = {}): Promise<AuditEntry[]> {
  let query = sb().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(filters.limit ?? 200);
  if (filters.table) query = query.eq("table_name", filters.table);
  const rows = await run(query);
  return rows.map(toAudit);
}

/** Officer names and positions (for receipts, handovers, the Roles screen). Everyone signed in can read this short list. */
export async function listOfficers(): Promise<Member[]> {
  const rows = (await run(sb().rpc("list_officers"))) as {
    id: string;
    member_code: string;
    full_name: string;
    role: MemberRole;
    position: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    memberCode: r.member_code,
    fullName: r.full_name,
    phone: "",
    drive: "",
    category: "executive",
    role: r.role,
    position: (r.position as OfficerPosition | null) ?? null,
    isActive: true,
    leftOn: null,
    isActivated: true,
    isLocked: false,
  }));
}

/** Only meaningful with test data. */
export const DEV_SIGN_IN_HINTS = { memberPin: "", officerPassword: "", officerCode: "", setupCodes: "" };
