-- get_my_reception_access() failed with 42702 "column reference owner_id is ambiguous":
-- the RETURNS TABLE column owner_id clashed with `on conflict (owner_id)`.
-- #variable_conflict use_column resolves the name to the table column.
create or replace function public.get_my_reception_access()
returns table(company_name text, reception_token uuid, owner_id uuid, role text)
language plpgsql
security definer
set search_path to ''
as $function$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in to open the reception workspace.';
  end if;

  if exists (
    select 1 from public.workspaces as w where w.owner_id = current_user_id
  ) then
    return query
      select w.company_name, w.reception_token, w.owner_id, 'admin'::text
      from public.workspaces as w
      where w.owner_id = current_user_id;
    return;
  end if;

  if exists (
    select 1
    from public.workspace_reception_members as member
    where member.user_id = current_user_id
  ) then
    return query
      select w.company_name, w.reception_token, w.owner_id, 'reception'::text
      from public.workspace_reception_members as member
      join public.workspaces as w on w.owner_id = member.owner_id
      where member.user_id = current_user_id
      limit 1;
    return;
  end if;

  insert into public.workspaces (owner_id)
  values (current_user_id)
  on conflict (owner_id) do nothing;

  return query
    select w.company_name, w.reception_token, w.owner_id, 'admin'::text
    from public.workspaces as w
    where w.owner_id = current_user_id;
end;
$function$;
