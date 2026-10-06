-- Invoker security applies each source table's membership RLS to this read-only feed.
create or replace view public.activity_feed with (security_invoker = true) as
with entries as (
  select 'event:' || e.id::text as id, e.group_id, e.actor_user_id, e.event_type, e.payload, e.created_at
  from public.activity_events e
  where e.event_type in ('expense_added', 'expense_updated', 'payment_recorded', 'payment_voided', 'payment_acknowledged')
  union all
  -- Older purchases/payments may predate event logging. Include each creation once.
  select 'expense:' || x.id::text, x.group_id, x.created_by, 'expense_added',
    jsonb_build_object('expense_id', x.id, 'description', x.description, 'amount', x.amount), x.created_at
  from public.expenses x where not exists (
    select 1 from public.activity_events e where e.group_id = x.group_id and e.event_type = 'expense_added' and e.payload->>'expense_id' = x.id::text
  )
  union all
  select 'payment:' || p.id::text, p.group_id, p.created_by, 'payment_recorded',
    jsonb_build_object('payment_id', p.id, 'from_user_id', p.from_user_id, 'to_user_id', p.to_user_id, 'amount', p.amount), p.created_at
  from public.payments p where not exists (
    select 1 from public.activity_events e where e.group_id = p.group_id and e.event_type = 'payment_recorded' and e.payload->>'payment_id' = p.id::text
  )
  union all
  select 'deleted:' || d.id::text, d.group_id, d.deleted_by, d.item_type || '_deleted',
    d.item_snapshot || jsonb_build_object('item_id', d.item_id), d.deleted_at
  from public.deleted_activity_logs d where d.expires_at > now()
)
select e.*, g.name as group_name, g.base_currency, p.display_name as actor_name
from entries e join public.groups g on g.id = e.group_id
left join public.profiles p on p.id = e.actor_user_id;
revoke all on public.activity_feed from public, anon, authenticated;
grant select on public.activity_feed to authenticated;

create index if not exists activity_event_expense_creation on public.activity_events(group_id, (payload->>'expense_id')) where event_type = 'expense_added';
create index if not exists activity_event_payment_creation on public.activity_events(group_id, (payload->>'payment_id')) where event_type = 'payment_recorded';
