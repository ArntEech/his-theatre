-- His Theatre: attendance, drive heads, News (announcements) and birthday posts.
-- Run once, after 0006_member_photos.sql.
--
--   * Drive heads: the Director names a head for each drive. A drive head can take attendance
--     and post News to their own drive. It gives no money powers and no access to member details.
--   * Rehearsals: every Tuesday and Thursday of a semester's dues weeks is set up by itself.
--     Officers add one-off rehearsals (for everyone or one drive) and cancel or restore them.
--     Drive heads may add and cancel one-off rehearsals for their own drive.
--   * Attendance: one record per member per rehearsal (Present, Late, Excused, Absent), however
--     many drives they're in. Drive heads mark on the day; officers until the end of that week;
--     the Director any time while the semester is open. Every save goes to the audit log.
--   * Excuses: a member can ask to be excused before a rehearsal; an officer or drive head decides.
--   * News: officers post to everyone or one drive; drive heads to their own drive. Members can't
--     post. Everyone who can see a post can like it, comment (one level of replies) and share it.
--     The author can edit, delete or turn off comments. Officers pin (3 at most) and remove
--     comments; the Director can remove any post.
--   * Birthdays: on a member's birthday the app posts a greeting from His Theatre (one post for
--     everyone who shares the day). Members can opt out in Settings.
--   * Who can see what: a member sees posts for everyone and for their own drives, their own
--     attendance only, and other members' names only where they post, comment or like.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
create or replace function private.today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Africa/Accra')::date
$$;

-- The drives a member belongs to: their main drive plus the drives they listed as interests.
create or replace function private.member_drives(p_member uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct d order by d), '{}')
  from (
    select trim(m.drive) as d from public.members m where m.id = p_member
    union all
    select trim(x) from public.members m, unnest(string_to_array(m.drive_interests, ',')) as x where m.id = p_member
  ) s
  where d <> ''
$$;

create or replace function private.log_action(p_table text, p_row text, p_summary text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.members;
begin
  select * into actor from public.members where id = public.current_member_id();
  insert into public.audit_logs (actor_member_id, actor_name, actor_position, action, table_name, row_id, summary)
  values (actor.id, coalesce(actor.full_name, 'System'), coalesce(actor.position, ''), 'insert', p_table, p_row, p_summary);
end $$;

create or replace function private.day_label(d date)
returns text language sql immutable set search_path = '' as $$
  select to_char(d, 'Dy FMDD Mon')
$$;

-- ---------------------------------------------------------------------------
-- 2. Drive heads
-- ---------------------------------------------------------------------------
create table if not exists public.drive_heads (
  member_id   uuid not null references public.members (id) on delete cascade,
  drive       text not null check (length(trim(drive)) between 1 and 60),
  assigned_by uuid references public.members (id),
  assigned_at timestamptz not null default now(),
  primary key (member_id, drive)
);

create or replace function public.my_led_drives()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(h.drive order by h.drive), '{}')
  from public.drive_heads h join public.members m on m.id = h.member_id
  where m.auth_user_id = auth.uid() and m.is_active
$$;

create or replace function public.can_take_attendance()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or cardinality(public.my_led_drives()) > 0
$$;

create or replace function public.my_drives()
returns text[] language sql stable security definer set search_path = '' as $$
  select private.member_drives(public.current_member_id())
$$;

