create or replace function public.get_my_reception_access()
returns table(company_name text, reception_token uuid, owner_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  signup_company_name text := nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'company_name'), '');
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

  insert into public.workspaces (owner_id, company_name)
  values (
    current_user_id,
    case
      when signup_company_name is not null and char_length(signup_company_name) <= 120
        then signup_company_name
      else 'My company'
    end
  )
  on conflict (owner_id) do nothing;

  return query
    select w.company_name, w.reception_token, w.owner_id, 'admin'::text
    from public.workspaces as w
    where w.owner_id = current_user_id;
end;
$$;

revoke all on function public.get_my_reception_access() from public, anon;
grant execute on function public.get_my_reception_access() to authenticated;
