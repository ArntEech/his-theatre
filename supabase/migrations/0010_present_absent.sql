-- His Theatre: attendance works like dues.
--   * Marks are Present, Absent, or Absent with excuse ("excused"). No "Late".
--   * Each member is on the roll only from the week their dues start (like dues).
--   * Grace period after each rehearsal: drive heads 3 days, officers 7 days, the Director
--     until the semester closes. Rehearsals before the app's launch can be filled in by
--     drive heads and officers until the catch-up date (6 Dec 2026).
--   * The evening of a rehearsal, drive heads and officers who haven't taken attendance get
--     a reminder with their deadline.
-- Run once, after 0009_push_keys.sql.

alter table public.attendance drop constraint if exists attendance_no_late;
alter table public.attendance add constraint attendance_no_late check (status <> 'late');

-- Save ticks for one rehearsal. p_marks: [{"member_id": "...", "status": "present" | "absent" |
-- "excused" | null}]; null clears a tick. Safe to send twice (offline replays).
create or replace function public.mark_attendance(p_rehearsal uuid, p_marks jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.rehearsals; problem text; m jsonb; mid uuid; st text; changed int := 0;
  me uuid := public.current_member_id(); totals jsonb;
begin
  select * into r from public.rehearsals where id = p_rehearsal;
  if not found then raise exception 'Rehearsal not found.'; end if;
  problem := private.mark_problem(r);
  if problem is not null then raise exception '%', problem; end if;
  if jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) > 500 then raise exception 'Nothing to save.'; end if;

  for m in select * from jsonb_array_elements(p_marks) loop
    mid := (m ->> 'member_id')::uuid;
    st := m ->> 'status';
    if not private.on_roll(mid, r) and not exists (select 1 from public.attendance where rehearsal_id = r.id and member_id = mid) then
      continue;
    end if;
    if st is null then
      delete from public.attendance where rehearsal_id = r.id and member_id = mid;
      if found then changed := changed + 1; end if;
    elsif st in ('present', 'absent', 'excused') then
      insert into public.attendance (rehearsal_id, member_id, status, marked_by)
      values (r.id, mid, st::public.attendance_status, me)
      on conflict (rehearsal_id, member_id) do update
        set status = excluded.status, marked_by = excluded.marked_by, marked_at = now()
        where public.attendance.status is distinct from excluded.status;
      if found then changed := changed + 1; end if;
    else
      raise exception 'Unknown attendance mark.';
    end if;
  end loop;

  select jsonb_build_object(
    'present', count(*) filter (where status = 'present'),
    'absent', count(*) filter (where status = 'absent'),
    'excused', count(*) filter (where status = 'excused'))
  into totals from public.attendance where rehearsal_id = r.id;
  update public.rehearsals set roll_taken = exists (select 1 from public.attendance where rehearsal_id = r.id)
  where id = r.id;

  if changed > 0 then
    perform private.log_action('attendance', r.id::text,
      format('took attendance for %s%s: %s present, %s absent, %s absent with excuse',
             private.day_label(r.held_on), coalesce(' (' || r.drive || ')', ''),
             totals ->> 'present', totals ->> 'absent', totals ->> 'excused'));
  end if;
  return totals || jsonb_build_object('changed', changed);
end $$;

insert into private.settings values
  ('attendance_head_days', '3'), ('attendance_officer_days', '7'),
  ('attendance_catchup_before', '2026-11-26'), ('attendance_catchup_until', '2026-12-06')
on conflict (key) do nothing;

-- The rules the app shows: grace days and the one-off catch-up.
create or replace function public.attendance_rules()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(key, value) from private.settings where key like 'attendance_%'
$$;

-- Last day this person may mark this rehearsal (null: until the semester closes).
create or replace function private.mark_deadline(r public.rehearsals)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  head_days int := coalesce((select value::int from private.settings where key = 'attendance_head_days'), 3);
  officer_days int := coalesce((select value::int from private.settings where key = 'attendance_officer_days'), 7);
  before date := (select value::date from private.settings where key = 'attendance_catchup_before');
  until date := (select value::date from private.settings where key = 'attendance_catchup_until');
  d date;
begin
  if public.is_super_admin() then return null; end if;
  d := r.held_on + case when public.is_admin() then officer_days else head_days end;
  if before is not null and r.held_on < before then d := greatest(d, until); end if;
  return d;
