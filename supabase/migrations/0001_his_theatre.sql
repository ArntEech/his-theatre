-- =============================================================================
-- His Theatre: database, version 1 (dues and ministry finance)
--
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Run it ONCE.
--
-- Rules this file enforces (the app's screens rely on these, not the other way round):
--   * Members can only ever read their own records. Officers read everything.
--   * Officer powers only work after the authenticator-code check (aal2).
--   * Money is whole pesewas (GH₵1 = 100). Money rows are never edited or deleted;
--     mistakes are fixed with a reversal (a negative row pointing at the original).
--   * Who recorded something, and when, is set by the database, not the phone.
--   * PINs and setup codes are stored only as bcrypt hashes, in a private schema
--     the app can never read.
--   * Every change to money, rates, weeks, semesters and roles is written to an
--     audit log that nobody can edit.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('member', 'admin', 'super_admin');
create type public.member_category as enum ('member', 'executive');
create type public.payment_method as enum ('cash', 'momo');
create type public.income_source as enum ('donation', 'offering', 'ticket_sales', 'fundraising', 'levy', 'other');

-- ---------------------------------------------------------------------------
-- 2. Members
-- ---------------------------------------------------------------------------
create table public.members (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,
  member_code   text not null unique check (member_code ~ '^HIS-[0-9]{3,}$'),
  full_name     text not null check (length(trim(full_name)) between 2 and 100),
  phone         text not null default '' check (length(phone) <= 20),
  drive         text not null default '' check (length(drive) <= 60),
  category      public.member_category not null default 'member',
  role          public.app_role not null default 'member',
  position      text check (position in ('Financial Secretary', 'Treasurer', 'Director')),
  is_active     boolean not null default true,
  left_on       date,
  is_activated  boolean not null default false,
  is_locked     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Helpers used by the access rules
-- ---------------------------------------------------------------------------
create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.members where auth_user_id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
    where auth_user_id = auth.uid() and is_active and role in ('admin', 'super_admin')
  ) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
    where auth_user_id = auth.uid() and is_active and role = 'super_admin'
  ) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- ---------------------------------------------------------------------------
-- 4. Private sign-in data (never reachable from the app)
-- ---------------------------------------------------------------------------
create table private.member_secrets (
  member_id             uuid primary key references public.members(id) on delete cascade,
  pin_hash              text,
  failed_attempts       int not null default 0,   -- since the last lock; 5 = 15-minute lock
  total_failed          int not null default 0,   -- since the last success; 10 = hard lock
  locked_until          timestamptz,
  setup_code_hash       text,
  setup_code_expires_at timestamptz,
  updated_at            timestamptz not null default now()
);
create table private.ip_attempts (
  ip           text not null,
  attempted_at timestamptz not null default now()
);
create index on private.ip_attempts (ip, attempted_at);

-- ---------------------------------------------------------------------------
-- 5. Semesters, weeks, rates, who is in which semester
-- ---------------------------------------------------------------------------
create table public.semesters (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  starts_on  date not null,
  ends_on    date not null check (ends_on > starts_on),
  is_closed  boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.semester_weeks (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  week_no     int  not null check (week_no > 0),
  week_start  date not null,
  counts      boolean not null default true,
  label       text check (length(label) <= 40),
  unique (semester_id, week_no),
  unique (semester_id, week_start)
);

create table public.dues_rates (
  semester_id   uuid not null references public.semesters(id) on delete cascade,
  category      public.member_category not null,
  weekly_amount int not null check (weekly_amount >= 0),
  primary key (semester_id, category)
);

create table public.member_semesters (
  member_id     uuid not null references public.members(id) on delete cascade,
  semester_id   uuid not null references public.semesters(id) on delete cascade,
  category      public.member_category not null,
  start_week_no int not null default 1 check (start_week_no > 0),
  primary key (member_id, semester_id)
);

-- ---------------------------------------------------------------------------
-- 6. Money (add-only)
-- ---------------------------------------------------------------------------
create table public.adjustments (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id),
  semester_id uuid not null references public.semesters(id),
  amount      int  not null check (amount <> 0),           -- negative = waiver
  reason      text not null check (length(trim(reason)) between 3 and 300),
  recorded_by uuid not null references public.members(id),
  created_at  timestamptz not null default now()
);

