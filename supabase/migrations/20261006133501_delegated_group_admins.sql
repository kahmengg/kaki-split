create or replace function private.is_group_admin(g uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select u is not null and (exists(select 1 from public.groups where id=g and created_by=u) or exists(select 1 from public.group_members where group_id=g and user_id=u and role='admin'));
$$;
revoke all on function private.is_group_admin(uuid,uuid) from public,anon;
grant execute on function private.is_group_admin(uuid,uuid) to authenticated;

create table public.group_role_changes (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 actor_user_id uuid references public.profiles(id) on delete set null, target_user_id uuid references public.profiles(id) on delete set null,
 old_role text not null,new_role text not null,created_at timestamptz not null default now()
);
alter table public.group_role_changes enable row level security;
revoke all on public.group_role_changes from public,anon,authenticated;
grant select on public.group_role_changes to authenticated;
create policy role_changes_member_read on public.group_role_changes for select to authenticated using(public.is_group_member(group_id,(select auth.uid())));
create index role_changes_group on public.group_role_changes(group_id,created_at desc);

-- A self-writable membership policy must never allow self-promotion.
create or replace function private.guard_member_role() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); owner_id uuid;
begin
 if actor is null and current_user in ('postgres','service_role','supabase_admin') then return new; end if;
 if tg_op='UPDATE' and (new.group_id<>old.group_id or new.user_id<>old.user_id) then raise exception 'Membership identity cannot be changed'; end if;
 if new.role not in ('owner','admin','member') then raise exception 'Unsupported member role'; end if;
 select created_by into owner_id from public.groups where id=new.group_id;
 if tg_op='UPDATE' and new.user_id=owner_id and new.role is distinct from old.role then raise exception 'The group creator keeps ownership'; end if;
 if new.role='owner' and new.user_id<>owner_id then raise exception 'Group ownership cannot be granted as a member role'; end if;
 if tg_op='INSERT' then
   if new.role<>'member' and not private.is_group_admin(new.group_id,actor) then raise exception 'Only a group admin can grant roles'; end if;
 elsif new.role is distinct from old.role and not private.is_group_admin(new.group_id,actor) then
   raise exception 'Only a group admin can grant roles';
 end if;
 return new;
end $$;
revoke all on function private.guard_member_role() from public,anon,authenticated;
create trigger guard_member_role before insert or update on public.group_members for each row execute function private.guard_member_role();
create or replace function private.audit_member_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role is distinct from old.role then insert into public.group_role_changes(group_id,actor_user_id,target_user_id,old_role,new_role) values(new.group_id,auth.uid(),new.user_id,old.role,new.role); end if;
 return null;
end $$;
revoke all on function private.audit_member_role() from public,anon,authenticated;
create trigger audit_member_role after update on public.group_members for each row execute function private.audit_member_role();

create or replace function private.set_group_member_role(p_group_id uuid,p_user_id uuid,p_role text,p_expected_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; current_role text;
begin
 select created_by into owner_id from public.groups where id=p_group_id for update;
 if auth.uid() is null or not private.is_group_admin(p_group_id,auth.uid()) then raise exception 'Only a group admin can grant roles'; end if;
 if p_user_id=owner_id then raise exception 'The group creator keeps ownership'; end if;
 if p_role is null or p_role not in ('admin','member') then raise exception 'Choose Admin or Member'; end if;
 select role into current_role from public.group_members where group_id=p_group_id and user_id=p_user_id for update;
 if not found then raise exception 'This person is no longer in the group'; end if;
 if current_role=p_role then return jsonb_build_object('user_id',p_user_id,'role',current_role); end if;
 if current_role is distinct from p_expected_role then raise exception 'This role changed. Refresh the members list'; end if;
 update public.group_members set role=p_role where group_id=p_group_id and user_id=p_user_id;
 return jsonb_build_object('user_id',p_user_id,'role',p_role);
end $$;
revoke all on function private.set_group_member_role(uuid,uuid,text,text) from public,anon;
grant execute on function private.set_group_member_role(uuid,uuid,text,text) to authenticated;
create or replace function public.set_group_member_role(p_group_id uuid,p_user_id uuid,p_role text,p_expected_role text) returns jsonb language sql security invoker set search_path='' as $$ select private.set_group_member_role(p_group_id,p_user_id,p_role,p_expected_role); $$;
revoke all on function public.set_group_member_role(uuid,uuid,text,text) from public,anon;
grant execute on function public.set_group_member_role(uuid,uuid,text,text) to authenticated;

create or replace function private.delete_group_expense(p_group_id uuid,p_expense_id uuid,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.expenses%rowtype; snapshot jsonb;
begin
 perform 1 from public.groups where id=p_group_id for update;
 if auth.uid() is null or not private.is_group_admin(p_group_id,auth.uid()) then raise exception 'Only a group admin can delete expenses'; end if;
 select * into e from public.expenses where id=p_expense_id and group_id=p_group_id for update;
 if not found then return jsonb_build_object('ok',true); end if;
 if e.revision is distinct from p_expected_revision then raise exception 'This expense changed. Reopen it before deleting'; end if;
 snapshot:=to_jsonb(e)||jsonb_build_object('splits',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from public.expense_splits s where expense_id=e.id),'change_history',(select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) from public.expense_change_history h where expense_id=e.id));
 insert into public.deleted_activity_logs(group_id,deleted_by,item_type,item_id,item_snapshot) values(p_group_id,auth.uid(),'expense',e.id,snapshot);
 delete from public.expenses where id=e.id;
 delete from public.activity_events where group_id=p_group_id and event_type in ('expense_added','expense_updated') and payload->>'expense_id'=e.id::text;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.delete_group_expense(uuid,uuid,integer) from public,anon;
