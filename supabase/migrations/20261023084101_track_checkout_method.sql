alter table public.guests add column if not exists checkout_method text;
alter table public.guests drop constraint if exists guests_checkout_method_check;
alter table public.guests
  add constraint guests_checkout_method_check
  check (checkout_method is null or checkout_method in ('self', 'assisted'));

-- Visits checked out before this column existed are reported as assisted because the method was not recorded.
update public.guests set checkout_method = 'assisted' where status = 'checked_out' and checkout_method is null;

-- Checkouts that do not explicitly say 'self' (the visitor flows below) were done by staff.
create or replace function public.set_guest_checkout_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'checked_out' then
    if tg_op = 'INSERT' or old.status is distinct from 'checked_out' then
      new.checkout_method := coalesce(new.checkout_method, 'assisted');
    end if;
  else
    new.checkout_method := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_guest_checkout_method on public.guests;
create trigger set_guest_checkout_method
  before insert or update on public.guests
  for each row execute function public.set_guest_checkout_method();

create or replace function public.checkout_visit(visit_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guests as g
  set status = 'checked_out',
      checked_out_at = now(),
      checkout_method = 'self'
  where g.visit_token = $1
    and g.status = 'checked_in';
  return found;
end;
$$;

revoke all on function public.checkout_visit(uuid) from public;
grant execute on function public.checkout_visit(uuid) to anon, authenticated;

create or replace function public.verify_self_checkout_code(
  challenge_id uuid,
  verification_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout_challenge public.self_checkout_challenges%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the server can verify self-checkout codes.';
  end if;

  select c.* into checkout_challenge
  from public.self_checkout_challenges as c
  where c.id = $1
  for update;

  if checkout_challenge.id is null
    or checkout_challenge.consumed_at is not null
    or checkout_challenge.expires_at <= now()
    or checkout_challenge.attempts >= 6
  then
    return false;
  end if;

  if checkout_challenge.code_hash <> $2 then
    update public.self_checkout_challenges
    set attempts = attempts + 1
    where id = checkout_challenge.id;
    return false;
  end if;

  update public.guests
  set status = 'checked_out',
      checked_out_at = now(),
      checkout_method = 'self'
  where id = checkout_challenge.guest_id
    and owner_id = checkout_challenge.owner_id
    and status = 'checked_in';

  if not found then
    update public.self_checkout_challenges
    set consumed_at = now()
    where id = checkout_challenge.id;
    return false;
  end if;

  update public.self_checkout_challenges
  set consumed_at = now()
  where id = checkout_challenge.id;

  return true;
end;
$$;

revoke all on function public.verify_self_checkout_code(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_self_checkout_code(uuid, text) to service_role;
