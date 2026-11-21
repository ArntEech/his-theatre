// LIVE IMPLEMENTATION: the real His Theatre data, in Supabase.
//
// Same functions and shapes as api.mock.ts, so screens can't tell which one they use.
// Security does NOT live here. The database's own rules decide who may read or change what
// (supabase/migrations/0001_his_theatre.sql): officer powers need the authenticator code,
// money rows can't be edited or deleted, handovers go only from the Financial Secretary to
// the Treasurer, and so on. This file asks, then turns answers into the app's shapes and
// friendly words. Money is always integer pesewas.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays, localToday, mondayOf } from "@/lib/dates";
import { normalizeMemberCode } from "@/lib/member-code";
import { isWeakPin, WEAK_PIN_MESSAGE } from "@/lib/pin";
import {
  byNewest,
  cashPosition,
  currentSemesterRecord,
  dashboard,
  duesFor,
  expenseRow,
  handoverRow,
  incomeRow,
  listItem,
  paymentRow,
  report,
  semesterDetail,
  todayReport,
  weeksOf,
  adjustmentRow,
  type Snapshot,
} from "./derive";
import {
  ApiError,
  type Adjustment,
  type AdjustmentInput,
  type AdjustmentRow,
  type AuditEntry,
  type AuditFilters,
  type CashPosition,
  type Dashboard,
  type DuesRate,
  type Expense,
  type ExpenseInput,
  type ExpenseRow,
  type Handover,
  type HandoverInput,
  type HandoverRow,
  type IncomeInput,
  type IncomeRow,
  type IsoDate,
  type Member,
  type MemberDetail,
  type MemberFilters,
  type MemberListItem,
  type MemberSemester,
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

/* ------------------------------------------------------------------ */
/* Connection                                                           */
/* ------------------------------------------------------------------ */

let client: SupabaseClient | null = null;

/** The Supabase connection. Uses only the public (publishable) key, never a secret key. */
function sb(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new ApiError("The app isn't connected to its database yet.");
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "his-theatre-auth",
      },
    });
  }
  return client;
}

type DbError = { message: string; code?: string } | null;

