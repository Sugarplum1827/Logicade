-- Make the ledger authoritative, transactionally serialized, and idempotent.
create unique index if not exists coin_first_level_reward_once
  on public.coin_transactions(student_id, level_id)
  where reason = 'first_level_completion_reward' and amount > 0;

create or replace function public.apply_coin_transaction(
  p_transaction_id uuid, p_student_id text, p_amount integer,
  p_reason text, p_source text default 'gameplay',
  p_level_id uuid default null, p_attempt_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare current_balance integer; existing record;
begin
  if p_amount = 0 or p_source <> 'gameplay' then raise exception 'invalid coin transaction'; end if;
  if p_reason = 'hint_used' and p_amount <> -6 then raise exception 'hint cost must be 6 coins'; end if;
  if p_reason = 'starting_balance' and p_amount <> 20 then raise exception 'starting balance must be 20 coins'; end if;
  if p_reason = 'first_level_completion_reward' then
    if p_amount <> 10 or p_level_id is null or not exists (
      select 1 from level_attempts where level_id=p_level_id and student_id=p_student_id
        and attempt_number=1 and completed
    ) then raise exception 'completion reward is not eligible'; end if;
  elsif p_reason not in ('hint_used','starting_balance') then
    raise exception 'unsupported gameplay coin reason';
  end if;
  perform 1 from students where student_id=p_student_id for update;
  if not found then raise exception 'participant not found'; end if;
  select * into existing from coin_transactions where transaction_id=p_transaction_id;
  if found then
    select coalesce(sum(amount),0)::integer into current_balance from coin_transactions where student_id=p_student_id;
    return jsonb_build_object('duplicate',true,'balance',current_balance);
  end if;
  if p_reason='first_level_completion_reward' and exists (
    select 1 from coin_transactions where student_id=p_student_id and level_id=p_level_id
      and reason='first_level_completion_reward'
  ) then
    select coalesce(sum(amount),0)::integer into current_balance from coin_transactions where student_id=p_student_id;
    return jsonb_build_object('duplicate',true,'balance',current_balance);
  end if;
  select coalesce(sum(amount),0)::integer into current_balance from coin_transactions where student_id=p_student_id;
  if current_balance + p_amount < 0 then raise exception 'insufficient coin balance'; end if;
  insert into coin_transactions(transaction_id,student_id,amount,reason,source,level_id,attempt_id)
    values(p_transaction_id,p_student_id,p_amount,p_reason,p_source,p_level_id,p_attempt_id);
  return jsonb_build_object('duplicate',false,'balance',current_balance+p_amount);
end;
$$;
revoke all on function public.apply_coin_transaction(uuid,text,integer,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.apply_coin_transaction(uuid,text,integer,text,text,uuid,uuid) to service_role;
