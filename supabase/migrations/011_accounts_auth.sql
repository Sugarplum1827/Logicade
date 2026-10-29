-- Server-authenticated LogiCade accounts. Password hashes and identity data
-- stay separate from the pseudonymous gameplay participant record.
create table if not exists public.app_accounts (
  account_id uuid primary key default gen_random_uuid(),
  student_id text not null unique references public.students(student_id) on delete cascade,
  username text not null,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists app_accounts_username_lower_uq on public.app_accounts (lower(username));
create unique index if not exists app_accounts_email_lower_uq on public.app_accounts (lower(email));
alter table public.app_accounts enable row level security;
revoke all on public.app_accounts from anon, authenticated;
grant select, insert on public.app_accounts to service_role;
