begin;

create schema game_private;
revoke all on schema game_private from public, anon, authenticated;

create table game_private.pokemon (
  id smallint primary key,
  name text not null,
  normalized_name text not null unique
);

-- Matches the playable sprite pool in src/pokemon.ts.
insert into game_private.pokemon (id, name, normalized_name) values
  (1, 'Bulbasaur', 'bulbasaur'),
  (2, 'Ivysaur', 'ivysaur'),
  (3, 'Venusaur', 'venusaur'),
  (4, 'Charmander', 'charmander'),
  (5, 'Charmeleon', 'charmeleon'),
  (6, 'Charizard', 'charizard'),
  (7, 'Squirtle', 'squirtle'),
  (8, 'Wartortle', 'wartortle'),
  (9, 'Blastoise', 'blastoise'),
  (10, 'Caterpie', 'caterpie'),
  (12, 'Butterfree', 'butterfree'),
  (16, 'Pidgey', 'pidgey'),
  (18, 'Pidgeot', 'pidgeot'),
  (19, 'Rattata', 'rattata'),
  (20, 'Raticate', 'raticate'),
  (21, 'Spearow', 'spearow'),
  (22, 'Fearow', 'fearow'),
  (23, 'Ekans', 'ekans'),
  (24, 'Arbok', 'arbok'),
  (25, 'Pikachu', 'pikachu'),
  (26, 'Raichu', 'raichu'),
  (27, 'Sandshrew', 'sandshrew'),
  (28, 'Sandslash', 'sandslash'),
  (35, 'Clefairy', 'clefairy'),
  (36, 'Clefable', 'clefable'),
  (37, 'Vulpix', 'vulpix'),
  (38, 'Ninetales', 'ninetales'),
  (39, 'Jigglypuff', 'jigglypuff'),
  (40, 'Wigglytuff', 'wigglytuff'),
  (41, 'Zubat', 'zubat'),
  (42, 'Golbat', 'golbat'),
  (43, 'Oddish', 'oddish'),
  (44, 'Gloom', 'gloom'),
  (45, 'Vileplume', 'vileplume'),
  (46, 'Paras', 'paras'),
  (47, 'Parasect', 'parasect'),
  (48, 'Venonat', 'venonat'),
  (49, 'Venomoth', 'venomoth'),
  (50, 'Diglett', 'diglett'),
  (51, 'Dugtrio', 'dugtrio'),
  (52, 'Meowth', 'meowth'),
  (53, 'Persian', 'persian'),
  (54, 'Psyduck', 'psyduck'),
  (55, 'Golduck', 'golduck'),
  (56, 'Mankey', 'mankey'),
  (57, 'Primeape', 'primeape'),
  (58, 'Growlithe', 'growlithe'),
  (59, 'Arcanine', 'arcanine'),
  (60, 'Poliwag', 'poliwag'),
  (61, 'Poliwhirl', 'poliwhirl'),
  (62, 'Poliwrath', 'poliwrath'),
  (63, 'Abra', 'abra'),
  (64, 'Kadabra', 'kadabra'),
  (65, 'Alakazam', 'alakazam'),
  (66, 'Machop', 'machop'),
  (67, 'Machoke', 'machoke'),
  (68, 'Machamp', 'machamp'),
  (69, 'Bellsprout', 'bellsprout'),
  (70, 'Weepinbell', 'weepinbell'),
  (71, 'Victreebel', 'victreebel'),
  (72, 'Tentacool', 'tentacool'),
  (73, 'Tentacruel', 'tentacruel'),
  (74, 'Geodude', 'geodude'),
  (75, 'Graveler', 'graveler'),
  (76, 'Golem', 'golem'),
  (77, 'Ponyta', 'ponyta'),
  (78, 'Rapidash', 'rapidash'),
  (79, 'Slowpoke', 'slowpoke'),
  (80, 'Slowbro', 'slowbro'),
  (81, 'Magnemite', 'magnemite'),
  (82, 'Magneton', 'magneton'),
  (83, 'Farfetch’d', 'farfetchd'),
  (84, 'Doduo', 'doduo'),
  (85, 'Dodrio', 'dodrio'),
  (86, 'Seel', 'seel'),
  (87, 'Dewgong', 'dewgong'),
  (88, 'Grimer', 'grimer'),
  (89, 'Muk', 'muk'),
  (90, 'Shellder', 'shellder'),
  (91, 'Cloyster', 'cloyster'),
  (92, 'Gastly', 'gastly'),
  (93, 'Haunter', 'haunter'),
  (94, 'Gengar', 'gengar'),
  (95, 'Onix', 'onix'),
  (96, 'Drowzee', 'drowzee'),
  (97, 'Hypno', 'hypno'),
  (98, 'Krabby', 'krabby'),
  (99, 'Kingler', 'kingler'),
  (100, 'Voltorb', 'voltorb'),
  (101, 'Electrode', 'electrode'),
  (102, 'Exeggcute', 'exeggcute'),
  (103, 'Exeggutor', 'exeggutor'),
  (104, 'Cubone', 'cubone'),
  (105, 'Marowak', 'marowak'),
  (106, 'Hitmonlee', 'hitmonlee'),
  (107, 'Hitmonchan', 'hitmonchan'),
  (108, 'Lickitung', 'lickitung'),
  (109, 'Koffing', 'koffing'),
  (110, 'Weezing', 'weezing'),
  (111, 'Rhyhorn', 'rhyhorn'),
  (112, 'Rhydon', 'rhydon'),
  (113, 'Chansey', 'chansey'),
  (114, 'Tangela', 'tangela'),
  (115, 'Kangaskhan', 'kangaskhan'),
  (116, 'Horsea', 'horsea'),
  (117, 'Seadra', 'seadra'),
  (118, 'Goldeen', 'goldeen'),
  (119, 'Seaking', 'seaking'),
  (120, 'Staryu', 'staryu'),
  (121, 'Starmie', 'starmie'),
  (122, 'Mr. Mime', 'mrmime'),
  (123, 'Scyther', 'scyther'),
  (124, 'Jynx', 'jynx'),
  (125, 'Electabuzz', 'electabuzz'),
  (126, 'Magmar', 'magmar'),
  (127, 'Pinsir', 'pinsir'),
  (128, 'Tauros', 'tauros'),
  (129, 'Magikarp', 'magikarp'),
  (130, 'Gyarados', 'gyarados'),
  (131, 'Lapras', 'lapras'),
  (132, 'Ditto', 'ditto'),
  (133, 'Eevee', 'eevee'),
  (134, 'Vaporeon', 'vaporeon'),
  (135, 'Jolteon', 'jolteon'),
  (136, 'Flareon', 'flareon'),
  (137, 'Porygon', 'porygon'),
  (138, 'Omanyte', 'omanyte'),
  (139, 'Omastar', 'omastar'),
  (140, 'Kabuto', 'kabuto'),
  (141, 'Kabutops', 'kabutops'),
  (142, 'Aerodactyl', 'aerodactyl'),
  (143, 'Snorlax', 'snorlax'),
  (144, 'Articuno', 'articuno'),
  (145, 'Zapdos', 'zapdos'),
  (146, 'Moltres', 'moltres'),
  (147, 'Dratini', 'dratini'),
  (148, 'Dragonair', 'dragonair'),
  (149, 'Dragonite', 'dragonite'),
  (150, 'Mewtwo', 'mewtwo'),
  (151, 'Mew', 'mew');

