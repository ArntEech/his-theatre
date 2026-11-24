-- His Theatre: officers use a 6-digit PIN instead of an authenticator app.
--
--   * Members choose a 4-digit PIN. Officers (Director, Financial Secretary, Treasurer and
--     anyone the Director makes an officer) choose a 6-digit PIN.
--   * Officer powers work only once that officer's PIN is 6 digits. Someone just made an
--     officer keeps their 4-digit PIN for the member view, and sets a 6-digit PIN to unlock
--     the officer screens.
--   * Setup codes for officers can only be issued by the Director (an officer can no longer
--     reset another officer's PIN and take over their account).
--   * Officers may start a semester and change its name and dates (the weeks follow).
--     Rates and closing a semester stay with the Director.

-- 1. Remember how long each PIN is (the PIN itself is only ever stored as a hash).
alter table private.member_secrets add column if not exists pin_digits smallint;
update private.member_secrets set pin_digits = 4 where pin_hash is not null and pin_digits is null;

-- 2. Officer checks: role + active + a 6-digit PIN. No authenticator needed.
create or replace function private.has_officer_pin(p_member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.member_secrets where member_id = p_member and pin_hash is not null and pin_digits = 6)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.auth_user_id = auth.uid() and m.is_active and m.role in ('admin', 'super_admin')
      and private.has_officer_pin(m.id)
  )
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.auth_user_id = auth.uid() and m.is_active and m.role = 'super_admin'
      and private.has_officer_pin(m.id)
  )
$$;

-- 3. PIN rules: 4 digits for members, 6 for officers, nothing easy to guess.
create or replace function private.pin_digits_for(p_member uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when role in ('admin', 'super_admin') then 6 else 4 end from public.members where id = p_member
$$;

create or replace function private.pin_problem(p text, p_digits int)
returns text language plpgsql immutable set search_path = '' as $$
declare n int;
begin
  if p_digits = 6 then
    if p !~ '^[0-9]{6}$' then return 'Officers choose a 6-digit PIN.'; end if;
    if p ~ '^(.)\1{5}$' then return 'Choose a PIN that''s harder to guess.'; end if;              -- 111111
    if p in ('012345','123456','234567','345678','456789','987654','876543','765432','654321','543210') then
      return 'Choose a PIN that''s harder to guess.';
    end if;
    if p ~ '^(..)\1\1$' or p ~ '^(...)\1$' then return 'Choose a PIN that''s harder to guess.'; end if;  -- 121212, 123123
    return null;
  end if;
  if p !~ '^[0-9]{4}$' then return 'Choose a 4-digit PIN.'; end if;
  if p ~ '^(.)\1{3}$' then return 'Choose a PIN that''s harder to guess.'; end if;
  if p in ('0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210') then
    return 'Choose a PIN that''s harder to guess.';
  end if;
  n := p::int;
  if n between 1950 and 2030 then return 'Choose a PIN that''s harder to guess.'; end if;
  return null;
end $$;

-- 4. First sign-in with a setup code: officers must choose 6 digits.
create or replace function public.activate_member(p_code text, p_setup text, p_pin text, p_ip text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.members; s private.member_secrets; digits int; problem text;
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
    return jsonb_build_object('ok', false, 'error', 'There''s no setup code for this account. Ask an officer for one.');
  end if;
  if m.is_locked then
    return jsonb_build_object('ok', false, 'error', 'This account is locked. Ask an officer to unlock it.');
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong tries. Wait 15 minutes, then try again.');
  end if;
  if s.setup_code_expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'This code has expired. Ask an officer for a new one.');
  end if;
  if s.setup_code_hash <> extensions.crypt(coalesce(p_setup, ''), s.setup_code_hash) then
    return jsonb_build_object('ok', false, 'error', replace(private.record_failure(m.id), 'member ID or PIN', 'member ID or setup code'));
  end if;
  digits := private.pin_digits_for(m.id);
  problem := private.pin_problem(coalesce(p_pin, ''), digits);
  if problem is not null then
    return jsonb_build_object('ok', false, 'error', problem, 'pin_digits', digits);
  end if;
  update private.member_secrets
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), pin_digits = digits,
         setup_code_hash = null, setup_code_expires_at = null,
         failed_attempts = 0, total_failed = 0, locked_until = null, updated_at = now()
   where member_id = m.id;
  perform set_config('his.trusted', 'on', true);
  update public.members set is_activated = true where id = m.id;
  perform set_config('his.trusted', 'off', true);
  return jsonb_build_object('ok', true, 'member_id', m.id);
