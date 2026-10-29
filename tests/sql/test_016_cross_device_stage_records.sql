-- Verify separate devices can sync level rows sharing their former local
-- level_index. The synthetic rows roll back inside the exception subtransaction.
do $$
declare
  test_student text := 'P-' || upper(encode(gen_random_bytes(12), 'hex'));
  first_level uuid := gen_random_uuid();
  second_level uuid := gen_random_uuid();
begin
  begin
    insert into public.students(student_id, enrollment_status)
      values (test_student, 'unknown');
    insert into public.levels(
      level_id, student_id, week, level_index, stage_number,
      difficulty_assigned, difficulty_served, game_type, map_id, sprite_ids,
      fingerprint, verification_result, pool_status, generated_at
    ) values
      (first_level, test_student, 1, 0, 1, 'standard', 'standard', 'device-a',
       'test-map', '[]'::jsonb, 'device-a', 'pass', 'test', now()),
      (second_level, test_student, 1, 0, 1, 'standard', 'standard', 'device-b',
       'test-map', '[]'::jsonb, 'device-b', 'pass', 'test', now());

    if (select count(*) from public.levels where student_id=test_student and level_index=0) <> 2 then
      raise exception 'same-stage level rows from separate devices were not both retained';
    end if;
    raise exception using errcode = 'P0001', message = 'rollback_test_done';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback_test_done' then raise; end if;
  end;
end;
$$;