create sequence public.receipt_seq;
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  receipt_no          text not null unique default 'R-' || lpad(nextval('public.receipt_seq')::text, 4, '0'),
  member_id           uuid not null references public.members(id),
  semester_id         uuid not null references public.semesters(id),
  amount              int  not null check (amount <> 0 and abs(amount) <= 200000),
  method              public.payment_method not null,
  momo_reference      text check (length(momo_reference) <= 80),
  paid_on             date not null default (now() at time zone 'Africa/Accra')::date,
  note                text check (length(note) <= 300),
  reverses_payment_id uuid unique references public.payments(id),
  idempotency_key     text not null unique,
  recorded_by         uuid not null references public.members(id),
  created_at          timestamptz not null default now(),
  check ((reverses_payment_id is null and amount > 0) or (reverses_payment_id is not null and amount < 0)),
  check (method = 'cash' or reverses_payment_id is not null or coalesce(trim(momo_reference), '') <> '')
);

create sequence public.expense_seq;
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique default 'E-' || lpad(nextval('public.expense_seq')::text, 4, '0'),
  description text not null check (length(trim(description)) between 2 and 200),
  category    text not null check (length(category) <= 60),
  amount      int  not null check (amount <> 0),
  paid_by     text not null default '' check (length(paid_by) <= 80),
  approved_by text not null default '' check (length(approved_by) <= 80),
  receipt_ref text check (length(receipt_ref) <= 80),
  date        date not null,
  reverses_id uuid unique references public.expenses(id),
  recorded_by uuid not null references public.members(id),
  created_at  timestamptz not null default now(),
  check ((reverses_id is null and amount > 0) or (reverses_id is not null and amount < 0))
);

create sequence public.income_seq;
create table public.other_income (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique default 'I-' || lpad(nextval('public.income_seq')::text, 4, '0'),
  source      public.income_source not null,
  description text not null default '' check (length(description) <= 200),
  amount      int  not null check (amount <> 0),
  method      public.payment_method not null,
  date        date not null,
  reverses_id uuid unique references public.other_income(id),
  recorded_by uuid not null references public.members(id),
  created_at  timestamptz not null default now(),
  check ((reverses_id is null and amount > 0) or (reverses_id is not null and amount < 0))
);

create sequence public.handover_seq;
create table public.handovers (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique default 'H-' || lpad(nextval('public.handover_seq')::text, 4, '0'),
  from_member_id uuid not null references public.members(id),
  to_member_id   uuid not null references public.members(id),
  amount         int  not null check (amount > 0),
  recorded_at    timestamptz not null default now(),
  confirmed_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- 7. Audit log
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  actor_member_id uuid,
  actor_name      text not null default 'System',
  actor_position  text not null default '',
  action          text not null,
  table_name      text not null,
  row_id          text,
  summary         text not null,
  created_at      timestamptz not null default now()
);

-- True when the request comes from the app on someone's phone (not the server or SQL editor).
create or replace function private.from_app()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
$$;

-- True only inside the database's own sign-in functions below (setup codes, unlocking,
-- activation). Phones can't set this: it's switched on for one transaction by those functions.
create or replace function private.trusted()
returns boolean language sql stable as $$
  select coalesce(current_setting('his.trusted', true), '') = 'on'
$$;

-- ---------------------------------------------------------------------------
-- 8. Triggers: the rules
-- ---------------------------------------------------------------------------

-- Nothing in these tables can be changed or deleted once written.
create or replace function private.block_changes()
returns trigger language plpgsql as $$
begin
  raise exception '% rows cannot be changed or deleted. Add a correcting entry instead.', tg_table_name;
end $$;
create trigger payments_add_only    before update or delete on public.payments     for each row execute function private.block_changes();
create trigger adjustments_add_only before update or delete on public.adjustments  for each row execute function private.block_changes();
create trigger expenses_add_only    before update or delete on public.expenses     for each row execute function private.block_changes();
create trigger income_add_only      before update or delete on public.other_income for each row execute function private.block_changes();
create trigger audit_add_only       before update or delete on public.audit_logs   for each row execute function private.block_changes();
create trigger handovers_no_delete  before delete on public.handovers              for each row execute function private.block_changes();

