create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  email text,
  avatar_url text,
  avatar_color text,
  paynow_number text,
  paylah_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep profile rows after auth account deletion so historical group expenses,
-- payments, and balances can still point at an anonymous "Deleted user" record.
alter table public.profiles
drop constraint if exists profiles_id_fkey;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  invite_code text not null unique,
  base_currency text not null default 'SGD',
  telegram_connected boolean not null default false,
  telegram_group_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  original_amount numeric(14, 2),
  original_currency text,
  exchange_rate numeric(14, 6),
  paid_by uuid not null references public.profiles(id) on delete restrict,
  split_type text not null default 'equal',
  category text not null default 'other',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint expenses_split_type_check check (split_type in ('equal', 'exact', 'percent'))
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12, 2) not null,
  is_settled boolean not null default false
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12, 2) not null,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.deleted_activity_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  deleted_by uuid references public.profiles(id) on delete set null,
  item_type text not null check (item_type in ('expense', 'payment')),
  item_id uuid not null,
  item_snapshot jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 month')
);

create table if not exists public.telegram_connections (
  group_id uuid primary key references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null unique,
  telegram_group_name text,
  linked_by uuid references public.profiles(id) on delete set null,
  linked_at timestamptz not null default now(),
  is_active boolean not null default true,
  expense_alerts_enabled boolean not null default true,
  payment_alerts_enabled boolean not null default true,
  daily_reminder_enabled boolean not null default true,
  reminder_hour smallint not null default 0,
  reminder_minute smallint not null default 0,
  reminder_timezone text not null default 'Asia/Singapore',
  reminder_interval_days smallint not null default 1 check (reminder_interval_days between 1 and 30),
  last_daily_reminder_date date
);

alter table public.telegram_connections
add column if not exists reminder_interval_days smallint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'telegram_connections_reminder_interval_days_check'
  ) then
    alter table public.telegram_connections
    add constraint telegram_connections_reminder_interval_days_check
    check (reminder_interval_days between 1 and 30);
  end if;
end $$;

create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_chat_id bigint,
  used_chat_title text
);

create table if not exists public.telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  error_message text,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint telegram_outbox_status_check check (status in ('pending', 'sent', 'failed'))
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_amount_positive_check') then
    alter table public.expenses add constraint expenses_amount_positive_check check (amount > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'expense_splits_amount_nonnegative_check') then
    alter table public.expense_splits add constraint expense_splits_amount_nonnegative_check check (amount >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_amount_positive_check') then
    alter table public.payments add constraint payments_amount_positive_check check (amount > 0);
  end if;
end $$;

create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_expenses_group_id on public.expenses(group_id);
create index if not exists idx_expenses_created_at on public.expenses(created_at desc);
create index if not exists idx_expense_splits_expense_id on public.expense_splits(expense_id);
create index if not exists idx_payments_group_id on public.payments(group_id);
create index if not exists idx_nudges_group_to on public.nudges(group_id, to_user_id);
create index if not exists idx_activity_events_group_created on public.activity_events(group_id, created_at desc);
create index if not exists idx_deleted_activity_logs_group_deleted on public.deleted_activity_logs(group_id, deleted_at desc);
create index if not exists idx_deleted_activity_logs_expires on public.deleted_activity_logs(expires_at);
create index if not exists idx_telegram_link_tokens_group on public.telegram_link_tokens(group_id);
create index if not exists idx_telegram_link_tokens_token on public.telegram_link_tokens(token);
create index if not exists idx_telegram_outbox_status_available on public.telegram_outbox(status, available_at);
create index if not exists idx_telegram_connections_active on public.telegram_connections(is_active);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profile_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.payments enable row level security;
alter table public.nudges enable row level security;
alter table public.activity_events enable row level security;
alter table public.deleted_activity_logs enable row level security;
alter table public.telegram_connections enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_outbox enable row level security;

create or replace function public.is_group_member(_group_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = _group_id
      and gm.user_id = _user_id
  );
$$;

create or replace function public.is_group_owner(_group_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = _group_id
      and g.created_by = _user_id
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public;
revoke all on function public.is_group_owner(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_group_member" on public.profiles;
create policy "profiles_select_group_member"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members gm
    where gm.user_id = profiles.id
      and public.is_group_member(gm.group_id, auth.uid())
  )
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member"
on public.groups for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_group_member(id, auth.uid())
);

drop policy if exists "groups_insert_creator" on public.groups;
create policy "groups_insert_creator"
on public.groups for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner"
on public.groups for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner"
on public.groups for delete
to authenticated
using (created_by = auth.uid());

drop policy if exists "group_members_select_self_or_group_owner" on public.group_members;
drop policy if exists "group_members_select_group_member" on public.group_members;
create policy "group_members_select_group_member"
on public.group_members for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "group_members_insert_self_or_group_owner" on public.group_members;
create policy "group_members_insert_self_or_group_owner"
on public.group_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "group_members_update_self_or_group_owner" on public.group_members;
create policy "group_members_update_self_or_group_owner"
on public.group_members for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
)
with check (
  user_id = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "group_members_delete_self_or_group_owner" on public.group_members;
create policy "group_members_delete_self_or_group_owner"
on public.group_members for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "expenses_select_group_member" on public.expenses;
create policy "expenses_select_group_member"
on public.expenses for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "expenses_insert_group_member_creator" on public.expenses;
create policy "expenses_insert_group_member_creator"
on public.expenses for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_group_member(group_id, auth.uid())
  and public.is_group_member(group_id, paid_by)
);

