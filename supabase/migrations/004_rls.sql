-- For Phase 6 local dev, we allow public read/write so the sync worker works.
-- In Phase 7 (Admin Dashboard), we will restrict reads.
alter table public.students disable row level security;
alter table public.levels disable row level security;
alter table public.level_attempts disable row level security;
alter table public.events disable row level security;