-- Everyone may see who leads which drive (shown on posts and the roll call).
create or replace function public.list_drive_heads()
returns table (member_id uuid, full_name text, drive text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.full_name, h.drive
  from public.drive_heads h join public.members m on m.id = h.member_id
  where m.is_active and public.current_member_id() is not null
  order by h.drive, m.full_name
$$;

create or replace function public.set_drive_head(p_member uuid, p_drive text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare who public.members; d text := trim(coalesce(p_drive, ''));
begin
  if not public.is_super_admin() then raise exception 'Only the Director can choose drive heads.'; end if;
  select * into who from public.members where id = p_member and is_active;
  if not found then raise exception 'Member not found.'; end if;
  if d = '' or length(d) > 60 then raise exception 'Choose a drive.'; end if;
  if p_on then
    insert into public.drive_heads (member_id, drive, assigned_by) values (p_member, d, public.current_member_id())
    on conflict do nothing;
    perform private.log_action('drive_heads', p_member::text, format('made %s head of %s', who.full_name, d));
  else
    delete from public.drive_heads where member_id = p_member and drive = d;
    perform private.log_action('drive_heads', p_member::text, format('removed %s as head of %s', who.full_name, d));
  end if;
end $$;

alter table public.drive_heads enable row level security;
drop policy if exists drive_heads_read on public.drive_heads;
create policy drive_heads_read on public.drive_heads for select to authenticated using (public.current_member_id() is not null);

-- ---------------------------------------------------------------------------
-- 3. Rehearsals
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.attendance_status as enum ('present', 'late', 'excused', 'absent');
exception when duplicate_object then null; end $$;

create table if not exists public.rehearsals (
  id            uuid primary key default gen_random_uuid(),
  semester_id   uuid not null references public.semesters (id) on delete cascade,
  held_on       date not null,
  kind          text not null default 'regular' check (kind in ('regular', 'extra')),
  drive         text check (drive is null or length(trim(drive)) between 1 and 60),
  title         text not null default '' check (length(title) <= 60),
  starts_at     time,
  is_cancelled  boolean not null default false,
  cancel_reason text check (length(cancel_reason) <= 200),
  roll_taken    boolean not null default false,   -- someone has taken attendance for it
  created_by    uuid references public.members (id),
  created_at    timestamptz not null default now()
);
create unique index if not exists rehearsals_one_regular_a_day on public.rehearsals (semester_id, held_on) where kind = 'regular';
create index if not exists rehearsals_by_day on public.rehearsals (held_on);

create table if not exists public.attendance (
  rehearsal_id uuid not null references public.rehearsals (id) on delete cascade,
  member_id    uuid not null references public.members (id),
  status       public.attendance_status not null,
  marked_by    uuid not null references public.members (id),
  marked_at    timestamptz not null default now(),
  primary key (rehearsal_id, member_id)
);
create index if not exists attendance_by_member on public.attendance (member_id);

create table if not exists public.excuse_requests (
  rehearsal_id uuid not null references public.rehearsals (id) on delete cascade,
  member_id    uuid not null references public.members (id),
  reason       text not null check (length(trim(reason)) between 3 and 200),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by   uuid references public.members (id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  primary key (rehearsal_id, member_id)
);

-- Every Tuesday and Thursday in the semester's dues weeks. Weeks marked "No dues" have no
-- rehearsal. Days that no longer fit (dates or weeks changed) are removed unless attendance
-- was already taken on them.
create or replace function private.sync_rehearsals(p_semester uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.semesters;
begin
  select * into s from public.semesters where id = p_semester;
  if not found or s.is_closed then return; end if;
  insert into public.rehearsals (semester_id, held_on, kind)
  select s.id, d::date, 'regular'
  from generate_series(s.starts_on, s.ends_on, interval '1 day') as d
  where extract(isodow from d) in (2, 4)
    and exists (select 1 from public.semester_weeks w
                where w.semester_id = s.id and w.counts and d::date between w.week_start and w.week_start + 6)
  on conflict (semester_id, held_on) where kind = 'regular' do nothing;

  delete from public.rehearsals r
  where r.semester_id = s.id and r.kind = 'regular'
    and not exists (select 1 from public.attendance a where a.rehearsal_id = r.id)
    and not (r.held_on between s.starts_on and s.ends_on and extract(isodow from r.held_on) in (2, 4)
             and exists (select 1 from public.semester_weeks w
                         where w.semester_id = s.id and w.counts and r.held_on between w.week_start and w.week_start + 6));
end $$;

create or replace function private.sync_rehearsals_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'semesters' then
    perform private.sync_rehearsals(new.id);
  elsif tg_op = 'DELETE' then
    perform private.sync_rehearsals(old.semester_id);
  else
    perform private.sync_rehearsals(new.semester_id);
  end if;
  return null;
end $$;
drop trigger if exists semesters_rehearsals on public.semesters;
create trigger semesters_rehearsals after insert or update on public.semesters
  for each row execute function private.sync_rehearsals_trigger();
drop trigger if exists weeks_rehearsals on public.semester_weeks;
create trigger weeks_rehearsals after insert or update or delete on public.semester_weeks
  for each row execute function private.sync_rehearsals_trigger();

-- Set up rehearsals for the semesters that already exist.
do $$ declare s uuid; begin
  for s in select id from public.semesters where not is_closed loop perform private.sync_rehearsals(s); end loop;
end $$;

-- What's stopping this person from marking this rehearsal (null = nothing).
create or replace function private.mark_problem(r public.rehearsals)
returns text language plpgsql stable security definer set search_path = '' as $$
declare t date := private.today();
begin
  if (select is_closed from public.semesters where id = r.semester_id) then return 'This semester is closed.'; end if;
  if r.is_cancelled then return 'This rehearsal was cancelled.'; end if;
  if r.held_on > t then return 'You can take attendance on the day of the rehearsal.'; end if;
  if public.is_super_admin() then return null; end if;
  if public.is_admin() then
    if t <= r.held_on + (7 - extract(isodow from r.held_on))::int then return null; end if;
    return 'Attendance for that week is closed. Ask the Director to change it.';
  end if;
  if cardinality(public.my_led_drives()) > 0 then
    if t = r.held_on then return null; end if;
    return 'Drive heads can mark attendance only on the day. Ask an officer to change it.';
  end if;
  return 'Only officers and drive heads take attendance.';
end $$;

-- Save ticks for one rehearsal. p_marks: [{"member_id": "...", "status": "present" | "late" |
-- "excused" | "absent" | null}]; null clears a tick. Safe to send twice (offline replays).
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
    elsif st in ('present', 'late', 'excused', 'absent') then
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
    'late', count(*) filter (where status = 'late'),
    'excused', count(*) filter (where status = 'excused'),
    'absent', count(*) filter (where status = 'absent'))
  into totals from public.attendance where rehearsal_id = r.id;
  update public.rehearsals set roll_taken = exists (select 1 from public.attendance where rehearsal_id = r.id)
  where id = r.id;

  if changed > 0 then
    perform private.log_action('attendance', r.id::text,
      format('took attendance for %s%s: %s present, %s late, %s excused, %s absent',
             private.day_label(r.held_on), coalesce(' (' || r.drive || ')', ''),
             totals ->> 'present', totals ->> 'late', totals ->> 'excused', totals ->> 'absent'));
  end if;
  return totals || jsonb_build_object('changed', changed);
end $$;

-- The list a drive head or officer ticks: everyone on this semester's roll who hasn't left,
-- with their drives and today's mark. Drive heads see names and drives only.
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
    where (m.is_active and (m.left_on is null or m.left_on >= r.held_on)) or a.status is not null
    order by m.full_name;
end $$;

create or replace function private.require_rehearsal_power(p_drive text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_admin() then return; end if;
  if p_drive is not null and p_drive = any (public.my_led_drives()) then return; end if;
  if cardinality(public.my_led_drives()) > 0 then
    raise exception 'Drive heads can only add or cancel rehearsals for their own drive.';
  end if;
  raise exception 'Only officers and drive heads can do that.';
end $$;

create or replace function public.add_rehearsal(p_held_on date, p_drive text, p_title text, p_starts_at time)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.semesters; d text := nullif(trim(coalesce(p_drive, '')), ''); new_id uuid;
begin
  perform private.require_rehearsal_power(d);
  if p_held_on < private.today() then raise exception 'Choose today or a later date.'; end if;
  select * into s from public.semesters where p_held_on between starts_on and ends_on and not is_closed
  order by starts_on desc limit 1;
  if not found then raise exception 'That date isn''t in an open semester.'; end if;
  insert into public.rehearsals (semester_id, held_on, kind, drive, title, starts_at, created_by)
  values (s.id, p_held_on, 'extra', d, left(trim(coalesce(p_title, '')), 60), p_starts_at, public.current_member_id())
  returning id into new_id;
  perform private.log_action('rehearsals', new_id::text,
    format('added a rehearsal on %s%s', private.day_label(p_held_on), coalesce(' for ' || d, '')));
  return new_id;
end $$;

-- Cancelling: nobody is marked absent, and a notice goes out on News (see section 5).
create or replace function public.cancel_rehearsal(p_id uuid, p_reason text, p_cancel boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rehearsals; reason text := nullif(left(trim(coalesce(p_reason, '')), 200), '');
begin
  select * into r from public.rehearsals where id = p_id;
  if not found then raise exception 'Rehearsal not found.'; end if;
  if r.kind = 'regular' then
    if not public.is_admin() then raise exception 'Only officers can cancel a regular rehearsal.'; end if;
  else
    perform private.require_rehearsal_power(r.drive);
  end if;
  if (select is_closed from public.semesters where id = r.semester_id) then raise exception 'This semester is closed.'; end if;
  if p_cancel and r.held_on < private.today() then raise exception 'That rehearsal has already happened.'; end if;
  update public.rehearsals set is_cancelled = p_cancel, cancel_reason = case when p_cancel then reason end where id = p_id;
  perform private.log_action('rehearsals', p_id::text,
    format('%s the rehearsal on %s%s', case when p_cancel then 'cancelled' else 'restored' end,
           private.day_label(r.held_on), coalesce(': ' || reason, '')));
end $$;

create or replace function public.request_excuse(p_rehearsal uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rehearsals; me uuid := public.current_member_id();
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  select * into r from public.rehearsals where id = p_rehearsal;
  if not found or r.is_cancelled then raise exception 'Rehearsal not found.'; end if;
  if r.held_on < private.today() then raise exception 'Ask before the rehearsal, or speak to your drive head.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say briefly why you can''t come.'; end if;
  insert into public.excuse_requests (rehearsal_id, member_id, reason) values (r.id, me, left(trim(p_reason), 200))
  on conflict (rehearsal_id, member_id) do update set reason = excluded.reason, status = 'pending', decided_by = null, decided_at = null
  where public.excuse_requests.status = 'pending';
  if not found then raise exception 'Your request was already answered.'; end if;
end $$;

create or replace function public.decide_excuse(p_rehearsal uuid, p_member uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rehearsals; who text;
begin
  if not public.can_take_attendance() then raise exception 'Only officers and drive heads can answer excuses.'; end if;
  select * into r from public.rehearsals where id = p_rehearsal;
  if not found then raise exception 'Rehearsal not found.'; end if;
  if (select is_closed from public.semesters where id = r.semester_id) then raise exception 'This semester is closed.'; end if;
  update public.excuse_requests set status = case when p_approve then 'approved' else 'declined' end,
    decided_by = public.current_member_id(), decided_at = now()
  where rehearsal_id = p_rehearsal and member_id = p_member;
  if not found then raise exception 'Request not found.'; end if;
  if p_approve then
    insert into public.attendance (rehearsal_id, member_id, status, marked_by)
    values (p_rehearsal, p_member, 'excused', public.current_member_id())
    on conflict (rehearsal_id, member_id) do update set status = 'excused', marked_by = excluded.marked_by, marked_at = now();
  end if;
  select full_name into who from public.members where id = p_member;
  perform private.log_action('attendance', p_rehearsal::text,
    format('%s %s''s excuse for %s', case when p_approve then 'approved' else 'declined' end, who, private.day_label(r.held_on)));
end $$;

alter table public.rehearsals enable row level security;
alter table public.attendance enable row level security;
alter table public.excuse_requests enable row level security;

drop policy if exists rehearsals_read on public.rehearsals;
create policy rehearsals_read on public.rehearsals for select to authenticated using (public.current_member_id() is not null);
drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated
  using (member_id = public.current_member_id() or public.can_take_attendance());
drop policy if exists excuses_read on public.excuse_requests;
create policy excuses_read on public.excuse_requests for select to authenticated
  using (member_id = public.current_member_id() or public.can_take_attendance());

-- ---------------------------------------------------------------------------
-- 4. Member settings (birthday opt-out, notifications, News last seen)
-- ---------------------------------------------------------------------------
create table if not exists public.member_settings (
  member_id     uuid primary key references public.members (id) on delete cascade,
  birthday_post boolean not null default true,
  notify        jsonb not null default '{}'::jsonb check (jsonb_typeof(notify) = 'object'),
  news_seen_at  timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.member_settings enable row level security;
drop policy if exists settings_own on public.member_settings;
create policy settings_own on public.member_settings for all to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

-- ---------------------------------------------------------------------------
-- 5. News
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references public.members (id) on delete set null,   -- null: posted by the app
  author_label     text not null default '' check (length(author_label) <= 80),
  kind             text not null default 'post' check (kind in ('post', 'birthday', 'notice')),
  body             text not null check (length(trim(body)) between 1 and 2000),
  tags             text[] not null default '{}' check (cardinality(tags) <= 5),
  drive            text check (drive is null or length(trim(drive)) between 1 and 60),
  urgent           boolean not null default false,
  event_at         timestamptz,
  comments_off     boolean not null default false,
  pinned_at        timestamptz,
  pinned_by        uuid references public.members (id),
  birthday_on      date,
  birthday_members uuid[],
  image_count      smallint not null default 0 check (image_count between 0 and 4),
  created_at       timestamptz not null default now(),
  edited_at        timestamptz
);
create unique index if not exists posts_one_birthday_a_day on public.posts (birthday_on) where kind = 'birthday';
create index if not exists posts_newest on public.posts (created_at desc);

create table if not exists public.post_images (
  post_id  uuid not null references public.posts (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  image    text not null check (image ~ '^data:image/(webp|jpeg|png);base64,' and length(image) <= 400000),
  primary key (post_id, position)
);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

create table if not exists public.post_views (
  post_id   uuid not null references public.posts (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  seen_at   timestamptz not null default now(),
  primary key (post_id, member_id)
);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  parent_id  uuid references public.post_comments (id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index if not exists comments_by_post on public.post_comments (post_id, created_at);

create table if not exists public.comment_reports (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  reason     text not null default '' check (length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (comment_id, member_id)
);

-- Who may see a post for a drive: that drive's members and heads, and officers.
create or replace function public.can_see_post(p_drive text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_member_id() is not null and (
    p_drive is null or public.is_admin()
    or p_drive = any (private.member_drives(public.current_member_id()))
    or p_drive = any (public.my_led_drives()))
$$;

-- The names a person may post under: their office, their portfolio, "Head, <drive>".
create or replace function public.my_post_labels()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct l), '{}') from (
    select m.position as l from public.members m where m.id = public.current_member_id() and public.is_admin()
    union all
    select nullif(trim(m.portfolio), '') from public.members m
      where m.id = public.current_member_id() and (public.is_admin() or cardinality(public.my_led_drives()) > 0)
    union all
    select 'Officer' where public.is_admin()
    union all
    select 'Head, ' || d from unnest(public.my_led_drives()) d
  ) s where l is not null
$$;

create or replace function private.clean_tags(p text[])
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(t order by first_at), '{}') from (
    select min(trim(x)) as t, min(n) as first_at
    from unnest(p) with ordinality as u(x, n)
    where length(trim(x)) between 1 and 24
    group by lower(trim(x))
  ) s
$$;

create or replace function private.prepare_post()
returns trigger language plpgsql security definer set search_path = '' as $$
declare labels text[];
begin
  if tg_op = 'INSERT' then
    if private.from_app() and not private.trusted() then
      if not (public.is_admin() or cardinality(public.my_led_drives()) > 0) then
        raise exception 'Only officers and drive heads can post.';
      end if;
      new.author_id := public.current_member_id();
      new.kind := 'post';
      new.created_at := now();
      new.edited_at := null;
      new.pinned_at := null;
      new.pinned_by := null;
      new.birthday_on := null;
      new.birthday_members := null;
      new.drive := nullif(trim(coalesce(new.drive, '')), '');
      if not public.is_admin() and (new.drive is null or not (new.drive = any (public.my_led_drives()))) then
        raise exception 'Drive heads post to their own drive.';
      end if;
      labels := public.my_post_labels();
      if new.author_label = '' or not (new.author_label = any (labels)) then new.author_label := labels[1]; end if;
    end if;
    new.tags := private.clean_tags(new.tags);
    return new;
  end if;

  -- UPDATE: the author changes the words, tags, event time and comments switch. Pinning goes
  -- through pin_post(); nothing else changes.
  if private.from_app() and not private.trusted() then
    if old.author_id is distinct from public.current_member_id() then raise exception 'Only the person who posted can edit it.'; end if;
    if new.author_id is distinct from old.author_id or new.kind is distinct from old.kind or new.drive is distinct from old.drive
       or new.created_at is distinct from old.created_at or new.pinned_at is distinct from old.pinned_at
       or new.pinned_by is distinct from old.pinned_by or new.birthday_on is distinct from old.birthday_on
       or new.birthday_members is distinct from old.birthday_members or new.author_label is distinct from old.author_label then
      raise exception 'That part of a post can''t be changed.';
    end if;
  end if;
  new.tags := private.clean_tags(new.tags);
  if new.body is distinct from old.body or new.tags is distinct from old.tags or new.event_at is distinct from old.event_at then
    new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists posts_prepare on public.posts;
create trigger posts_prepare before insert or update on public.posts for each row execute function private.prepare_post();

create or replace function private.prepare_post_image()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.from_app() and not private.trusted()
     and (select author_id from public.posts where id = new.post_id) is distinct from public.current_member_id() then
    raise exception 'Only the person who posted can add pictures.';
  end if;
  return new;
end $$;
drop trigger if exists post_images_prepare on public.post_images;
create trigger post_images_prepare before insert or update on public.post_images for each row execute function private.prepare_post_image();

create or replace function private.count_post_images()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  perform set_config('his.trusted', 'on', true);
  update public.posts set image_count = (select count(*) from public.post_images where post_id = pid) where id = pid;
  perform set_config('his.trusted', 'off', true);
  return null;
end $$;
drop trigger if exists post_images_count on public.post_images;
create trigger post_images_count after insert or delete on public.post_images for each row execute function private.count_post_images();

create or replace function private.prepare_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.posts; parent public.post_comments;
begin
  if tg_op = 'INSERT' then
    if private.from_app() then
      new.member_id := public.current_member_id();
      new.created_at := now();
      new.edited_at := null;
    end if;
    select * into p from public.posts where id = new.post_id;
    if not found then raise exception 'Post not found.'; end if;
    if p.comments_off then raise exception 'Comments are turned off for this post.'; end if;
    if new.parent_id is not null then
      select * into parent from public.post_comments where id = new.parent_id;
      if not found or parent.post_id <> new.post_id then raise exception 'Comment not found.'; end if;
      -- One level of replies: a reply to a reply joins the same thread.
      new.parent_id := coalesce(parent.parent_id, parent.id);
    end if;
    new.body := trim(new.body);
    return new;
  end if;
  if private.from_app() then
    if old.member_id is distinct from public.current_member_id() then raise exception 'You can only edit your own comment.'; end if;
    if new.post_id is distinct from old.post_id or new.member_id is distinct from old.member_id
       or new.parent_id is distinct from old.parent_id or new.created_at is distinct from old.created_at then
      raise exception 'Only the words of a comment can change.';
    end if;
  end if;
  new.body := trim(new.body);
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end $$;
drop trigger if exists comments_prepare on public.post_comments;
create trigger comments_prepare before insert or update on public.post_comments for each row execute function private.prepare_comment();

create or replace function public.pin_post(p_id uuid, p_pin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only officers can pin posts.'; end if;
  if p_pin and (select count(*) from public.posts where pinned_at is not null and id <> p_id) >= 3 then
    raise exception 'Up to 3 posts can be pinned. Unpin one first.';
  end if;
  perform set_config('his.trusted', 'on', true);
  update public.posts set pinned_at = case when p_pin then now() end, pinned_by = case when p_pin then public.current_member_id() end
  where id = p_id;
  perform set_config('his.trusted', 'off', true);
  if not found then raise exception 'Post not found.'; end if;
end $$;

-- Birthday greeting for a day (idempotent; the nightly job and the News screen both call it).
create or replace function private.ensure_birthday_post(p_day date)
returns void language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; names text[]; who text; n int;
begin
  if exists (select 1 from public.posts where kind = 'birthday' and birthday_on = p_day) then return; end if;
  select array_agg(m.id order by m.full_name), array_agg(m.full_name order by m.full_name)
  into ids, names
  from public.members m
  left join public.member_settings s on s.member_id = m.id
  where m.is_active and m.birth_day = extract(day from p_day) and m.birth_month = extract(month from p_day)
    and coalesce(s.birthday_post, true);
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then return; end if;
  who := case when n = 1 then names[1]
              else array_to_string(names[1:n - 1], ', ') || ' and ' || names[n] end;
  perform set_config('his.trusted', 'on', true);
  insert into public.posts (author_id, author_label, kind, body, tags, birthday_on, birthday_members, created_at)
  values (null, 'His Theatre', 'birthday',
          format('Happy birthday, %s! 🎉 Wishing you a blessed year ahead, from all of us at His Theatre.', who),
          array['Birthday'], p_day, ids, (p_day::timestamp at time zone 'Africa/Accra'))
  on conflict (birthday_on) where kind = 'birthday' do nothing;
  perform set_config('his.trusted', 'off', true);
end $$;

-- Cancelling a rehearsal posts a notice to the people it was for.
create or replace function private.rehearsal_notice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor public.members;
begin
  if new.is_cancelled and not old.is_cancelled and new.held_on >= private.today() then
    select * into actor from public.members where id = public.current_member_id();
    perform set_config('his.trusted', 'on', true);
    insert into public.posts (author_id, author_label, kind, body, tags, drive, urgent)
    values (actor.id, coalesce(actor.position, 'His Theatre'), 'notice',
            format('Rehearsal cancelled: %s%s.%s', private.day_label(new.held_on),
                   case when new.drive is not null then ' (' || new.drive || ')' else '' end,
                   coalesce(' ' || new.cancel_reason, '')),
            array['Rehearsal'], new.drive, true);
    perform set_config('his.trusted', 'off', true);
  end if;
  return null;
end $$;
drop trigger if exists rehearsals_notice on public.rehearsals;
create trigger rehearsals_notice after update on public.rehearsals for each row execute function private.rehearsal_notice();

-- What a person sees on News. Today's birthday post comes first, then pinned posts, then the
-- newest. p_before pages through older posts; p_tag filters.
create or replace function public.news_feed(p_before timestamptz default null, p_tag text default null, p_limit int default 20)
returns table (
  id uuid, author_id uuid, author_name text, author_label text, author_photo text, kind text, body text,
  tags text[], drive text, urgent boolean, event_at timestamptz, comments_off boolean, pinned_at timestamptz,
  birthday_on date, birthday_names text[], image_count smallint, created_at timestamptz, edited_at timestamptz,
  likes bigint, comments bigint, views bigint, liked_by_me boolean, seen_by_me boolean)
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.current_member_id(); t date := private.today();
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  perform private.ensure_birthday_post(t);
  return query
    select p.id, p.author_id, a.full_name, p.author_label, ph.image, p.kind, p.body, p.tags, p.drive, p.urgent, p.event_at,
           p.comments_off, p.pinned_at, p.birthday_on,
           (select array_agg(bm.full_name order by bm.full_name) from public.members bm where bm.id = any (p.birthday_members)),
           p.image_count, p.created_at, p.edited_at,
           (select count(*) from public.post_likes l where l.post_id = p.id),
           (select count(*) from public.post_comments c where c.post_id = p.id),
           (select count(*) from public.post_views v where v.post_id = p.id),
           exists (select 1 from public.post_likes l where l.post_id = p.id and l.member_id = me),
           exists (select 1 from public.post_views v where v.post_id = p.id and v.member_id = me)
    from public.posts p
    left join public.members a on a.id = p.author_id
    left join public.member_photos ph on ph.member_id = p.author_id
    where public.can_see_post(p.drive)
      and (p_tag is null or lower(p_tag) = any (select lower(x) from unnest(p.tags) x))
      and (p_before is null
           or (p.created_at < p_before and p.pinned_at is null and not (p.kind = 'birthday' and p.birthday_on = t)))
    order by (p.kind = 'birthday' and p.birthday_on = t) desc,
             (p.pinned_at is not null and p_before is null) desc, p.pinned_at desc nulls last,
             p.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;

create or replace function public.post_comments_for(p_post uuid)
returns table (id uuid, parent_id uuid, member_id uuid, full_name text, label text, photo text, body text,
               created_at timestamptz, edited_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.posts p where p.id = p_post and public.can_see_post(p.drive)) then
    raise exception 'Post not found.';
  end if;
  return query
    select c.id, c.parent_id, c.member_id, m.full_name,
           coalesce(case when m.role <> 'member' then m.position end,
                    (select 'Head, ' || min(h.drive) from public.drive_heads h where h.member_id = m.id), ''),
           -- Pictures show only for officers and drive heads; everyone else shows initials.
           case when m.role <> 'member' or exists (select 1 from public.drive_heads h where h.member_id = m.id)
                then ph.image end,
           c.body, c.created_at, c.edited_at
    from public.post_comments c
    join public.members m on m.id = c.member_id
    left join public.member_photos ph on ph.member_id = c.member_id
    where c.post_id = p_post
    order by c.created_at;
end $$;

create or replace function public.post_likers(p_post uuid)
returns table (member_id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.posts p where p.id = p_post and public.can_see_post(p.drive)) then
    raise exception 'Post not found.';
  end if;
  return query select m.id, m.full_name from public.post_likes l join public.members m on m.id = l.member_id
    where l.post_id = p_post order by l.created_at desc;
end $$;

-- Who has seen a post: officers only.
create or replace function public.post_viewers(p_post uuid)
returns table (member_id uuid, full_name text, seen_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only officers can see who viewed a post.'; end if;
  return query select m.id, m.full_name, v.seen_at from public.post_views v join public.members m on m.id = v.member_id
    where v.post_id = p_post order by v.seen_at desc;
end $$;

create or replace function public.news_unread()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.posts p
  where public.can_see_post(p.drive)
    and p.created_at > coalesce((select news_seen_at from public.member_settings where member_id = public.current_member_id()), '-infinity')
    and p.author_id is distinct from public.current_member_id()
$$;

create or replace function public.mark_news_seen()
returns void language sql security definer set search_path = '' as $$
  insert into public.member_settings (member_id, news_seen_at) values (public.current_member_id(), now())
  on conflict (member_id) do update set news_seen_at = now(), updated_at = now()
$$;

create or replace function public.report_comment(p_comment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.post_comments c join public.posts p on p.id = c.post_id
                 where c.id = p_comment and public.can_see_post(p.drive)) then
    raise exception 'Comment not found.';
  end if;
  insert into public.comment_reports (comment_id, member_id, reason)
  values (p_comment, public.current_member_id(), left(trim(coalesce(p_reason, '')), 200))
  on conflict do nothing;
end $$;

create or replace function public.reported_comments()
returns table (comment_id uuid, post_id uuid, author_name text, body text, reports bigint, reasons text[], last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only officers can see reports.'; end if;
  return query
    select c.id, c.post_id, m.full_name, c.body, count(*), array_agg(r.reason) filter (where r.reason <> ''), max(r.created_at)
    from public.comment_reports r join public.post_comments c on c.id = r.comment_id join public.members m on m.id = c.member_id
    group by c.id, c.post_id, m.full_name, c.body order by max(r.created_at) desc;
end $$;

-- Who removed what, for the audit log.
create or replace function private.log_news_removal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  if not private.from_app() then return null; end if;
  if tg_table_name = 'posts' then
    if old.author_id is distinct from public.current_member_id() then
      select full_name into who from public.members where id = old.author_id;
      perform private.log_action('posts', old.id::text, format('removed a post by %s: %s', coalesce(who, 'His Theatre'), left(old.body, 60)));
    end if;
  elsif old.member_id is distinct from public.current_member_id() then
    select full_name into who from public.members where id = old.member_id;
    perform private.log_action('post_comments', old.id::text, format('removed a comment by %s: %s', who, left(old.body, 60)));
  end if;
  return null;
end $$;
drop trigger if exists posts_removed on public.posts;
create trigger posts_removed after delete on public.posts for each row execute function private.log_news_removal();
drop trigger if exists comments_removed on public.post_comments;
create trigger comments_removed after delete on public.post_comments for each row execute function private.log_news_removal();

alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_views enable row level security;
alter table public.post_comments enable row level security;
alter table public.comment_reports enable row level security;

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (public.can_see_post(drive));
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (public.is_admin() or cardinality(public.my_led_drives()) > 0);
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = public.current_member_id()) with check (author_id = public.current_member_id());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = public.current_member_id() or public.is_super_admin());

drop policy if exists post_images_read on public.post_images;
create policy post_images_read on public.post_images for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and public.can_see_post(p.drive)));
drop policy if exists post_images_write on public.post_images;
create policy post_images_write on public.post_images for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = public.current_member_id()));
drop policy if exists post_images_delete on public.post_images;
create policy post_images_delete on public.post_images for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = public.current_member_id()));

drop policy if exists likes_read on public.post_likes;
create policy likes_read on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and public.can_see_post(p.drive)));
drop policy if exists likes_add on public.post_likes;
create policy likes_add on public.post_likes for insert to authenticated
  with check (member_id = public.current_member_id()
              and exists (select 1 from public.posts p where p.id = post_id and public.can_see_post(p.drive)));
drop policy if exists likes_remove on public.post_likes;
create policy likes_remove on public.post_likes for delete to authenticated using (member_id = public.current_member_id());

drop policy if exists views_own on public.post_views;
create policy views_own on public.post_views for select to authenticated using (member_id = public.current_member_id());
drop policy if exists views_add on public.post_views;
create policy views_add on public.post_views for insert to authenticated
  with check (member_id = public.current_member_id()
              and exists (select 1 from public.posts p where p.id = post_id and public.can_see_post(p.drive)));

drop policy if exists comments_read on public.post_comments;
create policy comments_read on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and public.can_see_post(p.drive)));
drop policy if exists comments_add on public.post_comments;
create policy comments_add on public.post_comments for insert to authenticated
  with check (member_id = public.current_member_id()
              and exists (select 1 from public.posts p where p.id = post_id and public.can_see_post(p.drive)));