/** Database answers → words for people, with a code the screens can act on. */
function toApiError(error: DbError): ApiError {
  const message = error?.message ?? "";
  if (/Failed to fetch|NetworkError|network|fetch failed|Load failed/i.test(message))
    return new ApiError("No connection. Check your internet and try again.", "offline");
  if (/JWT|not authenticated|Auth session missing|refresh token/i.test(message))
    return new ApiError("Please sign in again.", "unauthenticated");
  if (/row-level security|permission denied/i.test(message))
    return new ApiError(
      "You don't have permission to do that. Officers: sign out, then sign in again with your authenticator code.",
      "forbidden",
    );
  if (/Only the Director|Only officers/i.test(message)) return new ApiError(message, "forbidden");
  if (/semester is closed/i.test(message))
    return new ApiError(
      "This semester is closed. Money can no longer be recorded against it.",
      "closed",
    );
  if (error?.code === "23505" || /duplicate key/i.test(message))
    return new ApiError("That's already been recorded.", "duplicate");
  if (/violates check constraint|invalid input|value too long/i.test(message))
    return new ApiError("Some details aren't valid. Check the form and try again.", "invalid");
  if (/PGRST116|0 rows|multiple \(or no\) rows/i.test(message))
    return new ApiError("That record wasn't found, or you can't change it.", "not_found");
  // Messages written in the database's own rules are already plain English.
  return new ApiError(message || "Something went wrong. Please try again.");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

async function run<T = any>(query: PromiseLike<{ data: unknown; error: DbError }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw toApiError(error);
  return data as T;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PAGE = 1000;

/** Reads every row the person may see, a page at a time (the server sends at most 1000). */
async function all(table: string, orderBy: string[]): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb().from(table).select("*");
    for (const col of orderBy) q = q.order(col);
    const rows = await run<Row[]>(q.range(from, from + PAGE - 1));
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/* ------------------------------------------------------------------ */
/* Rows → app shapes                                                    */
/* ------------------------------------------------------------------ */

const toMember = (r: Row): Member => ({
  id: r.id,
  memberCode: r.member_code,
  fullName: r.full_name,
  phone: r.phone ?? "",
  drive: r.drive ?? "",
  category: r.category ?? "member",
  role: r.role,
  position: (r.position ?? null) as Position,
  isActive: r.is_active ?? true,
  leftOn: r.left_on ?? null,
  isActivated: r.is_activated ?? true,
  isLocked: r.is_locked ?? false,
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
const toRate = (r: Row): DuesRate => ({
  semesterId: r.semester_id,
  category: r.category,
  weeklyAmount: r.weekly_amount,
});
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
  actorPosition: (r.actor_position || null) as Position,
  action: r.action,
  table: r.table_name,
  summary: r.summary,
  createdAt: r.created_at,
});

/* ------------------------------------------------------------------ */
/* Who is signed in, and what they can see                              */
/* ------------------------------------------------------------------ */

/** Reads the "aal" claim: "aal2" means the authenticator code was passed in this session. */
function aalOf(accessToken: string): string {
  try {
    const payload = accessToken.split(".")[1] ?? "";
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return String(json.aal ?? "aal1");
  } catch {
    return "aal1";
  }
}

const isAdmin = (m: Member) => m.role === "admin" || m.role === "super_admin";
const today = () => localToday();

export async function getCurrentMember(): Promise<Member | null> {
  const {
    data: { session },
  } = await sb().auth.getSession();
  if (!session) return null;
  const { data: row, error } = await sb()
    .from("members")
    .select("*")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();
  if (error) throw toApiError(error);
  if (!row || !row.is_active) return null;
  const member = toMember(row);
  // Officer powers count only after the authenticator code. Until then, show the member view
  // (the database refuses officer actions anyway).
  if (isAdmin(member) && aalOf(session.access_token) !== "aal2") {
    return { ...member, role: "member", position: null };
  }
  return member;
}

interface Context {
  me: Member;
  s: Snapshot;
}

/** Many screens ask at once after a change; one load answers them all for a moment. */
const FRESH_MS = 2500;
let cache: { at: number; value: Promise<Context> } | null = null;

function changed() {
  cache = null;
}

async function load(): Promise<Context> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.value;
  const value = loadNow();
  cache = { at: Date.now(), value };
  value.catch(() => {
    if (cache?.value === value) cache = null;
  });
  return value;
}

async function loadNow(): Promise<Context> {
  const me = await getCurrentMember();
  if (!me) throw new ApiError("Please sign in again.", "unauthenticated");
  const officer = isAdmin(me);
  const none = Promise.resolve([] as Row[]);
  const [members, officers, semesters, weeks, rates, ms, adjustments, payments, expenses, income, handovers] =
    await Promise.all([
      officer ? all("members", ["member_code"]) : Promise.resolve([] as Row[]),
      run<Row[]>(sb().rpc("list_officers")),
      all("semesters", ["starts_on", "id"]),
      all("semester_weeks", ["semester_id", "week_no"]),
      all("dues_rates", ["semester_id", "category"]),
      all("member_semesters", ["semester_id", "member_id"]),
      all("adjustments", ["id"]),
      all("payments", ["id"]),
      officer ? all("expenses", ["id"]) : none,
      officer ? all("other_income", ["id"]) : none,
      officer ? all("handovers", ["id"]) : none,
    ]);

  // Members see only themselves; officer names come from the short public list.
  const people = officer ? members.map(toMember) : [me];
  for (const o of officers) {
    if (!people.some((p) => p.id === o.id)) people.push(toMember(o));
  }
  return {
    me,
    s: {
      members: people,
      semesters: semesters.map(toSemester),
      weeks: weeks.map(toWeek),
      rates: rates.map(toRate),
      memberSemesters: ms.map(toMemberSemester),
      adjustments: adjustments.map(toAdjustment),
      payments: payments.map(toPayment),
      expenses: expenses.map(toExpense),
      income: income.map(toIncome),
      handovers: handovers.map(toHandover),
    },
  };
}

async function asAdmin(): Promise<Context> {
  const ctx = await load();
  if (!isAdmin(ctx.me)) throw new ApiError("You don't have access to this page.", "forbidden");
  return ctx;
}

async function asSuperAdmin(): Promise<Context> {
  const ctx = await load();
  if (ctx.me.role !== "super_admin")
    throw new ApiError("Only the Director can do this.", "forbidden");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Checks that give clear messages before the database is asked         */
/* ------------------------------------------------------------------ */

function requireText(value: string | undefined, label: string, min = 3, max = 200): string {
  const text = (value ?? "").trim();
  if (text.length < min) throw new ApiError(`${label} is required.`, "invalid");
  if (text.length > max) throw new ApiError(`${label} is too long (${max} letters at most).`, "invalid");
  return text;
}

function requirePositiveAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new ApiError("Enter an amount greater than zero.", "invalid");
}

function findSemester(s: Snapshot, id: string): Semester {
  const semester = s.semesters.find((x) => x.id === id);
  if (!semester) throw new ApiError("That semester could not be found.", "not_found");
  return semester;
}

function requireOpenSemester(s: Snapshot, id: string): Semester {
  const semester = findSemester(s, id);
  if (semester.isClosed)
    throw new ApiError(
      `${semester.name} is closed. Money can no longer be recorded against it.`,
      "closed",
    );
  return semester;
}

function findMember(s: Snapshot, id: string): Member {
  const member = s.members.find((m) => m.id === id);
  if (!member) throw new ApiError("That member could not be found.", "not_found");
  return member;
}

function validatePin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new ApiError("Your PIN must be exactly 4 digits.", "invalid");
  if (isWeakPin(pin)) throw new ApiError(WEAK_PIN_MESSAGE, "weak_pin");
}

