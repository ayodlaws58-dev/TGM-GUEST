-- Tighten EXECUTE on SECURITY DEFINER functions flagged by the Supabase security advisor.
-- `revoke ... from public` does not remove the direct grants Supabase gives anon/authenticated
-- on new functions in the public schema, so revoke them explicitly.

-- Staff-only functions: signed-in users only.
revoke execute on function public.get_my_reception_access() from anon;
revoke execute on function public.get_or_create_reception_workspace() from anon, authenticated;
revoke execute on function public.list_reception_team() from anon;
revoke execute on function public.is_reception_member(uuid) from anon;

-- Trigger functions are never meant to be called over the API.
revoke execute on function public.protect_reception_guest_inserts() from public, anon, authenticated;
revoke execute on function public.protect_reception_guest_updates() from public, anon, authenticated;

-- Intentionally left callable by anon (QR check-in flow):
--   get_reception_company_by_qr, get_reception_hosts_by_qr, register_visitor_by_qr