end $$;

-- 5. Changing your PIN. Officers (and anyone just made an officer) choose 6 digits.
create or replace function public.change_pin(p_current text, p_new text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.current_member_id(); s private.member_secrets; digits int; problem text;
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into s from private.member_secrets where member_id = me for update;
  if not found or s.pin_hash is null or s.pin_hash <> extensions.crypt(coalesce(p_current, ''), s.pin_hash) then
    if found and s.pin_hash is not null then perform private.record_failure(me); end if;
    raise exception 'Your current PIN isn''t right.';
  end if;
  digits := private.pin_digits_for(me);
  problem := private.pin_problem(coalesce(p_new, ''), digits);
  if problem is not null then raise exception '%', problem; end if;
  update private.member_secrets
     set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), pin_digits = digits,
         failed_attempts = 0, updated_at = now()
   where member_id = me;
end $$;

-- 6. What the app needs to know about my own PIN (never the PIN itself).
create or replace function public.my_pin_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pin_digits', s.pin_digits,
    'needs_officer_pin', m.role in ('admin', 'super_admin') and coalesce(s.pin_digits, 0) <> 6
  )
  from public.members m left join private.member_secrets s on s.member_id = m.id
  where m.auth_user_id = auth.uid() and m.is_active
$$;
revoke all on function public.my_pin_status() from public, anon;
grant execute on function public.my_pin_status() to authenticated;

