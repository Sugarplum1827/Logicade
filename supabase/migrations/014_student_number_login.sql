-- Use student numbers as participant login identifiers. Existing accounts are
-- kept intact: their previous unique username becomes a temporary student
-- number until the participant or study administrator replaces it.
alter table public.app_accounts
  add column if not exists student_number text;

update public.app_accounts
set student_number = upper(username)
where student_number is null or btrim(student_number) = '';

alter table public.app_accounts
  alter column student_number set not null;

create unique index if not exists app_accounts_student_number_lower_uq
  on public.app_accounts (lower(student_number));

-- Email is no longer collected during registration. Retain existing addresses
-- as stored account data, but permit new accounts to omit them.
alter table public.app_accounts
  alter column email drop not null;
