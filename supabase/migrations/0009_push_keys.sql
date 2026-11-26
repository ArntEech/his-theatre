-- His Theatre: the notification signing keys live only on the server.
-- The push-send function makes the key pair the first time it runs and keeps the private half
-- in this private table (only the server key can read it). Phones ask for the public half,
-- which is safe to share: it only lets Google and Apple check messages really come from us.

create table if not exists private.push_keys (
  id          int primary key default 1 check (id = 1),
  public_key  text not null,
  private_key text not null,
  created_at  timestamptz not null default now()
);

create or replace function public.push_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select public_key from private.push_keys where id = 1 and public.current_member_id() is not null
$$;

create or replace function public.push_keys_get()
returns table (public_key text, private_key text) language sql stable security definer set search_path = '' as $$
  select public_key, private_key from private.push_keys where id = 1
$$;

-- Keeps the first pair ever saved; a second call can't replace it.
create or replace function public.push_keys_init(p_public text, p_private text)
returns void language sql security definer set search_path = '' as $$
  insert into private.push_keys (id, public_key, private_key) values (1, p_public, p_private) on conflict (id) do nothing
$$;

revoke all on function public.push_public_key(), public.push_keys_get(), public.push_keys_init(text, text) from public, anon, authenticated;
grant execute on function public.push_public_key() to authenticated;
grant execute on function public.push_keys_get(), public.push_keys_init(text, text) to service_role;
