-- A visitor's email address is optional. Blank emails are stored as NULL; an email that is
-- entered is still validated. (Visitors without an email can't use emailed-code self-checkout;
-- reception checks them out.)
--
-- Written against the function as deployed (20261026124500: geofence arguments + service-role guard),
-- so the existing 11-argument signature is replaced in place rather than adding an overload.
-- CREATE OR REPLACE keeps the existing grants.
alter table public.guests alter column email drop not null;

create or replace function public.register_visitor_by_qr(
  reception_token uuid,
  visitor_first_name text,
  visitor_middle_name text,
  visitor_last_name text,
  visitor_email text,
  visitor_phone text,
  visitor_company text,
  visitor_host text,
  visit_purpose text,
  visitor_lat double precision default null,
  visitor_lng double precision default null
)
returns table(
  name text,
  company text,
  host_name text,
  status text,
  checked_in_at timestamptz,
  visit_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_owner_id uuid;
  matched_host public.employee_hosts%rowtype;
  visitor_full_name text;
begin
  -- Only the server may register visitors, after it has verified the human check.
  if auth.role() is distinct from 'service_role' then
    raise exception 'Visitor registration must go through the check-in service.';
  end if;

  visitor_full_name := concat_ws(
    ' ',
    nullif(btrim(visitor_first_name), ''),
    nullif(btrim(visitor_middle_name), ''),
    nullif(btrim(visitor_last_name), '')
  );

  if visitor_first_name is null
    or visitor_last_name is null
    or visitor_phone is null
    or visitor_company is null
    or visitor_host is null
    or visit_purpose is null
    or char_length(btrim(visitor_first_name)) not between 1 and 120
    or (
      visitor_middle_name is not null
      and char_length(btrim(visitor_middle_name)) not between 1 and 120
    )
    or char_length(btrim(visitor_last_name)) not between 1 and 120
    or char_length(visitor_full_name) > 120
    or char_length(btrim(coalesce(visitor_email, ''))) > 254
    or (
      nullif(btrim(visitor_email), '') is not null
      and btrim(visitor_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    )
    or char_length(btrim(visitor_phone)) not between 1 and 32
    or char_length(visitor_company) > 120
    or char_length(btrim(visitor_host)) not between 1 and 120
    or char_length(btrim(visit_purpose)) not between 1 and 240
  then
    raise exception 'Enter valid visitor details, a host, and a visit purpose.';
  end if;

  select w.owner_id into workspace_owner_id
  from public.workspaces as w
  where w.reception_token = $1;

  if workspace_owner_id is null then
    return;
  end if;

  perform public.assert_within_geofence(workspace_owner_id, visitor_lat, visitor_lng);

  select h.* into matched_host
  from public.employee_hosts as h
  where h.owner_id = workspace_owner_id
    and h.active
    and lower(h.name) = lower(btrim(visitor_host));

  if matched_host.id is null then
    raise exception 'Choose an employee from the company host directory.';
  end if;

  return query
    insert into public.guests (
      owner_id,
      host_id,
      name,
      first_name,
      middle_name,
      last_name,
      email,
      phone,
      company,
      host_name,
      purpose,
      status,
      checked_in_at
    )
    values (
      workspace_owner_id,
      matched_host.id,
      visitor_full_name,
      btrim(visitor_first_name),
      nullif(btrim(visitor_middle_name), ''),
      btrim(visitor_last_name),
      lower(nullif(btrim(visitor_email), '')),
      btrim(visitor_phone),
      btrim(visitor_company),
      matched_host.name,
      btrim(visit_purpose),
      'pending_approval',
      null
    )
    returning public.guests.name, public.guests.company, public.guests.host_name,
      public.guests.status, public.guests.checked_in_at, public.guests.visit_token;
end;
$$;
