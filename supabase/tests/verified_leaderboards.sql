-- Run after applying all migrations. Rolls back the fixtures.
begin;
set local plpgsql.check_asserts = on;

insert into public.profiles (id, username) values
  ('leaderboard_test_a', 'leaderboard_test_a'),
  ('leaderboard_test_b', 'leaderboard_test_b'),
  ('leaderboard_test_c', 'leaderboard_test_c');

with fixtures(player_id, mode, score, version) as (values
  ('leaderboard_test_a', 'regular', 2500, 1),
  ('leaderboard_test_a', 'hard', 1400, 1),
  ('leaderboard_test_b', 'regular', 2500, 1),
  ('leaderboard_test_c', 'regular', 4500, 1)
), runs as (
  insert into game_private.runs (player_id, mode, expires_at, completed_at)
  select player_id, mode, now(), now() from fixtures group by player_id, mode
  returning id, player_id, mode
)
insert into public.verified_game_results
  (run_id, player_id, mode, score, correct_count, scoring_version, completed_at)
select r.id, r.player_id, r.mode, f.score, 3, f.version, now()
from runs r join fixtures f using (player_id, mode);

-- Add repeat games on distinct runs for the same players.
with runs as (
  insert into game_private.runs (player_id, mode, expires_at, completed_at)
  values ('leaderboard_test_a', 'regular', now(), now()), ('leaderboard_test_b', 'regular', now(), now())
  returning id, player_id, mode
)
insert into public.verified_game_results
  (run_id, player_id, mode, score, correct_count, scoring_version, completed_at)
select id, player_id, mode,
  case when player_id = 'leaderboard_test_a' then 2000 else 5000 end,
  3, case when player_id = 'leaderboard_test_a' then 1 else 2 end, now()
from runs;

do $$
begin
  set local role anon;
  assert not exists (select 1 from public.get_verified_leaderboard('regular') where username like 'leaderboard_test_%');
  begin
    perform public.leaderboard_visibility(true);
    raise exception 'Anonymous visibility write unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"leaderboard_test_a"}', true);
  set local role authenticated;
  assert not public.leaderboard_visibility();
  assert public.leaderboard_visibility(true);
  assert public.leaderboard_visibility(true);
  begin
    insert into game_private.leaderboard_players values ('leaderboard_test_c');
    raise exception 'Direct opt-in write unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"leaderboard_test_b"}', true);
  set local role authenticated;
  assert public.leaderboard_visibility(true);
  reset role;

  set local role anon;
  assert (select count(*) from public.get_verified_leaderboard('regular')
    where username in ('leaderboard_test_a', 'leaderboard_test_b') and score = 2500) = 2;
  assert (select count(*) from public.get_verified_leaderboard('regular')
    where username = 'leaderboard_test_a') = 1;
  assert (select count(distinct rank) from public.get_verified_leaderboard('regular')
    where username in ('leaderboard_test_a', 'leaderboard_test_b')) = 1;
  assert not exists (select 1 from public.get_verified_leaderboard('regular') where username = 'leaderboard_test_c');
  assert exists (select 1 from public.get_verified_leaderboard('hard') where username = 'leaderboard_test_a' and score = 1400);
  reset role;

  set local role authenticated;
  assert not public.leaderboard_visibility(false);
  assert not exists (select 1 from public.get_verified_leaderboard('regular') where username = 'leaderboard_test_b');
  assert exists (select 1 from public.verified_game_results where player_id = 'leaderboard_test_b');
end;
$$;

rollback;
