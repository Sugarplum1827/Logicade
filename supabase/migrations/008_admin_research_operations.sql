-- Admin and research-operational data that was not represented in the
-- original gameplay schema. Existing rows remain valid and are not invented.

alter table public.students
  add column if not exists enrollment_status text not null default 'unknown';

alter table public.level_attempts
  add column if not exists status text not null default 'completed',
  add column if not exists restart_count integer not null default 0,
  add column if not exists question_retry_count integer not null default 0,
  add column if not exists origin text not null default 'online';

update public.level_attempts
set status = case when completed then 'completed' else 'failed' end
where status = 'completed';

create table if not exists public.study_sessions (
  session_id uuid primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  device_id text,
  app_version text,
  started_at timestamptz not null,
  ended_at timestamptz,
  origin text not null default 'online' check (origin in ('online','offline')),
  last_sync_at timestamptz,
  pending_records integer not null default 0,
  failed_records integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.coin_transactions (
  transaction_id uuid primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null,
  source text not null default 'gameplay',
  -- Gameplay purchases can be recorded before a level/attempt is committed;
  -- the UUIDs are retained as links without blocking offline hint sync.
  level_id uuid,
  attempt_id uuid,
  event_id uuid unique,
  actor_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.difficulty_decisions (
  decision_id uuid primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  previous_level_id uuid references public.levels(level_id) on delete set null,
  next_level_id uuid references public.levels(level_id) on delete set null,
  difficulty_before text,
  difficulty_selected text not null,
  difficulty_served text,
  inputs jsonb not null default '{}'::jsonb,
  rule_version text not null,
  reason text not null,
  decided_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_logs (
  generation_id uuid primary key,
  request_id text,
  week integer,
  level integer,
  difficulty text,
  game_id text,
  source_path text,
  model_tag text,
  outcome text not null,
  attempts integer not null default 0,
  duration_ms integer,
  verifier_result text,
  error text,
  fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_devices (
  sync_device_id uuid primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  device_id text not null,
  last_seen_at timestamptz not null,
  last_sync_at timestamptz,
  pending_records integer not null default 0,
  failed_records integer not null default 0,
  last_error text,
  unique(student_id, device_id)
);

create table if not exists public.assessments (
  assessment_id uuid primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  instrument text not null,
  phase text not null check (phase in ('pretest','posttest','other')),
  score numeric not null,
  maximum_score numeric,
  completed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.survey_responses (
  response_id uuid primary key,
  student_id text references public.students(student_id) on delete set null,
  instrument text not null,
  item_id text not null,
  response jsonb not null,
  submitted_at timestamptz not null
);

create table if not exists public.audit_logs (
  audit_id uuid primary key,
  actor_id text not null,
  action text not null,
  target_type text,
  target_id text,
  outcome text not null default 'success',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists students_enrollment_created_idx
  on public.students(enrollment_status, created_at desc);
create index if not exists levels_student_week_idx
  on public.levels(student_id, week, level_index);
create index if not exists attempts_student_idx
  on public.level_attempts(student_id, ended_at desc);
create index if not exists attempts_status_ended_idx
  on public.level_attempts(status, ended_at desc);
create index if not exists coin_transactions_student_time_idx
  on public.coin_transactions(student_id, created_at desc);
create index if not exists difficulty_decisions_student_time_idx
  on public.difficulty_decisions(student_id, decided_at desc);
create index if not exists generation_logs_week_time_idx
  on public.generation_logs(week, created_at desc);
create index if not exists study_sessions_student_time_idx
  on public.study_sessions(student_id, started_at desc);
create index if not exists audit_logs_time_idx
  on public.audit_logs(created_at desc);

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
       coalesce((select max(l.level_index) from public.levels l where l.student_id=s.student_id),0) as current_level_index,
       (select max(a.ended_at) from public.level_attempts a where a.student_id=s.student_id) as last_activity_at
from public.students s
left join public.student_summary ss using (student_id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'level_attempts_status_check') then
    alter table public.level_attempts add constraint level_attempts_status_check
      check (status in ('completed','failed','incomplete','abandoned','restarted'));
  end if;
end $$;

create or replace view public.v_admin_coin_summary as
select s.student_id,
       coalesce(sum(t.amount) filter (where t.amount > 0),0) as coins_earned,
       coalesce(-sum(t.amount) filter (where t.amount < 0),0) as coins_spent,
       coalesce(sum(t.amount),0) as coin_balance
from public.students s
left join public.coin_transactions t using (student_id)
group by s.student_id;

create or replace view public.v_admin_difficulty as
select week, difficulty_served as difficulty, count(*) as levels_served,
       count(distinct student_id) as participants
from public.levels
group by week, difficulty_served;

create or replace view public.v_admin_sync_devices as
select count(*) as devices_seen,
       count(*) filter (where pending_records > 0) as devices_with_pending,
       coalesce(sum(pending_records),0) as pending_records,
       coalesce(sum(failed_records),0) as failed_records,
       max(last_sync_at) as latest_sync_at
from public.sync_devices;

create or replace view public.v_admin_assessments as
select phase, instrument, count(*) as completed,
       round(avg(score)::numeric,4) as mean_score,
       round(avg(case when maximum_score > 0 then score/maximum_score end)::numeric,4) as mean_normalized_score
from public.assessments
group by phase, instrument;

create or replace view public.v_admin_research_summary as
select
  count(*) as registered_participants,
  count(*) filter (where enrollment_status = 'enrolled') as enrolled_participants,
  count(*) filter (where enrollment_status = 'completed') as study_completed_participants,
  count(*) filter (where pretest_score is not null) as pretest_completed,
  count(*) filter (where posttest_score is not null) as posttest_completed,
  count(*) filter (where pretest_score is not null and posttest_score is not null) as paired_assessments,
  round(avg(pretest_score)::numeric,4) as mean_pretest,
  round(avg(posttest_score)::numeric,4) as mean_posttest,
  round((avg(posttest_score - pretest_score) filter (where pretest_score is not null and posttest_score is not null))::numeric,4) as mean_learning_gain,
  percentile_cont(0.5) within group (order by posttest_score - pretest_score)
    filter (where pretest_score is not null and posttest_score is not null) as median_learning_gain,
  round((stddev_samp(posttest_score - pretest_score) filter (where pretest_score is not null and posttest_score is not null))::numeric,4) as sd_learning_gain
from public.students;

create or replace view public.v_admin_generation as
select outcome, coalesce(verifier_result,'unknown') as verifier_result,
       count(*) as request_count, sum(attempts) as attempts,
       round(avg(duration_ms)::numeric,1) as mean_duration_ms,
       max(created_at) as latest_at
from public.generation_logs
group by outcome, coalesce(verifier_result,'unknown');

alter table public.study_sessions enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.difficulty_decisions enable row level security;
alter table public.generation_logs enable row level security;
alter table public.sync_devices enable row level security;
alter table public.assessments enable row level security;
alter table public.survey_responses enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.study_sessions, public.coin_transactions,
  public.difficulty_decisions, public.generation_logs, public.sync_devices,
  public.assessments, public.survey_responses, public.audit_logs,
  public.v_admin_participants, public.v_admin_coin_summary,
  public.v_admin_difficulty, public.v_admin_sync_devices,
  public.v_admin_assessments, public.v_admin_generation,
  public.v_admin_research_summary
from anon, authenticated;

grant select on public.v_admin_participants, public.v_admin_coin_summary,
  public.v_admin_difficulty, public.v_admin_sync_devices,
  public.v_admin_assessments, public.v_admin_generation,
  public.v_admin_research_summary to service_role;
grant select, insert, update on public.study_sessions, public.coin_transactions,
  public.difficulty_decisions, public.generation_logs, public.sync_devices,
  public.assessments, public.survey_responses, public.audit_logs to service_role;