drop policy if exists comments_edit on public.post_comments;
create policy comments_edit on public.post_comments for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());
drop policy if exists comments_remove on public.post_comments;
create policy comments_remove on public.post_comments for delete to authenticated
  using (member_id = public.current_member_id() or public.is_admin()
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = public.current_member_id()));

drop policy if exists reports_read on public.comment_reports;
create policy reports_read on public.comment_reports for select to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 6. Grants and live updates
-- ---------------------------------------------------------------------------
revoke all on public.drive_heads, public.rehearsals, public.attendance, public.excuse_requests, public.member_settings,
  public.posts, public.post_images, public.post_likes, public.post_views, public.post_comments, public.comment_reports
  from anon, public;
grant select on public.drive_heads, public.rehearsals, public.attendance, public.excuse_requests, public.comment_reports to authenticated;
grant select, insert, update on public.member_settings to authenticated;
grant select, insert, update, delete on public.posts, public.post_comments to authenticated;
grant select, insert, delete on public.post_images, public.post_likes to authenticated;
grant select, insert on public.post_views to authenticated;
grant all on public.drive_heads, public.rehearsals, public.attendance, public.excuse_requests, public.member_settings,
  public.posts, public.post_images, public.post_likes, public.post_views, public.post_comments, public.comment_reports
  to service_role;

