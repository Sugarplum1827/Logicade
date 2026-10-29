-- Level identity is the UUID; level_index was only a local ordering aid.
-- Requiring that local number to be unique blocked distinct devices from
-- synchronizing their level rows for the same participant. Curriculum stage
-- identity is now explicit in levels.stage_number (migration 015).
alter table public.levels
  drop constraint if exists levels_student_id_level_index_key;

create or replace view public.v_admin_participants as
select s.student_id, s.enrollment_status, s.stratum, s.created_at,
       s.pretest_score, s.posttest_score, s.learning_gain,
       coalesce(ss.levels_played,0) as levels_played,
       coalesce(ss.total_level_repeats,0) as total_level_repeats,
       coalesce(ss.total_hints,0) as total_hints,
       coalesce(ss.total_errors,0) as total_errors,
       (select count(*) from public.level_attempts a where a.student_id=s.student_id) as total_attempts,
       coalesce((select sum(t.amount) filter (where t.amount > 0) from public.coin_transactions t where t.student_id=s.student_id),0) as recorded_coins_earned,
       coalesce(-(select sum(t.amount) filter (where t.amount < 0) from public.coin_transactions t where t.student_id=s.student_id),0) as recorded_coins_spent,
       coalesce((select max(l.week) from public.levels l where l.student_id=s.student_id),0) as current_week,
       coalesce(
         (select max(l.stage_number) from public.levels l
          where l.student_id=s.student_id
            and l.week=(select max(lw.week) from public.levels lw where lw.student_id=s.student_id)),
         (select max(l.level_index) from public.levels l
          where l.student_id=s.student_id
            and l.week=(select max(lw.week) from public.levels lw where lw.student_id=s.student_id)),
         0
       ) as current_level_index,
       (select max(a.ended_at) from public.level_attempts a where a.student_id=s.student_id) as last_activity_at
from public.students s
left join public.student_summary ss using (student_id);
