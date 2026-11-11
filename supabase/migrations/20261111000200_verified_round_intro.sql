begin;

-- Signed-in rounds get the same Poké Ball intro as guest rounds. Opening a round now reveals the
-- sprite 1.6 s before the 10 s answer window starts, so the intro and the sprite download no longer
-- use up answer time. Only the deadline set by 'open' changes.
-- Every mutation uses the authenticated subject and the locked run row.
-- The expected round number prevents a retried request from advancing a later round.
create or replace function public.play_verified_game(
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
      -- 1.6 s for the Poké Ball intro, then the 10 s answer window. The sprite downloads during the
      -- intro, and points are capped at 1,000, so answering inside the intro gains nothing.
      update game_private.rounds set deadline = v_now + interval '11.6 seconds'
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
    insert into public.verified_game_results (run_id, player_id, mode, score, correct_count, scoring_version, completed_at)
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
