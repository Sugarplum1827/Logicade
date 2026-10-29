-- Research dashboard aggregates from stored facts only. Activity is explicitly
-- defined as a participant with at least one attempt in the preceding 30 days.
create or replace view public.v_admin_study_metrics as
select
  (select count(*) from public.students) as registered_participants,
  (select count(*) from public.students where enrollment_status = 'enrolled') as enrolled_participants,
  (select count(*) from public.students where enrollment_status = 'completed') as study_completed_participants,
  (select count(distinct student_id) from public.level_attempts where started_at >= now() - interval '30 days') as active_participants_30d,
  (select count(*) from public.level_attempts) as attempts_started,
  (select count(*) from public.level_attempts where status = 'completed' or completed) as attempts_completed,
  (select count(*) from public.level_attempts where status = 'failed') as failed_attempts,
  (select count(*) from public.level_attempts where status in ('incomplete','abandoned','restarted')) as incomplete_attempts,
  (select coalesce(sum(hint_count),0) from public.level_attempts) as recorded_hints,
  (select coalesce(sum(question_retry_count),0) from public.level_attempts) as recorded_question_retries,
  (select coalesce(sum(restart_count),0) from public.level_attempts) as recorded_level_restarts,
  (select count(*) from public.level_attempts where is_replay) as recorded_full_level_replays,
  (select coalesce(sum(amount) filter (where amount > 0),0) from public.coin_transactions) as coins_earned,
  (select coalesce(-sum(amount) filter (where amount < 0),0) from public.coin_transactions) as coins_spent,
  (select coalesce(sum(amount),0) from public.coin_transactions) as recorded_coin_balance,
  (select count(*) from public.generation_logs) as generation_requests,
  (select count(*) from public.generation_logs where outcome = 'verified_saved') as verified_generation_requests,
  (select count(*) from public.generation_logs where outcome = 'fallback_or_rejected') as fallback_or_rejected_generation_requests,
  (select count(*) from public.sync_devices) as reported_devices,
  (select coalesce(sum(pending_records),0) from public.sync_devices) as reported_pending_records,
  (select coalesce(sum(failed_records),0) from public.sync_devices) as reported_failed_records;

alter table public.coin_transactions enable row level security;
alter table public.generation_logs enable row level security;
alter table public.sync_devices enable row level security;
revoke all on public.v_admin_study_metrics from anon, authenticated;
grant select on public.v_admin_study_metrics to service_role;
