-- Run against a local or staging database after applying the migration. Rolls back all fixtures.
begin;
set local plpgsql.check_asserts = on;

do $$
declare
  v_result jsonb;
begin
  set local role anon;
  begin
    perform public.sync_profile('nobody');
    raise exception 'Anonymous call unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- A stale development-instance account already holds the name.
  insert into public.profiles (id, username) values ('user_test_old', 'test_trainer');

  -- Without a verified claim, a taken name is refused but the row is still created.
  perform set_config('request.jwt.claims', '{"sub":"user_test_new","role":"authenticated"}', true);
  set local role authenticated;
  v_result := public.sync_profile('Test_Trainer');
  assert v_result ->> 'status' = 'username_taken', v_result::text;
  assert v_result ->> 'username' is null;
  assert (select count(*) from public.profiles where id = 'user_test_new') = 1;
  begin
    insert into public.profiles (id, username) values ('user_test_new', 'direct_write');
    raise exception 'Direct profile write unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set username = 'direct_write' where id = 'user_test_new';
    raise exception 'Direct profile update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.profiles) = 1, 'Players can read only their own profile';

  v_result := public.sync_profile('fresh_name');
  assert v_result ->> 'status' = 'saved' and v_result ->> 'username' = 'fresh_name', v_result::text;
  v_result := public.sync_profile('not a valid name!');
  assert v_result ->> 'status' = 'username_invalid' and v_result ->> 'username' = 'fresh_name', v_result::text;
  reset role;

  -- With Clerk's verified claim, the stale holder releases the name.
  perform set_config('request.jwt.claims',
    '{"sub":"user_test_new","role":"authenticated","username":"test_trainer"}', true);
  set local role authenticated;
  v_result := public.sync_profile('ignored_client_value');
  assert v_result ->> 'status' = 'saved' and v_result ->> 'username' = 'test_trainer', v_result::text;
  reset role;
  assert (select username from public.profiles where id = 'user_test_old') is null;
  assert (select username from public.profiles where id = 'user_test_new') = 'test_trainer';

  -- A player without any username still gets a profile row.
  perform set_config('request.jwt.claims', '{"sub":"user_test_nameless","role":"authenticated"}', true);
  set local role authenticated;
  v_result := public.sync_profile(null);
  assert v_result ->> 'status' = 'saved' and v_result ->> 'username' is null, v_result::text;
  reset role;
end;
$$;

rollback;