-- Officer-recorded rows: the database fills in who and when. (A signed-in phone can't fake it;
-- the SQL editor and server can set recorded_by when importing old records.)
create or replace function private.stamp_recorder()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.from_app() then
    new.recorded_by := public.current_member_id();
    new.created_at := now();
  end if;
  if new.recorded_by is null then
    raise exception 'Must be recorded by a signed-in officer';
  end if;
  return new;
end $$;

create or replace function private.check_semester_open(p_semester uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select is_closed from public.semesters where id = p_semester) then
    raise exception 'This semester is closed.';
  end if;
end $$;

create or replace function private.prepare_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare orig public.payments;
begin
  perform private.check_semester_open(new.semester_id);
  if new.reverses_payment_id is not null then
    select * into orig from public.payments where id = new.reverses_payment_id;
    if not found then raise exception 'Payment not found.'; end if;
    if orig.reverses_payment_id is not null then raise exception 'A reversal can''t be reversed.'; end if;
    if new.amount <> -orig.amount or new.member_id <> orig.member_id or new.semester_id <> orig.semester_id then
      raise exception 'A reversal must cancel the original payment exactly.';
    end if;
    new.method := orig.method;
    new.momo_reference := orig.momo_reference;
  end if;
  return new;
end $$;
create trigger payments_stamp   before insert on public.payments for each row execute function private.stamp_recorder();
create trigger payments_prepare before insert on public.payments for each row execute function private.prepare_payment();

create or replace function private.prepare_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_semester_open(new.semester_id);
  return new;
end $$;
create trigger adjustments_stamp   before insert on public.adjustments for each row execute function private.stamp_recorder();
create trigger adjustments_prepare before insert on public.adjustments for each row execute function private.prepare_adjustment();

create or replace function private.prepare_reversible()
returns trigger language plpgsql security definer set search_path = '' as $$
declare orig_amount int; orig_rev uuid;
begin
  if new.reverses_id is not null then
    execute format('select amount, reverses_id from public.%I where id = $1', tg_table_name)
      into orig_amount, orig_rev using new.reverses_id;
    if orig_amount is null then raise exception 'Entry not found.'; end if;
    if orig_rev is not null then raise exception 'A reversal can''t be reversed.'; end if;
    if new.amount <> -orig_amount then raise exception 'A reversal must cancel the original exactly.'; end if;
  end if;
  return new;
end $$;
create trigger expenses_stamp   before insert on public.expenses     for each row execute function private.stamp_recorder();
create trigger expenses_prepare before insert on public.expenses     for each row execute function private.prepare_reversible();
create trigger income_stamp     before insert on public.other_income for each row execute function private.stamp_recorder();
create trigger income_prepare   before insert on public.other_income for each row execute function private.prepare_reversible();

-- Handovers: only the Financial Secretary hands over, only to the Treasurer,
-- and only the Treasurer can confirm receiving it. Nothing else can change.
create or replace function private.prepare_handover()
returns trigger language plpgsql security definer set search_path = '' as $$
declare from_pos text; to_pos text;
begin
  if tg_op = 'INSERT' then
    if private.from_app() then
      new.from_member_id := public.current_member_id();
    end if;
    new.recorded_at := now();
    new.confirmed_at := null;
    select position into from_pos from public.members where id = new.from_member_id;
    select position into to_pos   from public.members where id = new.to_member_id;
    if from_pos is distinct from 'Financial Secretary' then
      raise exception 'Only the Financial Secretary records handovers.';
    end if;
    if to_pos is distinct from 'Treasurer' then
      raise exception 'Cash is handed over to the Treasurer.';
    end if;
    return new;
  end if;
  -- UPDATE: confirming is the only change allowed.
  if old.confirmed_at is not null then raise exception 'Already confirmed.'; end if;
  if new.id <> old.id or new.ref <> old.ref or new.from_member_id <> old.from_member_id
     or new.to_member_id <> old.to_member_id or new.amount <> old.amount or new.recorded_at <> old.recorded_at then
    raise exception 'Handovers can''t be changed, only confirmed.';
  end if;
  if private.from_app() and public.current_member_id() is distinct from old.to_member_id then
    raise exception 'Only the person receiving the cash can confirm it.';
  end if;
  new.confirmed_at := now();
  return new;
