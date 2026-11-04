-- Add CC email field to workspaces table
alter table public.workspaces add column if not exists cc_emails text[] default '{}';

-- Add functions to manage CC emails
create or replace function public.update_workspace_cc_emails(cc_emails text[])
returns table(
  id uuid,
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
    raise exception 'Sign in to update workspace settings.';
  end if;

  return query
    update public.workspaces
    set cc_emails = $1
    where owner_id = current_user_id
    returning id, company_name, cc_emails;
end;
$$;

revoke all on function public.update_workspace_cc_emails(text[]) from public;
grant execute on function public.update_workspace_cc_emails(text[]) to authenticated;
