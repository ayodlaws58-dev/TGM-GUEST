-- Add CC email field to workspaces table
alter table public.workspaces add column if not exists cc_emails text[] default '{}';

-- Add functions to manage CC emails
-- update_workspace_cc_emails is defined in 20261104000001 (this version could not be created:
-- the argument and the output column were both named cc_emails).

create or replace function public.get_workspace_cc_emails()
returns table(
  company_name text,
  cc_emails text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in to view workspace settings.';
  end if;

  return query
    select w.company_name, w.cc_emails
    from public.workspaces as w
    where w.owner_id = current_user_id;
end;
$$;

revoke all on function public.get_workspace_cc_emails() from public;
grant execute on function public.get_workspace_cc_emails() to authenticated;
