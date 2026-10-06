create or replace function private.correct_expense(p_expense_id uuid, p_expected_revision integer, p_expense jsonb, p_splits jsonb, p_acknowledge_payments boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old public.expenses;
  v_new public.expenses;
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_currency text;
  v_before jsonb;
  v_after jsonb;
  v_amount numeric := (p_expense->>'amount')::numeric;
begin
  select * into v_old from public.expenses where id = p_expense_id for update;
  if v_actor is null or not found or not public.is_group_member(v_old.group_id, v_actor) then
    raise exception 'This expense is not available to your account';
  end if;
  select created_by, base_currency into v_owner, v_currency from public.groups where id = v_old.group_id;
  if v_actor <> v_old.created_by and v_actor <> v_owner then raise exception 'Only the recorder or group creator can edit this expense'; end if;
  if p_expected_revision is distinct from v_old.revision then raise exception 'This expense changed while you were editing. Reopen it to load the latest version.'; end if;
  if exists (select 1 from public.payments where group_id = v_old.group_id) and not p_acknowledge_payments then
    raise exception 'Payments already exist. Confirm that this correction may change outstanding balances.';
  end if;
  if v_amount is null or v_amount < 0.01 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2) or
     nullif(btrim(p_expense->>'description'), '') is null or length(p_expense->>'description') > 500 or
     coalesce(p_expense->>'split_type', '') not in ('equal', 'exact', 'percent') or
     not public.is_group_member(v_old.group_id, (p_expense->>'paid_by')::uuid) then
    raise exception 'Invalid expense details';
  end if;
  if jsonb_typeof(p_splits) is distinct from 'array' or jsonb_array_length(p_splits) = 0 then raise exception 'Choose at least one participant'; end if;
  if exists (select 1 from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)
      where s.user_id is null or s.amount is null or s.amount < 0 or s.amount > v_amount or s.amount <> round(s.amount, 2) or not public.is_group_member(v_old.group_id, s.user_id)) or
     (select count(*) <> count(distinct user_id) from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)) or
     (select sum(amount) from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)) <> v_amount then
    raise exception 'Participant amounts must be valid and add up to the total';
  end if;
  if coalesce(p_expense->>'original_currency', '') not in ('SGD','USD','EUR','GBP','AUD','IDR','THB','MYR','JPY') then raise exception 'Unsupported expense currency'; end if;
  if p_expense->>'original_currency' <> v_currency and (
    coalesce((p_expense->>'original_amount')::numeric, 0) <= 0 or coalesce((p_expense->>'exchange_rate')::numeric, 0) <= 0 or
    (round((p_expense->>'original_amount')::numeric * (p_expense->>'exchange_rate')::numeric, 2) <> v_amount and not coalesce((
      p_expense->>'original_currency' = v_old.original_currency and (p_expense->>'original_amount')::numeric = v_old.original_amount and
      (p_expense->>'exchange_rate')::numeric = v_old.exchange_rate and v_amount = v_old.amount), false))) then raise exception 'Invalid currency conversion'; end if;

  select jsonb_build_object('expense', to_jsonb(v_old), 'splits', coalesce(jsonb_agg(to_jsonb(s) order by s.user_id), '[]'::jsonb)) into v_before
    from public.expense_splits s where expense_id = p_expense_id;
  update public.expenses set description = btrim(p_expense->>'description'), amount = v_amount,
    category = coalesce(p_expense->>'category', 'other'), paid_by = (p_expense->>'paid_by')::uuid,
    split_type = p_expense->>'split_type', original_currency = p_expense->>'original_currency',
    original_amount = (p_expense->>'original_amount')::numeric, exchange_rate = (p_expense->>'exchange_rate')::numeric,
    exchange_rate_source = p_expense->>'exchange_rate_source', exchange_rate_date = (p_expense->>'exchange_rate_date')::date,
    revision = revision + 1 where id = p_expense_id returning * into v_new;
  delete from public.expense_splits where expense_id = p_expense_id;
  insert into public.expense_splits(expense_id, user_id, amount, is_settled)
    select p_expense_id, s.user_id, s.amount, s.user_id = v_new.paid_by from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric);
  select jsonb_build_object('expense', to_jsonb(v_new), 'splits', coalesce(jsonb_agg(to_jsonb(s) order by s.user_id), '[]'::jsonb)) into v_after
    from public.expense_splits s where expense_id = p_expense_id;
  insert into public.expense_change_history(expense_id, group_id, actor_user_id, revision, before_snapshot, after_snapshot)
    values (p_expense_id, v_old.group_id, v_actor, v_new.revision, v_before, v_after);
  insert into public.activity_events(group_id, actor_user_id, event_type, payload)
    values (v_old.group_id, v_actor, 'expense_updated', jsonb_build_object('expense_id', p_expense_id, 'description', v_new.description, 'amount', v_new.amount, 'revision', v_new.revision));
  return to_jsonb(v_new);
end;
$$;