function notInFuture(date: IsoDate, what: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError("Choose a date.", "invalid");
  if (date > today()) throw new ApiError(`${what} cannot be in the future.`, "invalid");
}

/* ------------------------------------------------------------------ */
/* Signing in                                                           */
/* ------------------------------------------------------------------ */

async function pinAuth(body: Record<string, string>): Promise<Session> {
  changed();
  await sb().auth.signOut({ scope: "local" });
  const { data, error } = await sb().functions.invoke("pin-auth", { body });
  if (error && !data)
    throw new ApiError("Sign-in isn't working right now. Please try again in a minute.");
  if (!data?.ok) throw new ApiError(data?.error ?? "That member ID or PIN isn't right.", "wrong_pin");
  const { error: sessionError } = await sb().auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError)
    throw new ApiError("Sign-in isn't working right now. Please try again in a minute.");
  const member = await getCurrentMember();
  if (!member) throw new ApiError("This membership is no longer active.", "inactive");
  return { member };
}

export async function signInMember(memberCode: string, pin: string): Promise<Session> {
  if (!pin) throw new ApiError("Enter your PIN.", "invalid");
  return pinAuth({ action: "login", memberCode: normalizeMemberCode(memberCode), pin });
}

export async function activateMember(
  memberCode: string,
  setupCode: string,
  newPin: string,
): Promise<Session> {
  validatePin(newPin);
  return pinAuth({
    action: "activate",
    memberCode: normalizeMemberCode(memberCode),
    setupCode: setupCode.trim(),
    pin: newPin,
  });
}

let pendingFactorId: string | null = null;

export async function signInOfficer(email: string, password: string): Promise<OfficerChallenge> {
  changed();
  pendingFactorId = null;
  const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    if (error && /fetch|network/i.test(error.message)) throw toApiError(error);
    throw new ApiError("That email and password do not match.", "invalid_credentials");
  }
  const { data: row } = await sb()
    .from("members")
    .select("role, is_active")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (!row || !row.is_active || row.role === "member") {
    await sb().auth.signOut({ scope: "local" });
    throw new ApiError("This account isn't set up as an officer. Ask the Director.", "inactive");
  }

  const { data: factors, error: factorError } = await sb().auth.mfa.listFactors();
  if (factorError) throw toApiError(factorError);
  const verified = factors.totp.find((f) => f.status === "verified");
  if (verified) {
    pendingFactorId = verified.id;
    return {};
  }

  // First officer sign-in: set up the authenticator app. Clear any half-finished attempt first.
  for (const f of factors.all.filter((x) => x.status !== "verified")) {
    await sb().auth.mfa.unenroll({ factorId: f.id });
  }
  const { data: enrolled, error: enrollError } = await sb().auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "His Theatre",
  });
  if (enrollError || !enrolled) throw toApiError(enrollError);
  pendingFactorId = enrolled.id;
  return { setup: { qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret } };
}

export async function verifyOfficerCode(code: string): Promise<Session> {
  if (!pendingFactorId) throw new ApiError("Start again with your email and password.", "no_challenge");
  const { error } = await sb().auth.mfa.challengeAndVerify({
    factorId: pendingFactorId,
    code: code.trim(),
  });
  if (error)
    throw new ApiError(
      "That code is not right. Use the newest code in your app, and make sure your phone's time is set automatically.",
      "invalid_code",
    );
  pendingFactorId = null;
  changed();
  const member = await getCurrentMember();
  if (!member) throw new ApiError("Please sign in again.", "unauthenticated");
  return { member };
}

export async function signOut(): Promise<void> {
  pendingFactorId = null;
  changed();
  await sb().auth.signOut({ scope: "local" });
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  validatePin(newPin);
  if (newPin === currentPin)
    throw new ApiError("Choose a PIN that is different from your current one.", "invalid");
  await run(sb().rpc("change_pin", { p_current: currentPin, p_new: newPin }));
}

/* ------------------------------------------------------------------ */
/* My dues                                                              */
/* ------------------------------------------------------------------ */

export async function getMyDues(semesterId: string): Promise<MyDues | null> {
  const { me, s } = await load();
  return duesFor(s, me.id, semesterId, today());
}

