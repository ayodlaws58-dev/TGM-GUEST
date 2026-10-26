-- Visitor registration now goes through /api/visitors/register, which verifies Cloudflare Turnstile
-- (or a reception staff session) and calls this function with the service role. Remove direct browser
-- access so the CAPTCHA cannot be bypassed by calling the Supabase RPC with the public anon key.
--
-- Deploy the app changes BEFORE applying this migration, otherwise check-in will fail in between.
revoke execute on function public.register_visitor_by_qr(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_visitor_by_qr(uuid, text, text, text, text, text, text, text, text) to service_role;
