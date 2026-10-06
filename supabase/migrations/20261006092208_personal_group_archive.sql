create table public.group_user_preferences (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  archived_at timestamptz,
  primary key (user_id, group_id)
);
alter table public.group_user_preferences enable row level security;
revoke all on public.group_user_preferences from public, anon, authenticated;
grant select, insert, update on public.group_user_preferences to authenticated;
-- Archive is a per-account presentation preference, never a ledger mutation.
create policy group_preferences_select_own on public.group_user_preferences for select to authenticated
  using (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())));
create policy group_preferences_insert_own on public.group_user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())));
create policy group_preferences_update_own on public.group_user_preferences for update to authenticated
  using (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())))
  with check (user_id = (select auth.uid()) and public.is_group_member(group_id, (select auth.uid())));
create index group_preferences_group_id on public.group_user_preferences(group_id);

-- Realtime keeps personal archive preferences in sync across open devices.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.group_user_preferences;
  end if;
end $$;