export async function getMyPayments(semesterId: string): Promise<PaymentRow[]> {
  const { me, s } = await load();
  return s.payments
    .filter((p) => p.memberId === me.id && p.semesterId === semesterId)
    .sort(byNewest)
    .map((p) => paymentRow(s, p));
}

export async function listSemesters(): Promise<Semester[]> {
  const { s } = await load();
  return [...s.semesters].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

export async function getCurrentSemester(): Promise<SemesterDetail | null> {
  const { s } = await load();
  const t = today();
  const semester = currentSemesterRecord(s, t);
  return semester ? semesterDetail(s, semester, t) : null;
}

/* ------------------------------------------------------------------ */
/* Members                                                              */
/* ------------------------------------------------------------------ */

export async function listMembers(filters: MemberFilters = {}): Promise<MemberListItem[]> {
  const { s } = await asAdmin();
  const t = today();
  const semesterId = currentSemesterRecord(s, t)?.id ?? null;
  const search = filters.search?.trim().toLowerCase() ?? "";
  const searchCode = normalizeMemberCode(search).toLowerCase();
  return s.members
    .filter((m) => filters.includeInactive || m.isActive)
    .filter((m) => !filters.drive || m.drive === filters.drive)
    .filter(
      (m) =>
        !search ||
        m.fullName.toLowerCase().includes(search) ||
        m.memberCode.toLowerCase().includes(search) ||
        m.memberCode.toLowerCase() === searchCode ||
        m.phone.replace(/\s/g, "").includes(search.replace(/\s/g, "")),
    )
    .map((m) => listItem(s, m, semesterId, t))
    .filter((item) => !filters.status || item.status === filters.status)
    .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName));
}

export async function getMember(id: string): Promise<MemberDetail> {
  const { me, s } = await load();
  if (me.id !== id && !isAdmin(me))
    throw new ApiError("You don't have access to this page.", "forbidden");
  const member = findMember(s, id);
  const t = today();
  const semesterId = currentSemesterRecord(s, t)?.id ?? null;
  return {
    member,
    semesterId,
    memberSemester:
      s.memberSemesters.find((x) => x.memberId === id && x.semesterId === semesterId) ?? null,
    dues: semesterId ? duesFor(s, id, semesterId, t) : null,
    payments: s.payments
      .filter((p) => p.memberId === id && (!semesterId || p.semesterId === semesterId))
      .sort(byNewest)
      .map((p) => paymentRow(s, p)),
    adjustments: s.adjustments
      .filter((a) => a.memberId === id && (!semesterId || a.semesterId === semesterId))
      .sort(byNewest)
      .map((a) => adjustmentRow(s, a)),
  };
}

export async function addMember(input: NewMemberInput): Promise<Member> {
  const { s } = await asAdmin();
  const fullName = requireText(input.fullName, "Full name", 2, 100);
  const drive = requireText(input.drive, "Drive", 1, 60);
  const phone = input.phone.trim();
  if (phone.length > 20) throw new ApiError("That phone number is too long.", "invalid");
  const row = await run<Row>(
    sb()
      .from("members")
      .insert({ full_name: fullName, phone, drive, category: input.category })
      .select()
      .single(),
  );
  changed();
  const semester = currentSemesterRecord(s, today());
  if (semester && !semester.isClosed) {
    const maxWeek = weeksOf(s, semester.id).length || 1;
    await run(
      sb()
        .from("member_semesters")
        .insert({
          member_id: row.id,
          semester_id: semester.id,
          category: input.category,
          start_week_no: Math.min(Math.max(1, Math.round(input.startWeekNo)), maxWeek),
        }),
    );
  }
  return toMember(row);
}

export async function updateMember(id: string, patch: MemberUpdate): Promise<Member> {
  const { s } = await asAdmin();
  const member = findMember(s, id);
  const update: Row = {};
  if (patch.fullName !== undefined) update.full_name = requireText(patch.fullName, "Full name", 2, 100);
  if (patch.phone !== undefined) {
    const phone = patch.phone.trim();
    if (phone.length > 20) throw new ApiError("That phone number is too long.", "invalid");
    update.phone = phone;
  }
  if (patch.drive !== undefined) update.drive = requireText(patch.drive, "Drive", 1, 60);
  if (patch.category !== undefined) update.category = patch.category;
  const row = await run<Row>(sb().from("members").update(update).eq("id", id).select().single());
  changed();
  // The category for the current semester follows, so the right weekly rate applies.
  if (patch.category !== undefined && patch.category !== member.category) {
    const semester = currentSemesterRecord(s, today());
    const onRoll =
      semester && s.memberSemesters.some((x) => x.memberId === id && x.semesterId === semester.id);
    if (semester && onRoll && !semester.isClosed) {
      await run(
        sb()
          .from("member_semesters")
          .update({ category: patch.category })
          .eq("member_id", id)
          .eq("semester_id", semester.id),
      );
    }
  }
  return toMember(row);
}

