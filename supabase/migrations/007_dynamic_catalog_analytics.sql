-- Preserve which catalogue entry produced each level and expose safe,
-- aggregate-only analytics to the server-side admin API.
alter table public.levels
  add column if not exists game_id text,
  add column if not exists game_title text,
  add column if not exists primary_mechanic text,
  add column if not exists learning_topic text,
  add column if not exists region_id text,
  add column if not exists region_name text;

create index if not exists levels_week_mechanic_idx
  on public.levels (week, primary_mechanic);
create index if not exists levels_game_id_idx
  on public.levels (game_id);
create index if not exists attempts_student_ended_idx
  on public.level_attempts (student_id, ended_at desc);
create index if not exists events_student_created_idx
  on public.events (student_id, created_at desc);
create index if not exists events_type_created_idx
  on public.events (event_type, created_at desc);

create or replace view public.v_admin_overview as
select
  (select count(*) from public.students) as total_students,
  (select count(*) from public.levels) as levels_started,
  (select count(*) from public.level_attempts) as total_attempts,
  (select count(*) from public.level_attempts where completed) as completed_attempts,
  coalesce((select round(avg(score)::numeric, 4) from public.level_attempts), 0) as mean_score,
  coalesce((select sum(error_count) from public.level_attempts), 0) as total_errors,
  coalesce((select sum(hint_count) from public.level_attempts), 0) as total_hints,
  coalesce((select round(sum(completion_time_sec)::numeric, 1) from public.level_attempts), 0) as total_play_time_sec,
  (select count(*) from public.events) as total_events,
  (select max(ended_at) from public.level_attempts) as last_attempt_at;

create or replace view public.v_admin_weekly as
select
  ls.week,
  count(*) as levels_played,
  count(distinct ls.student_id) as active_students,
  sum(ls.total_attempts) as total_attempts,
  coalesce(round(avg(ls.first_attempt_score)::numeric, 4), 0) as mean_first_score,
  coalesce(round(avg(ls.best_score)::numeric, 4), 0) as mean_best_score,
  sum(ls.total_errors) as total_errors,
  sum(ls.total_hints) as total_hints,
  sum(ls.total_time_sec) as total_play_time_sec
from public.level_summary ls
group by ls.week;

create or replace view public.v_admin_mechanics as
select
  l.week,
  coalesce(l.primary_mechanic, l.game_type, 'unknown') as mechanic,
  min(l.learning_topic) as learning_topic,
  count(distinct l.game_id) as catalogue_games,
  count(distinct l.student_id) as active_students,
  count(*) as levels_played,
  coalesce(sum(ls.total_attempts), 0) as total_attempts,
  coalesce(round(avg(ls.first_attempt_score)::numeric, 4), 0) as mean_first_score,
  coalesce(sum(ls.total_errors), 0) as total_errors,
  coalesce(sum(ls.total_hints), 0) as total_hints
from public.levels l
left join public.level_summary ls on ls.level_id = l.level_id
group by l.week, coalesce(l.primary_mechanic, l.game_type, 'unknown');

create or replace view public.v_admin_activity as
select
  event_type,
  count(*) as event_count,
  count(distinct student_id) as active_students,
  max(created_at) as latest_event_at
from public.events
group by event_type;

-- The browser now writes through the FastAPI service-role proxy. Keep direct
-- anonymous/authenticated table access disabled; the service role bypasses RLS.
alter table public.students enable row level security;
alter table public.levels enable row level security;
alter table public.level_attempts enable row level security;
alter table public.events enable row level security;
alter table public.level_summary enable row level security;
alter table public.week_summary enable row level security;
alter table public.student_summary enable row level security;
alter table public.difficulty_divergence enable row level security;

revoke all on public.students, public.levels, public.level_attempts, public.events,
  public.level_summary, public.week_summary, public.student_summary,
  public.difficulty_divergence from anon, authenticated;
revoke all on public.v_admin_overview, public.v_admin_weekly,
  public.v_admin_mechanics, public.v_admin_activity from anon, authenticated;
grant select on public.v_admin_overview, public.v_admin_weekly,
  public.v_admin_mechanics, public.v_admin_activity to service_role;
