-- Create host availability messages table
create table if not exists public.host_messages (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.employee_hosts (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  message_type text not null check (message_type in ('not_available', 'busy', 'need_time')),
  message text not null,
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

create policy "Organizers can read their host messages"
  on public.host_messages for select
  using (auth.uid() = owner_id);

create policy "Organizers can approve/reject messages"
  on public.host_messages for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Reception can read messages"
  on public.host_messages for select
  using (public.is_reception_member(owner_id));

-- Function to get pending host messages
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
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in to view messages.';
  end if;

  return query
    select hm.id, hm.host_id, h.name, hm.message_type, hm.message, hm.status, hm.created_at
    from public.host_messages as hm
    join public.employee_hosts as h on h.id = hm.host_id
    where hm.owner_id = current_user_id
    order by hm.created_at desc;
end;
$$;

revoke all on function public.get_pending_host_messages() from public;
grant execute on function public.get_pending_host_messages() to authenticated;

-- Function to submit a host message
create or replace function public.submit_host_message(host_id uuid, message_type text, message text)
returns table(
  id uuid,
  host_name text,
  message_type text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  workspace_owner_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to submit a message.';
  end if;

  select owner_id into workspace_owner_id
  from public.employee_hosts
  where id = host_id;

  if workspace_owner_id is null or workspace_owner_id <> current_user_id then
    raise exception 'You do not have permission to submit a message for this host.';
  end if;

  return query
    insert into public.host_messages (host_id, owner_id, message_type, message)
    values (host_id, current_user_id, message_type, message)
    returning hm.id, (select h.name from public.employee_hosts h where h.id = host_id), hm.message_type, hm.status
    from public.host_messages hm
    limit 1;
end;
$$;

revoke all on function public.submit_host_message(uuid, text, text) from public;
grant execute on function public.submit_host_message(uuid, text, text) to authenticated;

-- Function to approve a message
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
declare
  current_user_id uuid := auth.uid();
  workspace_owner_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to approve messages.';
  end if;

  select owner_id into workspace_owner_id
  from public.host_messages
  where id = message_id;

  if workspace_owner_id is null or workspace_owner_id <> current_user_id then
    raise exception 'You do not have permission to approve this message.';
  end if;

  return query
    update public.host_messages
    set status = 'approved', approved_at = now(), approved_by = current_user_id, last_notified_at = now()
    where id = message_id
    returning id, status, approved_at;
end;
$$;

revoke all on function public.approve_host_message(uuid) from public;
grant execute on function public.approve_host_message(uuid) to authenticated;

-- Function to reject a message
create or replace function public.reject_host_message(message_id uuid)
returns table(
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  workspace_owner_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to reject messages.';
  end if;

  select owner_id into workspace_owner_id
  from public.host_messages
  where id = message_id;

  if workspace_owner_id is null or workspace_owner_id <> current_user_id then
    raise exception 'You do not have permission to reject this message.';
  end if;

  return query
    update public.host_messages
    set status = 'rejected'
    where id = message_id
    returning id, status;
end;
$$;

revoke all on function public.reject_host_message(uuid) from public;
grant execute on function public.reject_host_message(uuid) to authenticated;