export async function deactivateMember(id: string, leftOn: IsoDate): Promise<Member> {
  const { me } = await asAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leftOn)) throw new ApiError("Choose the date they left.", "invalid");
  if (id === me.id) throw new ApiError("You cannot deactivate your own account.", "invalid");
  const row = await run<Row>(
    sb().from("members").update({ is_active: false, left_on: leftOn }).eq("id", id).select().single(),
  );
  changed();
  return toMember(row);
}

/* ------------------------------------------------------------------ */
/* Money: dues payments and adjustments                                 */
/* ------------------------------------------------------------------ */

async function paymentById(id: string): Promise<PaymentRow> {
  changed();
  const { s } = await load();
  const payment = s.payments.find((p) => p.id === id);
  if (!payment) throw new ApiError("That payment could not be found.", "not_found");
  return paymentRow(s, payment);
}

export async function recordPayment(input: RecordPaymentInput): Promise<PaymentRow> {
  const { s } = await asAdmin();
  // A retried submission returns the payment that was already recorded.
  const existing = s.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
  if (existing) return paymentRow(s, existing);

  requirePositiveAmount(input.amount);
  if (input.amount > 200_000)
    throw new ApiError("One payment can't be more than GH₵ 2,000. Split it into two.", "invalid");
  requireOpenSemester(s, input.semesterId);
  const member = findMember(s, input.memberId);
  if (!s.memberSemesters.some((x) => x.memberId === member.id && x.semesterId === input.semesterId))
    throw new ApiError(`${member.fullName} is not on the roll for this semester.`, "invalid");
  const momoReference = input.momoReference?.trim();
  if (input.method === "momo" && !momoReference)
    throw new ApiError("Enter the MoMo transaction ID.", "invalid");
  notInFuture(input.paidOn, "The payment date");
  const note = input.note?.trim();

  const { data, error } = await sb()
    .from("payments")
    .insert({
      member_id: member.id,
      semester_id: input.semesterId,
      amount: input.amount,
      method: input.method,
      momo_reference: input.method === "momo" ? momoReference : null,
      paid_on: input.paidOn,
      note: note ? note.slice(0, 300) : null,
      idempotency_key: input.idempotencyKey,
    })
    .select("id")
    .single();
  if (error) {
    // Sent twice (say, on a weak connection): the first one already went through.
    if (error.code === "23505" && /idempotency/i.test(error.message)) {
      changed();
      const again = (await load()).s.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
      if (again) return paymentById(again.id);
    }
    throw toApiError(error);
  }
  return paymentById((data as Row).id);
}

export async function reversePayment(id: string, reason: string): Promise<PaymentRow> {
  const { s } = await asAdmin();
  const original = s.payments.find((p) => p.id === id);
  if (!original) throw new ApiError("That payment could not be found.", "not_found");
  if (original.reversesPaymentId)
    throw new ApiError("A reversal cannot itself be voided. Record a new payment instead.", "invalid");
  if (s.payments.some((p) => p.reversesPaymentId === id))
    throw new ApiError(`${original.receiptNo} has already been voided.`, "invalid");
  const why = requireText(reason, "A reason", 3, 300);
  requireOpenSemester(s, original.semesterId);
  const row = await run<Row>(
    sb()
      .from("payments")
      .insert({
        member_id: original.memberId,
        semester_id: original.semesterId,
        amount: -original.amount,
        method: original.method,
        momo_reference: original.momoReference ?? null,
        paid_on: today(),
        note: why,
        reverses_payment_id: original.id,
        idempotency_key: `reverse:${original.id}`,
      })
      .select("id")
      .single(),
  );
  return paymentById(row.id);
}

export async function addAdjustment(input: AdjustmentInput): Promise<AdjustmentRow> {
  const { s } = await asAdmin();
  if (!Number.isSafeInteger(input.amount) || input.amount === 0)
    throw new ApiError("Enter an amount greater than zero.", "invalid");
  const why = requireText(input.reason, "A reason", 3, 300);
  requireOpenSemester(s, input.semesterId);
  findMember(s, input.memberId);
  const row = await run<Row>(
    sb()
      .from("adjustments")
      .insert({
        member_id: input.memberId,
        semester_id: input.semesterId,
        amount: input.amount,
        reason: why,
      })
      .select()
      .single(),
  );
  changed();
  return adjustmentRow((await load()).s, toAdjustment(row));
}

/* ------------------------------------------------------------------ */
/* Money: expenses, other income, handovers                             */
/* ------------------------------------------------------------------ */

