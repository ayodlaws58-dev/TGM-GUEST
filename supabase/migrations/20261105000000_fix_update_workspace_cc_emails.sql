-- Mirrors what is live in Supabase so the repo matches the database.
-- (Applied directly: 20261104214526 fix_update_workspace_cc_emails, then renamed the argument to p_cc_emails
-- as rename_cc_emails_argument_to_p_cc_emails.)
--
-- The app calls this function BY ARGUMENT NAME (p_cc_emails, see updateWorkspaceCcEmails in lib/guests.ts), so
-- the two must agree. Entries are trimmed, lower-cased, de-duplicated and validated; at most 20 recipients.
drop function if exists public.update_workspace_cc_emails(text[]);

create function public.update_workspace_cc_emails(p_cc_emails text[])
returns setof public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  cleaned text[];
  address text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update workspace settings.';
  end if;

  -- Trim, lower-case, and drop blanks and duplicates (keeping the order they were entered in).
  select coalesce(array_agg(s.addr order by s.first_position), '{}')
    into cleaned
  from (
    select lower(btrim(t.entry)) as addr, min(t.position) as first_position
    from unnest(coalesce(p_cc_emails, '{}')) with ordinality as t(entry, position)
    where btrim(t.entry) <> ''
    group by lower(btrim(t.entry))
  ) as s;

  if coalesce(array_length(cleaned, 1), 0) > 20 then
    raise exception 'You can add up to 20 CC recipients.';
  end if;

  foreach address in array cleaned loop
    if char_length(address) > 254 or address !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
      raise exception '"%" is not a valid email address.', address;
    end if;
  end loop;

  return query
    update public.workspaces as w
    set cc_emails = cleaned
    where w.owner_id = auth.uid()
    returning w.*;
end;
$$;

revoke all on function public.update_workspace_cc_emails(text[]) from public, anon;
grant execute on function public.update_workspace_cc_emails(text[]) to authenticated;
