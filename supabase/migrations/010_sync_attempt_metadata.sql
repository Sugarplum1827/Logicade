-- Bring existing databases in line with the client attempt payload. Safe to
-- apply even when migration 008 was already applied.
alter table public.level_attempts
  add column if not exists status text not null default 'completed',
  add column if not exists restart_count integer not null default 0,
  add column if not exists question_retry_count integer not null default 0,
  add column if not exists origin text not null default 'online';

update public.level_attempts
set status = case when completed then 'completed' else 'failed' end
where status = 'completed';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'level_attempts_status_check') then
    alter table public.level_attempts add constraint level_attempts_status_check
      check (status in ('completed','failed','incomplete','abandoned','restarted'));
  end if;
end $$;

notify pgrst, 'reload schema';
