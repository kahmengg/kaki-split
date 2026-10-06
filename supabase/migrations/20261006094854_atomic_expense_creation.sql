-- Retain the result even if a later correction/deletion changes the expense.
create table private.expense_creation_requests (
 group_id uuid not null references public.groups(id) on delete cascade,
 request_id uuid not null, created_by uuid not null references public.profiles(id) on delete restrict,
 request_payload jsonb not null, response jsonb not null, created_at timestamptz not null default now(),
 primary key(group_id,request_id)
);
alter table private.expense_creation_requests enable row level security;
revoke all on private.expense_creation_requests from public,anon,authenticated;

create or replace function private.create_group_expense(p_group_id uuid,p_request_id uuid,p_expense jsonb,p_splits jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); g public.groups%rowtype; saved public.expenses%rowtype;
 previous private.expense_creation_requests%rowtype; body jsonb; allocations jsonb;
 total numeric:=(p_expense->>'amount')::numeric; original numeric:=(p_expense->>'original_amount')::numeric;
 rate numeric:=(p_expense->>'exchange_rate')::numeric; payer uuid:=(p_expense->>'paid_by')::uuid;
begin
 -- Lock the same group row as payments: nobody observes a half-written expense.
 select * into g from public.groups where id=p_group_id for update;
 if actor is null or g.id is null or not public.is_group_member(p_group_id,actor) then
   raise exception 'This group is unavailable to your account';
 end if;
 if p_request_id is null or total is null or total::text in ('NaN','Infinity','-Infinity') or total<0.01 or total>9999999999.99 or total<>round(total,2)
   or nullif(btrim(p_expense->>'description'),'') is null or length(p_expense->>'description')>500
   or coalesce(p_expense->>'split_type','') not in ('equal','exact','percent')
   or payer is null
   or length(coalesce(p_expense->>'category','other'))>100 or length(coalesce(p_expense->>'exchange_rate_source',''))>100
   or coalesce(p_expense->>'original_currency','') not in ('SGD','USD','EUR','GBP','AUD','IDR','THB','MYR','JPY') then
   raise exception 'Invalid expense details';
 end if;
 if jsonb_typeof(p_splits) is distinct from 'array' or jsonb_array_length(p_splits)=0 then raise exception 'Choose at least one participant'; end if;
 if exists(select 1 from jsonb_to_recordset(p_splits) as s(user_id uuid,amount numeric)
   where s.user_id is null or s.amount is null or s.amount::text in ('NaN','Infinity','-Infinity') or s.amount<0 or s.amount>total or s.amount<>round(s.amount,2))
   or (select count(*)<>count(distinct user_id) from jsonb_to_recordset(p_splits) as s(user_id uuid,amount numeric))
   or (select sum(amount) from jsonb_to_recordset(p_splits) as s(user_id uuid,amount numeric))<>total then
   raise exception 'Participant amounts must be valid and add up to the total';
 end if;
 if p_expense->>'original_currency'<>g.base_currency then
   if original is null or rate is null or original::text in ('NaN','Infinity','-Infinity') or rate::text in ('NaN','Infinity','-Infinity')
     or original<=0 or original>999999999999.99 or original<>round(original,2) or rate<=0 or rate>=100000000 or rate<>round(rate,6)
     or round(original*rate,2)<>total then raise exception 'Invalid currency conversion'; end if;
 else
   if original is not null or rate is not null then raise exception 'Base currency expenses do not need a conversion'; end if;
 end if;
 select jsonb_agg(jsonb_build_object('user_id',s.user_id,'amount',s.amount) order by s.user_id) into allocations
   from jsonb_to_recordset(p_splits) as s(user_id uuid,amount numeric);
 body:=jsonb_build_object('description',btrim(p_expense->>'description'),'amount',total,'paid_by',payer,'split_type',p_expense->>'split_type',
   'category',coalesce(p_expense->>'category','other'),'original_currency',p_expense->>'original_currency','original_amount',original,'exchange_rate',rate,
   'exchange_rate_source',p_expense->>'exchange_rate_source','exchange_rate_date',case when original is not null then p_expense->>'exchange_rate_date' else null end,'splits',allocations);
 select * into previous from private.expense_creation_requests where group_id=p_group_id and request_id=p_request_id;
 if found then
   if previous.created_by<>actor or previous.request_payload<>body then raise exception 'This expense request was already used for different details'; end if;
   return previous.response;
 end if;
 -- Replays may refer to a former participant, but new entries require current members.
 if not public.is_group_member(p_group_id,payer) or exists(select 1 from jsonb_to_recordset(p_splits) as s(user_id uuid,amount numeric) where not public.is_group_member(p_group_id,s.user_id)) then
   raise exception 'Choose current group members for the split';
 end if;
 insert into public.expenses(group_id,description,amount,paid_by,split_type,category,created_by,original_amount,original_currency,exchange_rate,exchange_rate_source,exchange_rate_date)
 values(p_group_id,body->>'description',total,payer,body->>'split_type',body->>'category',actor,original,body->>'original_currency',rate,body->>'exchange_rate_source',(body->>'exchange_rate_date')::date)
 returning * into saved;
 insert into public.expense_splits(expense_id,user_id,amount,is_settled)
 select saved.id,s.user_id,s.amount,s.user_id=payer from jsonb_to_recordset(p_splits) as s(user_id uuid,amount numeric);
 insert into public.activity_events(group_id,actor_user_id,event_type,payload) values(p_group_id,actor,'expense_added',
   jsonb_build_object('expense_id',saved.id,'description',saved.description,'amount',saved.amount));
 -- Keep the existing one-per-expense alert, without introducing reminders.
 insert into public.telegram_outbox(group_id,event_type,payload,status) values(p_group_id,'expense_added',
   jsonb_build_object('expense_id',saved.id,'description',saved.description,'amount',saved.amount,'paid_by',payer,'created_by',actor,
     'split_member_count',jsonb_array_length(p_splits),'currency',saved.original_currency,'split_type',saved.split_type),'pending');
 insert into private.expense_creation_requests(group_id,request_id,created_by,request_payload,response)
 values(p_group_id,p_request_id,actor,body,to_jsonb(saved));
 return to_jsonb(saved);
end $$;
revoke all on function private.create_group_expense(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function private.create_group_expense(uuid,uuid,jsonb,jsonb) to authenticated;
create or replace function public.create_group_expense(p_group_id uuid,p_request_id uuid,p_expense jsonb,p_splits jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.create_group_expense(p_group_id,p_request_id,p_expense,p_splits); $$;
revoke all on function public.create_group_expense(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.create_group_expense(uuid,uuid,jsonb,jsonb) to authenticated;