create table game_private.runs (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  mode text not null check (mode in ('regular', 'hard')),
  round_number smallint not null default 1 check (round_number between 1 and 5),
  expires_at timestamptz not null,
  completed_at timestamptz
);

create unique index one_unfinished_run_per_player
  on game_private.runs (player_id) where completed_at is null;

create table game_private.rounds (
  run_id uuid not null references game_private.runs on delete cascade,
  number smallint not null check (number between 1 and 5),
  pokemon_id smallint not null references game_private.pokemon,
  choices smallint[],
  deadline timestamptz,
  outcome text check (outcome in ('correct', 'incorrect', 'skipped', 'timeout')),
  points integer check (points between 0 and 1000),
  primary key (run_id, number),
  unique (run_id, pokemon_id)
);

create table public.game_results (
  run_id uuid primary key references game_private.runs,
  player_id text not null,
  mode text not null check (mode in ('regular', 'hard')),
  score integer not null check (score between 0 and 5000),
  correct_count integer not null check (correct_count between 0 and 5),
  scoring_version integer not null,
  completed_at timestamptz not null
);

create index game_results_player_completed
  on public.game_results (player_id, completed_at desc);

alter table public.game_results enable row level security;
revoke all on public.game_results from public, anon, authenticated;
grant select on public.game_results to authenticated;
create policy read_own_game_results on public.game_results
  for select to authenticated using (player_id = (select auth.jwt() ->> 'sub'));

