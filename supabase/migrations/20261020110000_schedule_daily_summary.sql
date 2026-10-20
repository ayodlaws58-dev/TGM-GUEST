create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Reads the target URL and shared secret from Supabase Vault so neither is committed.
-- One-time setup (SQL editor):
--   select vault.create_secret('https://YOUR-SITE/api/daily-summary', 'daily_summary_url');
--   select vault.create_secret('SAME-VALUE-AS-CRON_SECRET', 'daily_summary_secret');
create or replace function public.trigger_daily_summary()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_url text;
  shared_secret text;
begin
  select decrypted_secret into target_url from vault.decrypted_secrets where name = 'daily_summary_url';
  select decrypted_secret into shared_secret from vault.decrypted_secrets where name = 'daily_summary_secret';
  if target_url is null or shared_secret is null then
    raise exception 'Set the daily_summary_url and daily_summary_secret vault secrets first.';
  end if;

  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || shared_secret),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.trigger_daily_summary() from public, anon, authenticated;

-- 16:00 UTC = 5:00 PM West Africa Time (UTC+1, no daylight saving).
select cron.schedule('daily-visitor-summary', '0 16 * * *', $$select public.trigger_daily_summary()$$);