revoke all on function private.today(), private.member_drives(uuid), private.log_action(text, text, text),
  private.day_label(date), private.sync_rehearsals(uuid), private.mark_problem(public.rehearsals),
  private.require_rehearsal_power(text), private.clean_tags(text[]), private.ensure_birthday_post(date)
  from public, anon, authenticated;

revoke all on function public.my_led_drives(), public.can_take_attendance(), public.my_drives(), public.list_drive_heads(),
  public.set_drive_head(uuid, text, boolean), public.mark_attendance(uuid, jsonb), public.roll_call(uuid),
  public.add_rehearsal(date, text, text, time), public.cancel_rehearsal(uuid, text, boolean),
  public.request_excuse(uuid, text), public.decide_excuse(uuid, uuid, boolean), public.can_see_post(text),
  public.my_post_labels(), public.pin_post(uuid, boolean), public.news_feed(timestamptz, text, int),
  public.post_comments_for(uuid), public.post_likers(uuid), public.post_viewers(uuid), public.news_unread(),
  public.mark_news_seen(), public.report_comment(uuid, text), public.reported_comments()
  from public, anon;
grant execute on function public.my_led_drives(), public.can_take_attendance(), public.my_drives(), public.list_drive_heads(),
  public.set_drive_head(uuid, text, boolean), public.mark_attendance(uuid, jsonb), public.roll_call(uuid),
  public.add_rehearsal(date, text, text, time), public.cancel_rehearsal(uuid, text, boolean),
  public.request_excuse(uuid, text), public.decide_excuse(uuid, uuid, boolean), public.can_see_post(text),
  public.my_post_labels(), public.pin_post(uuid, boolean), public.news_feed(timestamptz, text, int),
  public.post_comments_for(uuid), public.post_likers(uuid), public.post_viewers(uuid), public.news_unread(),
  public.mark_news_seen(), public.report_comment(uuid, text), public.reported_comments()
  to authenticated;

do $$
declare t text;
begin
  foreach t in array array['rehearsals', 'attendance', 'excuse_requests', 'drive_heads', 'posts', 'post_comments', 'post_likes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