-- Every mutation uses the authenticated subject and the locked run row.
-- The expected round number prevents a retried request from advancing a later round.
create function public.play_verified_game(
  p_action text,
  p_mode text default null,
  p_run_id uuid default null,
  p_round integer default null,
  p_guess text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player text := nullif(auth.jwt() ->> 'sub', '');
  v_run game_private.runs%rowtype;
  v_round game_private.rounds%rowtype;
  v_now timestamptz;
  v_score integer;
  v_correct integer;
  v_points integer;
  v_name text;
  v_outcome text;
  v_feedback text;
  v_results jsonb;
begin
  if v_player is null then
    raise exception 'Sign in to play a verified game' using errcode = '42501';
  end if;

  if p_action = 'start' then
    if p_mode is null or p_mode not in ('regular', 'hard') then
      raise exception 'Invalid game mode' using errcode = '22023';
    end if;

    -- Serialize initial creation even when the player has no row to lock yet.
    perform pg_advisory_xact_lock(hashtextextended(v_player, 0));
    delete from game_private.runs
      where player_id = v_player and completed_at is null and expires_at <= clock_timestamp();
    select * into v_run from game_private.runs
      where player_id = v_player and completed_at is null for update;

    if not found then
      insert into game_private.runs (player_id, mode, expires_at)
      values (v_player, p_mode, clock_timestamp() + interval '30 minutes')
      returning * into v_run;

      insert into game_private.rounds (run_id, number, pokemon_id, choices)
      select v_run.id, answers.number, answers.id,
        case when p_mode = 'regular' then array(
          select options.id
          from (
            select answers.id
            union all
            select distractors.id from (
              select id from game_private.pokemon where id <> answers.id order by random() limit 3
            ) distractors
          ) options order by random()
        ) end
      from (
        select id, row_number() over () as number
        from (select id from game_private.pokemon order by random() limit 5) picked
      ) answers;
    elsif v_run.mode <> p_mode then
      raise exception 'Resume your active game in its original mode' using errcode = '22023';
    end if;
  else
    if p_action is null or p_action not in ('open', 'guess', 'skip', 'next', 'status') then
      raise exception 'Invalid game action' using errcode = '22023';
    end if;
    select * into v_run from game_private.runs
      where id = p_run_id and player_id = v_player for update;
    if not found or (v_run.completed_at is null and v_run.expires_at <= clock_timestamp()) then
      raise exception 'Game not found or expired' using errcode = '22023';
    end if;
  end if;

  select * into strict v_round from game_private.rounds
    where run_id = v_run.id and number = v_run.round_number;
  v_now := clock_timestamp();

  -- A status call also settles an expired round so reloads can resume safely.
  if v_round.outcome is null and v_round.deadline <= v_now then
    v_outcome := 'timeout';
  end if;

  if p_round = v_round.number and v_outcome is null then
    if p_action = 'open' and v_round.deadline is null then
      update game_private.rounds set deadline = v_now + interval '10 seconds'
        where run_id = v_run.id and number = v_round.number returning * into v_round;
    elsif p_action in ('guess', 'skip') and v_round.deadline is not null and v_round.outcome is null then
      if p_action = 'skip' then
        v_outcome := 'skipped';
      elsif p_guess is null or length(p_guess) > 100 or btrim(p_guess) = '' then
        raise exception 'Invalid guess' using errcode = '22023';
      elsif v_run.mode = 'regular' then
        if not exists (select 1 from unnest(v_round.choices) as choice(id) where choice.id::text = p_guess) then
          raise exception 'Guess must be one of the round choices' using errcode = '22023';
        end if;
        v_outcome := case when p_guess = v_round.pokemon_id::text then 'correct' else 'incorrect' end;
      elsif exists (
        select 1 from game_private.pokemon
        where id = v_round.pokemon_id
          and normalized_name = regexp_replace(lower(normalize(p_guess, NFKD)), '[^a-z0-9]', '', 'g')
      ) then
        v_outcome := 'correct';
      else
        v_feedback := 'try_again';
      end if;
    elsif p_action = 'next' and v_round.outcome is not null and v_run.completed_at is null then
      update game_private.runs set round_number = round_number + 1
        where id = v_run.id returning * into v_run;
      select * into strict v_round from game_private.rounds
        where run_id = v_run.id and number = v_run.round_number;
    end if;
  end if;

  if v_outcome is not null then
    v_points := case when v_outcome = 'correct' then
      least(1000, ceil(extract(epoch from (v_round.deadline - v_now)) * 100)::integer)
      else 0 end;
    update game_private.rounds set outcome = v_outcome, points = v_points
      where run_id = v_run.id and number = v_round.number returning * into v_round;
  end if;

  select coalesce(sum(points), 0), count(*) filter (where outcome = 'correct')
    into v_score, v_correct from game_private.rounds where run_id = v_run.id;

  if v_outcome is not null and v_round.number = 5 then
    update game_private.runs set completed_at = v_now where id = v_run.id returning * into v_run;
    insert into public.game_results (run_id, player_id, mode, score, correct_count, scoring_version, completed_at)
      values (v_run.id, v_player, v_run.mode, v_score, v_correct, 1, v_run.completed_at);
  end if;

  if v_round.outcome is not null then
    select name into v_name from game_private.pokemon where id = v_round.pokemon_id;
  end if;

  if v_run.completed_at is not null then
    select jsonb_agg(jsonb_build_object(
      'round', r.number, 'answer', p.name, 'outcome', r.outcome, 'points', r.points
    ) order by r.number) into v_results
    from game_private.rounds r join game_private.pokemon p on p.id = r.pokemon_id
    where r.run_id = v_run.id;
  end if;

  return jsonb_build_object(
    'runId', v_run.id,
    'mode', v_run.mode,
    'round', v_round.number,
    'spriteId', case when v_round.deadline is not null then v_round.pokemon_id end,
    'choices', case when v_round.deadline is not null then v_round.choices end,
    'deadline', v_round.deadline,
    'serverTime', v_now,
    'outcome', v_round.outcome,
    'roundPoints', v_round.points,
    'answer', v_name,
    'feedback', v_feedback,
    'score', v_score,
    'correctCount', v_correct,
    'completed', v_run.completed_at is not null,
    'results', v_results
  );
end;
$$;

revoke execute on function public.play_verified_game(text, text, uuid, integer, text) from public, anon;
grant execute on function public.play_verified_game(text, text, uuid, integer, text) to authenticated;

commit;
