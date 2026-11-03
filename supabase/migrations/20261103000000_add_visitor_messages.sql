-- Create visitor messages table
create table if not exists public.visitor_messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  message_type text not null check (message_type in ('not_available', 'busy', 'need_time')),
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_notified_at timestamptz
);

create index if not exists visitor_messages_guest_id_idx on public.visitor_messages (guest_id);
create index if not exists visitor_messages_status_idx on public.visitor_messages (status);
create index if not exists visitor_messages_created_at_idx on public.visitor_messages (created_at desc);

alter table public.visitor_messages enable row level security;

create policy "Organizers can read their visitor messages"
  on public.visitor_messages for select
  using (auth.uid() = owner_id);

create policy "Organizers can approve/reject messages"
  on public.visitor_messages for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Reception can read messages"
  on public.visitor_messages for select
  using (public.is_reception_member(owner_id));

create policy "Reception can read messages for their workspace"
  on public.visitor_messages for select
  using (auth.uid() = owner_id or public.is_reception_member(owner_id));

-- Function to get pending messages
create or replace function public.get_pending_visitor_messages()
returns table(
  id uuid,
  guest_id uuid,
  guest_name text,
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
    select vm.id, vm.guest_id, g.name, vm.message_type, vm.message, vm.status, vm.created_at
    from public.visitor_messages as vm
    join public.guests as g on g.id = vm.guest_id
    where vm.owner_id = current_user_id
    order by vm.created_at desc;
end;
$$;

revoke all on function public.get_pending_visitor_messages() from public;
grant execute on function public.get_pending_visitor_messages() to authenticated;

-- Function to approve a message
create or replace function public.approve_visitor_message(message_id uuid)
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
  from public.visitor_messages
  where id = message_id;

  if workspace_owner_id is null or workspace_owner_id <> current_user_id then
    raise exception 'You do not have permission to approve this message.';
  end if;

  return query
    update public.visitor_messages
    set status = 'approved', approved_at = now(), approved_by = current_user_id, last_notified_at = now()
    where id = message_id
    returning id, status, approved_at;
end;
$$;

revoke all on function public.approve_visitor_message(uuid) from public;
grant execute on function public.approve_visitor_message(uuid) to authenticated;

-- Function to reject a message
create or replace function public.reject_visitor_message(message_id uuid)
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
  from public.visitor_messages
  where id = message_id;

  if workspace_owner_id is null or workspace_owner_id <> current_user_id then
    raise exception 'You do not have permission to reject this message.';
  end if;

  return query
    update public.visitor_messages
    set status = 'rejected'
    where id = message_id
    returning id, status;
end;
$$;

revoke all on function public.reject_visitor_message(uuid) from public;
grant execute on function public.reject_visitor_message(uuid) to authenticated;