end $$;
create trigger handovers_prepare before insert or update on public.handovers for each row execute function private.prepare_handover();

-- Members: new Member IDs are numbered automatically; roles and sign-in fields are protected.
create or replace function private.prepare_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_no int;
begin
  if tg_op = 'INSERT' then
    if new.member_code is null or new.member_code = '' then
      select coalesce(max(substring(member_code from 5)::int), 0) + 1 into next_no from public.members;
      new.member_code := 'HIS-' || lpad(next_no::text, 3, '0');
    end if;
    new.member_code := upper(new.member_code);
    if private.from_app() then
      new.role := 'member';
      new.position := null;
      new.auth_user_id := null;
      new.is_activated := false;
      new.is_locked := false;
    end if;
    return new;
  end if;
  if private.from_app() then
    if (new.role, new.position) is distinct from (old.role, old.position) then
      if not public.is_super_admin() then
        raise exception 'Only the Director can change roles.';
      end if;
      if old.id = public.current_member_id() and new.role <> 'super_admin' then
        raise exception 'You can''t remove your own Director role.';
      end if;
      if new.role <> 'member' and new.position is null then
        raise exception 'Choose their position.';
      end if;
    end if;
    if not private.trusted() and (new.auth_user_id is distinct from old.auth_user_id
       or new.member_code is distinct from old.member_code
       or new.is_activated is distinct from old.is_activated
       or new.is_locked is distinct from old.is_locked) then
      raise exception 'Sign-in details are managed by the server.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger members_prepare before insert or update on public.members for each row execute function private.prepare_member();
create trigger members_no_delete before delete on public.members for each row execute function private.block_changes();

-- Semester changes are blocked once a semester is closed.
create or replace function private.guard_closed_semester()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'semesters' then
    if old.is_closed then raise exception 'This semester is closed.'; end if;
    return new;
  end if;
  perform private.check_semester_open(coalesce(new.semester_id, old.semester_id));
  return coalesce(new, old);
end $$;
create trigger semesters_guard        before update on public.semesters for each row execute function private.guard_closed_semester();
create trigger weeks_guard            before insert or update or delete on public.semester_weeks for each row execute function private.guard_closed_semester();
create trigger rates_guard            before insert or update or delete on public.dues_rates for each row execute function private.guard_closed_semester();
create trigger member_semesters_guard before update on public.member_semesters for each row execute function private.guard_closed_semester();

-- Any officer may name a week (say "Interim Assessment") and switch its dues on or off.
-- Only the Director may change which weeks exist or their dates.
create or replace function private.guard_week_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.from_app() and not public.is_super_admin()
     and (new.semester_id, new.week_no, new.week_start) is distinct from (old.semester_id, old.week_no, old.week_start) then
    raise exception 'Only the Director can change week dates.';
  end if;
  return new;
end $$;
create trigger weeks_edit_guard before update on public.semester_weeks for each row execute function private.guard_week_edit();

-- ---------------------------------------------------------------------------
-- 9. Audit log writer (plain-English summaries)
-- ---------------------------------------------------------------------------
create or replace function private.cedi(p int)
returns text language sql immutable as $$
  select case when p < 0 then '−' else '' end || 'GH₵' ||
         case when abs(p) % 100 = 0 then (abs(p) / 100)::text
              else to_char(abs(p) / 100.0, 'FM999999990.00') end
$$;

create or replace function private.write_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  actor public.members;
  who text;
  s text;