drop policy if exists "expenses_update_creator" on public.expenses;
create policy "expenses_update_creator"
on public.expenses for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "expenses_delete_creator_or_group_owner" on public.expenses;
drop policy if exists "expenses_delete_creator" on public.expenses;
create policy "expenses_delete_creator_or_group_owner"
on public.expenses for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "expense_splits_select_group_member" on public.expense_splits;
create policy "expense_splits_select_group_member"
on public.expense_splits for select
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_splits.expense_id
      and public.is_group_member(e.group_id, auth.uid())
  )
);

drop policy if exists "expense_splits_insert_expense_creator" on public.expense_splits;
create policy "expense_splits_insert_expense_creator"
on public.expense_splits for insert
to authenticated
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_splits.expense_id
      and e.created_by = auth.uid()
      and public.is_group_member(e.group_id, expense_splits.user_id)
  )
);

drop policy if exists "expense_splits_update_expense_creator" on public.expense_splits;
create policy "expense_splits_update_expense_creator"
on public.expense_splits for update
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_splits.expense_id
      and e.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_splits.expense_id
      and e.created_by = auth.uid()
      and public.is_group_member(e.group_id, expense_splits.user_id)
  )
);

drop policy if exists "expense_splits_delete_expense_creator" on public.expense_splits;
create policy "expense_splits_delete_expense_creator"
on public.expense_splits for delete
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_splits.expense_id
      and e.created_by = auth.uid()
  )
);

drop policy if exists "payments_select_group_member" on public.payments;
create policy "payments_select_group_member"
on public.payments for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "payments_insert_group_member_creator" on public.payments;
create policy "payments_insert_group_member_creator"
on public.payments for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_group_member(group_id, auth.uid())
  and public.is_group_member(group_id, from_user_id)
  and public.is_group_member(group_id, to_user_id)
);

drop policy if exists "payments_update_creator" on public.payments;
create policy "payments_update_creator"
on public.payments for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "payments_delete_creator_or_group_owner" on public.payments;
drop policy if exists "payments_delete_creator" on public.payments;
create policy "payments_delete_creator_or_group_owner"
on public.payments for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "nudges_select_group_member" on public.nudges;
create policy "nudges_select_group_member"
on public.nudges for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "nudges_insert_group_member_sender" on public.nudges;
create policy "nudges_insert_group_member_sender"
on public.nudges for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
  and public.is_group_member(group_id, to_user_id)
);

drop policy if exists "nudges_delete_sender_or_group_owner" on public.nudges;
drop policy if exists "nudges_delete_sender" on public.nudges;
create policy "nudges_delete_sender_or_group_owner"
on public.nudges for delete
to authenticated
using (
  from_user_id = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "activity_events_select_group_member" on public.activity_events;
create policy "activity_events_select_group_member"
on public.activity_events for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "activity_events_insert_group_member_actor" on public.activity_events;
create policy "activity_events_insert_group_member_actor"
on public.activity_events for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
);

