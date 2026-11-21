-- His Theatre: member profile details from the registration form.
-- Run once, after 0001_his_theatre.sql.
--
-- Who sees them: the existing rules already apply. A member reads only their own row;
-- officers (with their authenticator code) read everyone's. Officers' names and positions
-- are the only details other members can see (public.list_officers).
-- Who changes them: officers only, like every other member detail.

alter table public.members
  add column birth_day         smallint check (birth_day between 1 and 31),
  add column birth_month       smallint check (birth_month between 1 and 12),
  add column level             smallint check (level between 100 and 900),
  add column joined_as         text check (joined_as in ('new', 'continuing')),
  add column course            text not null default '' check (length(course) <= 120),
  add column hall              text not null default '' check (length(hall) <= 120),
  add column drive_interests   text not null default '' check (length(drive_interests) <= 200),
  add column experience        text not null default '' check (length(experience) <= 60),
  add column experience_notes  text not null default '' check (length(experience_notes) <= 500),
  add column registered_at     timestamptz,
  -- What they do in the group, e.g. "Drama Director", "Secretary". Shown under their name.
  -- Separate from the three finance offices (Director, Financial Secretary, Treasurer),
  -- which are what give officer powers.
  add column portfolio         text not null default '' check (length(portfolio) <= 60),
  add constraint members_birthday_both check ((birth_day is null) = (birth_month is null));
