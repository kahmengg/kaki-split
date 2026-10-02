-- Only server code may reserve quota; browser clients cannot reset the counter.
create table if not exists public.receipt_scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_day date not null,
  attempts smallint not null check (attempts between 1 and 5),
  primary key (user_id, scan_day)
);
alter table public.receipt_scan_usage enable row level security;
revoke all on public.receipt_scan_usage from public, anon, authenticated;
grant select, insert, update on public.receipt_scan_usage to service_role;

create or replace function public.reserve_receipt_scan(p_user_id uuid)
returns table (allowed boolean, remaining integer, resets_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (statement_timestamp() at time zone 'Asia/Singapore')::date;
  v_attempts integer;
begin
  -- ON CONFLICT locks the account/day row: concurrent calls cannot pass five.
  insert into public.receipt_scan_usage as usage (user_id, scan_day, attempts)
  values (p_user_id, v_day, 1)
  on conflict (user_id, scan_day) do update
    set attempts = usage.attempts + 1
    where usage.attempts < 5
  returning attempts into v_attempts;

  return query select
    v_attempts is not null,
    case when v_attempts is null then 0 else 5 - v_attempts end,
    ((v_day + 1)::timestamp at time zone 'Asia/Singapore');
end;
$$;
-- Functions default to PUBLIC execution; explicitly close that bypass.
revoke all on function public.reserve_receipt_scan(uuid) from public, anon, authenticated;
grant execute on function public.reserve_receipt_scan(uuid) to service_role;