drop policy if exists "activity_events_delete_actor_or_group_owner" on public.activity_events;
create policy "activity_events_delete_actor_or_group_owner"
on public.activity_events for delete
to authenticated
using (
  actor_user_id = auth.uid()
  or public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "deleted_activity_logs_select_group_member" on public.deleted_activity_logs;
create policy "deleted_activity_logs_select_group_member"
on public.deleted_activity_logs for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "telegram_connections_select_group_member" on public.telegram_connections;
create policy "telegram_connections_select_group_member"
on public.telegram_connections for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "telegram_connections_upsert_group_owner" on public.telegram_connections;
create policy "telegram_connections_upsert_group_owner"
on public.telegram_connections for all
to authenticated
using (public.is_group_owner(group_id, auth.uid()))
with check (public.is_group_owner(group_id, auth.uid()));

drop policy if exists "telegram_link_tokens_select_group_member" on public.telegram_link_tokens;
create policy "telegram_link_tokens_select_group_member"
on public.telegram_link_tokens for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "telegram_link_tokens_insert_group_owner" on public.telegram_link_tokens;
create policy "telegram_link_tokens_insert_group_owner"
on public.telegram_link_tokens for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_group_owner(group_id, auth.uid())
);

drop policy if exists "telegram_link_tokens_update_group_owner" on public.telegram_link_tokens;
create policy "telegram_link_tokens_update_group_owner"
on public.telegram_link_tokens for update
to authenticated
using (public.is_group_owner(group_id, auth.uid()))
with check (public.is_group_owner(group_id, auth.uid()));

