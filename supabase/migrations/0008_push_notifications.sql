-- His Theatre: phone notifications (Web Push) and the nightly and weekly jobs.
-- Run once, after 0007_attendance_and_news.sql.
--
-- How it works: when something happens (a new post, a comment, a birthday, cash waiting to be
-- confirmed, a weekly dues reminder) the database writes a message to a private outbox and
-- pokes the "push-send" server function. That function reads the outbox with the server key
-- and delivers each message through Google or Apple to the phones that turned notifications on.
-- Poking the function can't send anything that isn't already in the outbox, so it needs no secret.
-- Each member chooses which kinds they get (Settings → Notifications). Urgent posts always go.

-- ---------------------------------------------------------------------------
-- 1. Phones that turned notifications on
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint   text primary key check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  member_id  uuid not null references public.members (id) on delete cascade,
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member on public.push_subscriptions (member_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for select to authenticated using (member_id = public.current_member_id());
drop policy if exists push_remove on public.push_subscriptions;
create policy push_remove on public.push_subscriptions for delete to authenticated using (member_id = public.current_member_id());

-- A shared phone moves to whoever turned notifications on last.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := public.current_member_id();
begin
  if me is null then raise exception 'Please sign in again.'; end if;
  insert into public.push_subscriptions (endpoint, member_id, p256dh, auth) values (p_endpoint, me, p_p256dh, p_auth)
  on conflict (endpoint) do update set member_id = me, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- 2. Outbox
-- ---------------------------------------------------------------------------
create table if not exists private.push_outbox (
  id         bigint generated always as identity primary key,
  member_ids uuid[] not null,
  kind       text not null,
  title      text not null,
  body       text not null,
  url        text not null default '/',
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create table if not exists private.settings (key text primary key, value text not null);
-- The address of the push-send function on the live project. (Not a secret.)
insert into private.settings values ('push_url', 'https://qjpsbsgwxqyqwdoowywh.supabase.co/functions/v1/push-send')
on conflict (key) do nothing;

-- Ask push-send to deliver what's waiting. Does nothing where pg_net isn't installed (tests).
create or replace function private.kick_push()
returns void language plpgsql security definer set search_path = '' as $$
declare u text;
begin
  select value into u from private.settings where key = 'push_url';
  if u is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := ''{"Content-Type":"application/json"}''::jsonb)' using u;
exception when others then
  null;  -- a notification must never stop the thing that caused it
end $$;

-- Queue a message for these members, keeping only those who want this kind.
create or replace function private.notify(p_members uuid[], p_kind text, p_title text, p_body text, p_url text default '/')
returns void language plpgsql security definer set search_path = '' as $$
declare ids uuid[];
begin
  select array_agg(distinct m.id) into ids
  from public.members m left join public.member_settings s on s.member_id = m.id
  where m.id = any (p_members) and m.is_active
    and (p_kind = 'urgent' or coalesce((s.notify ->> p_kind)::boolean, true))
    and exists (select 1 from public.push_subscriptions ps where ps.member_id = m.id);
  if ids is null then return; end if;
  insert into private.push_outbox (member_ids, kind, title, body, url)
  values (ids, p_kind, left(p_title, 80), left(p_body, 180), p_url);
  perform private.kick_push();
end $$;

-- Who can see a post for this drive (mirrors public.can_see_post, for any member).
create or replace function private.post_audience(p_drive text, p_except uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.id), '{}') from public.members m
  where m.is_active and m.is_activated and m.id is distinct from p_except
    and (p_drive is null or m.role in ('admin', 'super_admin')
         or p_drive = any (private.member_drives(m.id))
         or exists (select 1 from public.drive_heads h where h.member_id = m.id and h.drive = p_drive))
$$;

