-- Corrections update the ledger and audit trail in one transaction.
alter table public.expenses add column if not exists revision integer not null default 0;
create table if not exists public.expense_change_history (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  revision integer not null,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (expense_id, revision)
);
create index if not exists expense_change_history_expense_idx on public.expense_change_history(expense_id, created_at desc);
alter table public.expense_change_history enable row level security;
revoke all on public.expense_change_history from public, anon, authenticated;
grant select on public.expense_change_history to authenticated;
grant all on public.expense_change_history to service_role;
create policy expense_history_member_read on public.expense_change_history for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

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
  if v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 2) or
     nullif(btrim(p_expense->>'description'), '') is null or length(p_expense->>'description') > 500 or
     coalesce(p_expense->>'split_type', '') not in ('equal', 'exact', 'percent') or
     not public.is_group_member(v_old.group_id, (p_expense->>'paid_by')::uuid) then
    raise exception 'Invalid expense details';
  end if;
  if jsonb_typeof(p_splits) is distinct from 'array' or jsonb_array_length(p_splits) = 0 then raise exception 'Choose at least one participant'; end if;
  if exists (select 1 from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)
      where s.user_id is null or s.amount is null or s.amount < 0 or s.amount <> round(s.amount, 2) or not public.is_group_member(v_old.group_id, s.user_id)) or
     (select count(*) <> count(distinct user_id) from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)) or
     (select sum(amount) from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)) <> v_amount then
    raise exception 'Participant amounts must be valid and add up to the total';
  end if;
  if coalesce(p_expense->>'original_currency', '') not in ('SGD','USD','EUR','GBP','AUD','IDR','THB','MYR','JPY') then raise exception 'Unsupported expense currency'; end if;
  if p_expense->>'original_currency' <> v_currency and (
    coalesce((p_expense->>'original_amount')::numeric, 0) <= 0 or coalesce((p_expense->>'exchange_rate')::numeric, 0) <= 0 or
    round((p_expense->>'original_amount')::numeric * (p_expense->>'exchange_rate')::numeric, 2) <> v_amount) then raise exception 'Invalid currency conversion'; end if;

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
revoke all on function private.correct_expense(uuid, integer, jsonb, jsonb, boolean) from public, anon;
grant execute on function private.correct_expense(uuid, integer, jsonb, jsonb, boolean) to authenticated;
create or replace function public.correct_expense(p_expense_id uuid, p_expected_revision integer, p_expense jsonb, p_splits jsonb, p_acknowledge_payments boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.correct_expense(p_expense_id, p_expected_revision, p_expense, p_splits, p_acknowledge_payments);
$$;
revoke all on function public.correct_expense(uuid, integer, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.correct_expense(uuid, integer, jsonb, jsonb, boolean) to authenticated;
-- Corrections must use the audited function rather than direct row updates.
drop policy if exists expenses_update_creator on public.expenses;
drop policy if exists expense_splits_update_expense_creator on public.expense_splits;
drop policy if exists expense_splits_delete_expense_creator on public.expense_splits;

-- Separate the customer allowance from a bounded provider-request budget.
create table if not exists public.receipt_scan_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_day date not null,
  attempts smallint not null check (attempts between 1 and 10),
  primary key (user_id, scan_day)
);
alter table public.receipt_scan_requests enable row level security;
revoke all on public.receipt_scan_requests from public, anon, authenticated;
grant all on public.receipt_scan_requests to service_role;
drop function public.reserve_receipt_scan(uuid);
create function public.reserve_receipt_scan(p_user_id uuid)
returns table (allowed boolean, remaining integer, resets_at timestamptz, reason text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_day date := (statement_timestamp() at time zone 'Asia/Singapore')::date;
  v_requests integer;
  v_attempts integer;
begin
  insert into public.receipt_scan_requests as requests values (p_user_id, v_day, 1)
    on conflict (user_id, scan_day) do update set attempts = requests.attempts + 1 where requests.attempts < 10
    returning attempts into v_requests;
  if v_requests is null then
    return query select false, 5 - coalesce((select attempts::integer from public.receipt_scan_usage where user_id = p_user_id and scan_day = v_day), 0),
      ((v_day + 1)::timestamp at time zone 'Asia/Singapore'), 'daily_request_limit';
    return;
  end if;
  insert into public.receipt_scan_usage as usage values (p_user_id, v_day, 1)
    on conflict (user_id, scan_day) do update set attempts = usage.attempts + 1 where usage.attempts < 5
    returning attempts into v_attempts;
  return query select v_attempts is not null, case when v_attempts is null then 0 else 5 - v_attempts end,
    ((v_day + 1)::timestamp at time zone 'Asia/Singapore'), case when v_attempts is null then 'daily_scan_limit' else null end;
end;
$$;
revoke all on function public.reserve_receipt_scan(uuid) from public, anon, authenticated;
grant execute on function public.reserve_receipt_scan(uuid) to service_role;

create function public.refund_receipt_scan(p_user_id uuid, p_resets_at timestamptz)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_day date := (p_resets_at at time zone 'Asia/Singapore')::date - 1;
  v_attempts integer;
begin
  -- Lock the reservation's original day, including calls spanning midnight.
  select attempts into v_attempts from public.receipt_scan_usage where user_id = p_user_id and scan_day = v_day for update;
  if v_attempts = 1 then
    delete from public.receipt_scan_usage where user_id = p_user_id and scan_day = v_day;
  elsif v_attempts > 1 then
    update public.receipt_scan_usage set attempts = attempts - 1 where user_id = p_user_id and scan_day = v_day;
  end if;
  return 5 - greatest(coalesce(v_attempts, 1) - 1, 0);
end;
$$;
revoke all on function public.refund_receipt_scan(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.refund_receipt_scan(uuid, timestamptz) to service_role;