grant execute on function private.delete_group_expense(uuid,uuid,integer) to authenticated;
create or replace function public.delete_group_expense(p_group_id uuid,p_expense_id uuid,p_expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select private.delete_group_expense(p_group_id,p_expense_id,p_expected_revision); $$;
revoke all on function public.delete_group_expense(uuid,uuid,integer) from public,anon;
grant execute on function public.delete_group_expense(uuid,uuid,integer) to authenticated;

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
  if v_actor <> v_old.created_by and not private.is_group_admin(v_old.group_id,v_actor) then raise exception 'Only the recorder or a group admin can edit this expense'; end if;
  if p_expected_revision is distinct from v_old.revision then raise exception 'This expense changed while you were editing. Reopen it to load the latest version.'; end if;
  if exists (select 1 from public.payments where group_id = v_old.group_id) and not p_acknowledge_payments then
    raise exception 'Payments already exist. Confirm that this correction may change outstanding balances.';
  end if;
  if v_amount is null or v_amount < 0.01 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2) or
     nullif(btrim(p_expense->>'description'), '') is null or length(p_expense->>'description') > 500 or
     coalesce(p_expense->>'split_type', '') not in ('equal', 'exact', 'percent') or
     not public.is_group_member(v_old.group_id, (p_expense->>'paid_by')::uuid) then
    raise exception 'Invalid expense details';
  end if;
  if jsonb_typeof(p_splits) is distinct from 'array' or jsonb_array_length(p_splits) = 0 then raise exception 'Choose at least one participant'; end if;
  if exists (select 1 from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)
      where s.user_id is null or s.amount is null or s.amount < 0 or s.amount > v_amount or s.amount <> round(s.amount, 2) or not public.is_group_member(v_old.group_id, s.user_id)) or
     (select count(*) <> count(distinct user_id) from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)) or
     (select sum(amount) from jsonb_to_recordset(p_splits) as s(user_id uuid, amount numeric)) <> v_amount then
    raise exception 'Participant amounts must be valid and add up to the total';
  end if;
  if coalesce(p_expense->>'original_currency', '') not in ('SGD','USD','EUR','GBP','AUD','IDR','THB','MYR','JPY') then raise exception 'Unsupported expense currency'; end if;
  if p_expense->>'original_currency' <> v_currency and (
    coalesce((p_expense->>'original_amount')::numeric, 0) <= 0 or coalesce((p_expense->>'exchange_rate')::numeric, 0) <= 0 or
    (round((p_expense->>'original_amount')::numeric * (p_expense->>'exchange_rate')::numeric, 2) <> v_amount and not coalesce((
      p_expense->>'original_currency' = v_old.original_currency and (p_expense->>'original_amount')::numeric = v_old.original_amount and
      (p_expense->>'exchange_rate')::numeric = v_old.exchange_rate and v_amount = v_old.amount), false))) then raise exception 'Invalid currency conversion'; end if;

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


create or replace function private.change_group_payment(p_payment_id uuid,p_expected_revision integer,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old_payment public.payments%rowtype; saved public.payments%rowtype; owner uuid; g uuid;
begin
 select group_id into g from public.payments where id=p_payment_id;
 select created_by into owner from public.groups where id=g for update;
 select * into old_payment from public.payments where id=p_payment_id for update;
 if actor is null or old_payment.id is null or not public.is_group_member(g,actor) then raise exception 'Payment unavailable or you are no longer a group member.'; end if;
 if p_action='acknowledge' then
   if actor<>old_payment.to_user_id then raise exception 'Only the recipient can acknowledge receipt.'; end if;
   if old_payment.voided_at is not null then raise exception 'A voided payment cannot be acknowledged.'; end if;
   if old_payment.acknowledged_at is not null then return to_jsonb(old_payment); end if;
 elsif p_action='void' then
   if actor<>old_payment.created_by and not private.is_group_admin(g,actor) then raise exception 'Only the recorder or a group admin can void this record.'; end if;
   if p_reason is null or length(btrim(p_reason))<3 or length(btrim(p_reason))>300 then raise exception 'Give a reason between 3 and 300 characters.'; end if;
   if old_payment.voided_at is not null then
     if old_payment.void_reason<>btrim(p_reason) then raise exception 'This payment was already voided with a different reason.'; end if;
     return to_jsonb(old_payment);
   end if;
 else raise exception 'Unknown payment action.';
 end if;
 if p_expected_revision is null or old_payment.revision<>p_expected_revision then raise exception 'This payment record changed. Reopen its details.'; end if;
 update public.payments set revision=revision+1,
   acknowledged_at=case when p_action='acknowledge' then now() else acknowledged_at end,
   voided_at=case when p_action='void' then now() else voided_at end,
   voided_by=case when p_action='void' then actor else voided_by end,
   void_reason=case when p_action='void' then btrim(p_reason) else void_reason end
 where id=p_payment_id returning * into saved;
 insert into public.payment_change_history(payment_id,group_id,actor_user_id,action,revision,before_snapshot,after_snapshot)
 values(p_payment_id,g,actor,p_action,saved.revision,to_jsonb(old_payment),to_jsonb(saved));
 insert into public.activity_events(group_id,actor_user_id,event_type,payload)
 values(g,actor,case when p_action='void' then 'payment_voided' else 'payment_acknowledged' end,jsonb_build_object('payment_id',p_payment_id,'amount',saved.amount,'reason',saved.void_reason));
 return to_jsonb(saved);
end $$;