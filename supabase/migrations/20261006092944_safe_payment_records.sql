alter table public.groups add column if not exists ledger_revision bigint not null default 0;
alter table public.payments add column if not exists request_id uuid;
alter table public.payments add column if not exists revision integer not null default 0;
alter table public.payments add column if not exists acknowledged_at timestamptz;
alter table public.payments add column if not exists voided_at timestamptz;
alter table public.payments add column if not exists voided_by uuid references public.profiles(id) on delete set null;
alter table public.payments add column if not exists void_reason text;
create unique index if not exists payment_request_unique on public.payments(group_id, request_id) where request_id is not null;

create table public.payment_change_history (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete cascade,
 group_id uuid not null references public.groups(id) on delete cascade,
 actor_user_id uuid references public.profiles(id) on delete set null,
 action text not null check(action in ('acknowledge','void')), revision integer not null,
 before_snapshot jsonb not null, after_snapshot jsonb not null, created_at timestamptz not null default now(),
 unique(payment_id, revision)
);
alter table public.payment_change_history enable row level security;
revoke all on public.payment_change_history from public, anon, authenticated;
grant select on public.payment_change_history to authenticated;
create policy payment_history_members on public.payment_change_history for select to authenticated
 using(public.is_group_member(group_id, (select auth.uid())));
create index payment_history_group on public.payment_change_history(group_id,created_at desc);

-- Every ledger mutation advances the snapshot and serializes against recording.
create or replace function private.bump_group_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare g uuid;
begin
 if tg_table_name='expense_splits' then
   select group_id into g from public.expenses where id=case when tg_op='DELETE' then old.expense_id else new.expense_id end;
 else
   g := case when tg_op='DELETE' then old.group_id else new.group_id end;
 end if;
 if g is not null then update public.groups set ledger_revision=ledger_revision+1 where id=g; end if;
 return null;
end $$;
revoke all on function private.bump_group_ledger() from public, anon, authenticated;
create trigger expenses_ledger_revision after insert or update or delete on public.expenses for each row execute function private.bump_group_ledger();
create trigger splits_ledger_revision after insert or update or delete on public.expense_splits for each row execute function private.bump_group_ledger();
create trigger payments_ledger_revision after insert or update or delete on public.payments for each row execute function private.bump_group_ledger();

-- Same greedy simplification and deterministic tie order as the client.
create or replace function private.payment_pair_balance(g uuid, f uuid, t uuid) returns numeric language plpgsql security invoker set search_path='' as $$
declare debtors uuid[]; creditors uuid[]; debts numeric[]; credits numeric[]; i integer:=1; j integer:=1; portion numeric;
begin
 with movements as (
   select paid_by as user_id, amount as value from public.expenses where group_id=g
   union all select s.user_id,-s.amount from (
     select distinct on (s.expense_id,s.user_id) s.* from public.expense_splits s join public.expenses e on e.id=s.expense_id where e.group_id=g order by s.expense_id,s.user_id,s.id
   ) s
   union all select from_user_id,amount from public.payments where group_id=g and voided_at is null
   union all select to_user_id,-amount from public.payments where group_id=g and voided_at is null
 ), net as (select user_id,sum(value) as amount from movements group by user_id)
 select
   array_agg(user_id order by -amount desc,user_id::text collate "C") filter(where amount<0),
   array_agg(-amount order by -amount desc,user_id::text collate "C") filter(where amount<0),
   array_agg(user_id order by amount desc,user_id::text collate "C") filter(where amount>0),
   array_agg(amount order by amount desc,user_id::text collate "C") filter(where amount>0)
 into debtors,debts,creditors,credits from net;
 while i<=coalesce(array_length(debtors,1),0) and j<=coalesce(array_length(creditors,1),0) loop
   portion:=least(debts[i],credits[j]);
   if debtors[i]=f and creditors[j]=t then return portion; end if;
   debts[i]:=debts[i]-portion; credits[j]:=credits[j]-portion;
   if debts[i]=0 then i:=i+1; end if;
   if credits[j]=0 then j:=j+1; end if;
 end loop;
 return 0;
end $$;
revoke all on function private.payment_pair_balance(uuid,uuid,uuid) from public, anon, authenticated;

