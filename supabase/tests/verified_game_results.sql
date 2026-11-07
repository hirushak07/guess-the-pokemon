-- Run against a local database after applying the migration. Rolls back all fixtures.
begin;
set local plpgsql.check_asserts = on;

do $$
declare
  v_state jsonb;
  v_id uuid;
  v_answer text;
  v_choice text;
  v_deadline text;
  v_first_round_points integer;
  v_count integer;
begin
  set local role anon;
  begin
    perform public.play_verified_game('start', 'regular');
    raise exception 'Anonymous call unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"user_test_owner","role":"authenticated"}', true);
  set local role authenticated;
  v_state := public.play_verified_game('start', 'regular');
  v_id := (v_state ->> 'runId')::uuid;
  assert v_state ->> 'deadline' is null and v_state ->> 'answer' is null;
  assert v_state ->> 'spriteId' is null and v_state ->> 'choices' is null;
  assert (public.play_verified_game('start', 'regular') ->> 'runId')::uuid = v_id;
  assert public.play_verified_game('start', 'hard') ->> 'mode' = 'regular';
  assert (public.play_verified_game('guess', null, v_id, 1, '25') ->> 'outcome') is null;
  begin
    perform 1 from game_private.rounds;
    raise exception 'Private rounds unexpectedly readable';
  exception when insufficient_privilege then null;
  end;

  v_state := public.play_verified_game('open', null, v_id, 1);
  v_deadline := v_state ->> 'deadline';
  assert v_deadline is not null;
  assert jsonb_array_length(v_state -> 'choices') = 4;
  assert v_state -> 'choices' @> jsonb_build_array(v_state -> 'spriteId');
  assert public.play_verified_game('open', null, v_id, 1) ->> 'deadline' = v_deadline;
  begin
    perform public.play_verified_game('guess', null, v_id, 1, '999');
    raise exception 'Out-of-round choice unexpectedly accepted';
  exception when invalid_parameter_value then null;
  end;

  reset role;
  update game_private.rounds set deadline = clock_timestamp() + interval '7 seconds'
    where run_id = v_id and number = 1;
  set local role authenticated;
  v_state := public.play_verified_game('guess', null, v_id, 1, v_state ->> 'spriteId');
  assert v_state ->> 'outcome' = 'correct';
  v_first_round_points := (v_state ->> 'roundPoints')::integer;
  assert v_first_round_points between 600 and 700;
  assert (public.play_verified_game('skip', null, v_id, 1) ->> 'score')::integer = v_first_round_points;

  for round in 2..5 loop
    v_state := public.play_verified_game('next', null, v_id, round - 1);
    assert (v_state ->> 'round')::integer = round;
    assert (public.play_verified_game('next', null, v_id, round - 1) ->> 'round')::integer = round;
    v_state := public.play_verified_game('open', null, v_id, round);

    if round = 2 then
      reset role;
      update game_private.rounds set deadline = clock_timestamp() - interval '1 millisecond'
        where run_id = v_id and number = round;
      set local role authenticated;
      v_state := public.play_verified_game('guess', null, v_id, round, v_state ->> 'spriteId');
      assert v_state ->> 'outcome' = 'timeout';
    elsif round = 3 then
      select choice into v_choice from jsonb_array_elements_text(v_state -> 'choices') choice
        where choice <> v_state ->> 'spriteId' limit 1;
      v_state := public.play_verified_game('guess', null, v_id, round, v_choice);
      assert v_state ->> 'outcome' = 'incorrect';
    else
      v_state := public.play_verified_game('skip', null, v_id, round);
      assert v_state ->> 'outcome' = 'skipped';
    end if;
    assert (v_state ->> 'roundPoints')::integer = 0;
  end loop;
  assert (v_state ->> 'completed')::boolean;
  assert jsonb_array_length(v_state -> 'results') = 5;
  assert (select count(distinct result ->> 'answer') from jsonb_array_elements(v_state -> 'results') result) = 5;
  assert (public.play_verified_game('skip', null, v_id, 5) ->> 'completed')::boolean;
  select count(*) into v_count from public.verified_game_results where run_id = v_id;
  assert v_count = 1;
  assert exists (select 1 from public.verified_game_results where run_id = v_id and score = v_first_round_points and correct_count = 1);
  begin
    update public.verified_game_results set score = 5000 where run_id = v_id;
    raise exception 'Direct score edit unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '{"sub":"user_test_other","role":"authenticated"}', true);
  assert not exists (select 1 from public.verified_game_results where run_id = v_id);
  begin
    perform public.play_verified_game('status', null, v_id);
    raise exception 'Another player unexpectedly accessed the run';
  exception when invalid_parameter_value then null;
  end;

  v_state := public.play_verified_game('start', 'hard');
  v_id := (v_state ->> 'runId')::uuid;
  v_state := public.play_verified_game('open', null, v_id, 1);
  assert v_state ->> 'choices' is null;
  v_deadline := v_state ->> 'deadline';
  v_state := public.play_verified_game('guess', null, v_id, 1, 'wrong');
  assert v_state ->> 'feedback' = 'try_again' and v_state ->> 'deadline' = v_deadline;
  reset role;
  select upper(name) into v_answer from game_private.pokemon where id = (v_state ->> 'spriteId')::integer;
  set local role authenticated;
  v_state := public.play_verified_game('guess', null, v_id, 1, '  ' || v_answer || '  ');
  assert v_state ->> 'outcome' = 'correct';
  reset role;
end;
$$;

rollback;
