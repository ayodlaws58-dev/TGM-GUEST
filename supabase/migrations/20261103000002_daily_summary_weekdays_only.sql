-- The 5:00 PM West Africa Time summary should only run Monday to Friday.
-- 20261020110000 was edited after it had been applied, so the live schedule never changed: update the job here.
-- (16:00 UTC; days 1-5, where 0 = Sunday and 6 = Saturday.)
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'daily-visitor-summary'),
  schedule := '0 16 * * 1-5'
);
