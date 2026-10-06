-- All fixture records/preferences roll back; no real group is archived.
begin;
do $$
declare
 a uuid := (select id from auth.users order by created_at limit 1);
 b uuid := gen_random_uuid(); g uuid := gen_random_uuid(); hidden uuid := gen_random_uuid();
begin
 if a is null then raise exception 'Archive test needs one existing authenticated account'; end if;
 insert into public.profiles(id, display_name) values (b, 'Archive fixture outsider');
 insert into public.groups(id, name, created_by, invite_code) values (g, 'Archive fixture', a, g::text), (hidden, 'Private archive fixture', b, hidden::text);
 insert into public.group_members(group_id, user_id) values (g,a), (g,b), (hidden,b);
 insert into public.expenses(group_id, description, amount, paid_by, created_by) values (g,'Archive balance fixture',20,a,a);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('role','authenticated',true);
 insert into public.group_user_preferences(group_id,user_id,archived_at) values (g,a,now());
 if (select count(*) from public.expenses where group_id=g) <> 1 then raise exception 'Archive changed shared records'; end if;
 begin
   insert into public.group_user_preferences(group_id,user_id,archived_at) values (hidden,a,now());
   raise exception 'TEST: archived nonmember group';
 exception when insufficient_privilege then null; end;
 begin
   update public.group_user_preferences set user_id=b where group_id=g and user_id=a;
   raise exception 'TEST: changed preference owner';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.group_user_preferences where group_id=g) then raise exception 'Member can see another user preference'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 update public.group_user_preferences set archived_at=null where group_id=g and user_id=a;
 if not exists(select 1 from public.group_user_preferences where group_id=g and user_id=a and archived_at is null) then raise exception 'Unarchive failed'; end if;
 if (select count(*) from public.expenses where group_id=g) <> 1 then raise exception 'Unarchive changed shared records'; end if;
 perform set_config('role','postgres',true);
 if has_table_privilege('anon','public.group_user_preferences','select') then raise exception 'Anonymous archive access'; end if;
end $$;
rollback;
