-- Instrumented attempts leave unmeasured fields NULL on older records.
alter table public.level_attempts add column research_metrics jsonb
    check (research_metrics is null or jsonb_typeof(research_metrics) = 'object');

create table public.learner_sessions (
    session_id uuid primary key,
    student_id text not null references public.students on delete cascade,
    started_at timestamptz not null,
    duration_ms integer not null check (duration_ms >= 0),
    active_ms integer not null check (active_ms >= 0),
    inactive_ms integer not null check (inactive_ms >= 0),
    check (active_ms::bigint + inactive_ms <= duration_ms)
);
create index learner_sessions_student_time on public.learner_sessions (student_id, started_at desc);
alter table public.learner_sessions enable row level security;
revoke all on public.learner_sessions from public, anon, authenticated;
grant select, insert, update on public.learner_sessions to service_role;

create function public.keep_latest_learner_session() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.student_id <> old.student_id or new.started_at <> old.started_at then
        raise exception 'Learner session identity cannot change';
    end if;
    if new.duration_ms <= old.duration_ms or new.active_ms < old.active_ms or new.inactive_ms < old.inactive_ms then
        return null;
    end if;
    return new;
end;
$$;
create trigger keep_latest_learner_session before update on public.learner_sessions
for each row execute function public.keep_latest_learner_session();

create view public.v_admin_research_attempts as
select a.attempt_id, a.student_id, a.level_id, l.week, l.stage_number,
       l.difficulty_assigned, l.difficulty_served, a.attempt_number, a.status, a.is_replay,
       a.started_at, a.ended_at, a.hint_count, a.restart_count,
       a.research_metrics ->> 'objective_id' as objective_id,
       a.research_metrics ->> 'session_id' as session_id,
       (a.research_metrics ->> 'session_duration_ms')::integer as session_duration_so_far_ms,
       (a.research_metrics ->> 'session_inactive_ms')::integer as session_inactive_so_far_ms,
       (a.research_metrics ->> 'scored_submissions')::integer as scored_submissions,
       (a.research_metrics ->> 'correct_submissions')::integer as correct_submissions,
       (a.research_metrics ->> 'scored_submissions')::integer -
           (a.research_metrics ->> 'correct_submissions')::integer as mistake_count,
       case when a.research_metrics ->> 'scored_submissions' is not null then a.question_retry_count end as question_retry_count,
       case when a.research_metrics ->> 'scored_submissions' is not null then a.activity_retries end as activity_retry_count,
       (a.research_metrics ->> 'correct_submissions')::numeric /
           nullif((a.research_metrics ->> 'scored_submissions')::integer, 0) as submission_accuracy,
       (a.research_metrics ->> 'response_sample_count')::integer as response_sample_count,
       (a.research_metrics ->> 'response_total_ms')::numeric /
           nullif((a.research_metrics ->> 'response_sample_count')::integer, 0) as mean_response_ms,
       (a.research_metrics ->> 'active_play_ms')::integer as active_play_ms,
       case when a.status = 'completed' then (a.research_metrics ->> 'active_play_ms')::integer end as completion_time_ms,
       a.accuracy as gameplay_accuracy, a.research_metrics ->> 'accuracy_basis' as gameplay_accuracy_basis
from public.level_attempts a join public.levels l using (level_id, student_id);

create view public.v_admin_research_stages as
with ordered as (
    select a.*, row_number() over (
        partition by a.student_id, a.week, a.stage_number
        order by case when a.status in ('completed', 'failed') then 0 else 1 end,
                 l.level_index, a.attempt_number, a.started_at, a.attempt_id
    ) as evidence_order
    from public.v_admin_research_attempts a join public.levels l using (level_id, student_id)
    where a.stage_number is not null
)
select student_id, week, stage_number, count(*) as attempt_count,
       count(*) filter (where status in ('completed', 'failed')) as evaluated_attempt_count,
       count(*) filter (where status = 'failed') as failed_attempt_count,
       count(*) filter (where status = 'failed')::numeric /
           nullif(count(*) filter (where status in ('completed', 'failed')), 0) as failure_rate,
       bool_or(status = 'completed') filter (where evidence_order = 1 and status in ('completed', 'failed')
                                            and (week, stage_number) <> (1, 1)) as first_try_success,
       max(objective_id) filter (where evidence_order = 1 and status in ('completed', 'failed')) as first_objective_id,
       max(scored_submissions) filter (where evidence_order = 1 and status in ('completed', 'failed')) as first_scored_submissions,
       max(correct_submissions) filter (where evidence_order = 1 and status in ('completed', 'failed')) as first_correct_submissions
from ordered group by student_id, week, stage_number;

-- Objective-level gameplay mastery estimate. Orientation is excluded.
create view public.v_admin_topic_mastery as
select student_id, first_objective_id as objective_id,
       count(*) as evaluated_stages, count(first_scored_submissions) as measured_stages,
       sum(first_scored_submissions) as evidence_submissions, sum(first_correct_submissions) as evidence_correct,
       sum(first_correct_submissions)::numeric / nullif(sum(first_scored_submissions), 0) as topic_mastery
from public.v_admin_research_stages
where first_objective_id is not null and week > 1
group by student_id, first_objective_id;

revoke all on public.v_admin_research_attempts, public.v_admin_research_stages, public.v_admin_topic_mastery
    from public, anon, authenticated;
grant select on public.v_admin_research_attempts, public.v_admin_research_stages, public.v_admin_topic_mastery to service_role;

notify pgrst, 'reload schema';
