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