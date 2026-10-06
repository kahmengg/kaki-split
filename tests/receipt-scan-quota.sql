begin;
do $$
declare
  v_user uuid;
  v_result record;
  v_remaining integer;
  v_day date := (statement_timestamp() at time zone 'Asia/Singapore')::date;
begin
  select id into v_user from auth.users limit 1;
  if v_user is null then raise exception 'Database test needs one existing auth account'; end if;
  -- Isolate the selected account inside this transaction; ROLLBACK restores its usage.
  delete from public.receipt_scan_usage where user_id = v_user;
  delete from public.receipt_scan_requests where user_id = v_user;
  insert into public.receipt_scan_usage values (v_user, v_day - 1, 5);
  for attempt in 1..6 loop
    select * into v_result from public.reserve_receipt_scan(v_user);
    if v_result.allowed is distinct from (attempt <= 5) or
       v_result.remaining <> greatest(0, 5 - attempt) then
      raise exception 'Unexpected quota for attempt %', attempt;
    end if;
    if v_result.resets_at <> ((v_day + 1)::timestamp at time zone 'Asia/Singapore') then
      raise exception 'Wrong reset boundary';
    end if;
  end loop;
  if (select attempts from public.receipt_scan_usage where user_id = v_user and scan_day = v_day) <> 5 then
    raise exception 'Counter exceeded five';
  end if;
  -- Returning service failures restores scans without restoring the request budget.
  delete from public.receipt_scan_usage where user_id = v_user and scan_day = v_day;
  delete from public.receipt_scan_requests where user_id = v_user;
  for attempt in 1..10 loop
    select * into v_result from public.reserve_receipt_scan(v_user);
    if not v_result.allowed then raise exception 'Request unexpectedly blocked before safety limit'; end if;
    if public.refund_receipt_scan(v_user, v_result.resets_at) <> 5 then raise exception 'Service failure did not restore allowance'; end if;
  end loop;
  select * into v_result from public.reserve_receipt_scan(v_user);
  if v_result.allowed or v_result.reason <> 'daily_request_limit' or v_result.remaining <> 5 then raise exception 'Failed requests can bypass safety budget'; end if;
  -- A response after midnight must refund the original reservation day.
  insert into public.receipt_scan_usage values (v_user, v_day - 2, 2);
  -- Keep the mutation in its own statement: SQL does not promise OR evaluation order.
  v_remaining := public.refund_receipt_scan(v_user, ((v_day - 1)::timestamp at time zone 'Asia/Singapore'));
  if v_remaining <> 4 or
     (select attempts from public.receipt_scan_usage where user_id=v_user and scan_day=v_day-2) <> 1 then raise exception 'Refund used wrong calendar day'; end if;
  -- Singapore midnight is 16:00 UTC, independent of the browser/server timezone.
  if ('2026-10-03T15:59:59Z'::timestamptz at time zone 'Asia/Singapore')::date <> date '2026-10-03' or
     ('2026-10-03T16:00:00Z'::timestamptz at time zone 'Asia/Singapore')::date <> date '2026-10-04' then
    raise exception 'Wrong Singapore calendar day';
  end if;
  if has_function_privilege('anon', 'public.reserve_receipt_scan(uuid)', 'execute') or
     has_function_privilege('authenticated', 'public.reserve_receipt_scan(uuid)', 'execute') or
     has_table_privilege('authenticated', 'public.receipt_scan_usage', 'update') or
     has_table_privilege('anon', 'public.receipt_scan_usage', 'insert') then
    raise exception 'Quota accessible to browser clients';
  end if;
  if has_function_privilege('authenticated', 'public.refund_receipt_scan(uuid,timestamptz)', 'execute') or
     has_table_privilege('authenticated','public.receipt_scan_requests','insert') or
     not has_table_privilege('service_role','public.receipt_scan_usage','delete') then raise exception 'Wrong refund/request-budget permissions'; end if;
  if not has_function_privilege('service_role', 'public.reserve_receipt_scan(uuid)', 'execute') then
    raise exception 'Server cannot reserve quota';
  end if;
end;
$$;
rollback;
