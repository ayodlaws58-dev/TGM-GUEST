-- Host availability messages: an employee host's "not available / busy / need time" note,
-- approved or rejected by the workspace administrator.
create table if not exists public.host_messages (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.employee_hosts (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  message_type text not null check (message_type in ('not_available', 'busy', 'need_time')),
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_notified_at timestamptz
);

create index if not exists host_messages_host_id_idx on public.host_messages (host_id);
create index if not exists host_messages_status_idx on public.host_messages (status);
create index if not exists host_messages_created_at_idx on public.host_messages (created_at desc);

alter table public.host_messages enable row level security;

drop policy if exists "Organizers can read their host messages" on public.host_messages;
create policy "Organizers can read their host messages"
  on public.host_messages for select
  using (auth.uid() = owner_id);

drop policy if exists "Organizers can approve/reject messages" on public.host_messages;
create policy "Organizers can approve/reject messages"
  on public.host_messages for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Reception can read messages" on public.host_messages;
create policy "Reception can read messages"
  on public.host_messages for select
  using (public.is_reception_member(owner_id));

-- The functions below keep the argument names the app calls them with (host_id, message_type,
-- message, message_id). Parameters are referenced as function_name.parameter, and column names are
-- always table-qualified, so they cannot clash with the output columns.

create or replace function public.get_pending_host_messages()
returns table(
  id uuid,
  host_id uuid,
  host_name text,
  message_type text,
  message text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Sign in to view messages.';
  end if;

  return query
    select hm.id, hm.host_id, h.name, hm.message_type, hm.message, hm.status, hm.created_at
    from public.host_messages as hm
    join public.employee_hosts as h on h.id = hm.host_id
    where hm.owner_id = auth.uid()
    order by hm.created_at desc;
end;
$$;

revoke all on function public.get_pending_host_messages() from public;
grant execute on function public.get_pending_host_messages() to authenticated;

-- Returns the saved row (setof host_messages) rather than a custom table: a RETURNS TABLE column named
-- message_type or message would clash with the argument names the app calls this function with.
create or replace function public.submit_host_message(host_id uuid, message_type text, message text)
returns setof public.host_messages
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  host_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to submit a message.';
  end if;

  if submit_host_message.message_type is null
    or submit_host_message.message_type not in ('not_available', 'busy', 'need_time') then
    raise exception 'Choose a valid message type.';
  end if;

  if char_length(btrim(coalesce(submit_host_message.message, ''))) not between 1 and 1000 then
    raise exception 'Enter a message of up to 1000 characters.';
  end if;

  select eh.owner_id into host_owner_id
  from public.employee_hosts as eh
  where eh.id = submit_host_message.host_id and eh.active;

  if host_owner_id is null or host_owner_id <> auth.uid() then
    raise exception 'You do not have permission to submit a message for this host.';
  end if;

  return query
    insert into public.host_messages as hm (host_id, owner_id, message_type, message)
    values (submit_host_message.host_id, auth.uid(), submit_host_message.message_type, btrim(submit_host_message.message))
    returning hm.*;
end;
$$;

revoke all on function public.submit_host_message(uuid, text, text) from public;
grant execute on function public.submit_host_message(uuid, text, text) to authenticated;

create or replace function public.approve_host_message(message_id uuid)
returns table(
  id uuid,
  status text,
  approved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  message_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to approve messages.';
  end if;

  select hm.owner_id into message_owner_id
  from public.host_messages as hm
  where hm.id = approve_host_message.message_id;

  if message_owner_id is null or message_owner_id <> auth.uid() then
    raise exception 'You do not have permission to approve this message.';
  end if;

  return query
    update public.host_messages as hm
    set status = 'approved', approved_at = now(), approved_by = auth.uid(), last_notified_at = now()
    where hm.id = approve_host_message.message_id
    returning hm.id, hm.status, hm.approved_at;
end;
$$;

revoke all on function public.approve_host_message(uuid) from public;
grant execute on function public.approve_host_message(uuid) to authenticated;

create or replace function public.reject_host_message(message_id uuid)
returns table(
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  message_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to reject messages.';
  end if;

  select hm.owner_id into message_owner_id
  from public.host_messages as hm
  where hm.id = reject_host_message.message_id;

  if message_owner_id is null or message_owner_id <> auth.uid() then
    raise exception 'You do not have permission to reject this message.';
  end if;

  return query
    update public.host_messages as hm
    set status = 'rejected'
    where hm.id = reject_host_message.message_id
    returning hm.id, hm.status;
end;
$$;

revoke all on function public.reject_host_message(uuid) from public;
grant execute on function public.reject_host_message(uuid) to authenticated;
