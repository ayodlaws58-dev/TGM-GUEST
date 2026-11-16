-- Host meeting response: when a visitor is approved, the host's arrival email carries links that let
-- the employee tell reception whether they can meet (coming now / need a few minutes / can't meet).
--
-- host_response_token is a separate, unguessable capability that only goes into the host's email.
-- It is deliberately distinct from visit_token (held by the visitor), so a visitor cannot answer on
-- the host's behalf.

alter table public.guests
  add column if not exists host_response text
    check (host_response in ('coming', 'delayed', 'unavailable')),
  add column if not exists host_response_note text
    check (host_response_note is null or char_length(host_response_note) <= 240),
  add column if not exists host_response_at timestamptz,
  add column if not exists host_response_token uuid not null default gen_random_uuid();

create unique index if not exists guests_host_response_token_key
  on public.guests (host_response_token);

-- Read the minimum the response page needs. Never returns visitor email/phone.
create or replace function public.get_host_response_visit(response_token uuid)
returns table(
  visitor_name text,
  visitor_company text,
  purpose text,
  host_name text,
  company_name text,
  status text,
  checked_in_at timestamptz,
  host_response text,
  host_response_note text,
  host_response_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select g.name, g.company, g.purpose, g.host_name, w.company_name, g.status, g.checked_in_at,
    g.host_response, g.host_response_note, g.host_response_at
  from public.guests as g
  join public.workspaces as w on w.owner_id = g.owner_id
  where g.host_response_token = $1;
$$;

-- Record (or change) the host's answer while the visitor is still on site.
create or replace function public.submit_host_response(response_token uuid, response text, note text)
returns table(
  host_response text,
  host_response_note text,
  host_response_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  target public.guests%rowtype;
  clean_note text := nullif(btrim(coalesce(submit_host_response.note, '')), '');
begin
  if submit_host_response.response is null
    or submit_host_response.response not in ('coming', 'delayed', 'unavailable') then
    raise exception 'Choose whether you can meet your visitor.';
  end if;

  if clean_note is not null and char_length(clean_note) > 240 then
    raise exception 'Keep your note to 240 characters or fewer.';
  end if;

  select g.* into target
  from public.guests as g
  where g.host_response_token = submit_host_response.response_token;

  if target.id is null then
    raise exception 'This response link is not valid.';
  end if;

  if target.status <> 'checked_in' then
    raise exception 'This visit is no longer active, so a response is not needed.';
  end if;

  return query
    update public.guests as g
    set host_response = submit_host_response.response,
        host_response_note = clean_note,
        host_response_at = now()
    where g.id = target.id
    returning g.host_response, g.host_response_note, g.host_response_at;
end;
$$;

revoke all on function public.get_host_response_visit(uuid) from public;
grant execute on function public.get_host_response_visit(uuid) to anon, authenticated;

revoke all on function public.submit_host_response(uuid, text, text) from public;
grant execute on function public.submit_host_response(uuid, text, text) to anon, authenticated;
