-- §14.6 Trigger — immutable first attempt, derived repeats.
create or replace function public.refresh_level_summary() returns trigger
language plpgsql as $$
begin
  insert into public.level_summary as ls (
    level_id, student_id, week, level_index,
    first_attempt_score, first_attempt_accuracy, best_score,
    total_attempts, repeats_this_level,
    total_errors, total_hints, total_activity_retries,
    total_time_sec, completed_any)
  select l.level_id, l.student_id, l.week, l.level_index,
         a.score, a.accuracy, a.score, 1, 0,
         a.error_count, a.hint_count, a.activity_retries,
         coalesce(a.completion_time_sec,0), a.completed
  from public.levels l
  join public.level_attempts a on a.level_id = l.level_id
  where l.level_id = new.level_id and a.attempt_id = new.attempt_id
  on conflict (level_id) do update set
    -- first_attempt_* deliberately ABSENT: immutability enforced here
    best_score             = greatest(ls.best_score, excluded.best_score),
    total_attempts         = ls.total_attempts + 1,
    repeats_this_level     = ls.total_attempts + 1 - 1, -- §2.10: derived from total
    total_errors           = ls.total_errors + new.error_count,
    total_hints            = ls.total_hints + new.hint_count,
    total_activity_retries = ls.total_activity_retries + new.activity_retries,
    total_time_sec         = ls.total_time_sec + coalesce(new.completion_time_sec,0),
    completed_any          = ls.completed_any or new.completed;
  return new;
end $$;

drop trigger if exists trg_attempt_rollup on public.level_attempts;
create trigger trg_attempt_rollup
after insert on public.level_attempts
for each row execute function public.refresh_level_summary();