create or replace function private.record_group_payment(p_group_id uuid,p_from uuid,p_to uuid,p_amount numeric,p_request_id uuid,p_expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); g public.groups%rowtype; previous public.payments%rowtype; saved public.payments%rowtype; payload jsonb;
begin
 select * into g from public.groups where id=p_group_id for update;
 if actor is null or g.id is null or not public.is_group_member(p_group_id,actor)
   or (actor<>p_from and actor<>p_to and actor<>g.created_by)
   or p_from=p_to or p_from is null or p_to is null
   or not public.is_group_member(p_group_id,p_from) or not public.is_group_member(p_group_id,p_to) then
   raise exception 'You cannot record this payment. Only its payer, recipient or group creator can record it.';
 end if;
 if p_request_id is null or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>=10000000000 then raise exception 'Enter a valid payment amount with at most two decimal places.'; end if;
 select * into previous from public.payments where group_id=p_group_id and request_id=p_request_id;
 if found then
   if previous.created_by<>actor or previous.from_user_id<>p_from or previous.to_user_id<>p_to or previous.amount<>p_amount then raise exception 'This payment request was already used for different details. Reopen the group.'; end if;
   return to_jsonb(previous);
 end if;
 if p_expected_revision is null or g.ledger_revision<>p_expected_revision then raise exception 'The group balance changed. Refresh the group before recording this payment.'; end if;
 if exists(select 1 from public.expenses e left join public.expense_splits s on s.expense_id=e.id where e.group_id=p_group_id group by e.id,e.amount having coalesce(sum(s.amount),0)<>e.amount) then raise exception 'An expense is still being saved or has incomplete splits. Refresh the group before recording.'; end if;
 if p_amount>private.payment_pair_balance(p_group_id,p_from,p_to) then raise exception 'Payment exceeds the current outstanding balance. Refresh the group.'; end if;
 insert into public.payments(group_id,from_user_id,to_user_id,amount,created_by,request_id)
 values(p_group_id,p_from,p_to,p_amount,actor,p_request_id) returning * into saved;
 payload:=jsonb_build_object('payment_id',saved.id,'from_user_id',p_from,'to_user_id',p_to,'amount',p_amount,'created_by',actor);
 insert into public.activity_events(group_id,actor_user_id,event_type,payload) values(p_group_id,actor,'payment_recorded',payload);
 -- Preserve existing payment alerts; retries do not enqueue another alert.
 insert into public.telegram_outbox(group_id,event_type,payload,status) values(p_group_id,'payment_recorded',payload,'pending');
 return to_jsonb(saved);
end $$;

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
   if actor<>old_payment.created_by and actor<>owner then raise exception 'Only the recorder or group creator can void this record.'; end if;
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

revoke all on function private.record_group_payment(uuid,uuid,uuid,numeric,uuid,bigint) from public,anon;
revoke all on function private.change_group_payment(uuid,integer,text,text) from public,anon;
grant execute on function private.record_group_payment(uuid,uuid,uuid,numeric,uuid,bigint) to authenticated;
grant execute on function private.change_group_payment(uuid,integer,text,text) to authenticated;
create or replace function public.record_group_payment(p_group_id uuid,p_from uuid,p_to uuid,p_amount numeric,p_request_id uuid,p_expected_revision bigint)
 returns jsonb language sql security invoker set search_path='' as $$ select private.record_group_payment(p_group_id,p_from,p_to,p_amount,p_request_id,p_expected_revision); $$;
create or replace function public.change_group_payment(p_payment_id uuid,p_expected_revision integer,p_action text,p_reason text default null)
 returns jsonb language sql security invoker set search_path='' as $$ select private.change_group_payment(p_payment_id,p_expected_revision,p_action,p_reason); $$;
revoke all on function public.record_group_payment(uuid,uuid,uuid,numeric,uuid,bigint) from public,anon;
revoke all on function public.change_group_payment(uuid,integer,text,text) from public,anon;
grant execute on function public.record_group_payment(uuid,uuid,uuid,numeric,uuid,bigint) to authenticated;
grant execute on function public.change_group_payment(uuid,integer,text,text) to authenticated;
revoke insert,update on public.payments from authenticated;
