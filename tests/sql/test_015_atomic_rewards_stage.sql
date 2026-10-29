-- The single DO statement runs the synthetic records inside a PL/pgSQL
-- exception subtransaction and deliberately aborts that subtransaction at the
-- end. It is safe to execute with Supabase's prepared-statement query tool.
do $$
declare
  test_student text := 'P-' || upper(encode(gen_random_bytes(12), 'hex'));
  duplicate_student text := 'P-' || upper(encode(gen_random_bytes(12), 'hex'));
  test_level uuid := gen_random_uuid();
  failed_attempt uuid := gen_random_uuid();
  successful_attempt uuid := gen_random_uuid();
  reward_transaction uuid := gen_random_uuid();
  duplicate_reward_transaction uuid := gen_random_uuid();
  registration jsonb;
  reward jsonb;
  duplicate_reward jsonb;
begin
  begin
  registration := public.register_app_account_atomic(
    test_student, 'migration015_' || lower(substr(replace(test_student, 'P-', ''), 1, 12)),
    'TEST-' || substr(replace(test_student, 'P-', ''), 1, 12),
    'pbkdf2_sha256$310000$YWJjZA$YWJjZA', gen_random_uuid()
  );
  if (registration ->> 'balance')::integer <> 20 then
    raise exception 'expected initial balance 20';
  end if;

  insert into public.levels(
    level_id, student_id, week, level_index, stage_number,
    difficulty_assigned, difficulty_served, game_type, map_id, sprite_ids,
    fingerprint, verification_result, pool_status, generated_at
  ) values (
    test_level, test_student, 1, 0, 1, 'standard', 'standard', 'migration-smoke',
    'migration-smoke', '[]'::jsonb, 'migration015-smoke', 'pass', 'test', now()
  );
  insert into public.level_attempts(
    attempt_id, level_id, student_id, attempt_number, is_replay, score, accuracy,
    in_activity_attempts, error_count, completion_time_sec, hint_count,
    activity_retries, completed, started_at, ended_at, status, restart_count,
    question_retry_count, origin
  ) values
    (failed_attempt, test_level, test_student, 1, false, 0.2, 0.2, 1, 3, 20, 0, 0, false,
     now() - interval '1 minute', now() - interval '40 seconds', 'failed', 0, 0, 'online'),
    (successful_attempt, test_level, test_student, 2, false, 0.9, 0.9, 1, 0, 20, 0, 0, true,
     now() - interval '30 seconds', now(), 'completed', 0, 0, 'online');

  reward := public.apply_coin_transaction(
    reward_transaction, test_student, 10, 'first_level_completion_reward',
    'gameplay', test_level, successful_attempt
  );
  if reward ->> 'duplicate' <> 'false' or (reward ->> 'balance')::integer <> 30 then
    raise exception 'first successful clear did not award 10 coins after a failed attempt';
  end if;
  duplicate_reward := public.apply_coin_transaction(
    reward_transaction, test_student, 10, 'first_level_completion_reward',
    'gameplay', test_level, successful_attempt
  );
  if duplicate_reward ->> 'duplicate' <> 'true' or (duplicate_reward ->> 'balance')::integer <> 30 then
    raise exception 'same reward retry was not idempotent';
  end if;
  duplicate_reward := public.apply_coin_transaction(
    duplicate_reward_transaction, test_student, 10, 'first_level_completion_reward',
    'gameplay', test_level, successful_attempt
  );
  if duplicate_reward ->> 'duplicate' <> 'true' or (duplicate_reward ->> 'balance')::integer <> 30 then
    raise exception 'second reward transaction duplicated the first-clear reward';
  end if;

  begin
    perform public.register_app_account_atomic(
      duplicate_student,
      'migration015_' || lower(substr(replace(test_student, 'P-', ''), 1, 12)),
      'TEST-DUP-' || substr(replace(duplicate_student, 'P-', ''), 1, 12),
      'pbkdf2_sha256$310000$YWJjZA$YWJjZA', gen_random_uuid()
    );
    raise exception 'duplicate registration unexpectedly succeeded';
  exception when unique_violation then
    if exists (select 1 from public.students where student_id = duplicate_student)
      or exists (select 1 from public.coin_transactions where student_id = duplicate_student) then
      raise exception 'failed duplicate registration left partial rows';
    end if;
  end;

  if (select count(*) from public.coin_transactions where student_id = test_student) <> 2 then
    raise exception 'unexpected test ledger row count';
  end if;
    raise exception using errcode = 'P0001', message = 'rollback_test_done';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback_test_done' then
      raise;
    end if;
  end;
end;
$$;
