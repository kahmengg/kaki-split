-- Requires receipt_scan_usage from supabase-schema.sql.
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
drop function if exists public.reserve_receipt_scan(uuid);
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

create or replace function public.refund_receipt_scan(p_user_id uuid, p_resets_at timestamptz)
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


grant delete on public.receipt_scan_usage to service_role;