-- 7. Setup codes. Any officer can issue them for members; only the Director for officers.
create or replace function public.issue_setup_code(p_member uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare code text; target public.members;
begin
  if not public.is_admin() then raise exception 'Only officers can do this.'; end if;
  select * into target from public.members where id = p_member and is_active;
  if not found then raise exception 'Member not found.'; end if;
  if target.role in ('admin', 'super_admin') and not public.is_super_admin() then
    raise exception 'Only the Director can give an officer a setup code.';
  end if;
  if target.id = public.current_member_id() then
    raise exception 'Change your own PIN in Settings instead.';
  end if;
  code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into private.member_secrets (member_id) values (p_member) on conflict (member_id) do nothing;
  update private.member_secrets
     set setup_code_hash = extensions.crypt(code, extensions.gen_salt('bf', 10)),
         setup_code_expires_at = now() + interval '7 days',
         pin_hash = null, pin_digits = null, failed_attempts = 0, total_failed = 0, locked_until = null, updated_at = now()
   where member_id = p_member;
  perform set_config('his.trusted', 'on', true);
  update public.members set is_activated = false, is_locked = false where id = p_member;
  perform set_config('his.trusted', 'off', true);
  return code;
end $$;

-- 8. Officers may start a semester, rename it and move its dates (its weeks follow).
--    Rates and closing a semester stay with the Director.
drop policy if exists semesters_officer on public.semesters;
create policy semesters_officer on public.semesters for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function private.guard_semester_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.from_app() and not public.is_super_admin() and not private.trusted() then
    if new.is_closed is distinct from old.is_closed then
      raise exception 'Only the Director can close a semester.';
    end if;
    if (to_jsonb(new) - array['name', 'starts_on', 'ends_on', 'updated_at'])
       is distinct from (to_jsonb(old) - array['name', 'starts_on', 'ends_on', 'updated_at']) then
      raise exception 'Officers can change the semester''s name and dates only.';
    end if;
  end if;
  if new.ends_on < new.starts_on then raise exception 'The end date must be after the start date.'; end if;
  return new;
end $$;
drop trigger if exists semesters_edit_guard on public.semesters;
create trigger semesters_edit_guard before update on public.semesters for each row execute function private.guard_semester_edit();

-- Week dates move only through save_semester below (or the Director).
create or replace function private.guard_week_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.from_app() and not public.is_super_admin() and not private.trusted()
     and (new.semester_id, new.week_no, new.week_start) is distinct from (old.semester_id, old.week_no, old.week_start) then
    raise exception 'Only the Director can change week dates.';
  end if;
  return new;
end $$;

-- Start a semester, or change one's name and dates. One week per Monday from the week of the
-- start date to the end date; weeks outside the new dates are removed, new ones added.
-- A new semester copies the last semester's rates and puts every active member on its roll.
create or replace function public.save_semester(p_id uuid, p_name text, p_starts date, p_ends date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sem public.semesters; sid uuid; mondays date[]; prev uuid; w record; i int;
begin
  if not public.is_admin() then raise exception 'Only officers can do this.'; end if;
  p_name := trim(coalesce(p_name, ''));
  if length(p_name) < 2 or length(p_name) > 60 then raise exception 'Give the semester a name.'; end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then
    raise exception 'The semester must end after it starts.';
  end if;
  select array_agg(d::date order by d) into mondays
    from generate_series(date_trunc('week', p_starts)::date, p_ends, interval '7 days') d;
  if array_length(mondays, 1) > 30 then raise exception 'A semester cannot be longer than 30 weeks.'; end if;
  perform set_config('his.trusted', 'on', true);
  if p_id is null then
    select id into prev from public.semesters order by starts_on desc limit 1;
    insert into public.semesters (name, starts_on, ends_on) values (p_name, p_starts, p_ends) returning id into sid;
    insert into public.semester_weeks (semester_id, week_no, week_start)
      select sid, n, mondays[n] from generate_series(1, array_length(mondays, 1)) n;
    insert into public.dues_rates (semester_id, category, weekly_amount)
      select sid, c, coalesce((select weekly_amount from public.dues_rates where semester_id = prev and category = c),
                              case when c = 'executive' then 1000 else 500 end)
        from unnest(array['executive', 'member']::public.member_category[]) c;
    insert into public.member_semesters (member_id, semester_id, category, start_week_no)
      select id, sid, category, 1 from public.members where is_active;
  else
    select * into sem from public.semesters where id = p_id for update;
    if not found then raise exception 'That semester could not be found.'; end if;
    if sem.is_closed then raise exception 'A closed semester cannot be changed.'; end if;
    sid := sem.id;
    update public.semesters set name = p_name, starts_on = p_starts, ends_on = p_ends where id = sid;
    delete from public.semester_weeks where semester_id = sid and not (week_start = any(mondays));
    update public.semester_weeks set week_no = week_no + 1000 where semester_id = sid;
    for w in select id, week_start from public.semester_weeks where semester_id = sid loop
      update public.semester_weeks set week_no = array_position(mondays, w.week_start) where id = w.id;
    end loop;
    for i in 1 .. array_length(mondays, 1) loop
      insert into public.semester_weeks (semester_id, week_no, week_start)
        values (sid, i, mondays[i]) on conflict (semester_id, week_start) do nothing;
    end loop;
  end if;
  perform set_config('his.trusted', 'off', true);
  return sid;
end $$;
revoke all on function public.save_semester(uuid, text, date, date) from public, anon;
grant execute on function public.save_semester(uuid, text, date, date) to authenticated;

revoke all on function private.has_officer_pin(uuid), private.pin_digits_for(uuid), private.pin_problem(text, int),
  private.guard_semester_edit() from public, anon, authenticated;