async function expenseById(id: string): Promise<ExpenseRow> {
  changed();
  const { s } = await load();
  const expense = s.expenses.find((e) => e.id === id);
  if (!expense) throw new ApiError("That expense could not be found.", "not_found");
  return expenseRow(s, expense);
}

async function incomeById(id: string): Promise<IncomeRow> {
  changed();
  const { s } = await load();
  const income = s.income.find((i) => i.id === id);
  if (!income) throw new ApiError("That income could not be found.", "not_found");
  return incomeRow(s, income);
}

export async function recordExpense(input: ExpenseInput): Promise<ExpenseRow> {
  await asAdmin();
  requirePositiveAmount(input.amount);
  notInFuture(input.date, "The expense date");
  const row = await run<Row>(
    sb()
      .from("expenses")
      .insert({
        description: requireText(input.description, "A description"),
        category: requireText(input.category, "A category", 1, 60),
        amount: input.amount,
        paid_by: requireText(input.paidBy, "Who paid", 2, 80),
        approved_by: requireText(input.approvedBy, "Who approved it", 2, 80),
        receipt_ref: input.receiptRef?.trim() ? input.receiptRef.trim().slice(0, 80) : null,
        date: input.date,
      })
      .select("id")
      .single(),
  );
  return expenseById(row.id);
}

export async function reverseExpense(id: string, reason: string): Promise<ExpenseRow> {
  const { s } = await asAdmin();
  const original = s.expenses.find((e) => e.id === id);
  if (!original) throw new ApiError("That expense could not be found.", "not_found");
  if (original.reversesId) throw new ApiError("A reversal cannot itself be voided.", "invalid");
  if (s.expenses.some((e) => e.reversesId === id))
    throw new ApiError(`${original.ref} has already been voided.`, "invalid");
  const why = requireText(reason, "A reason");
  const row = await run<Row>(
    sb()
      .from("expenses")
      .insert({
        description: why,
        category: original.category,
        amount: -original.amount,
        paid_by: original.paidBy,
        approved_by: original.approvedBy,
        receipt_ref: original.receiptRef ?? null,
        date: today(),
        reverses_id: original.id,
      })
      .select("id")
      .single(),
  );
  return expenseById(row.id);
}

export async function recordIncome(input: IncomeInput): Promise<IncomeRow> {
  await asAdmin();
  requirePositiveAmount(input.amount);
  notInFuture(input.date, "The date");
  const row = await run<Row>(
    sb()
      .from("other_income")
      .insert({
        source: input.source,
        description: requireText(input.description, "A description"),
        amount: input.amount,
        method: input.method,
        date: input.date,
      })
      .select("id")
      .single(),
  );
  return incomeById(row.id);
}

export async function reverseIncome(id: string, reason: string): Promise<IncomeRow> {
  const { s } = await asAdmin();
  const original = s.income.find((i) => i.id === id);
  if (!original) throw new ApiError("That income could not be found.", "not_found");
  if (original.reversesId) throw new ApiError("A reversal cannot itself be voided.", "invalid");
  if (s.income.some((i) => i.reversesId === id))
    throw new ApiError(`${original.ref} has already been voided.`, "invalid");
  const why = requireText(reason, "A reason");
  const row = await run<Row>(
    sb()
      .from("other_income")
      .insert({
        source: original.source,
        description: why,
        amount: -original.amount,
        method: original.method,
        date: today(),
        reverses_id: original.id,
      })
      .select("id")
      .single(),
  );
  return incomeById(row.id);
}

export async function recordHandover(input: HandoverInput): Promise<HandoverRow> {
  const { me, s } = await asAdmin();
  requirePositiveAmount(input.amount);
  const to = findMember(s, input.toMemberId);
  if (to.id === me.id) throw new ApiError("Choose someone other than yourself.", "invalid");
  if (!isAdmin(to)) throw new ApiError("Cash can only be handed to an officer.", "invalid");
  const holding = cashPosition(s).holders.find((h) => h.memberId === me.id)?.holding ?? 0;
  if (input.amount > holding)
    throw new ApiError(
      `You are only holding GH₵ ${(Math.max(0, holding) / 100).toFixed(2)} in cash.`,
      "invalid",
    );
  const row = await run<Row>(
    sb()
      .from("handovers")
      .insert({ from_member_id: me.id, to_member_id: to.id, amount: input.amount })
      .select()
      .single(),
  );
  changed();
  return handoverRow((await load()).s, toHandover(row));
}

