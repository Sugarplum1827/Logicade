-- §14.5 Supabase PostgreSQL schema. Client-supplied UUIDs; no serials.
create extension if not exists "pgcrypto";

create table public.students (
  student_id text primary key,
  auth_uid   uuid default auth.uid(),
  stratum    text,                       -- analysis only
  pretest_score real, posttest_score real, learning_gain real,
  model_tag text, model_digest text,
  created_at timestamptz not null default now()
);

create table public.levels (
  level_id uuid primary key,
  student_id text not null references public.students on delete cascade,
  week int not null, level_index int not null,
  difficulty_assigned text not null, difficulty_served text not null,
  game_type text not null, map_id text not null,
  sprite_ids jsonb not null, fingerprint text not null,
  verification_result text not null, pool_status text not null,
  generated_at timestamptz not null,
  unique (student_id, level_index)
);

create table public.level_attempts (
  attempt_id uuid primary key,
  level_id uuid not null references public.levels on delete cascade,
  student_id text not null references public.students on delete cascade,
  attempt_number int not null, is_replay boolean not null,
  score real not null check (score between 0 and 1),
  accuracy real not null check (accuracy between 0 and 1),
  in_activity_attempts int not null, error_count int not null,
  completion_time_sec real, hint_count int not null default 0,
  activity_retries int not null default 0, completed boolean not null,
  started_at timestamptz not null, ended_at timestamptz,
  unique (level_id, attempt_number)
);

create table public.events (
  event_id uuid primary key,
  level_id uuid not null references public.levels on delete cascade,
  attempt_id uuid references public.level_attempts on delete cascade,
  student_id text not null, event_type text not null,
  t_ms_since_start int not null, entity_id text, rule_id text, payload jsonb,
  created_at timestamptz not null default now()
);

create table public.level_summary (
  level_id uuid primary key references public.levels on delete cascade,
  student_id text not null, week int not null, level_index int not null,
  first_attempt_score real,          -- IMMUTABLE
  first_attempt_accuracy real,       -- IMMUTABLE
  best_score real,
  total_attempts int not null default 0,
  repeats_this_level int not null default 0,
  total_errors int not null default 0,
  total_hints int not null default 0,
  total_activity_retries int not null default 0,
  total_time_sec real not null default 0,
  completed_any boolean not null default false,
  next_difficulty_assigned text
);

create table public.week_summary (
  student_id text not null, week int not null,
  levels_played int not null default 0, total_level_repeats int not null default 0,
  mean_first_attempt_score real, mean_best_score real,
  total_errors int not null default 0, total_hints int not null default 0,
  primary key (student_id, week)
);

create table public.student_summary (
  student_id text primary key references public.students on delete cascade,
  levels_played int not null default 0,
  total_level_repeats int not null default 0,
  levels_repeated_at_least_once int not null default 0,
  overall_repeat_rate real,
  mean_first_attempt_score real, mean_best_score real,
  total_errors int not null default 0, total_hints int not null default 0,
  total_activity_retries int not null default 0, total_time_sec real not null default 0
);

create table public.difficulty_divergence (
  level_id uuid primary key,
  client_next text, server_next text,
  client_inputs jsonb, server_inputs jsonb,
  detected_at timestamptz default now()
);