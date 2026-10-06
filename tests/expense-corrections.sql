-- Synthetic records and all changes roll back; existing expenses are untouched.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  g uuid := gen_random_uuid(); e uuid := gen_random_uuid(); fx uuid := gen_random_uuid();
  payload jsonb;
  result jsonb;
begin
  insert into public.profiles(id, display_name) values (a, 'Test creator'), (b, 'Test recorder'), (c, 'Test member');
  insert into public.groups(id,name,created_by,invite_code) values (g,'Correction test',a,g::text);
  insert into public.group_members(group_id,user_id) values (g,a),(g,b),(g,c);
  insert into public.expenses(id,group_id,description,amount,paid_by,created_by) values (e,g,'Before',20,b,b);
  insert into public.expense_splits(expense_id,user_id,amount) values (e,a,10),(e,b,10);
  payload := jsonb_build_object('description','After','amount',30,'paid_by',a,'split_type','exact','category','food','original_currency','SGD','exchange_rate_source','identity');
  perform set_config('request.jwt.claim.sub',c::text,true);
  begin
    perform public.correct_expense(e,0,payload,jsonb_build_array(jsonb_build_object('user_id',a,'amount',30)));
    raise exception 'TEST: unrelated member correction accepted';
  exception when others then if sqlerrm not like 'Only the recorder%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',b::text,true);
  begin
    perform public.correct_expense(e,0,payload,jsonb_build_array(jsonb_build_object('user_id',a,'amount',29)));
    raise exception 'TEST: invalid split accepted';
  exception when others then if sqlerrm not like 'Participant amounts%' then raise; end if; end;
  if (select description from public.expenses where id=e) <> 'Before' then raise exception 'Failed correction mutated expense'; end if;
  result := public.correct_expense(e,0,payload,jsonb_build_array(jsonb_build_object('user_id',a,'amount',12),jsonb_build_object('user_id',b,'amount',18)));
  if (result->>'revision')::integer <> 1 or (select sum(amount) from public.expense_splits where expense_id=e) <> 30 then raise exception 'Correction totals/revision mismatch'; end if;
  if (select count(*) from public.expense_change_history where expense_id=e and actor_user_id=b and before_snapshot->'expense'->>'description'='Before' and after_snapshot->'expense'->>'description'='After') <> 1 then raise exception 'Missing before/after audit'; end if;
  begin
    perform public.correct_expense(e,0,payload,jsonb_build_array(jsonb_build_object('user_id',a,'amount',30)));
    raise exception 'TEST: stale revision accepted';
  exception when others then if sqlerrm not like 'This expense changed%' then raise; end if; end;
  insert into public.payments(group_id,from_user_id,to_user_id,amount,created_by) values (g,b,a,5,b);
  perform set_config('request.jwt.claim.sub',a::text,true);
  begin
    perform public.correct_expense(e,1,payload,jsonb_build_array(jsonb_build_object('user_id',a,'amount',30)));
    raise exception 'TEST: payment warning bypassed';
  exception when others then if sqlerrm not like 'Payments already exist%' then raise; end if; end;
  perform public.correct_expense(e,1,payload,jsonb_build_array(jsonb_build_object('user_id',a,'amount',30)),true);
  if (select count(*) from public.expense_change_history where expense_id=e) <> 2 then raise exception 'Creator correction missing'; end if;
  -- Older rates have six decimal places; a text correction must retain the saved total.
  insert into public.expenses(id,group_id,description,amount,paid_by,created_by,original_amount,original_currency,exchange_rate)
    values (fx,g,'Legacy FX',84.34,a,a,1000000,'IDR',0.000084);
  insert into public.expense_splits(expense_id,user_id,amount) values (fx,a,84.34);
  perform public.correct_expense(fx,0,jsonb_build_object('description','Legacy FX corrected','amount',84.34,'paid_by',a,'split_type','exact','category','food','original_currency','IDR','original_amount',1000000,'exchange_rate',0.000084),jsonb_build_array(jsonb_build_object('user_id',a,'amount',84.34)),true);
  if (select amount from public.expenses where id=fx) <> 84.34 then raise exception 'Text correction changed accounting total'; end if;
  if has_function_privilege('anon','public.correct_expense(uuid,integer,jsonb,jsonb,boolean)','execute') or has_table_privilege('authenticated','public.expense_change_history','insert') then raise exception 'Audit API permissions too broad'; end if;
  perform set_config('test.expense_id',e::text,true);
  perform set_config('test.group_id',g::text,true);
  perform set_config('test.member_id',c::text,true);
end;
$$;
-- Exercise real RLS, not just the elevated function's internal predicates.
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.member_id'),true);
  if (select count(*) from public.expense_change_history where expense_id=current_setting('test.expense_id')::uuid) <> 2 then raise exception 'Member cannot read history'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if (select count(*) from public.expense_change_history where expense_id=current_setting('test.expense_id')::uuid) <> 0 then raise exception 'Nonmember can read history'; end if;
end;
$$;
rollback;