export async function confirmHandover(id: string): Promise<HandoverRow> {
  const { me, s } = await asAdmin();
  const handover = s.handovers.find((h) => h.id === id);
  if (!handover) throw new ApiError("That handover could not be found.", "not_found");
  if (handover.toMemberId !== me.id)
    throw new ApiError(
      `Only ${findMember(s, handover.toMemberId).fullName} can confirm receiving this cash.`,
      "forbidden",
    );
  if (handover.confirmedAt) throw new ApiError(`${handover.ref} was already confirmed.`, "invalid");
  // The database stamps the time itself; this value only marks the change.
  const row = await run<Row>(
    sb()
      .from("handovers")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single(),
  );
  changed();
  return handoverRow((await load()).s, toHandover(row));
}

export async function getCashPosition(): Promise<CashPosition> {
  const { s } = await asAdmin();
  return cashPosition(s);
}

/* ------------------------------------------------------------------ */
/* Today, dashboard and reports                                         */
/* ------------------------------------------------------------------ */

export async function getToday(): Promise<TodayReport> {
  const { me, s } = await asAdmin();
  return todayReport(s, me.id, today());
}

export async function getDashboard(semesterId: string): Promise<Dashboard> {
  const { s } = await asAdmin();
  return dashboard(s, findSemester(s, semesterId), today());
}

export async function getReport(from: IsoDate, to: IsoDate): Promise<Report> {
  const { s } = await asAdmin();
  if (from > to) throw new ApiError("The start date must be on or before the end date.", "invalid");
  return report(s, from, to);
}

/* ------------------------------------------------------------------ */
/* Semester settings (the Director)                                     */
/* ------------------------------------------------------------------ */

export async function saveSemester(input: SemesterInput): Promise<SemesterDetail> {
  const { s } = await asSuperAdmin();
  const name = requireText(input.name, "A name", 2, 60);
  if (!input.startsOn || !input.endsOn || input.startsOn >= input.endsOn)
    throw new ApiError("The semester must end after it starts.", "invalid");
  // One week per Monday, from the week holding the start date up to the end date.
  const mondays: IsoDate[] = [];
  for (let d = mondayOf(input.startsOn); d <= input.endsOn; d = addDays(d, 7)) mondays.push(d);
  if (mondays.length > 30) throw new ApiError("A semester cannot be longer than 30 weeks.", "invalid");

  let semesterId: string;
  if (input.id) {
    const semester = findSemester(s, input.id);
    if (semester.isClosed) throw new ApiError("A closed semester cannot be changed.", "closed");
    semesterId = semester.id;
    await run(
      sb()
        .from("semesters")
        .update({ name, starts_on: input.startsOn, ends_on: input.endsOn })
        .eq("id", semesterId),
    );
    const previous = weeksOf(s, semesterId);
    const gone = previous.filter((w) => !mondays.includes(w.weekStart));
    if (gone.length)
      await run(sb().from("semester_weeks").delete().in("id", gone.map((w) => w.id)));
    // Renumber kept weeks in two steps so week numbers never clash on the way.
    const kept = previous.filter((w) => mondays.includes(w.weekStart));
    const moved = kept.filter((w) => w.weekNo !== mondays.indexOf(w.weekStart) + 1);
    for (const w of moved)
      await run(sb().from("semester_weeks").update({ week_no: w.weekNo + 1000 }).eq("id", w.id));
    for (const w of moved)
      await run(
        sb()
          .from("semester_weeks")
          .update({ week_no: mondays.indexOf(w.weekStart) + 1 })
          .eq("id", w.id),
      );
    const added = mondays
      .map((weekStart, i) => ({ semester_id: semesterId, week_no: i + 1, week_start: weekStart }))
      .filter((w) => !kept.some((k) => k.weekStart === w.week_start));
    if (added.length) await run(sb().from("semester_weeks").insert(added));
  } else {
    const previous = currentSemesterRecord(s, today());
    const row = await run<Row>(
      sb()
        .from("semesters")
        .insert({ name, starts_on: input.startsOn, ends_on: input.endsOn })
        .select()
        .single(),
    );
    semesterId = row.id;
    await run(
      sb()
        .from("semester_weeks")
        .insert(mondays.map((weekStart, i) => ({ semester_id: semesterId, week_no: i + 1, week_start: weekStart }))),
    );
    await run(
      sb()
        .from("dues_rates")
        .insert(
          (["executive", "member"] as const).map((category) => ({
            semester_id: semesterId,
            category,
            weekly_amount:
              s.rates.find((r) => r.semesterId === previous?.id && r.category === category)
                ?.weeklyAmount ?? (category === "executive" ? 1000 : 500),
          })),
        ),
    );
    const roll = s.members
      .filter((m) => m.isActive)
      .map((m) => ({ member_id: m.id, semester_id: semesterId, category: m.category, start_week_no: 1 }));
    if (roll.length) await run(sb().from("member_semesters").insert(roll));
  }
  changed();
  const fresh = (await load()).s;
  return semesterDetail(fresh, findSemester(fresh, semesterId), today());
}

