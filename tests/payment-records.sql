begin;
do $$
declare
 a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
 g uuid := gen_random_uuid(); e uuid := gen_random_uuid(); request uuid := gen_random_uuid();
 revision bigint; result jsonb; payment uuid;
begin
 insert into public.profiles(id,display_name) values(a,'Payment fixture creditor'),(b,'Payment fixture debtor'),(c,'Payment fixture outsider');
 insert into public.groups(id,name,created_by,invite_code) values(g,'Payment fixture',a,g::text);
 insert into public.group_members(group_id,user_id) values(g,a),(g,b);
 insert into public.expenses(id,group_id,description,amount,paid_by,created_by) values(e,g,'Dinner fixture',60,a,a);
 insert into public.expense_splits(expense_id,user_id,amount) values(e,a,30),(e,b,30);
 select ledger_revision into revision from public.groups where id=g;
 perform set_config('request.jwt.claim.sub',c::text,true);
 begin
  perform public.record_group_payment(g,b,a,10,request,revision);
  raise exception 'TEST: outsider recorded payment';
 exception when others then if sqlerrm not like 'You cannot record%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 begin
  perform public.record_group_payment(g,b,a,'NaN'::numeric,request,revision);
  raise exception 'TEST: nonfinite payment accepted';
 exception when others then if sqlerrm not like 'Enter a valid%' then raise; end if; end;
 begin
  perform public.record_group_payment(g,b,a,31,request,revision);
  raise exception 'TEST: overpayment accepted';
 exception when others then if sqlerrm not like 'Payment exceeds%' then raise; end if; end;
 begin
  perform public.record_group_payment(g,b,a,10,request,revision-1);
  raise exception 'TEST: stale balance accepted';
 exception when others then if sqlerrm not like 'The group balance changed%' then raise; end if; end;
 perform set_config('role','authenticated',true);
 result := public.record_group_payment(g,b,a,10,request,revision);
 payment := (result->>'id')::uuid;
 if public.record_group_payment(g,b,a,10,request,revision)->>'id' <> payment::text then raise exception 'Retry created a different payment'; end if;
 perform set_config('role','postgres',true);
 if (select count(*) from public.payments where group_id=g) <> 1 then raise exception 'Duplicate payment'; end if;
 if (select count(*) from public.activity_events where group_id=g and event_type='payment_recorded') <> 1 then raise exception 'Duplicate activity'; end if;
 if (select count(*) from public.telegram_outbox where group_id=g) <> 1 then raise exception 'Duplicate alert'; end if;
 if private.payment_pair_balance(g,b,a) <> 20 then raise exception 'Partial balance incorrect'; end if;
 begin
  perform public.record_group_payment(g,b,a,11,request,revision);
  raise exception 'TEST: reused key with changed payload';
 exception when others then if sqlerrm not like 'This payment request%' then raise; end if; end;
 begin
  perform public.change_group_payment(payment,0,'acknowledge',null);
  raise exception 'TEST: debtor acknowledged receipt';
 exception when others then if sqlerrm not like 'Only the recipient%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('role','authenticated',true);
 perform public.change_group_payment(payment,0,'acknowledge',null);
 perform public.change_group_payment(payment,0,'acknowledge',null);
 perform set_config('role','postgres',true);
 if private.payment_pair_balance(g,b,a) <> 20 then raise exception 'Acknowledgement changed balances'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('role','authenticated',true);
 perform public.change_group_payment(payment,1,'void','Entered the wrong amount');
 perform public.change_group_payment(payment,1,'void','Entered the wrong amount');
 perform set_config('role','postgres',true);
 if private.payment_pair_balance(g,b,a) <> 30 then raise exception 'Void did not restore balance'; end if;
 if (select count(*) from public.payment_change_history where payment_id=payment) <> 2 then raise exception 'Missing or duplicate audit history'; end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('role','authenticated',true);
 if exists(select 1 from public.payment_change_history where payment_id=payment) then raise exception 'Outsider sees payment audit'; end if;
 perform set_config('role','postgres',true);
 if has_function_privilege('anon','public.record_group_payment(uuid,uuid,uuid,numeric,uuid,bigint)','execute') then raise exception 'Anonymous payment RPC'; end if;
 if has_table_privilege('authenticated','public.payments','insert') then raise exception 'Direct insert bypass'; end if;
 if has_table_privilege('authenticated','public.payments','delete') then raise exception 'Direct delete bypass'; end if;
 begin
  delete from public.payments where id=payment;
  set constraints payment_change_history_payment_id_fkey immediate;
  raise exception 'TEST: individual deletion erased corrected payment history';
 exception when foreign_key_violation then null; end;
 delete from public.groups where id=g;
 set constraints all immediate;
 if exists(select 1 from public.payment_change_history where group_id=g) then raise exception 'Whole group deletion did not cascade history'; end if;
end $$;
rollback;
