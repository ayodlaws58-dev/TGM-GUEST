alter table public.workspaces
  add column geofence_lat double precision,
  add column geofence_lng double precision,
  add column geofence_radius_m integer not null default 30;

alter table public.workspaces
  add constraint workspaces_geofence_lat_check check (geofence_lat is null or geofence_lat between -90 and 90),
  add constraint workspaces_geofence_lng_check check (geofence_lng is null or geofence_lng between -180 and 180),
  add constraint workspaces_geofence_radius_check check (geofence_radius_m between 5 and 5000),
  add constraint workspaces_geofence_pair_check check ((geofence_lat is null) = (geofence_lng is null));

create function public.geofence_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- Workspaces without a saved office location are not restricted.
create function public.assert_within_geofence(workspace_owner_id uuid, user_lat double precision, user_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fence public.workspaces%rowtype;
begin
  select w.* into fence from public.workspaces as w where w.owner_id = workspace_owner_id;
  if fence.geofence_lat is null then
    return;
  end if;
  if user_lat is null or user_lng is null
    or user_lat not between -90 and 90
    or user_lng not between -180 and 180
  then
    raise exception 'Allow location access in your browser so we can confirm you are at the office, then try again.';
  end if;
  if public.geofence_distance_m(fence.geofence_lat, fence.geofence_lng, user_lat, user_lng) > fence.geofence_radius_m then
    raise exception 'You must be at the office (within % meters) to do this. Please see reception for help.', fence.geofence_radius_m;
  end if;
end;
$$;

revoke all on function public.assert_within_geofence(uuid, double precision, double precision) from public, anon, authenticated;

create function public.is_within_reception_geofence(reception_token uuid, user_lat double precision, user_lng double precision)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_owner_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the server can check the geofence.';
  end if;
  select w.owner_id into workspace_owner_id from public.workspaces as w where w.reception_token = $1;
  if workspace_owner_id is null then
    return true;
  end if;
  begin
    perform public.assert_within_geofence(workspace_owner_id, user_lat, user_lng);
  exception when raise_exception then
    return false;
  end;
  return true;
end;
$$;

revoke all on function public.is_within_reception_geofence(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.is_within_reception_geofence(uuid, double precision, double precision) to service_role;

drop function public.register_visitor_by_qr(uuid, text, text, text, text, text, text, text, text);

create function public.register_visitor_by_qr(
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
  visitor_full_name := concat_ws(
    ' ',
    nullif(btrim(visitor_first_name), ''),
    nullif(btrim(visitor_middle_name), ''),
    nullif(btrim(visitor_last_name), '')
  );

  if visitor_first_name is null
    or visitor_last_name is null
    or visitor_email is null
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
    or char_length(btrim(visitor_email)) > 254
    or visitor_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
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
      lower(btrim(visitor_email)),
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

revoke all on function public.register_visitor_by_qr(uuid, text, text, text, text, text, text, text, text, double precision, double precision) from public;
grant execute on function public.register_visitor_by_qr(uuid, text, text, text, text, text, text, text, text, double precision, double precision) to anon, authenticated;

drop function public.checkout_visit(uuid);

create function public.checkout_visit(visit_token uuid, user_lat double precision default null, user_lng double precision default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit_owner_id uuid;
begin
  select g.owner_id into visit_owner_id
  from public.guests as g
  where g.visit_token = $1 and g.status = 'checked_in';

  if visit_owner_id is null then
    return false;
  end if;

  perform public.assert_within_geofence(visit_owner_id, user_lat, user_lng);

  update public.guests as g
  set status = 'checked_out',
      checked_out_at = now()
  where g.visit_token = $1
    and g.status = 'checked_in';
  return found;
end;
$$;

revoke all on function public.checkout_visit(uuid, double precision, double precision) from public;
grant execute on function public.checkout_visit(uuid, double precision, double precision) to anon, authenticated;
