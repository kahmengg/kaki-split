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
