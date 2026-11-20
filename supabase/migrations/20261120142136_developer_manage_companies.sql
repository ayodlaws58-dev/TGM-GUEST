-- Let developers and super admins edit and remove companies (workspaces).

-- list_all_workspaces now also returns the CC list and a visitor count, so the
-- return type changes and the function has to be dropped first.
drop function if exists public.list_all_workspaces();

create function public.list_all_workspaces()
returns table(
  id uuid,
  owner_id uuid,
  company_name text,
  reception_token uuid,
  created_at timestamptz,
  cc_emails text[],
  visitor_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not (public.is_super_admin() or public.is_developer()) then
    raise exception 'Only super admins and developers can view all workspaces.';
  end if;

  return query
    select w.id, w.owner_id, w.company_name, w.reception_token, w.created_at,
           coalesce(w.cc_emails, '{}'::text[]),
           (select count(*) from public.guests as g where g.owner_id = w.owner_id)
    from public.workspaces as w
    order by w.created_at desc;
end;
$$;

revoke all on function public.list_all_workspaces() from public, anon;
grant execute on function public.list_all_workspaces() to authenticated;

create or replace function public.admin_update_workspace(
  p_owner_id uuid,
  p_company_name text,
  p_cc_emails text[]
)
returns table(id uuid, owner_id uuid, company_name text, cc_emails text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  clean_name text := btrim(coalesce(p_company_name, ''));
  clean_cc text[];
begin
  if auth.uid() is null or not (public.is_super_admin() or public.is_developer()) then
    raise exception 'Only super admins and developers can edit companies.';
  end if;

  if char_length(clean_name) not between 1 and 120 then
    raise exception 'Company name must be between 1 and 120 characters.';
  end if;

  select coalesce(array_agg(distinct lower(btrim(e))), '{}'::text[])
    into clean_cc
    from unnest(coalesce(p_cc_emails, '{}'::text[])) as e
    where btrim(e) <> '';

  if exists (
    select 1 from unnest(clean_cc) as e
    where char_length(e) > 254 or e !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ) then
    raise exception 'One of the CC email addresses is not valid.';
  end if;

  return query
    update public.workspaces as w
    set company_name = clean_name,
        cc_emails = clean_cc
    where w.owner_id = p_owner_id
    returning w.id, w.owner_id, w.company_name, w.cc_emails;

  if not found then
    raise exception 'Company not found.';
  end if;
end;
$$;

revoke all on function public.admin_update_workspace(uuid, text, text[]) from public, anon;
grant execute on function public.admin_update_workspace(uuid, text, text[]) to authenticated;

-- Removes a company and all of its data: visitors, hosts, host messages,
-- reception team and self-checkout challenges. The owner's login is kept.
create or replace function public.admin_delete_workspace(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (public.is_super_admin() or public.is_developer()) then
    raise exception 'Only super admins and developers can remove companies.';
  end if;

  if p_owner_id = auth.uid() then
    raise exception 'You cannot remove your own company.';
  end if;

  if not exists (select 1 from public.workspaces where owner_id = p_owner_id) then
    raise exception 'Company not found.';
  end if;

  -- Order matters: guests reference employee_hosts with "on delete restrict".
  delete from public.host_messages where owner_id = p_owner_id;
  delete from public.guests where owner_id = p_owner_id;
  delete from public.employee_hosts where owner_id = p_owner_id;
  -- Cascades to workspace_reception_members and self_checkout_challenges.
  delete from public.workspaces where owner_id = p_owner_id;
end;
$$;

revoke all on function public.admin_delete_workspace(uuid) from public, anon;
grant execute on function public.admin_delete_workspace(uuid) to authenticated;