end $$;

create or replace function private.mark_problem(r public.rehearsals)
returns text language plpgsql stable security definer set search_path = '' as $$
declare d date;
begin
  if (select is_closed from public.semesters where id = r.semester_id) then return 'This semester is closed.'; end if;
  if r.is_cancelled then return 'This rehearsal was cancelled.'; end if;
  if r.held_on > private.today() then return 'You can take attendance on the day of the rehearsal.'; end if;
  if not public.can_take_attendance() then return 'Only officers and drive heads take attendance.'; end if;
  d := private.mark_deadline(r);
  if d is not null and private.today() > d then
    return format('Attendance for %s closed on %s. Ask %s to change it.', private.day_label(r.held_on), private.day_label(d),
                  case when public.is_admin() then 'the Director' else 'an officer' end);
  end if;
  return null;
end $$;

-- On the roll for a rehearsal: members whose dues had started by that week, who hadn't left.
create or replace function private.on_roll(p_member uuid, r public.rehearsals)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member_semesters ms
    join public.members m on m.id = ms.member_id
    left join public.semester_weeks w on w.semester_id = ms.semester_id and w.week_no = ms.start_week_no
    where ms.member_id = p_member and ms.semester_id = r.semester_id
      and m.is_active and (m.left_on is null or m.left_on >= r.held_on)
      and (w.week_start is null or r.held_on >= w.week_start))
$$;

create or replace function public.roll_call(p_rehearsal uuid)
returns table (member_id uuid, member_code text, full_name text, drives text[], status public.attendance_status,
               marked_by_name text, marked_at timestamptz, excuse_reason text, excuse_status text)
language plpgsql stable security definer set search_path = '' as $$
declare r public.rehearsals;
begin
  if not public.can_take_attendance() then raise exception 'Only officers and drive heads take attendance.'; end if;
  select * into r from public.rehearsals where id = p_rehearsal;
  if not found then raise exception 'Rehearsal not found.'; end if;
  return query
    select m.id, m.member_code, m.full_name, private.member_drives(m.id), a.status, mb.full_name, a.marked_at,
           e.reason, e.status
    from public.members m
    join public.member_semesters ms on ms.member_id = m.id and ms.semester_id = r.semester_id
    left join public.attendance a on a.rehearsal_id = r.id and a.member_id = m.id
    left join public.members mb on mb.id = a.marked_by
    left join public.excuse_requests e on e.rehearsal_id = r.id and e.member_id = m.id
    where private.on_roll(m.id, r) or a.status is not null
    order by m.full_name;
end $$;

-- Evening reminder: drive heads and officers who haven't taken attendance for today's rehearsal.
create or replace function private.attendance_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.rehearsals; h record; t date := private.today();
  head_days int := coalesce((select value::int from private.settings where key = 'attendance_head_days'), 3);
begin
  for r in select * from public.rehearsals where held_on = t and not is_cancelled loop
    if (select is_closed from public.semesters where id = r.semester_id) then continue; end if;
    -- Each drive head whose drive has nobody marked yet.
    for h in
      select dh.member_id, dh.drive from public.drive_heads dh join public.members m on m.id = dh.member_id
      where m.is_active and (r.drive is null or r.drive = dh.drive)
        and not exists (select 1 from public.attendance a where a.rehearsal_id = r.id
                        and dh.drive = any (private.member_drives(a.member_id)))
    loop
      perform private.notify(array[h.member_id], 'attendance', 'Attendance not taken',
        format('You haven''t taken attendance for %s (%s). You have until %s.', private.day_label(t), h.drive,
               private.day_label(t + head_days)),
        '/attendance/take');
    end loop;
  end loop;
end $$;

do $$
begin
  perform cron.schedule('his-attendance-reminders', '3 21 * * *', 'select private.attendance_reminders()');
exception when others then raise notice 'pg_cron not available here; schedule not set.';
end $$;

revoke all on function private.on_roll(uuid, public.rehearsals), private.mark_deadline(public.rehearsals),
  private.attendance_reminders() from public, anon, authenticated;
revoke all on function public.attendance_rules() from public, anon;
grant execute on function public.attendance_rules() to authenticated;