drop policy if exists "telegram_outbox_select_group_member" on public.telegram_outbox;
create policy "telegram_outbox_select_group_member"
on public.telegram_outbox for select
to authenticated
using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "telegram_outbox_insert_group_member" on public.telegram_outbox;
create policy "telegram_outbox_insert_group_member"
on public.telegram_outbox for insert
to authenticated
with check (public.is_group_member(group_id, auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars_upload_own_folder" on storage.objects;
create policy "avatars_upload_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- Receipt scanning daily quota
-- Only server code may reserve quota; browser clients cannot reset the counter.
create table if not exists public.receipt_scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_day date not null,
  attempts smallint not null check (attempts between 1 and 5),
  primary key (user_id, scan_day)
);
alter table public.receipt_scan_usage enable row level security;
revoke all on public.receipt_scan_usage from public, anon, authenticated;
grant select, insert, update on public.receipt_scan_usage to service_role;

create or replace function public.reserve_receipt_scan(p_user_id uuid)
returns table (allowed boolean, remaining integer, resets_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (statement_timestamp() at time zone 'Asia/Singapore')::date;
  v_attempts integer;
begin
  -- ON CONFLICT locks the account/day row: concurrent calls cannot pass five.
  insert into public.receipt_scan_usage as usage (user_id, scan_day, attempts)
  values (p_user_id, v_day, 1)
  on conflict (user_id, scan_day) do update
    set attempts = usage.attempts + 1
    where usage.attempts < 5
  returning attempts into v_attempts;

  return query select
    v_attempts is not null,
    case when v_attempts is null then 0 else 5 - v_attempts end,
    ((v_day + 1)::timestamp at time zone 'Asia/Singapore');
end;
$$;
-- Functions default to PUBLIC execution; explicitly close that bypass.
revoke all on function public.reserve_receipt_scan(uuid) from public, anon, authenticated;
grant execute on function public.reserve_receipt_scan(uuid) to service_role;


-- Expense correction history and receipt service-failure recovery.
-- Corrections update the ledger and audit trail in one transaction.
alter table public.expenses add column if not exists revision integer not null default 0;
create table if not exists public.expense_change_history (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  revision integer not null,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (expense_id, revision)
);
create index if not exists expense_change_history_expense_idx on public.expense_change_history(expense_id, created_at desc);
alter table public.expense_change_history enable row level security;
revoke all on public.expense_change_history from public, anon, authenticated;
grant select on public.expense_change_history to authenticated;
grant all on public.expense_change_history to service_role;
drop policy if exists expense_history_member_read on public.expense_change_history;
create policy expense_history_member_read on public.expense_change_history for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

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
  if v_actor <> v_old.created_by and v_actor <> v_owner then raise exception 'Only the recorder or group creator can edit this expense'; end if;
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
revoke all on function private.correct_expense(uuid, integer, jsonb, jsonb, boolean) from public, anon;
grant execute on function private.correct_expense(uuid, integer, jsonb, jsonb, boolean) to authenticated;
create or replace function public.correct_expense(p_expense_id uuid, p_expected_revision integer, p_expense jsonb, p_splits jsonb, p_acknowledge_payments boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.correct_expense(p_expense_id, p_expected_revision, p_expense, p_splits, p_acknowledge_payments);
$$;
revoke all on function public.correct_expense(uuid, integer, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.correct_expense(uuid, integer, jsonb, jsonb, boolean) to authenticated;
-- Corrections must use the audited function rather than direct row updates.
drop policy if exists expenses_update_creator on public.expenses;
drop policy if exists expense_splits_update_expense_creator on public.expense_splits;
drop policy if exists expense_splits_delete_expense_creator on public.expense_splits;

-- Separate the customer allowance from a bounded provider-request budget.
create table if not exists public.receipt_scan_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_day date not null,
  attempts smallint not null check (attempts between 1 and 10),
  primary key (user_id, scan_day)
);
alter table public.receipt_scan_requests enable row level security;
revoke all on public.receipt_scan_requests from public, anon, authenticated;
grant all on public.receipt_scan_requests to service_role;
drop function if exists public.reserve_receipt_scan(uuid);
create function public.reserve_receipt_scan(p_user_id uuid)
returns table (allowed boolean, remaining integer, resets_at timestamptz, reason text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_day date := (statement_timestamp() at time zone 'Asia/Singapore')::date;
  v_requests integer;
  v_attempts integer;
begin
  insert into public.receipt_scan_requests as requests values (p_user_id, v_day, 1)
    on conflict (user_id, scan_day) do update set attempts = requests.attempts + 1 where requests.attempts < 10
    returning attempts into v_requests;
  if v_requests is null then
    return query select false, 5 - coalesce((select attempts::integer from public.receipt_scan_usage where user_id = p_user_id and scan_day = v_day), 0),
      ((v_day + 1)::timestamp at time zone 'Asia/Singapore'), 'daily_request_limit';
    return;
  end if;
  insert into public.receipt_scan_usage as usage values (p_user_id, v_day, 1)
    on conflict (user_id, scan_day) do update set attempts = usage.attempts + 1 where usage.attempts < 5
    returning attempts into v_attempts;
  return query select v_attempts is not null, case when v_attempts is null then 0 else 5 - v_attempts end,
    ((v_day + 1)::timestamp at time zone 'Asia/Singapore'), case when v_attempts is null then 'daily_scan_limit' else null end;
end;
$$;
revoke all on function public.reserve_receipt_scan(uuid) from public, anon, authenticated;
grant execute on function public.reserve_receipt_scan(uuid) to service_role;

create or replace function public.refund_receipt_scan(p_user_id uuid, p_resets_at timestamptz)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_day date := (p_resets_at at time zone 'Asia/Singapore')::date - 1;
  v_attempts integer;
begin
  -- Lock the reservation's original day, including calls spanning midnight.
  select attempts into v_attempts from public.receipt_scan_usage where user_id = p_user_id and scan_day = v_day for update;
  if v_attempts = 1 then
    delete from public.receipt_scan_usage where user_id = p_user_id and scan_day = v_day;
  elsif v_attempts > 1 then
    update public.receipt_scan_usage set attempts = attempts - 1 where user_id = p_user_id and scan_day = v_day;
  end if;
  return 5 - greatest(coalesce(v_attempts, 1) - 1, 0);
end;
$$;
revoke all on function public.refund_receipt_scan(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.refund_receipt_scan(uuid, timestamptz) to service_role;


grant delete on public.receipt_scan_usage to service_role;

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

create table if not exists public.group_user_preferences (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  archived_at timestamptz,
  primary key (user_id, group_id)
);
alter table public.group_user_preferences enable row level security;
revoke all on public.group_user_preferences from public, anon, authenticated;
grant select, insert, update on public.group_user_preferences to authenticated;
-- Archive is a per-account presentation preference, never a ledger mutation.
drop policy if exists group_preferences_select_own on public.group_user_preferences;
create policy group_preferences_select_own on public.group_user_preferences for select to authenticated
  using (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())));
drop policy if exists group_preferences_insert_own on public.group_user_preferences;
create policy group_preferences_insert_own on public.group_user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())));
drop policy if exists group_preferences_update_own on public.group_user_preferences;
create policy group_preferences_update_own on public.group_user_preferences for update to authenticated
  using (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())))
  with check (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())));
create index if not exists group_preferences_group_id on public.group_user_preferences(group_id);

-- Realtime keeps personal archive preferences in sync across open devices.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_user_preferences') then
    alter publication supabase_realtime add table public.group_user_preferences;
  end if;
end $$;