begin
  select * into actor from public.members where id = public.current_member_id();
  if tg_table_name in ('payments', 'adjustments', 'member_semesters') then
    select full_name into who from public.members where id = (r ->> 'member_id')::uuid;
  end if;

  s := case tg_table_name
    when 'payments' then
      case when r ->> 'reverses_payment_id' is not null
        then format('reversed a payment for %s (%s, %s)', who, r ->> 'receipt_no', private.cedi((r ->> 'amount')::int))
        else format('recorded %s %s from %s (%s)', private.cedi((r ->> 'amount')::int),
                    case r ->> 'method' when 'momo' then 'MoMo' else 'cash' end, who, r ->> 'receipt_no') end
    when 'adjustments' then
      format('%s %s for %s: %s', case when (r ->> 'amount')::int < 0 then 'waived' else 'added' end,
             private.cedi(abs((r ->> 'amount')::int)), who, r ->> 'reason')
    when 'expenses' then
      case when r ->> 'reverses_id' is not null
        then format('reversed spending (%s, %s)', r ->> 'ref', r ->> 'description')
        else format('recorded spending of %s: %s (%s)', private.cedi((r ->> 'amount')::int), r ->> 'description', r ->> 'ref') end
    when 'other_income' then
      case when r ->> 'reverses_id' is not null
        then format('reversed income (%s)', r ->> 'ref')
        else format('recorded %s income of %s (%s)', replace(r ->> 'source', '_', ' '), private.cedi((r ->> 'amount')::int), r ->> 'ref') end
    when 'handovers' then
      case when tg_op = 'UPDATE'
        then format('confirmed receiving %s (%s)', private.cedi((r ->> 'amount')::int), r ->> 'ref')
        else format('handed over %s to the Treasurer (%s)', private.cedi((r ->> 'amount')::int), r ->> 'ref') end
    when 'members' then
      case
        when tg_op = 'INSERT' then format('added %s (%s)', r ->> 'full_name', r ->> 'member_code')
        when (r ->> 'role') is distinct from (o ->> 'role') or (r ->> 'position') is distinct from (o ->> 'position')
          then format('made %s %s', r ->> 'full_name', coalesce(r ->> 'position', 'a member (no officer role)'))
        when (r ->> 'is_active') = 'false' and (o ->> 'is_active') = 'true'
          then format('marked %s as left on %s', r ->> 'full_name', r ->> 'left_on')
        when (r ->> 'is_locked') = 'false' and (o ->> 'is_locked') = 'true'
          then format('unlocked %s', r ->> 'full_name')
        when (r ->> 'is_locked') = 'true' and (o ->> 'is_locked') = 'false'
          then format('%s was locked after too many wrong PINs', r ->> 'full_name')
        when (r ->> 'is_activated') is distinct from (o ->> 'is_activated')
          then format('%s %s', r ->> 'full_name', case when (r ->> 'is_activated') = 'true' then 'set up their PIN' else 'was given a new setup code' end)
        else format('updated details for %s', r ->> 'full_name') end
    when 'dues_rates' then
      format('set the %s rate to %s a week', r ->> 'category', private.cedi((r ->> 'weekly_amount')::int))
    when 'semester_weeks' then
      case
        when tg_op = 'INSERT' then format('added week %s (%s)', r ->> 'week_no', r ->> 'week_start')
        when (r ->> 'counts') = 'true' then format('made week %s count for dues', r ->> 'week_no')
        else format('made week %s free (%s)', r ->> 'week_no', coalesce(r ->> 'label', 'no dues')) end
    when 'semesters' then
      case
        when tg_op = 'INSERT' then format('created %s', r ->> 'name')
        when (r ->> 'is_closed') = 'true' then format('closed %s', r ->> 'name')
        else format('updated %s', r ->> 'name') end
    when 'member_semesters' then
      case when tg_op = 'INSERT' then format('added %s to the semester from week %s', who, r ->> 'start_week_no')
        else format('%s now pays from week %s', who, r ->> 'start_week_no') end
    else tg_op || ' ' || tg_table_name
  end;

  -- Skip noise: a member edit that only touched updated_at.
  if tg_table_name = 'members' and tg_op = 'UPDATE'
     and (r - 'updated_at') = (o - 'updated_at') then
    return null;
  end if;

  insert into public.audit_logs (actor_member_id, actor_name, actor_position, action, table_name, row_id, summary)
  values (actor.id, coalesce(actor.full_name, 'System'), coalesce(actor.position, ''), lower(tg_op), tg_table_name,
          coalesce(r ->> 'id', r ->> 'member_id'), s);
  return null;
end $$;

