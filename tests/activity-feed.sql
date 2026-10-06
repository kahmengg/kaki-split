begin;
insert into public.profiles(id, display_name) values
 ('77777777-0000-0000-0000-000000000001', 'Feed test member'),
 ('77777777-0000-0000-0000-000000000002', 'Feed test outsider');
insert into public.groups(id, name, created_by, invite_code) values
 ('77777777-0000-0000-0000-000000000010', 'Visible feed fixture', '77777777-0000-0000-0000-000000000001', 'feed-test-visible'),
 ('77777777-0000-0000-0000-000000000011', 'Private feed fixture', '77777777-0000-0000-0000-000000000002', 'feed-test-private');
insert into public.group_members(group_id, user_id) values
 ('77777777-0000-0000-0000-000000000010', '77777777-0000-0000-0000-000000000001'),
 ('77777777-0000-0000-0000-000000000011', '77777777-0000-0000-0000-000000000002');
insert into public.expenses(id, group_id, description, amount, paid_by, created_by) values
 ('77777777-0000-0000-0000-000000000020', '77777777-0000-0000-0000-000000000010', 'Legacy dinner', 20, '77777777-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001');
insert into public.activity_events(group_id, actor_user_id, event_type, payload) values
 ('77777777-0000-0000-0000-000000000010', '77777777-0000-0000-0000-000000000001', 'expense_updated', '{"expense_id":"77777777-0000-0000-0000-000000000020","description":"Updated dinner","amount":25}'),
 ('77777777-0000-0000-0000-000000000011', '77777777-0000-0000-0000-000000000002', 'expense_added', '{"description":"Private expense"}');
insert into public.deleted_activity_logs(group_id, deleted_by, item_type, item_id, item_snapshot) values
 ('77777777-0000-0000-0000-000000000010', '77777777-0000-0000-0000-000000000001', 'payment', '77777777-0000-0000-0000-000000000030', '{"amount":5}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000001', true);
do $$ begin
 if (select count(*) from public.activity_feed where group_id = '77777777-0000-0000-0000-000000000010') <> 3 then raise exception 'Missing legacy creation, correction or deletion'; end if;
 if exists(select 1 from public.activity_feed where group_id = '77777777-0000-0000-0000-000000000011') then raise exception 'Feed exposed another group'; end if;
end $$;
reset role;
insert into public.activity_events(group_id, actor_user_id, event_type, payload) values
 ('77777777-0000-0000-0000-000000000010', '77777777-0000-0000-0000-000000000001', 'expense_added', '{"expense_id":"77777777-0000-0000-0000-000000000020","description":"Legacy dinner","amount":20}');
set local role authenticated;
do $$ begin
 if (select count(*) from public.activity_feed where group_id = '77777777-0000-0000-0000-000000000010') <> 3 then raise exception 'Creation duplicated its legacy fallback'; end if;
 if has_table_privilege('anon', 'public.activity_feed', 'select') then raise exception 'Anonymous feed access'; end if;
end $$;
rollback;
