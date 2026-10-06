begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();
begin
 insert into public.profiles(id,display_name) values(a,'Owner fixture'),(b,'Admin fixture'),(c,'Member fixture'),(d,'Outside fixture');
 insert into public.groups(id,name,created_by,invite_code) values(g,'Role fixture',a,g::text);
 insert into public.group_members(group_id,user_id,role) values(g,a,'owner'),(g,b,'member'),(g,c,'member');
 insert into public.expenses(id,group_id,description,amount,paid_by,created_by,original_currency) values(e,g,'Owner expense',20,a,a,'SGD');
 insert into public.expense_splits(expense_id,user_id,amount) values(e,a,10),(e,b,10);
 insert into public.payments(id,group_id,from_user_id,to_user_id,amount,created_by) values(p,g,b,a,5,a);
 perform set_config('test.owner',a::text,true); perform set_config('test.admin',b::text,true); perform set_config('test.member',c::text,true); perform set_config('test.outside',d::text,true); perform set_config('test.group',g::text,true); perform set_config('test.expense',e::text,true); perform set_config('test.payment',p::text,true);
end $$;
set local role authenticated;
do $$
declare a uuid:=current_setting('test.owner')::uuid; b uuid:=current_setting('test.admin')::uuid; c uuid:=current_setting('test.member')::uuid; d uuid:=current_setting('test.outside')::uuid; g uuid:=current_setting('test.group')::uuid; e uuid:=current_setting('test.expense')::uuid; p uuid:=current_setting('test.payment')::uuid; details jsonb;
begin
 perform set_config('request.jwt.claim.sub',b::text,true);
 begin
  update public.group_members set role='admin' where group_id=g and user_id=b;
  raise exception 'TEST: direct self-promotion accepted';
 exception when others then if sqlerrm not like 'Only a group admin%' then raise; end if; end;
 begin
  perform public.set_group_member_role(g,b,'admin','member'); raise exception 'TEST: RPC self-promotion accepted';
 exception when others then if sqlerrm not like 'Only a group admin%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.set_group_member_role(g,b,'admin','member');
 perform public.set_group_member_role(g,b,'admin','member');
 if (select count(*) from public.group_role_changes where group_id=g)<>1 then raise exception 'Role retries duplicated audit'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.set_group_member_role(g,c,'admin','member');
 begin
  perform public.set_group_member_role(g,a,'member','owner'); raise exception 'TEST: owner demotion accepted';
 exception when others then if sqlerrm not like 'The group creator keeps%' then raise; end if; end;
 details:=jsonb_build_object('description','Admin corrected','amount',20,'paid_by',a,'split_type','equal','category','food','original_currency','SGD');
 perform public.correct_expense(e,0,details,jsonb_build_array(jsonb_build_object('user_id',a,'amount',10),jsonb_build_object('user_id',b,'amount',10)),true);
 perform public.change_group_payment(p,0,'void','Admin corrected duplicate record');
 begin
  perform public.delete_group_expense(g,e,0); raise exception 'TEST: stale delete accepted';
 exception when others then if sqlerrm not like 'This expense changed%' then raise; end if; end;
 perform public.delete_group_expense(g,e,1);
 if exists(select 1 from public.expenses where id=e) or (select count(*) from public.deleted_activity_logs where item_id=e and item_snapshot->'change_history' is not null)<>1 then raise exception 'Admin deletion or retained history failed'; end if;
 perform public.set_group_member_role(g,c,'member','admin');
 perform set_config('request.jwt.claim.sub',c::text,true);
 begin
  perform public.set_group_member_role(g,b,'member','admin'); raise exception 'TEST: revoked admin kept role permissions';
 exception when others then if sqlerrm not like 'Only a group admin%' then raise; end if; end;
 begin
  perform public.delete_group_expense(g,e,1); raise exception 'TEST: revoked admin kept delete permissions';
 exception when others then if sqlerrm not like 'Only a group admin%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',d::text,true);
 if exists(select 1 from public.group_role_changes where group_id=g) then raise exception 'Outsider can read role audit'; end if;
 begin
  perform public.set_group_member_role(g,d,'admin','member'); raise exception 'TEST: outsider got admin';
 exception when others then if sqlerrm not like 'Only a group admin%' then raise; end if; end;
 if has_function_privilege('anon','public.set_group_member_role(uuid,uuid,text,text)','execute') then raise exception 'Anonymous role API grant'; end if;
end $$;
rollback;