create trigger audit_payments         after insert on public.payments              for each row execute function private.write_audit();
create trigger audit_adjustments      after insert on public.adjustments           for each row execute function private.write_audit();
create trigger audit_expenses         after insert on public.expenses              for each row execute function private.write_audit();
create trigger audit_income           after insert on public.other_income          for each row execute function private.write_audit();
create trigger audit_handovers        after insert or update on public.handovers   for each row execute function private.write_audit();
create trigger audit_members          after insert or update on public.members     for each row execute function private.write_audit();
create trigger audit_rates            after insert or update on public.dues_rates  for each row execute function private.write_audit();
create trigger audit_weeks            after insert or update on public.semester_weeks for each row execute function private.write_audit();
create trigger audit_semesters        after insert or update on public.semesters   for each row execute function private.write_audit();
create trigger audit_member_semesters after insert or update on public.member_semesters for each row execute function private.write_audit();

-- ---------------------------------------------------------------------------
-- 10. PIN and setup-code functions
-- ---------------------------------------------------------------------------
create or replace function private.is_weak_pin(p text)
returns boolean language plpgsql immutable as $$
declare n int;
begin
  if p !~ '^[0-9]{4}$' then return true; end if;
  if p ~ '^(.)\1{3}$' then return true; end if;                                    -- 1111
  if p in ('0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210') then return true; end if;
  n := p::int;
  if n between 1950 and 2030 then return true; end if;                              -- years
  return false;
end $$;

