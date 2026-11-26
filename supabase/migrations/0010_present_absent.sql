-- His Theatre: attendance works like dues.
--   * Marks are Present, Absent, or Absent with excuse ("excused"). No "Late".
--   * Officers and drive heads can mark any rehearsal from the start of the semester up to
--     today, while the semester is open (like recording dues for past weeks).
--   * Each member is on the roll only from the week their dues start.
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

create or replace function private.mark_problem(r public.rehearsals)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if (select is_closed from public.semesters where id = r.semester_id) then return 'This semester is closed.'; end if;
  if r.is_cancelled then return 'This rehearsal was cancelled.'; end if;
  if r.held_on > private.today() then return 'You can take attendance on the day of the rehearsal.'; end if;
  if public.can_take_attendance() then return null; end if;
  return 'Only officers and drive heads take attendance.';
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

revoke all on function private.on_roll(uuid, public.rehearsals) from public, anon, authenticated;