alter table public.groups add column if not exists ledger_revision bigint not null default 0;
alter table public.payments add column if not exists request_id uuid;
alter table public.payments add column if not exists revision integer not null default 0;
alter table public.payments add column if not exists acknowledged_at timestamptz;
alter table public.payments add column if not exists voided_at timestamptz;
alter table public.payments add column if not exists voided_by uuid references public.profiles(id) on delete set null;
alter table public.payments add column if not exists void_reason text;
create unique index if not exists payment_request_unique on public.payments(group_id, request_id) where request_id is not null;

create table if not exists public.payment_change_history (
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
drop policy if exists payment_history_members on public.payment_change_history;
create policy payment_history_members on public.payment_change_history for select to authenticated
 using(public.is_group_member(group_id, (select auth.uid())));
create index if not exists payment_history_group on public.payment_change_history(group_id,created_at desc);

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
drop trigger if exists expenses_ledger_revision on public.expenses;
create trigger expenses_ledger_revision after insert or update or delete on public.expenses for each row execute function private.bump_group_ledger();
drop trigger if exists splits_ledger_revision on public.expense_splits;
create trigger splits_ledger_revision after insert or update or delete on public.expense_splits for each row execute function private.bump_group_ledger();
drop trigger if exists payments_ledger_revision on public.payments;
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

-- Payment corrections survive individual deletion; deleting the whole group still
-- cascades its history. Deferred checking lets both group cascades finish first.
alter table public.payment_change_history drop constraint payment_change_history_payment_id_fkey;
alter table public.payment_change_history add constraint payment_change_history_payment_id_fkey
 foreign key(payment_id) references public.payments(id) deferrable initially deferred;
revoke delete on public.payments from authenticated;

-- Retain the result even if a later correction/deletion changes the expense.
create table if not exists private.expense_creation_requests (
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

create or replace function private.is_group_admin(g uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select u is not null and (exists(select 1 from public.groups where id=g and created_by=u) or exists(select 1 from public.group_members where group_id=g and user_id=u and role='admin'));
$$;
revoke all on function private.is_group_admin(uuid,uuid) from public,anon;
grant execute on function private.is_group_admin(uuid,uuid) to authenticated;

create table if not exists public.group_role_changes (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 actor_user_id uuid references public.profiles(id) on delete set null, target_user_id uuid references public.profiles(id) on delete set null,
 old_role text not null,new_role text not null,created_at timestamptz not null default now()
);
alter table public.group_role_changes enable row level security;
revoke all on public.group_role_changes from public,anon,authenticated;
grant select on public.group_role_changes to authenticated;
drop policy if exists role_changes_member_read on public.group_role_changes;
create policy role_changes_member_read on public.group_role_changes for select to authenticated using(public.is_group_member(group_id,(select auth.uid())));
create index if not exists role_changes_group on public.group_role_changes(group_id,created_at desc);

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
drop trigger if exists guard_member_role on public.group_members;
create trigger guard_member_role before insert or update on public.group_members for each row execute function private.guard_member_role();
create or replace function private.audit_member_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role is distinct from old.role then insert into public.group_role_changes(group_id,actor_user_id,target_user_id,old_role,new_role) values(new.group_id,auth.uid(),new.user_id,old.role,new.role); end if;
 return null;
end $$;
revoke all on function private.audit_member_role() from public,anon,authenticated;
drop trigger if exists audit_member_role on public.group_members;
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
create or replace function private.set_group_member_role(p_group_id uuid,p_user_id uuid,p_role text,p_expected_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; v_previous_role text;
begin
 select created_by into owner_id from public.groups where id=p_group_id for update;
 if auth.uid() is null or not private.is_group_admin(p_group_id,auth.uid()) then raise exception 'Only a group admin can grant roles'; end if;
 if p_user_id=owner_id then raise exception 'The group creator keeps ownership'; end if;
 if p_role is null or p_role not in ('admin','member') then raise exception 'Choose Admin or Member'; end if;
 select role into v_previous_role from public.group_members where group_id=p_group_id and user_id=p_user_id for update;
 if not found then raise exception 'This person is no longer in the group'; end if;
 if v_previous_role=p_role then return jsonb_build_object('user_id',p_user_id,'role',v_previous_role); end if;
 if v_previous_role is distinct from p_expected_role then raise exception 'This role changed. Refresh the members list'; end if;
 update public.group_members set role=p_role where group_id=p_group_id and user_id=p_user_id;
 return jsonb_build_object('user_id',p_user_id,'role',p_role);
end $$;