-- Super admin role. Safe to re-run: parts of this were already applied by hand.
create table if not exists public.super_admins (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.super_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "Super admins can read all workspaces" on public.workspaces;
create policy "Super admins can read all workspaces"
  on public.workspaces for select
  using (auth.uid() = owner_id or public.is_super_admin());

drop policy if exists "Super admins can read all guests" on public.guests;
create policy "Super admins can read all guests"
  on public.guests for select
  using (auth.uid() = owner_id or public.is_reception_member(owner_id) or public.is_super_admin());

drop policy if exists "Super admins can read all employee hosts" on public.employee_hosts;
create policy "Super admins can read all employee hosts"
  on public.employee_hosts for select
  using (auth.uid() = owner_id or public.is_super_admin());

-- Built on the deployed function (keeps the signup company name and the
-- "ambiguous owner_id" fix from 20261022150700) with the super admin branch added.
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

  if public.is_super_admin() then
    -- Prefer the account's own workspace; otherwise the oldest one, so the result is stable.
    return query
      select w.company_name, w.reception_token, w.owner_id, 'super_admin'::text
      from public.workspaces as w
      order by (w.owner_id = current_user_id) desc, w.created_at
      limit 1;
    return;
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

create or replace function public.list_all_workspaces()
returns table(id uuid, owner_id uuid, company_name text, reception_token uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not (public.is_super_admin()) then
    raise exception 'Only super admins can view all workspaces.';
  end if;

  return query
    select w.id, w.owner_id, w.company_name, w.reception_token, w.created_at
    from public.workspaces as w
    order by w.created_at desc;
end;
$$;

revoke all on function public.list_all_workspaces() from public;
grant execute on function public.list_all_workspaces() to authenticated;

create or replace function public.list_guests_by_workspace(workspace_owner_id uuid)
returns table(
  id uuid,
  owner_id uuid,
  name text,
  email text,
  phone text,
  company text,
  host_name text,
  host_id uuid,
  purpose text,
  status text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  checkout_method text,
  host_notified_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Sign in to view guests.';
  end if;

  if auth.uid() <> list_guests_by_workspace.workspace_owner_id and not (public.is_super_admin()) then
    raise exception 'You do not have permission to view this workspace.';
  end if;

  return query
    select g.id, g.owner_id, g.name, g.email, g.phone, g.company, g.host_name, g.host_id,
           g.purpose, g.status, g.checked_in_at, g.checked_out_at, g.checkout_method,
           g.host_notified_at, g.created_at
    from public.guests as g
    where g.owner_id = list_guests_by_workspace.workspace_owner_id
    order by g.created_at desc;
end;
$$;

revoke all on function public.list_guests_by_workspace(uuid) from public;
grant execute on function public.list_guests_by_workspace(uuid) to authenticated;
