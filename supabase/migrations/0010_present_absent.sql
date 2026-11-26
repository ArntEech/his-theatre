-- His Theatre: attendance is Present, Absent, or Absent with excuse ("excused"). No "Late".
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
    if not exists (select 1 from public.members where id = mid and is_active) then continue; end if;
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
