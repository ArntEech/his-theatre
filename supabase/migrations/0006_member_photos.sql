-- His Theatre: profile pictures.
-- Each member may add, change or remove their own picture. Members see only their own;
-- officers see everyone's (to recognise who they're recording money for). A picture is a
-- small square image (about 320 × 320) stored as a data URL, so it follows the same row rules
-- as everything else and needs no separate file storage.

create table if not exists public.member_photos (
  member_id uuid primary key references public.members (id) on delete cascade,
  image text not null check (image ~ '^data:image/(webp|jpeg|png);base64,' and length(image) <= 150000),
  updated_at timestamptz not null default now()
);

alter table public.member_photos enable row level security;

drop policy if exists photos_read on public.member_photos;
create policy photos_read on public.member_photos for select to authenticated
  using (member_id = public.current_member_id() or public.is_admin());

drop policy if exists photos_insert on public.member_photos;
create policy photos_insert on public.member_photos for insert to authenticated
  with check (member_id = public.current_member_id());

drop policy if exists photos_update on public.member_photos;
create policy photos_update on public.member_photos for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

-- You can remove your own picture; officers can remove one that isn't suitable.
drop policy if exists photos_delete on public.member_photos;
create policy photos_delete on public.member_photos for delete to authenticated
  using (member_id = public.current_member_id() or public.is_admin());

revoke all on public.member_photos from anon, public;
grant select, insert, update, delete on public.member_photos to authenticated;