export async function setWeekCounts(
  weekId: string,
  counts: boolean,
  label?: string,
): Promise<SemesterWeek> {
  // Any officer may name a week and switch its dues; the database allows only those two changes.
  const { s } = await asAdmin();
  const week = s.weeks.find((w) => w.id === weekId);
  if (!week) throw new ApiError("That week could not be found.", "not_found");
  requireOpenSemester(s, week.semesterId);
  const text = label?.trim().slice(0, 40) || null;
  const row = await run<Row>(
    sb().from("semester_weeks").update({ counts, label: text }).eq("id", weekId).select().single(),
  );
  changed();
  return toWeek(row);
}

export async function setRates(semesterId: string, rates: RatesInput): Promise<SemesterDetail> {
  const { s } = await asSuperAdmin();
  const semester = requireOpenSemester(s, semesterId);
  for (const category of ["executive", "member"] as const) {
    const amount = rates[category];
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new ApiError("Rates must be zero or more.", "invalid");
  }
  await run(
    sb()
      .from("dues_rates")
      .upsert(
        (["executive", "member"] as const).map((category) => ({
          semester_id: semesterId,
          category,
          weekly_amount: rates[category],
        })),
        { onConflict: "semester_id,category" },
      ),
  );
  changed();
  const fresh = (await load()).s;
  return semesterDetail(fresh, findSemester(fresh, semester.id), today());
}

export async function closeSemester(semesterId: string): Promise<Semester> {
  const { s } = await asSuperAdmin();
  const semester = findSemester(s, semesterId);
  if (semester.isClosed) throw new ApiError(`${semester.name} is already closed.`, "invalid");
  const row = await run<Row>(
    sb().from("semesters").update({ is_closed: true }).eq("id", semesterId).select().single(),
  );
  changed();
  return toSemester(row);
}

/* ------------------------------------------------------------------ */
/* Accounts and roles                                                   */
/* ------------------------------------------------------------------ */

export async function issueSetupCode(memberId: string): Promise<SetupCodeResult> {
  const { s } = await asAdmin();
  const member = findMember(s, memberId);
  if (!member.isActive) throw new ApiError("This member is no longer active.", "inactive");
  const setupCode = await run<string>(sb().rpc("issue_setup_code", { p_member: memberId }));
  changed();
  // The code is shown once, here, and is never saved on this device.
  return { setupCode, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() };
}

export async function unlockMember(memberId: string): Promise<Member> {
  await asAdmin();
  await run(sb().rpc("unlock_member", { p_member: memberId }));
  changed();
  const row = await run<Row>(sb().from("members").select("*").eq("id", memberId).single());
  return toMember(row);
}

export async function setRole(memberId: string, role: Role, position: Position): Promise<Member> {
  const { s } = await asSuperAdmin();
  const member = findMember(s, memberId);
  const finalPosition = role === "member" ? null : position;
  if (role !== "member" && !finalPosition)
    throw new ApiError("Choose their position.", "invalid");
  // Each office is held by one person at a time.
  const holder = finalPosition
    ? s.members.find((m) => m.id !== member.id && m.isActive && m.position === finalPosition)
    : undefined;
  if (holder)
    throw new ApiError(
      `${holder.fullName} is the ${finalPosition} now. Change their role first.`,
      "invalid",
    );
  const row = await run<Row>(
    sb()
      .from("members")
      .update({ role, position: finalPosition })
      .eq("id", memberId)
      .select()
      .single(),
  );
  changed();
  return toMember(row);
}

export async function listAudit(filters: AuditFilters = {}): Promise<AuditEntry[]> {
  await asSuperAdmin();
  let q = sb().from("audit_logs").select("*").order("id", { ascending: false }).limit(1000);
  if (filters.table) q = q.eq("table_name", filters.table);
  const rows = (await run<Row[]>(q)).map(toAudit);
  // Searching here, not in the database, keeps typed text out of the query.
  const search = filters.search?.trim().toLowerCase() ?? "";
  return rows
    .filter((a) => !search || `${a.actorName} ${a.action} ${a.summary}`.toLowerCase().includes(search))
    .slice(0, 300);
}

/* ------------------------------------------------------------------ */
/* Demo-only tools: never available on real data                        */
/* ------------------------------------------------------------------ */

export async function devPreviewAs(_memberCode: string): Promise<Session> {
  throw new ApiError("Preview is only available on demo data.", "forbidden");
}

export async function devResetMockData(): Promise<void> {
  throw new ApiError("Reset is only available on demo data.", "forbidden");
}
