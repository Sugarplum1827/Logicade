-- Preserve the exact reusable Phaser template configuration served to each
-- learner. Attempt-level columns are needed because a retry can use a new
-- variation while remaining part of the same level.
alter table public.levels
  add column if not exists template_id text,
  add column if not exists template_version text,
  add column if not exists variation_id text,
  add column if not exists variation_seed bigint;

alter table public.level_attempts
  add column if not exists template_id text,
  add column if not exists template_version text,
  add column if not exists variation_id text,
  add column if not exists variation_seed bigint;

create index if not exists levels_template_variation_idx
  on public.levels(template_id, variation_id);

create index if not exists attempts_template_variation_idx
  on public.level_attempts(template_id, variation_id);

notify pgrst, 'reload schema';
