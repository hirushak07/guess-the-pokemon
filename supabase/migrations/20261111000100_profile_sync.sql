begin;

-- Profiles were created by hand in each project; this records the production shape so every
-- environment matches. Every statement is safe to run on a project that already has the table.
create table if not exists public.profiles (
  id text primary key,
  username text,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists created_at timestamptz not null default now();
-- A player always gets a profile row, even when their Clerk username is missing or unusable.
alter table public.profiles alter column username drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_username_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_check check (username ~ '^[A-Za-z0-9_]{3,20}$');
  end if;
end;
$$;

create unique index if not exists profiles_username_unique on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Writes go through sync_profile, so a username can't be claimed with a direct table write.
drop policy if exists "Create own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
drop policy if exists profile_insert_own on public.profiles;
drop policy if exists profile_update_own on public.profiles;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "Read own profile" on public.profiles;
drop policy if exists profile_read_own on public.profiles;
drop policy if exists read_own_profile on public.profiles;
create policy read_own_profile on public.profiles
  for select to authenticated using (id = (select auth.jwt() ->> 'sub'));

-- Creates or updates the caller's profile. The JWT subject decides whose row it is.
-- When the Clerk session token carries a "username" claim, that verified name wins and is
-- released from any older row still holding it (Clerk keeps usernames unique, so that row is stale:
-- a renamed account or a development-instance account). Without the claim, the name the client
-- sends is only used when nobody else has it, so a player can never take someone else's name.
create or replace function public.sync_profile(p_username text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player text := nullif(auth.jwt() ->> 'sub', '');
  v_verified text := nullif(btrim(auth.jwt() ->> 'username'), '');
  v_username text;
  v_status text := 'saved';
  v_profile public.profiles%rowtype;
begin
  if v_player is null then
    raise exception 'Sign in to save a profile' using errcode = '42501';
  end if;

  v_username := coalesce(v_verified, nullif(btrim(p_username), ''));

  if v_username is not null and v_username !~ '^[A-Za-z0-9_]{3,20}$' then
    v_status := 'username_invalid';
  elsif v_username is not null then
    -- Two players racing for the same name take turns here.
    perform pg_advisory_xact_lock(hashtextextended('profile:' || lower(v_username), 0));
    if v_verified is not null then
      update public.profiles set username = null
        where lower(username) = lower(v_username) and id <> v_player;
    elsif exists (
      select 1 from public.profiles where lower(username) = lower(v_username) and id <> v_player
    ) then
      v_status := 'username_taken';
    end if;
  end if;

  if v_status = 'saved' then
    insert into public.profiles (id, username) values (v_player, v_username)
      on conflict (id) do update set username = excluded.username
      returning * into v_profile;
  else
    -- Keep whatever name the row already has rather than blanking it.
    insert into public.profiles (id) values (v_player)
      on conflict (id) do update set id = excluded.id
      returning * into v_profile;
  end if;

  return jsonb_build_object('status', v_status, 'username', v_profile.username);
end;
$$;

revoke execute on function public.sync_profile(text) from public, anon;
grant execute on function public.sync_profile(text) to authenticated;

commit;