-- The server function's side door: hand over waiting messages with each phone's address.
create or replace function public.claim_push_jobs()
returns table (id bigint, kind text, title text, body text, url text, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with jobs as (
    update private.push_outbox o set claimed_at = now()
    where o.id in (select x.id from private.push_outbox x where x.claimed_at is null order by x.id limit 50 for update skip locked)
    returning o.*
  )
  select j.id, j.kind, j.title, j.body, j.url, s.endpoint, s.p256dh, s.auth
  from jobs j join public.push_subscriptions s on s.member_id = any (j.member_ids);
  delete from private.push_outbox where claimed_at < now() - interval '7 days';
end $$;

create or replace function public.drop_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint
$$;

-- ---------------------------------------------------------------------------
-- 3. What sends a notification
-- ---------------------------------------------------------------------------
create or replace function private.push_for_post()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who text; first_line text := left(split_part(new.body, E'\n', 1), 140);
begin
  if new.kind = 'birthday' then
    perform private.notify(new.birthday_members, 'birthday', 'Happy birthday! 🎉', 'From all of us at His Theatre. See your wishes.', '/announcements');
    select string_agg(split_part(full_name, ' ', 1), ' and ') into who from public.members where id = any (new.birthday_members);
    perform private.notify(array(select x from unnest(private.post_audience(null, null)) x where not (x = any (new.birthday_members))),
      'birthday', '🎂 Birthday today', format('It''s %s''s birthday. Send your wishes!', who), '/announcements');
    return null;
  end if;
  select full_name into who from public.members where id = new.author_id;
  perform private.notify(private.post_audience(new.drive, new.author_id), case when new.urgent then 'urgent' else 'news' end,
    case when new.urgent then '⚠️ ' else '' end || coalesce(who || ' · ' || nullif(new.author_label, ''), new.author_label, 'His Theatre'),
    first_line, '/announcements');
  return null;
end $$;
drop trigger if exists posts_push on public.posts;
create trigger posts_push after insert on public.posts for each row execute function private.push_for_post();

create or replace function private.push_for_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who text; post_author uuid; parent_author uuid;
begin
  select split_part(full_name, ' ', 1) into who from public.members where id = new.member_id;
  select author_id into post_author from public.posts where id = new.post_id;
  if new.parent_id is not null then select member_id into parent_author from public.post_comments where id = new.parent_id; end if;
  perform private.notify(array(select x from unnest(array[post_author, parent_author]) x where x is not null and x <> new.member_id),
    'comments', format('%s commented', who), left(new.body, 140), '/announcements');
  return null;
end $$;
drop trigger if exists comments_push on public.post_comments;
create trigger comments_push after insert on public.post_comments for each row execute function private.push_for_comment();

create or replace function private.push_for_handover()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  select full_name into who from public.members where id = new.from_member_id;
  perform private.notify(array[new.to_member_id], 'handovers', 'Cash to confirm',
    format('%s handed you %s (%s). Count it, then confirm.', who, private.cedi(new.amount), new.ref), '/admin/handovers');
  return null;
end $$;
drop trigger if exists handovers_push on public.handovers;
create trigger handovers_push after insert on public.handovers for each row execute function private.push_for_handover();

-- Members who owe for weeks already past, in the current semester.
create or replace function private.queue_dues_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare s public.semesters; t date := private.today(); ids uuid[];
begin
  select * into s from public.semesters where t between starts_on and ends_on and not is_closed order by starts_on desc limit 1;
  if not found then return; end if;
  select array_agg(x.member_id) into ids from (
    select ms.member_id,
      coalesce((select r.weekly_amount from public.dues_rates r where r.semester_id = s.id and r.category = ms.category), 0)
        * (select count(*) from public.semester_weeks w where w.semester_id = s.id and w.counts and w.week_no >= ms.start_week_no and w.week_start <= t)
      + coalesce((select sum(a.amount) from public.adjustments a where a.member_id = ms.member_id and a.semester_id = s.id), 0)
      - coalesce((select sum(p.amount) from public.payments p where p.member_id = ms.member_id and p.semester_id = s.id), 0) as owed
    from public.member_semesters ms join public.members m on m.id = ms.member_id
    where ms.semester_id = s.id and m.is_active and m.is_activated
  ) x where x.owed > 0;
  if ids is null then return; end if;
  perform private.notify(ids, 'dues', 'Dues reminder', 'You have dues outstanding. Tap to see your balance.', '/dues');
end $$;

create or replace function private.nightly()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.ensure_birthday_post(private.today());
end $$;

-- ---------------------------------------------------------------------------
-- 4. Schedules (Supabase's pg_cron; times are GMT, which is Ghana time)
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then raise notice 'pg_net not available here; notifications will queue only.';
end $$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('his-birthdays', '1 0 * * *', 'select private.nightly()');
  perform cron.schedule('his-dues-reminders', '7 9 * * 1', 'select private.queue_dues_reminders()');
exception when others then raise notice 'pg_cron not available here; schedules not set.';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
revoke all on public.push_subscriptions from anon, public;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

revoke all on function private.kick_push(), private.notify(uuid[], text, text, text, text), private.post_audience(text, uuid),
  private.queue_dues_reminders(), private.nightly() from public, anon, authenticated;
revoke all on function public.save_push_subscription(text, text, text), public.claim_push_jobs(),
  public.drop_push_subscription(text) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.claim_push_jobs(), public.drop_push_subscription(text) to service_role;
