-- Keep registration and the initial wallet ledger entry in one PostgreSQL transaction.
-- No participant or account rows are rewritten by this migration.

alter table public.levels
  add column if not exists stage_number smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'levels_stage_number_range'
      and conrelid = 'public.levels'::regclass
  ) then
    alter table public.levels
      add constraint levels_stage_number_range
      check (stage_number is null or stage_number between 1 and 10);
  end if;
end;
$$;

create index if not exists levels_student_week_stage_idx
  on public.levels (student_id, week, stage_number)
  where stage_number is not null;

-- A first-clear reward is earned on the first successful completion, even
-- when earlier attempts on the same level failed. The existing partial unique
-- index continues to guarantee one reward per participant and level.
create or replace function public.apply_coin_transaction(
  p_transaction_id uuid, p_student_id text, p_amount integer,
  p_reason text, p_source text default 'gameplay',
  p_level_id uuid default null, p_attempt_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare current_balance integer; existing public.coin_transactions%rowtype;
begin
  if p_transaction_id is null or p_student_id is null or p_amount is null or p_amount = 0
    or p_source is distinct from 'gameplay' then
    raise exception 'invalid coin transaction';
  end if;
  if p_reason = 'hint_used' and p_amount <> -6 then
    raise exception 'hint cost must be 6 coins';
  end if;
  if p_reason = 'starting_balance' and p_amount <> 20 then
    raise exception 'starting balance must be 20 coins';
  end if;
  if p_reason = 'first_level_completion_reward' then
    if p_amount <> 10 or p_level_id is null or not exists (
      select 1 from public.level_attempts a
      where a.level_id = p_level_id and a.student_id = p_student_id
        and a.completed
        and (p_attempt_id is null or a.attempt_id = p_attempt_id)
    ) then
      raise exception 'completion reward is not eligible';
    end if;
  elsif p_reason not in ('hint_used', 'starting_balance') then
    raise exception 'unsupported gameplay coin reason';
  end if;

  perform 1 from public.students where student_id = p_student_id for update;
  if not found then raise exception 'participant not found'; end if;

  select * into existing from public.coin_transactions where transaction_id = p_transaction_id;
  if found then
    if existing.student_id is distinct from p_student_id
      or existing.amount is distinct from p_amount
      or existing.reason is distinct from p_reason
      or existing.source is distinct from p_source
      or existing.level_id is distinct from p_level_id
      or existing.attempt_id is distinct from p_attempt_id then
      raise exception 'coin transaction ID was reused with different details';
    end if;
    select coalesce(sum(amount), 0)::integer into current_balance
      from public.coin_transactions where student_id = p_student_id;
    return jsonb_build_object('duplicate', true, 'balance', current_balance);
  end if;

  if p_reason = 'first_level_completion_reward' and exists (
    select 1 from public.coin_transactions
    where student_id = p_student_id and level_id = p_level_id
      and reason = 'first_level_completion_reward' and amount > 0
  ) then
    select coalesce(sum(amount), 0)::integer into current_balance
      from public.coin_transactions where student_id = p_student_id;
    return jsonb_build_object('duplicate', true, 'balance', current_balance);
  end if;

  select coalesce(sum(amount), 0)::integer into current_balance
    from public.coin_transactions where student_id = p_student_id;
  if current_balance + p_amount < 0 then raise exception 'insufficient coin balance'; end if;
  insert into public.coin_transactions(transaction_id, student_id, amount, reason, source, level_id, attempt_id)
    values (p_transaction_id, p_student_id, p_amount, p_reason, p_source, p_level_id, p_attempt_id);
  return jsonb_build_object('duplicate', false, 'balance', current_balance + p_amount);
end;
$$;
revoke all on function public.apply_coin_transaction(uuid, text, integer, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_coin_transaction(uuid, text, integer, text, text, uuid, uuid)
  to service_role;

-- The service-only registration RPC makes the pseudonymous participant row,
-- starting ledger transaction, and login account all commit or all roll back.
create or replace function public.register_app_account_atomic(
  p_student_id text,
  p_username text,
  p_student_number text,
  p_password_hash text,
  p_transaction_id uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare ledger_result jsonb;
begin
  if p_student_id is null or p_student_id !~ '^P-[A-F0-9]{24}$'
    or p_username is null or btrim(p_username) !~ '^[A-Za-z0-9_.-]{3,40}$'
    or p_student_number is null or btrim(p_student_number) !~ '^[A-Za-z0-9][A-Za-z0-9-]{2,39}$'
    or p_password_hash is null or p_password_hash !~ '^pbkdf2_sha256\$310000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$'
    or p_transaction_id is null then
    raise exception 'invalid account registration data';
  end if;

  insert into public.students(student_id, enrollment_status)
    values (p_student_id, 'unknown');
  ledger_result := public.apply_coin_transaction(
    p_transaction_id, p_student_id, 20, 'starting_balance', 'gameplay', null, null
  );
  insert into public.app_accounts(student_id, username, student_number, email, password_hash)
    values (p_student_id, btrim(p_username), upper(btrim(p_student_number)), null, p_password_hash);

  return jsonb_build_object(
    'student_id', p_student_id,
    'username', btrim(p_username),
    'student_number', upper(btrim(p_student_number)),
    'balance', coalesce((ledger_result ->> 'balance')::integer, 20)
  );
end;
$$;
revoke all on function public.register_app_account_atomic(text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.register_app_account_atomic(text, text, text, text, uuid)
  to service_role;
