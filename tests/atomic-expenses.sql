begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); e uuid; body jsonb; splits jsonb; result jsonb;
begin
 insert into public.profiles(id,display_name) values(a,'Test recorder'),(b,'Test member');
 insert into public.groups(id,name,created_by,invite_code) values(g,'Atomic fixture',a,g::text);
 insert into public.group_members(group_id,user_id) values(g,a),(g,b);
 perform set_config('request.jwt.claim.sub',a::text,true);
 body:=jsonb_build_object('description','Atomic lunch','amount',20,'paid_by',a,'split_type','equal','original_currency','SGD','exchange_rate_source','identity');
 splits:=jsonb_build_array(jsonb_build_object('user_id',a,'amount',10),jsonb_build_object('user_id',b,'amount',10));
 begin
  perform public.create_group_expense(g,r,body,splits||jsonb_build_array(jsonb_build_object('user_id',b,'amount',0)));
  raise exception 'TEST: repeated participant accepted';
 exception when others then if sqlerrm not like 'Participant amounts%' then raise; end if; end;
 if exists(select 1 from public.expenses where group_id=g) then raise exception 'Invalid request left a partial expense'; end if;
 result:=public.create_group_expense(g,r,body,splits); e:=(result->>'id')::uuid;
 if public.create_group_expense(g,r,body,splits)->>'id'<>e::text then raise exception 'Replay changed ID'; end if;
 if (select count(*) from public.expenses where group_id=g)<>1 or (select sum(amount) from public.expense_splits where expense_id=e)<>20
  or (select count(*) from public.activity_events where group_id=g)<>1 or (select count(*) from public.telegram_outbox where group_id=g)<>1 then raise exception 'Atomic request duplicated or omitted ledger/activity/alert'; end if;
 begin
  perform public.create_group_expense(g,r,body||jsonb_build_object('description','Changed'),splits);
  raise exception 'TEST: changed request accepted';
 exception when others then if sqlerrm not like 'This expense request was already%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
  perform public.create_group_expense(g,gen_random_uuid(),body,splits);
  raise exception 'TEST: outsider accepted';
 exception when others then if sqlerrm not like 'This group is unavailable%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin
  perform public.create_group_expense(g,gen_random_uuid(),body||jsonb_build_object('amount','NaN'),splits);
  raise exception 'TEST: nonfinite accepted';
 exception when others then if sqlerrm not like 'Invalid expense details%' then raise; end if; end;
 delete from public.expenses where id=e;
 if public.create_group_expense(g,r,body,splits)->>'id'<>e::text or exists(select 1 from public.expenses where id=e) then raise exception 'Retry resurrected a deleted expense'; end if;
 if has_function_privilege('anon','public.create_group_expense(uuid,uuid,jsonb,jsonb)','execute') or has_table_privilege('authenticated','private.expense_creation_requests','select') then raise exception 'Request API permissions too broad'; end if;
 perform set_config('test.group',g::text,true); perform set_config('test.actor',a::text,true); perform set_config('test.payer',b::text,true);
end $$;
set local role authenticated;
do $$
declare g uuid:=current_setting('test.group')::uuid; a uuid:=current_setting('test.actor')::uuid; b uuid:=current_setting('test.payer')::uuid; result jsonb;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);
 result:=public.create_group_expense(g,gen_random_uuid(),jsonb_build_object('description','FX taxi','amount',26,'paid_by',b,'split_type','exact','original_currency','USD','original_amount',20,'exchange_rate',1.3,'exchange_rate_source','fixture','exchange_rate_date','2026-10-06'),jsonb_build_array(jsonb_build_object('user_id',a,'amount',26)));
 perform public.create_group_expense(g,gen_random_uuid(),jsonb_build_object('description','Half-cent fixture','amount',1.01,'paid_by',a,'split_type','equal','original_currency','USD','original_amount',1,'exchange_rate',1.005,'exchange_rate_source','fixture'),jsonb_build_array(jsonb_build_object('user_id',a,'amount',1.01)));
 if (result->>'amount')::numeric<>26 or (result->>'created_by')::uuid<>a then raise exception 'Authenticated FX creation failed'; end if;
end $$;
rollback;