-- Rate limit per device address: 20 tries every 15 minutes.
create or replace function private.ip_allowed(p_ip text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare recent int;
begin
  delete from private.ip_attempts where attempted_at < now() - interval '1 day';
  select count(*) into recent from private.ip_attempts
    where ip = coalesce(p_ip, '?') and attempted_at > now() - interval '15 minutes';
  if recent >= 20 then return false; end if;
  insert into private.ip_attempts (ip) values (coalesce(p_ip, '?'));
  return true;
end $$;

-- Counts a wrong PIN or code: 5 → 15-minute lock, 10 in total → locked until an officer unlocks.
create or replace function private.record_failure(p_member uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare s private.member_secrets;
begin
  update private.member_secrets
     set failed_attempts = failed_attempts + 1, total_failed = total_failed + 1, updated_at = now()
   where member_id = p_member returning * into s;
  if s.total_failed >= 10 then
    perform set_config('his.trusted', 'on', true);
    update public.members set is_locked = true where id = p_member;
    perform set_config('his.trusted', 'off', true);
    return 'Too many wrong tries. This account is now locked. Ask the Financial Secretary to unlock it.';
  end if;
  if s.failed_attempts >= 5 then
    update private.member_secrets set locked_until = now() + interval '15 minutes', failed_attempts = 0 where member_id = p_member;
    return 'Too many wrong tries. Wait 15 minutes, then try again.';
  end if;
  return format('That member ID or PIN isn''t right. %s tries left before a 15-minute wait.', 5 - s.failed_attempts);
end $$;

-- Called only by the pin-auth server function (service role).
create or replace function public.pin_login_check(p_code text, p_pin text, p_ip text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.members; s private.member_secrets;
begin
  if not private.ip_allowed(p_ip) then
    return jsonb_build_object('ok', false, 'error', 'Too many tries from this device. Wait 15 minutes.');
  end if;
  select * into m from public.members where member_code = upper(trim(p_code)) and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That member ID or PIN isn''t right.');
  end if;
  select * into s from private.member_secrets where member_id = m.id for update;
  if not found or s.pin_hash is null then
    return jsonb_build_object('ok', false, 'error', 'This account isn''t set up yet. Use "First time" with the setup code from the Financial Secretary.');
  end if;
  if m.is_locked then
    return jsonb_build_object('ok', false, 'error', 'This account is locked. Ask the Financial Secretary to unlock it.');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong tries. Wait 15 minutes, then try again.');
  end if;
  if s.pin_hash = extensions.crypt(coalesce(p_pin, ''), s.pin_hash) then
    update private.member_secrets set failed_attempts = 0, total_failed = 0, locked_until = null, updated_at = now()
     where member_id = m.id;
    return jsonb_build_object('ok', true, 'member_id', m.id);
  end if;
  return jsonb_build_object('ok', false, 'error', private.record_failure(m.id));
end $$;

-- Called only by the pin-auth server function (service role).
create or replace function public.activate_member(p_code text, p_setup text, p_pin text, p_ip text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.members; s private.member_secrets;
begin
  if not private.ip_allowed(p_ip) then
    return jsonb_build_object('ok', false, 'error', 'Too many tries from this device. Wait 15 minutes.');
  end if;
  select * into m from public.members where member_code = upper(trim(p_code)) and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That member ID or setup code isn''t right.');
  end if;
  select * into s from private.member_secrets where member_id = m.id for update;
  if not found or s.setup_code_hash is null then
    return jsonb_build_object('ok', false, 'error', 'There''s no setup code for this account. Ask the Financial Secretary for one.');
  end if;
  if m.is_locked then
    return jsonb_build_object('ok', false, 'error', 'This account is locked. Ask the Financial Secretary to unlock it.');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong tries. Wait 15 minutes, then try again.');
  end if;
  if s.setup_code_expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'This code has expired. Ask the Financial Secretary for a new one.');
  end if;
  if s.setup_code_hash <> extensions.crypt(coalesce(p_setup, ''), s.setup_code_hash) then
    return jsonb_build_object('ok', false, 'error', replace(private.record_failure(m.id), 'member ID or PIN', 'member ID or setup code'));
  end if;
  if private.is_weak_pin(p_pin) then
    return jsonb_build_object('ok', false, 'error', 'Choose a PIN that''s harder to guess.');
  end if;
  update private.member_secrets
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
         setup_code_hash = null, setup_code_expires_at = null,
         failed_attempts = 0, total_failed = 0, locked_until = null, updated_at = now()
   where member_id = m.id;
  perform set_config('his.trusted', 'on', true);
  update public.members set is_activated = true where id = m.id;
  perform set_config('his.trusted', 'off', true);
  return jsonb_build_object('ok', true, 'member_id', m.id);
end $$;

-- Called only by the pin-auth server function, to link a member to their sign-in account.
create or replace function public.link_member_auth(p_member uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('his.trusted', 'on', true);
  update public.members set auth_user_id = p_user where id = p_member and auth_user_id is null;
  perform set_config('his.trusted', 'off', true);
end $$;

-- Officers: a one-time 6-digit setup code (valid 72 hours). Issuing one resets the PIN.
create or replace function public.issue_setup_code(p_member uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare code text;
begin
  if not public.is_admin() then raise exception 'Only officers can do this.'; end if;
  if not exists (select 1 from public.members where id = p_member and is_active) then
    raise exception 'Member not found.';
  end if;
  code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into private.member_secrets (member_id) values (p_member) on conflict (member_id) do nothing;
  update private.member_secrets
     set setup_code_hash = extensions.crypt(code, extensions.gen_salt('bf', 10)),
         setup_code_expires_at = now() + interval '72 hours',
         pin_hash = null, failed_attempts = 0, total_failed = 0, locked_until = null, updated_at = now()
   where member_id = p_member;
  perform set_config('his.trusted', 'on', true);
  update public.members set is_activated = false, is_locked = false where id = p_member;
  perform set_config('his.trusted', 'off', true);
  return code;
end $$;

create or replace function public.unlock_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only officers can do this.'; end if;
  update private.member_secrets set failed_attempts = 0, total_failed = 0, locked_until = null, updated_at = now()
   where member_id = p_member;
  perform set_config('his.trusted', 'on', true);
  update public.members set is_locked = false where id = p_member;
  perform set_config('his.trusted', 'off', true);
end $$;

-- A signed-in member changes their own PIN.
create or replace function public.change_pin(p_current text, p_new text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.current_member_id(); s private.member_secrets;
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into s from private.member_secrets where member_id = me for update;
  if not found or s.pin_hash is null or s.pin_hash <> extensions.crypt(coalesce(p_current, ''), s.pin_hash) then
    raise exception 'Your current PIN isn''t right.';
  end if;
  if private.is_weak_pin(p_new) then raise exception 'Choose a PIN that''s harder to guess.'; end if;
  update private.member_secrets set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), updated_at = now()
   where member_id = me;
end $$;

-- Officer names for receipts and the handover screen. Members can read this short list.
create or replace function public.list_officers()
returns table (id uuid, member_code text, full_name text, role public.app_role, "position" text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.member_code, m.full_name, m.role, m.position
    from public.members m
   where m.role <> 'member' and m.is_active and auth.uid() is not null
   order by m.role desc, m.full_name
$$;

-- ---------------------------------------------------------------------------
-- 11. Row-level security: who can see and change what
-- ---------------------------------------------------------------------------
alter table public.members          enable row level security;
alter table public.semesters        enable row level security;
alter table public.semester_weeks   enable row level security;
alter table public.dues_rates       enable row level security;
alter table public.member_semesters enable row level security;
alter table public.adjustments      enable row level security;
alter table public.payments         enable row level security;
alter table public.expenses         enable row level security;
alter table public.other_income     enable row level security;
alter table public.handovers        enable row level security;
alter table public.audit_logs       enable row level security;
alter table private.member_secrets  enable row level security;
alter table private.ip_attempts     enable row level security;

create policy members_read   on public.members for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
create policy members_insert on public.members for insert to authenticated with check (public.is_admin());
create policy members_update on public.members for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy semesters_read   on public.semesters      for select to authenticated using (true);
create policy semesters_write  on public.semesters      for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy weeks_read       on public.semester_weeks for select to authenticated using (true);
create policy weeks_write      on public.semester_weeks for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy weeks_officer    on public.semester_weeks for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy rates_read       on public.dues_rates     for select to authenticated using (true);
create policy rates_write      on public.dues_rates     for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy ms_read   on public.member_semesters for select to authenticated using (member_id = public.current_member_id() or public.is_admin());
create policy ms_insert on public.member_semesters for insert to authenticated with check (public.is_admin());
create policy ms_update on public.member_semesters for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy adj_read   on public.adjustments for select to authenticated using (member_id = public.current_member_id() or public.is_admin());
create policy adj_insert on public.adjustments for insert to authenticated with check (public.is_admin());
create policy pay_read   on public.payments    for select to authenticated using (member_id = public.current_member_id() or public.is_admin());
create policy pay_insert on public.payments    for insert to authenticated with check (public.is_admin());

create policy exp_read   on public.expenses     for select to authenticated using (public.is_admin());
create policy exp_insert on public.expenses     for insert to authenticated with check (public.is_admin());
create policy inc_read   on public.other_income for select to authenticated using (public.is_admin());
create policy inc_insert on public.other_income for insert to authenticated with check (public.is_admin());
create policy ho_read    on public.handovers    for select to authenticated using (public.is_admin());
create policy ho_insert  on public.handovers    for insert to authenticated with check (public.is_admin());
create policy ho_update  on public.handovers    for update to authenticated using (public.is_admin() and to_member_id = public.current_member_id()) with check (public.is_admin());

create policy audit_read on public.audit_logs for select to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 12. Grants (the project doesn't grant anything automatically)
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from public, anon;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.members, public.semesters, public.semester_weeks, public.dues_rates,
  public.member_semesters, public.handovers to authenticated;
grant select, insert on public.adjustments, public.payments, public.expenses, public.other_income to authenticated;
grant select on public.audit_logs to authenticated;
grant delete on public.semester_weeks to authenticated;
grant usage, select on public.receipt_seq, public.expense_seq, public.income_seq, public.handover_seq to authenticated;

grant execute on function public.current_member_id(), public.is_admin(), public.is_super_admin(),
  public.issue_setup_code(uuid), public.unlock_member(uuid), public.change_pin(text, text),
  public.list_officers() to authenticated;

-- The server function (service role) needs these; phones never call them.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.pin_login_check(text, text, text), public.activate_member(text, text, text, text),
  public.link_member_auth(uuid, uuid), public.current_member_id(), public.is_admin(), public.is_super_admin()
  to service_role;

-- ---------------------------------------------------------------------------
-- 13. Indexes
-- ---------------------------------------------------------------------------
create index on public.payments (member_id, semester_id);
create index on public.payments (paid_on);
create index on public.payments (recorded_by);
create index on public.adjustments (member_id, semester_id);
create index on public.member_semesters (semester_id);
create index on public.expenses (date);
create index on public.other_income (date);
create index on public.audit_logs (table_name, created_at desc);
