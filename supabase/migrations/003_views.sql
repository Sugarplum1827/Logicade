create view public.v_per_level as
select ls.student_id, ls.week, ls.level_index, l.difficulty_assigned,
       ls.first_attempt_score, ls.best_score, ls.total_attempts,
       ls.repeats_this_level as repeats_for_this_level,
       ls.total_errors, ls.total_hints, ls.total_activity_retries,
       ls.next_difficulty_assigned
from public.level_summary ls
join public.levels l using (level_id)
order by ls.student_id, ls.level_index;

create view public.v_overall_repeats as
select student_id,
       count(*)                                       as levels_played,
       sum(repeats_this_level)                        as total_level_repeats,
       count(*) filter (where repeats_this_level > 0) as levels_repeated_at_least_once,
       round((sum(repeats_this_level)::numeric
             / nullif(count(*),0))::numeric, 4)       as overall_repeat_rate,
       round(avg(first_attempt_score)::numeric, 4)    as mean_first_attempt_score,
       round(avg(best_score)::numeric, 4)             as mean_best_score
from public.level_summary group by student_id;