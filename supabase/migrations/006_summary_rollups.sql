-- ── 006_summary_rollups.sql ─────────────────────────────────────────
-- Fills the gap left by 002_triggers.sql:
--   • drops unique(level_id, attempt_number) — client retries reuse attempt_number=1
--   • guards first_attempt_* against direct UPDATE
--   • populates week_summary and student_summary when level_summary changes

-- ── 1. Drop the retry-blocking constraint ───────────────────────────
alter table public.level_attempts
  drop constraint if exists level_attempts_level_id_attempt_number_key;

-- ── 2. Enforce first_attempt_* immutability (defence in depth) ──────
create or replace function public.lock_first_attempt() returns trigger
language plpgsql as $$
begin
  if old.first_attempt_score is distinct from new.first_attempt_score
     or old.first_attempt_accuracy is distinct from new.first_attempt_accuracy then
    raise exception 'first_attempt_* is immutable (§14.6)';
  end if;
  return new;
end $$;

drop trigger if exists trg_lock_first_attempt on public.level_summary;
create trigger trg_lock_first_attempt
before update on public.level_summary
for each row execute function public.lock_first_attempt();

-- ── 3. Populate week_summary on level_summary changes ───────────────
create or replace function public.refresh_week_summary() returns trigger
language plpgsql as $$
begin
  insert into public.week_summary as ws (
    student_id, week, levels_played, total_level_repeats,
    mean_first_attempt_score, mean_best_score,
    total_errors, total_hints)
  select ls.student_id, ls.week,
         1, ls.repeats_this_level,
         ls.first_attempt_score, ls.best_score,
         ls.total_errors, ls.total_hints
  from public.level_summary ls
  where ls.level_id = new.level_id
  on conflict (student_id, week) do update set
    levels_played            = (select count(*) from public.level_summary
                                 where student_id = ws.student_id and week = ws.week),
    total_level_repeats      = (select sum(repeats_this_level) from public.level_summary
                                 where student_id = ws.student_id and week = ws.week),
    mean_first_attempt_score = (select round(avg(first_attempt_score)::numeric, 4)
                                 from public.level_summary
                                 where student_id = ws.student_id and week = ws.week),
    mean_best_score          = (select round(avg(best_score)::numeric, 4)
                                 from public.level_summary
                                 where student_id = ws.student_id and week = ws.week),
    total_errors             = (select sum(total_errors) from public.level_summary
                                 where student_id = ws.student_id and week = ws.week),
    total_hints              = (select sum(total_hints) from public.level_summary
                                 where student_id = ws.student_id and week = ws.week);
  return new;
end $$;

drop trigger if exists trg_level_week_rollup on public.level_summary;
create trigger trg_level_week_rollup
after insert or update on public.level_summary
for each row execute function public.refresh_week_summary();

-- ── 4. Populate student_summary on level_summary changes ────────────
create or replace function public.refresh_student_summary() returns trigger
language plpgsql as $$
begin
  insert into public.student_summary as ss (
    student_id, levels_played, total_level_repeats,
    levels_repeated_at_least_once, overall_repeat_rate,
    mean_first_attempt_score, mean_best_score,
    total_errors, total_hints, total_activity_retries, total_time_sec)
  select
    ls.student_id,
    count(*),
    sum(ls.repeats_this_level),
    count(*) filter (where ls.repeats_this_level > 0),
    round((sum(ls.repeats_this_level)::numeric / nullif(count(*),0))::numeric, 4),
    round(avg(ls.first_attempt_score)::numeric, 4),
    round(avg(ls.best_score)::numeric, 4),
    sum(ls.total_errors),
    sum(ls.total_hints),
    sum(ls.total_activity_retries),
    sum(ls.total_time_sec)
  from public.level_summary ls
  where ls.student_id = new.student_id
  group by ls.student_id
  on conflict (student_id) do update set
    levels_played                 = excluded.levels_played,
    total_level_repeats           = excluded.total_level_repeats,
    levels_repeated_at_least_once = excluded.levels_repeated_at_least_once,
    overall_repeat_rate           = excluded.overall_repeat_rate,
    mean_first_attempt_score      = excluded.mean_first_attempt_score,
    mean_best_score               = excluded.mean_best_score,
    total_errors                  = excluded.total_errors,
    total_hints                   = excluded.total_hints,
    total_activity_retries        = excluded.total_activity_retries,
    total_time_sec                = excluded.total_time_sec;
  return new;
end $$;

drop trigger if exists trg_level_student_rollup on public.level_summary;
create trigger trg_level_student_rollup
after insert or update on public.level_summary
for each row execute function public.refresh_student_summary();