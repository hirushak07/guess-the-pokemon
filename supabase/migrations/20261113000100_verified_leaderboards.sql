begin;

create table game_private.leaderboard_players (
  player_id text primary key
);

revoke all on game_private.leaderboard_players from public, anon, authenticated;

create function public.leaderboard_visibility(p_visible boolean default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player text := nullif(auth.jwt() ->> 'sub', '');
begin
  if v_player is null then
    raise exception 'Sign in to manage leaderboard visibility' using errcode = '42501';
  end if;

  if p_visible is true then
    insert into game_private.leaderboard_players (player_id) values (v_player)
      on conflict (player_id) do nothing;
  elsif p_visible is false then
    delete from game_private.leaderboard_players where player_id = v_player;
  end if;

  return exists (select 1 from game_private.leaderboard_players where player_id = v_player);
end;
$$;

create function public.get_verified_leaderboard(p_mode text)
returns table (rank bigint, username text, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  with best_scores as (
    select p.username, max(r.score) as score
    from game_private.leaderboard_players opted_in
    join public.profiles p on p.id = opted_in.player_id
    join public.verified_game_results r on r.player_id = opted_in.player_id
    where r.mode = p_mode and r.scoring_version = 1 and r.score > 0
      and p.username ~ '^[A-Za-z0-9_]{3,20}$'
    group by p.id, p.username
  )
  select rank() over (order by b.score desc), b.username, b.score
  from best_scores b
  order by b.score desc, lower(b.username)
  limit 20;
$$;

revoke execute on function public.leaderboard_visibility(boolean) from public, anon, authenticated;
grant execute on function public.leaderboard_visibility(boolean) to authenticated;
revoke execute on function public.get_verified_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_verified_leaderboard(text) to anon, authenticated;

commit;
